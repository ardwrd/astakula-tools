import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import JSZip from "jszip";

const root = path.resolve(fileURLToPath(new URL("../../", import.meta.url)));
const qaDir = path.join(root, "qa");
const sheetjsUrl = "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";
const assetMime = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg"
};
let browser, server, origin, sheetjs, brutCss, jszip, jspdf;

before(async () => {
  // Cache pinned production libraries before opening pages; each test uses real library code.
  const [s, css, zip, pdf] = await Promise.all([
    fetch(sheetjsUrl, { signal: AbortSignal.timeout(30000) }),
    fetch("https://cdn.jsdelivr.net/npm/@sprtn/ui@1.3.2/dist/brut.css", { signal: AbortSignal.timeout(30000) }),
    readFile(path.join(qaDir, "node_modules/jszip/dist/jszip.min.js")),
    readFile(path.join(qaDir, "node_modules/jspdf/dist/jspdf.umd.min.js"))
  ]);
  assert.equal(s.status, 200, "Pinned SheetJS CDN should be available");
  assert.equal(css.status, 200, "Pinned BRUT CSS should be available");
  sheetjs = await s.text();
  brutCss = await css.text();
  jszip = zip;
  jspdf = pdf;
  server = createServer(async (request, response) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname); }
    catch { response.writeHead(400).end("Bad request"); return; }
    const target = path.resolve(root, "." + pathname, pathname.endsWith("/") ? "index.html" : "");
    if (target !== root && !target.startsWith(root + path.sep)) {
      response.writeHead(403).end("Forbidden"); return;
    }
    try {
      const bytes = await readFile(target);
      response.writeHead(200, { "Content-Type": assetMime[path.extname(target)] || "application/octet-stream", "Cache-Control": "no-store" });
      response.end(bytes);
    } catch { response.writeHead(404).end("Not found"); }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  origin = "http://127.0.0.1:" + server.address().port;
  browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
});

after(async () => {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
});

async function openTool(tool, options = {}) {
  const page = await browser.newPage({ acceptDownloads: true, ...options });
  const errors = [];
  page.on("pageerror", error => errors.push(String(error)));
  await page.route("https://**/*", async route => {
    const url = route.request().url();
    if (url === sheetjsUrl) {
      await route.fulfill({ status: 200, contentType: "text/javascript", body: sheetjs });
    } else if (url.includes("/@sprtn/ui@1.3.2/dist/brut.css")) {
      await route.fulfill({ status: 200, contentType: "text/css", body: brutCss });
    } else if (url.includes("/jszip@3.10.1/dist/jszip.min.js")) {
      await route.fulfill({ status: 200, contentType: "text/javascript", body: jszip });
    } else if (url.includes("/jspdf@2.5.2/dist/jspdf.umd.min.js")) {
      await route.fulfill({ status: 200, contentType: "text/javascript", body: jspdf });
    } else {
      // Font downloads are optional. Their failures exercise the system-font fallback.
      await route.abort();
    }
  });
  await page.goto(origin + "/" + tool + "/", { waitUntil: "load" });
  return { page, errors };
}

async function pngFixture(page, width = 160, height = 110) {
  const encoded = await page.evaluate(({ width, height }) => {
    const c = document.createElement("canvas"); c.width = width; c.height = height;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#eb5f4b"; ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#122d29"; ctx.fillRect(20, 20, width - 40, height - 40);
    return c.toDataURL("image/png").split(",")[1];
  }, { width, height });
  return Buffer.from(encoded, "base64");
}

async function downloadedBytes(page, action) {
  // Handle rejection immediately so a missing download reports the UI's error,
  // rather than producing an unhandled rejection after the browser closes.
  const pending = page.waitForEvent("download", { timeout: 8000 }).then(
    download => ({ download }), error => ({ error })
  );
  await action();
  const outcome = await pending;
  if (outcome.error) {
    const status = await page.locator("#statusBox").textContent().catch(() => "");
    throw new Error(String(outcome.error.message) + " (tool status: " + status + ")");
  }
  const download = outcome.download;
  const dir = await mkdtemp(path.join(tmpdir(), "astakula-tool-qa-"));
  try {
    const output = path.join(dir, download.suggestedFilename());
    await download.saveAs(output);
    return { filename: download.suggestedFilename(), bytes: await readFile(output) };
  } finally { await rm(dir, { recursive: true, force: true }); }
}

