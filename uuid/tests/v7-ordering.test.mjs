import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const first = source.indexOf("function secureRandomBytes(length)");
const last = source.indexOf("function applyOutputFormat(uuid)", first);
assert.ok(first >= 0 && last > first, "UUID generator helpers exist");
const code = source.slice(first, last) + "\n({ generateV4, generateV7 })";
function generators(now = 1750000000000, randomByte = 0) {
    const ctx = { Uint8Array, Array, BigInt, Date: { now: () => now },
        window: { crypto: { getRandomValues(bytes) { bytes.fill(randomByte); return bytes; } } }
    };
    return vm.runInNewContext(code, ctx);
}

test("UUIDv7 preserves RFC version and variant and encodes epoch milliseconds", () => {
    const { generateV7 } = generators();
    const value = generateV7();
    assert.match(value, /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    const compact = value.replaceAll("-", "");
    assert.equal(parseInt(compact.slice(0, 12), 16), 1750000000000);
});

test("UUIDv7 is strictly increasing when many IDs share a millisecond", () => {
    const { generateV7 } = generators();
    const values = Array.from({ length: 1000 }, () => generateV7());
    assert.equal(new Set(values).size, 1000);
    assert.deepEqual([...values].sort(), values);
});

test("UUIDv4 remains correctly versioned", () => {
    const { generateV4 } = generators();
    assert.match(generateV4(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
