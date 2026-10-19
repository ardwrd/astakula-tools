import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const start = source.indexOf("function isJsonFile(file)");
const end = source.indexOf("function getClipboardFile(", start);
assert.ok(start >= 0 && end > start, "JSON file importer must exist");
const setup = [
  "const MAX_FILE_SIZE = 5 * 1024 * 1024;",
  "let inputRevision = 0; let fileReadRevision = 0;",
  source.slice(start, end),
  "({loadFile})"
].join("\n");

function harness() {
  const elements = { input: { value: "" }, output: { value: "" }, fileInput: { value: "" } };
  const status = [];
  const context = vm.createContext({ elements, setStatus: (...args) => status.push(args), updateMeta() {} });
  return { elements, status, context, loadFile: vm.runInContext(setup, context) .loadFile };
}

function deferredFile(name) {
  let resolve;
  const file = { name, size: 50, type: "application/json", text: () => new Promise((done) => { resolve = done; }) };
  return { file, finish(value) { resolve(value); } };
}

test("slow first file cannot overwrite a newer loaded file", async () => {
  const h = harness();
  const first = deferredFile("first.json");
  const second = deferredFile("second.json");
  const p1 = h.loadFile(first.file);
  const p2 = h.loadFile(second.file);
  second.finish('{"file":2}');
  assert.equal(await p2, true);
  first.finish('{"file":1}');
  assert.equal(await p1, false);
  assert.equal(h.elements.input.value, '{"file":2}');
});

test("user edits cancel an in-flight file import", async () => {
  const h = harness();
  const file = deferredFile("sample.json");
  const pending = h.loadFile(file.file);
  h.elements.input.value = '{"manual":true}';
  vm.runInContext("inputRevision += 1", h.context); // Models the input listener.
  file.finish('{"file":true}');
  assert.equal(await pending, false);
  assert.equal(h.elements.input.value, '{"manual":true}');
});

test("ordinary file upload remains supported", async () => {
  const h = harness();
  const accepted = await h.loadFile({ name: "ok.json", size: 10, type: "application/json", text: async () => '{"ok":true}' });
  assert.equal(accepted, true);
  assert.equal(h.elements.input.value, '{"ok":true}');
});