test("Excel: import XLSX, render a preview and export CSV with actual cells", async () => {
  const { page, errors } = await openTool("excel");
  try {
    assert.equal(await page.evaluate(() => window.XLSX?.version), "0.20.3");
    const content = await page.evaluate(() => {
      const sheet = XLSX.utils.aoa_to_sheet([["Nama", "Jumlah"], ["Pelanggan A", 13], ["Pelanggan B", 21]]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, sheet, "Data");
      return Array.from(new Uint8Array(XLSX.write(wb, { bookType: "xlsx", type: "array" })));
    });
    assert.ok(content.length > 1000, "Expected non-empty XLSX binary fixture");
    await page.locator("#sourceInput").setInputFiles({
      name: "report.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: Buffer.from(content)
    });
    await page.waitForFunction(() => document.querySelector("#fileName")?.textContent === "report.xlsx");
    assert.match(await page.locator("#previewTable").innerText(), /Pelanggan B/);
    await page.locator('[data-mode="convert"]').click();
    const result = await downloadedBytes(page, () => page.locator("#exportCsvButton").click());
    assert.match(result.filename, /\.csv$/);
    assert.match(result.bytes.toString("utf8"), /Pelanggan A,13/);
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});

test("Image: convert a PNG to JPEG and download a readable image", async () => {
  const { page, errors } = await openTool("image");
  try {
    const png = await pngFixture(page);
    await page.locator("#imageInput").setInputFiles({ name: "fixture.png", mimeType: "image/png", buffer: png });
    await page.locator('[data-tab="convert"]').click();
    await page.locator("#convertFormat").selectOption("image/jpeg");
    await page.locator("#processButton").click();
    await page.locator(".result-card").first().waitFor({ state: "visible" });
    const result = await downloadedBytes(page, () => page.locator(".result-card .result-download button").first().click());
    assert.match(result.filename, /\.jpe?g$/);
    assert.equal(result.bytes[0], 0xff);
    assert.equal(result.bytes[1], 0xd8);
    assert.equal(result.bytes[2], 0xff);
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});

test("Certificate: image template, sample data, dynamic field and PNG ZIP batch", async () => {
  const { page, errors } = await openTool("certificate");
  try {
    assert.equal(await page.evaluate(() => window.XLSX?.version), "0.20.3");
    const template = await pngFixture(page, 400, 260);
    await page.locator("#templateInput").setInputFiles({ name: "certificate.png", mimeType: "image/png", buffer: template });
    await page.waitForFunction(() => document.querySelector("#templateState")?.textContent === "Ready");
    await page.locator("#sampleButton").click();
    await page.locator("#editorSection").waitFor({ state: "visible" });
    await page.locator('#fieldButtons [data-add-field="Name"]').click();
    await page.waitForFunction(() => !document.querySelector("#generateZipButton").disabled);
    const download = await downloadedBytes(page, () => page.locator("#generateZipButton").click());
    assert.match(download.filename, /\.zip$/);
    const zip = await JSZip.loadAsync(download.bytes);
    const images = Object.keys(zip.files).filter(name => name.endsWith(".png"));
    assert.equal(images.length, 3);
    for (const filename of images) {
      const png = await zip.files[filename].async("uint8array");
      assert.deepEqual(Array.from(png.slice(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10]);
    }
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});

for (const name of ["excel", "image", "certificate"]) {
  test(name + ": mobile 375px has no page-level horizontal overflow", async () => {
    const { page, errors } = await openTool(name, {
      viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true
    });
    try {
      const layout = await page.evaluate(() => ({
        viewport: window.innerWidth,
        page: document.documentElement.scrollWidth,
        body: document.body.scrollWidth
      }));
      assert.ok(layout.page <= layout.viewport + 2, JSON.stringify(layout));
      assert.ok(layout.body <= layout.viewport + 2, JSON.stringify(layout));
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
  });
}
