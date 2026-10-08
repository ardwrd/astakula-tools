import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdtemp, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import * as PDFLib from "pdf-lib";
import JSZip from "jszip";

const root = path.resolve(fileURLToPath(new URL("../../", import.meta.url)));
const pdfDir = path.join(root, "pdf");
const mime = {".html":"text/html", ".css":"text/css", ".js":"text/javascript", ".mjs":"text/javascript", ".svg":"image/svg+xml"};
const vendor = [
  [/\/@sprtn\/ui@.*\/dist\/brut\.css/, null, "text/css"],
  [/\/pdf-lib@.*\/dist\/pdf-lib\.min\.js/, "pdf-lib/dist/pdf-lib.min.js", "text/javascript"],
  [/\/jszip@.*\/dist\/jszip\.min\.js/, "jszip/dist/jszip.min.js", "text/javascript"],
  [/\/pdfjs-dist@.*\/build\/pdf\.min\.mjs/, "pdfjs-dist/build/pdf.min.mjs", "text/javascript"],
  [/\/pdfjs-dist@.*\/build\/pdf\.worker\.min\.mjs/, "pdfjs-dist/build/pdf.worker.min.mjs", "text/javascript"]
];
let server, browser, address;

before(async () => {
  server = createServer(async (request, response) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname); }
    catch { response.writeHead(400).end(); return; }
    const target = path.resolve(root, "." + pathname, pathname.endsWith("/") ? "index.html" : "");
    if (target !== root && !target.startsWith(root + path.sep)) {
      response.writeHead(403).end(); return;
    }
    try {
      const data = await readFile(target);
      response.writeHead(200, {"Content-Type":mime[path.extname(target)]||"application/octet-stream",
        "Cache-Control":"no-store"});
      response.end(data);
    } catch {
      response.writeHead(404).end("Not found");
    }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  address = "http://127.0.0.1:" + server.address().port;
  browser = await chromium.launch({headless:true, args:["--no-sandbox"]});
});

after(async () => {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
});

async function fixturePdf(count=3) {
  const pdf=await PDFLib.PDFDocument.create();
  for(let i=0;i<count;i++){
    const page=pdf.addPage([300+i,400+i]);
    page.drawText("Astakula page " + (i+1),{x:30,y:350,size:14});
  }
  return Buffer.from(await pdf.save());
}

async function launchPage(options = {}) {
  const page = await browser.newPage({acceptDownloads:true, ...options});
  const errors=[];
  page.on("pageerror", e=>errors.push(String(e)));
  await page.route("https://cdn.jsdelivr.net/**", async route => {
    const pathname = new URL(route.request().url()).pathname;
    const selected = vendor.find(([pattern])=>pattern.test(pathname));
    if(!selected){await route.abort();return;}
    if(!selected[1]) {await route.fulfill({status:200,contentType:selected[2],body:""});return;}
    const file = path.join(pdfDir,"node_modules",selected[1]);
    const bytes = await readFile(file);
    await route.fulfill({status:200,contentType:selected[2],body:bytes});
  });
  await page.goto(address+"/pdf/",{waitUntil:"load"});
  await page.waitForFunction(() => !!window.AstakulaPDF && !!window.JSZip && document.documentElement.dataset.pdfToolsReady === "true");
  return {page,errors};
}

async function loadFile(page, mode, bytes) {
  await page.locator('[data-mode="'+mode+'"]').click();
  await page.locator("#"+mode+"Input").setInputFiles({
    name:"test-document.pdf",mimeType:"application/pdf",buffer:bytes
  });
  await page.waitForFunction(mode => {
    const el=document.getElementById(mode+"Meta");
    return !!el && /pages?/.test(el.textContent);
  },mode);
}

async function runDownload(page, button) {
  const downloadWait=page.waitForEvent("download",{timeout:45000});
  await page.locator("#"+button).click();
  await page.locator("#downloadButton").waitFor({state:"visible"});
  await page.locator("#downloadButton").click();
  const download=await downloadWait;
  const temp=await mkdtemp(path.join(tmpdir(),"astakula-pdf-"));
  const destination=path.join(temp,download.suggestedFilename());
  await download.saveAs(destination);
  const bytes=await readFile(destination);
  await rm(temp,{recursive:true,force:true});
  return {bytes,name:download.suggestedFilename()};
}

test("tool cards, dark mode, filtering and privacy are functional", async () => {
  const {page,errors}=await launchPage();
  try {
    assert.equal(await page.locator('[data-tool-select]').count(),10);
    await page.locator("#toolSearch").fill("watermark");
    assert.equal(await page.locator('[data-tool-card]:not(.hidden)').count(),1);
    await page.locator("#toolSearch").clear();
    await page.locator('[data-catalog-filter="convert"]').click();
    assert.equal(await page.locator('[data-tool-card]:not(.hidden)').count(),3);
    await page.locator('[data-catalog-filter="all"]').click();
    await page.locator('[data-tool-select="watermark"]').click();
    assert.equal(await page.locator('#watermarkPanel').isVisible(),true);
    assert.equal(await page.locator('#mergePanel').isVisible(),false);
    await page.locator('[data-theme-toggle]').first().click();
    assert.equal(await page.locator("html").getAttribute("data-theme"),"dark");
    const foreground = await page.locator('[data-tool-select="merge"]').evaluate(el => getComputedStyle(el).color);
    assert.equal(foreground, "rgb(245, 241, 233)", "unselected cards must have light text in dark mode");
    await mkdir(path.join(pdfDir,"artifacts"),{recursive:true});
    await page.screenshot({path:path.join(pdfDir,"artifacts","toolhub-desktop.png"),fullPage:true});
    assert.deepEqual(errors,[]);
  } finally {await page.close();}
});

