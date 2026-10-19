import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const start = source.indexOf("function md5Bytes(inputBytes)");
const end = source.indexOf("function bufferToHex(buffer)", start);
assert.ok(start >= 0 && end > start, "MD5 implementation exists");
const md5Bytes = vm.runInNewContext(
    source.slice(start, end) + "\nmd5Bytes", { Uint8Array, Uint32Array, Math, Array, BigInt }
);
const encode = (text) => new TextEncoder().encode(text);

test("MD5 matches published RFC 1321 reference vectors", () => {
    const cases = [
        ["", "d41d8cd98f00b204e9800998ecf8427e"],
        ["a", "0cc175b9c0f1b6a831c399e269772661"],
        ["abc", "900150983cd24fb0d6963f7d28e17f72"],
        ["message digest", "f96b697d7cb7938d525a2f31aaf161d0"],
        ["abcdefghijklmnopqrstuvwxyz", "c3fcd3d76192e4007dfb496cca67e13b"],
        ["ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789", "d174ab98d277d9f5a5611c2c9f419d9f"],
        ["1234567890".repeat(8), "57edf4a22be3c955ac49da2e2107b67a"]
    ];
    for (const [message, expected] of cases) {
        assert.equal(md5Bytes(encode(message)), expected, JSON.stringify(message));
    }
});

test("MD5 handles block padding boundaries and UTF-8 bytes correctly", () => {
    for (const text of ["a".repeat(55), "b".repeat(56), "c".repeat(63), "d".repeat(64), "e".repeat(65), "Halo, dunia!", "Kopi ☕ dan ayam 🐓"]) {
        const expected = createHash("md5").update(text, "utf8").digest("hex");
        assert.equal(md5Bytes(encode(text)), expected, JSON.stringify(text));
    }
});

test("MD5 remains correct for multi-block file-sized inputs", () => {
    const value = new Uint8Array(65536);
    for (let i = 0; i < value.length; i++) value[i] = i & 255;
    const expected = createHash("md5").update(value).digest("hex");
    assert.equal(md5Bytes(value), expected);
});
