import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import { webcrypto } from "node:crypto";

const source = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
function createHarness(subtle) {
    const elements = new Map();
    function el(name) {
        if (!elements.has(name)) elements.set(name, {
            value: "", textContent: "", className: "", files: [],
            disabled: false,
            classList: { toggle() {}, add() {}, remove() {}, contains() { return false; } },
            listeners: {}, addEventListener(type, handler) { this.listeners[type] = handler; },
            setAttribute() {}, focus() {}
        });
        return elements.get(name);
    }
    el("#algorithmSelect").value = "SHA-256";
    el("#caseSelect").value = "lower";
    const context = vm.createContext({
        document: { querySelector: el, addEventListener() {} },
        window: { crypto: { subtle }, setTimeout },
        TextEncoder, Uint8Array, BigInt, Array, Intl,
        navigator: { clipboard: { writeText: async () => {} } }
    });
    vm.runInContext(source, context);
    return { elements, el, context };
}

test("computes a SHA-256 digest for unchanged input", async () => {
    const h = createHarness(webcrypto.subtle);
    h.el("#textInput").value = "abc";
    await vm.runInContext("generateHash()", h.context);
    assert.equal(h.el("#hashOutput").value, "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("discard pending digest after input has been edited", async () => {
    let resolve;
    const subtle = { digest() { return new Promise((r) => { resolve = r; }); } };
    const h = createHarness(subtle);
    h.el("#textInput").value = "old";
    const pending = vm.runInContext("generateHash()", h.context);
    h.el("#textInput").value = "new";
    h.el("#textInput").listeners.input();
    resolve(new Uint8Array(32).buffer);
    await pending;
    assert.equal(h.el("#hashOutput").value, "");
});

test("discard pending digest when algorithm changes", async () => {
    let resolve;
    const h = createHarness({ digest() { return new Promise((r) => { resolve = r; }); } });
    h.el("#textInput").value = "abc";
    const pending = vm.runInContext("generateHash()", h.context);
    h.el("#algorithmSelect").value = "SHA-1";
    h.el("#algorithmSelect").listeners.change();
    resolve(new Uint8Array(32).buffer);
    await pending;
    assert.equal(h.el("#hashOutput").value, "");
});


test("valid SHA-256 digest matches regardless of hex letter case or paste spacing", async () => {
    const h = createHarness(webcrypto.subtle);
    h.el("#textInput").value = "abc";
    await vm.runInContext("generateHash()", h.context);
    h.el("#expectedHash").value = "BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD";
    h.el("#verifyButton").listeners.click();
    assert.match(h.el("#verifyResult").textContent, /Match/);
    assert.match(h.el("#verifyResult").className, /is-match/);
});

test("rejects wrong-length and non-hex expected hashes before comparing", async () => {
    const h = createHarness(webcrypto.subtle);
    h.el("#textInput").value = "abc";
    await vm.runInContext("generateHash()", h.context);
    for (const value of ["not-a-digest", "a".repeat(32), "g".repeat(64)]) {
        h.el("#expectedHash").value = value;
        h.el("#verifyButton").listeners.click();
        assert.match(h.el("#verifyResult").textContent, /64 hexadecimal characters/);
        assert.match(h.el("#statusBox").className, /is-error/);
    }
});

test("editing the expected digest clears a previous Match status", async () => {
    const h = createHarness(webcrypto.subtle);
    h.el("#textInput").value = "abc";
    await vm.runInContext("generateHash()", h.context);
    h.el("#expectedHash").value = h.el("#hashOutput").value;
    h.el("#verifyButton").listeners.click();
    assert.match(h.el("#verifyResult").textContent, /Match/);
    h.el("#expectedHash").value = "changed";
    h.el("#expectedHash").listeners.input();
    assert.equal(h.el("#verifyResult").textContent, "No comparison yet.");
});