test("original merge, extract, reorder, rotate still produce valid PDFs", async () => {
  const {page,errors}=await launchPage();
  try {
    const bytes=await fixturePdf(3);
    await page.locator("#mergeInput").setInputFiles([
      {name:"a.pdf",mimeType:"application/pdf",buffer:bytes},
      {name:"b.pdf",mimeType:"application/pdf",buffer:bytes}
    ]);
    const merged=await runDownload(page,"mergeButton");
    assert.equal((await PDFLib.PDFDocument.load(merged.bytes)).getPageCount(),6);
    await loadFile(page,"extract",bytes);
    await page.locator("#extractPages").fill("1,3");
    assert.equal((await PDFLib.PDFDocument.load((await runDownload(page,"extractButton")).bytes)).getPageCount(),2);
    await loadFile(page,"reorder",bytes);
    await page.locator("#reorderPages").fill("3,1,2");
    assert.equal((await PDFLib.PDFDocument.load((await runDownload(page,"reorderButton")).bytes)).getPageCount(),3);
    await loadFile(page,"rotate",bytes);
    assert.equal((await PDFLib.PDFDocument.load((await runDownload(page,"rotateButton")).bytes)).getPage(0).getRotation().angle,90);
    assert.deepEqual(errors,[]);
  }finally{await page.close();}
});

test("split and remove deliver valid page contents", async () => {
  const {page,errors}=await launchPage();
  try {
    const bytes=await fixturePdf(3);
    await loadFile(page,"split",bytes);
    const zip=await JSZip.loadAsync((await runDownload(page,"splitButton")).bytes);
    const names=Object.keys(zip.files).filter(x=>x.endsWith(".pdf")).sort();
    assert.deepEqual(names,["page-001.pdf","page-002.pdf","page-003.pdf"]);
    for(const name of names) {
      const part=await zip.files[name].async("uint8array");
      assert.equal((await PDFLib.PDFDocument.load(part)).getPageCount(),1);
    }
    await loadFile(page,"remove",bytes);
    await page.locator("#removePages").fill("2");
    assert.equal((await PDFLib.PDFDocument.load((await runDownload(page,"removeButton")).bytes)).getPageCount(),2);
    assert.deepEqual(errors,[]);
  }finally{await page.close();}
});

test("image conversion and PDF rasterization produce readable outputs", async () => {
  const {page,errors}=await launchPage();
  try {
    const png=await page.evaluate(async()=>{
      const canvas=document.createElement("canvas");canvas.width=80;canvas.height=60;
      const ctx=canvas.getContext("2d");ctx.fillStyle="#ff4477";ctx.fillRect(0,0,80,60);
      return [...new Uint8Array(await (await new Promise(resolve=>canvas.toBlob(resolve,"image/png"))).arrayBuffer())];
    });
    await page.locator('[data-mode="images"]').click();
    await page.locator("#imagesInput").setInputFiles([{name:"pixel.png",mimeType:"image/png",buffer:Buffer.from(png)}]);
    assert.equal((await PDFLib.PDFDocument.load((await runDownload(page,"imagesButton")).bytes)).getPageCount(),1);
    await loadFile(page,"pdfpng",await fixturePdf(2));
    const output=await JSZip.loadAsync((await runDownload(page,"pdfpngButton")).bytes);
    assert.deepEqual(Object.keys(output.files).sort(),["page-001.png","page-002.png"]);
    for(const entry of Object.values(output.files)){
      const bytes=await entry.async("uint8array");
      assert.deepEqual([...bytes.slice(0,8)],[137,80,78,71,13,10,26,10]);
    }
    assert.deepEqual(errors,[]);
  }finally{await page.close();}
});

test("watermark and page numbers keep output PDF page counts", async () => {
  const {page,errors}=await launchPage();
  try {
    const bytes=await fixturePdf(2);
    await loadFile(page,"watermark",bytes);
    await page.locator("#watermarkText").fill("DRAFT");
    assert.equal((await PDFLib.PDFDocument.load((await runDownload(page,"watermarkButton")).bytes)).getPageCount(),2);
    await loadFile(page,"numbers",bytes);
    assert.equal((await PDFLib.PDFDocument.load((await runDownload(page,"numbersButton")).bytes)).getPageCount(),2);
    assert.deepEqual(errors,[]);
  }finally{await page.close();}
});


test("mobile viewport keeps the catalog usable and completes a split download", async () => {
  const {page,errors}=await launchPage({
    viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2
  });
  try {
    const layout=await page.evaluate(()=>({
      viewport:document.documentElement.clientWidth,
      content:document.documentElement.scrollWidth
    }));
    assert.ok(layout.content<=layout.viewport+4,"unexpected horizontal overflow: "+JSON.stringify(layout));
    assert.equal(await page.locator('[data-tool-select]').count(),10);
    await page.locator('[data-tool-select="split"]').click();
    assert.equal(await page.locator("#splitPanel").isVisible(),true);
    await loadFile(page,"split",await fixturePdf(2));
    const zip=await JSZip.loadAsync((await runDownload(page,"splitButton")).bytes);
    assert.equal(Object.keys(zip.files).filter(f=>f.endsWith(".pdf")).length,2);
    await page.locator('[data-catalog-filter="advanced"]').click();
    assert.equal(await page.locator('[data-tool-card]:not(.hidden)').count(),4);
    await page.locator('[data-catalog-filter="all"]').click();
    await mkdir(path.join(pdfDir,"artifacts"),{recursive:true});
    await page.screenshot({path:path.join(pdfDir,"artifacts","toolhub-mobile.png"),fullPage:true});
    assert.deepEqual(errors,[]);
  } finally {await page.close();}
});
