import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const extended = readFileSync(new URL("../js/extended-tools.mjs", import.meta.url), "utf8");
const expected = ["merge","extract","reorder","rotate","split","remove","images","pdfpng","watermark","numbers"];
test("each published tool has a tab, panel and catalog action", () => {
  for (const mode of expected) {
    assert.ok(html.includes('data-mode="' + mode + '"'), "missing tab: " + mode);
    assert.ok(html.includes('data-panel="' + mode + '"'), "missing panel: " + mode);
    assert.ok(html.includes('data-tool-select="' + mode + '"'), "missing card: " + mode);
  }
});
test("catalog only offers existing tools", () => {
  assert.equal((html.match(/data-tool-select=/g) || []).length, 10);
  assert.equal((html.match(/class="tool-card is-planned"/g) || []).length, 6);
  assert.ok(html.includes('id="toolSearch"'));
});
test("HTML ids remain unique", () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(ids.length, new Set(ids).size);
});
test("extended tools are wired after the legacy adapter", () => {
  assert.ok(html.indexOf('src="./js/app.js?v=2"') < html.indexOf('src="./js/extended-tools.mjs?v=1"'));
  for (const mode of ["split","remove","images","pdfpng","watermark","numbers"]) {
    assert.ok(extended.includes('byId("' + mode + 'Button")'), "missing action listener: " + mode);
  }
  assert.ok(html.includes("pdfjs-dist@3.11.174"));
  assert.ok(html.includes("jszip@3.10.1"));
});
