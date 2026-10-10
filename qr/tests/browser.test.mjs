import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { chromium } from "playwright";
import { listGenerators } from "../js/registry.js";
import { validateImageUrl, toBase64Url } from "../js/generators/image.js";

const root = path.resolve(fileURLToPath(new URL("../../", import.meta.url)));
const qrDir = path.join(root, "qr");
const types = {".html":"text/html",".js":"text/javascript",".css":"text/css",".svg":"image/svg+xml"};
let http, browser, base;

before(async () => {
    http = createServer(async (req,res) => {
        const url = new URL(req.url, "http://localhost");
        let name;
        try { name = decodeURIComponent(url.pathname); } catch { res.writeHead(400).end(); return; }
        const file = path.resolve(root, "."+name, name.endsWith("/")?"index.html":"");
        if (!file.startsWith(root+path.sep)) {res.writeHead(403).end();return;}
        try {
            const data=await readFile(file);
            res.writeHead(200,{"Content-Type":types[path.extname(file)]||"application/octet-stream"});
            res.end(data);
        } catch {res.writeHead(404).end();}
    });
    await new Promise(resolve=>http.listen(0,"127.0.0.1",resolve));
    base="http://127.0.0.1:"+http.address().port;
    browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
});

after(async()=>{await browser?.close();if(http)await new Promise(resolve=>http.close(resolve));});

async function newPage() {
    const page=await browser.newPage({acceptDownloads:true});
    const errors=[];
    page.on("pageerror",e=>errors.push(String(e)));
    await page.route("https://cdn.jsdelivr.net/**",async route=>{
        const url=route.request().url();
        if(url.includes("@sprtn/ui@")) {
            await route.fulfill({status:200,contentType:"text/css",body:""});
        } else if(url.includes("qrcode-generator@1.4.4/qrcode.js")) {
            const script=await readFile(path.join(qrDir,"node_modules","qrcode-generator","qrcode.js"));
            await route.fulfill({status:200,contentType:"text/javascript",body:script});
        } else await route.abort();
    });
    await page.goto(base+"/qr/",{waitUntil:"load"});
    await page.waitForFunction(()=>!!window.astakulaQrApp && !!window.qrcode);
    return {page,errors};
}

test("registry has all legacy QR generators plus Image to QR",()=>{
    assert.equal(listGenerators().length,11);
    assert.ok(listGenerators().some(g=>g.id==="image"));
    assert.equal(validateImageUrl("https://example.org/photo.png"),"https://example.org/photo.png");
    assert.throws(()=>validateImageUrl("data:image/png;base64,SGk="));
    assert.equal(toBase64Url("++//=="),"--__");
});

test("Image to QR supports externally hosted image links and existing URL mode",async()=>{
    const {page,errors}=await newPage();
    try {
        assert.equal(await page.locator('[data-generator-id]').count(),11);
        await page.locator('[data-generator-id="image"]').click();
        await page.locator('#qr-field-image-mode').selectOption("url");
        await page.locator('#qr-field-image-url').fill("https://example.org/image.jpg");
        await page.locator('#generateButton').click();
        await page.locator('#resultSection:not(.hidden)').waitFor();
        assert.equal(await page.locator('#payloadOutput').inputValue(),"https://example.org/image.jpg");
        assert.ok(await page.locator('#qrPreview canvas').count());
        await page.locator('[data-generator-id="url"]').click();
        await page.locator('#qr-field-url-url').fill("https://astakula.com/");
        await page.locator('#generateButton').click();
        await page.locator('#resultSection:not(.hidden)').waitFor();
        assert.equal(await page.locator('#payloadOutput').inputValue(),"https://astakula.com/");
        assert.deepEqual(errors,[]);
    } finally {await page.close();}
});

test("image upload produces QR with fully self-contained mini JPEG and viewable fragment",async()=>{
    const {page,errors}=await newPage();
    try {
        await page.locator('[data-generator-id="image"]').click();
        const png=await page.evaluate(async()=>{
            const canvas=document.createElement("canvas");
            canvas.width=100;canvas.height=90;
            const c=canvas.getContext("2d");
            c.fillStyle="#ff2255";c.fillRect(0,0,100,90);
            const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/png"));
            return [...new Uint8Array(await blob.arrayBuffer())];
        });
        await page.locator('#qr-field-image-image').setInputFiles({name:"test.png",mimeType:"image/png",buffer:Buffer.from(png)});
        await page.locator('#generateButton').click();
        await page.locator('#resultSection:not(.hidden)').waitFor({timeout:25000});
        const payload=await page.locator('#payloadOutput').inputValue();
        assert.match(payload,/^https:\/\/tools\.astakula\.com\/qr\/image\/#i=/);
        assert.ok(payload.length<1651);
        const model=await page.evaluate(()=>window.astakulaQrApp.qrRenderer.qrModel.getModuleCount());
        assert.ok(model>20);
        const fragment=payload.slice(payload.indexOf("#"));
        const viewer=await browser.newPage();
        try {
            await viewer.goto(base+"/qr/image/"+fragment);
            await viewer.locator('#viewerImage:not([hidden])').waitFor({timeout:10000});
            assert.match(await viewer.locator('#viewerImage').getAttribute("src"),/^data:image\/jpeg;base64,/);
            assert.equal(await viewer.locator('#viewerDownload').isVisible(),true);
        } finally {await viewer.close();}
        assert.deepEqual(errors,[]);
    } finally {await page.close();}
});

test("image mode rejects invalid input without affecting normal URL QR",async()=>{
    const {page,errors}=await newPage();
    try {
        await page.locator('[data-generator-id="image"]').click();
        await page.locator('#qr-field-image-image').setInputFiles({name:"bad.svg",mimeType:"image/svg+xml",buffer:Buffer.from("<svg/>")});
        await page.locator('#generateButton').click();
        await page.locator('#errorBox:not(.hidden)').waitFor();
        assert.match(await page.locator('#errorBox').textContent(),/JPG, PNG, dan WebP/);
        await page.locator('#resetButton').click();
        assert.equal(await page.locator('#qr-field-image-image').inputValue(),"");
        assert.deepEqual(errors,[]);
    } finally {await page.close();}
});

test("mobile Image to QR form remains usable and avoids horizontal overflow",async()=>{
    const {page,errors}=await newPage();
    try {
        await page.setViewportSize({width:390,height:844});
        await page.locator('[data-generator-id="image"]').click();
        const metrics=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
        assert.ok(metrics.scroll<=metrics.width+4,"horizontal overflow on mobile: "+JSON.stringify(metrics));
        assert.equal(await page.locator('#qr-field-image-image').isVisible(),true);
        await page.locator('#qr-field-image-mode').selectOption("url");
        assert.equal(await page.locator('#qr-field-image-image').isVisible(),false);
        assert.equal(await page.locator('#qr-field-image-url').isVisible(),true);
        assert.deepEqual(errors,[]);
    }finally{await page.close();}
});
