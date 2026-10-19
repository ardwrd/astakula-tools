import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
function mockNode() {
  return {
    value: "", checked: false, className: "", textContent: "", files: [],
    classList: { toggle() {}, contains() { return false; }, add() {}, remove() {} },
    listeners: {}, addEventListener(type, handler) { this.listeners[type] = handler; },
    setAttribute() {}, focus() {}
  };
}
function harness() {
  const fields = new Map();
  const document = { querySelector(selector) {
    if (!fields.has(selector)) fields.set(selector, mockNode());
    return fields.get(selector);
  }, addEventListener() {} };
  const context = vm.createContext({ document, window: { setTimeout }, btoa, atob,
    String, Uint8Array, TextEncoder, TextDecoder, setTimeout, Intl, Blob, URL });
  vm.runInContext(source, context);
  return { fields, context, get: (selector) => document.querySelector(selector) };
}
function deferredFile(name) {
  let resolve;
  return {
    file: { name, size: 3, type: "text/plain",
      arrayBuffer: () => new Promise((done) => { resolve = done; }) },
    done(text) { resolve(new TextEncoder().encode(text).buffer); }
  };
}

test("later file selection wins over a slower earlier read", async () => {
  const h = harness();
  const first = deferredFile("old.txt");
  const second = deferredFile("new.txt");
  const oldTask = vm.runInContext("loadFile", h.context)(first.file);
  const newTask = vm.runInContext("loadFile", h.context)(second.file);
  second.done("new");
  await newTask;
  first.done("old");
  await oldTask;
  assert.equal(h.get("#fileBase64Output").value, "bmV3");
  assert.match(h.get("#fileMeta").textContent, /new\.txt/);
});

test("clear cancels an in-flight file read", async () => {
  const h = harness();
  const sample = deferredFile("late.txt");
  const task = vm.runInContext("loadFile", h.context)(sample.file);
  vm.runInContext("clearFileEncode()", h.context);
  sample.done("old");
  await task;
  assert.equal(h.get("#fileBase64Output").value, "");
  assert.equal(h.get("#fileMeta").textContent, "No file");
});
