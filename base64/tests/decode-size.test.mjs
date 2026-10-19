import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const start = source.indexOf("function parseBase64Input(value)");
const end = source.indexOf("function getTextInput()", start);
assert.ok(start >= 0 && end > start, "Base64 helpers must exist");
const code = source.slice(start, end) + "\n({ base64ToBytes, parseBase64Input })";
const { base64ToBytes } = vm.runInNewContext(code, { atob, Uint8Array });

test("decodes normal Base64 and URL-safe Base64", () => {
    assert.deepEqual(Array.from(base64ToBytes("Zm9v").bytes), [102, 111, 111]);
    assert.deepEqual(Array.from(base64ToBytes("data:text/plain;base64,Zg==").bytes), [102]);
});

test("rejects decoded files larger than the permitted byte count", () => {
    assert.throws(() => base64ToBytes("Zm9v", 2), /size limit/);
    assert.deepEqual(Array.from(base64ToBytes("Zm9v", 3).bytes), [102, 111, 111]);
    assert.throws(() => base64ToBytes("data:text/plain;base64,Zg==", 0), /size limit/);
});

test("rejects oversized input before attempting base64 decoding", () => {
    let calls = 0;
    const safe = vm.runInNewContext(code, { atob() { calls++; throw new Error("must not decode"); }, Uint8Array });
    assert.throws(() => safe.base64ToBytes("Zm9v", 1), /size limit/);
    assert.equal(calls, 0);
});
