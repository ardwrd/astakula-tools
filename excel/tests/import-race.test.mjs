import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
function part(from, to) {
    const begin = source.indexOf(from), end = source.indexOf(to, begin);
    assert.ok(begin >= 0 && end > begin, "Expected source block: " + from);
    return source.slice(begin, end);
}

function harness() {
    const elements = Object.fromEntries([
        "filePanel", "fileName", "fileMeta", "sourceInput", "mergeInput",
        "sheetToolbar", "previewSection", "previewTable", "sheetSelect",
        "searchInput", "duplicateMeta", "removeDuplicatesButton"
    ].map(key => [key, {
        value: "", textContent: "", disabled: false,
        classList: { add() {}, remove() {} }, replaceChildren() {}
    }]));
    const reads = [];
    let status = "";
    const context = vm.createContext({
        elements, formatBytes: () => "1 KB", duplicateRows: { clear() {} },
        populateSheetSelect() {}, updateWorkspace() {}, populateColumnControls() {},
        setStatus(message) { status = message; },
        readWorkbookFile(file) {
            return new Promise((resolve, reject) => reads.push({ file, resolve, reject }));
        }
    });
    const blocks = [
        "let loadSequence = 0; let sourceFile=null; let workbook=null; let activeSheetName='';",
        part("async function loadSource(file)", "function populateSheetSelect()"),
        part("async function handleIncomingFile(file)", "function extractPastedFile(event)")
    ].join("\n");
    const api = vm.runInContext(blocks + "\n({ loadSource, resetWorkbook, removeSource, handleIncomingFile, get current() { return sourceFile; }})", context);
    return { api, reads, elements, get status() { return status; } };
}
function book(sheet) {
    return { SheetNames: [sheet], Sheets: { [sheet]: {} } };
}
function file(name) { return { name, size: 1024 }; }

test("last selected spreadsheet wins when previous import finishes later", async () => {
    const h = harness();
    const old = h.api.handleIncomingFile(file("old.xlsx"));
    const recent = h.api.handleIncomingFile(file("latest.xlsx"));
    h.reads[1].resolve(book("Latest"));
    await recent;
    h.reads[0].resolve(book("Old"));
    await old;
    assert.equal(h.api.current.name, "latest.xlsx");
    assert.equal(h.elements.fileName.textContent, "latest.xlsx");
    assert.match(h.status, /latest\.xlsx loaded/);
});

test("Remove prevents an in-flight spreadsheet from reappearing", async () => {
    const h = harness();
    const pending = h.api.handleIncomingFile(file("pending.xlsx"));
    h.api.removeSource();
    h.reads[0].resolve(book("Pending"));
    await pending;
    assert.equal(h.api.current, null);
    assert.equal(h.elements.fileName.textContent, "");
    assert.match(h.status, /Choose a spreadsheet to begin/);
});

test("an obsolete file parse error cannot overwrite a successful later import", async () => {
    const h = harness();
    const previous = h.api.handleIncomingFile(file("broken.xlsx"));
    const recent = h.api.handleIncomingFile(file("valid.xlsx"));
    h.reads[1].resolve(book("Valid"));
    await recent;
    h.reads[0].reject(new Error("broken source"));
    await previous;
    assert.match(h.status, /valid\.xlsx loaded/);
});

test("Reset followed by Remove cannot restore the old workbook", async () => {
    const h = harness();
    const original = h.api.handleIncomingFile(file("reset.xlsx"));
    h.reads[0].resolve(book("Reset"));
    await original;
    const resetting = h.api.resetWorkbook();
    h.api.removeSource();
    h.reads[1].resolve(book("Reset"));
    await resetting;
    assert.equal(h.api.current, null);
    assert.match(h.status, /Choose a spreadsheet to begin/);
});
