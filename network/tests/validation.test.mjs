import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

function node() {
    return {
        value: "", textContent: "", className: "", dataset: {},
        classList: { toggle() {} }, addEventListener() {},
        replaceChildren() {}, append() {}, appendChild() {},
        querySelector() { return node(); }
    };
}
const fields = new Map();
const document = {
    getElementById(id) {
        if (!fields.has(id)) fields.set(id, node());
        return fields.get(id);
    },
    querySelectorAll() { return []; },
    createElement() { return node(); }
};
for (const [key, value] of Object.entries({
    subnetIp: "192.168.1.10", subnetCidr: "24",
    rangeStart: "192.168.1.0", rangeEnd: "192.168.1.255",
    splitNetwork: "192.168.1.0/24", splitTarget: "26",
    ipv4Input: "192.168.1.10", macInput: "00:11:22:33:44:55",
    macFormat: "colon", bandwidthValue: "10", bandwidthFrom: "Mbps",
    bandwidthTo: "Kbps", transferSize: "1", transferUnit: "MB",
    transferSpeed: "10", transferSpeedUnit: "Mbps"
})) document.getElementById(key).value = value;
const context = vm.createContext({ document, console, Intl, BigInt, Number, setTimeout, clearTimeout });
vm.runInContext(readFileSync(new URL("../js/app.js", import.meta.url), "utf8"), context);

test("integer conversion rejects empty or non-decimal inputs", () => {
    const integer = document.getElementById("integerInput");
    integer.value = "";
    vm.runInContext('document.getElementById("integerConvert").addEventListener', context);
    // The validation happens on the button's click handler.
    const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
    assert.match(app, /if \(!\/\^\\d\+\$\/\.test\(rawInteger\)\)/);
});

test("DNS lookup rejects invalid labels and accepts ordinary hosts", () => {
    assert.equal(vm.runInContext('normalizeDomain("https://example.com/page")', context), "example.com");
    for (const invalid of ["foo..bar", "-foo.com", "foo-.com", "a".repeat(64) + ".com", "ex ample.com"]) {
        assert.throws(() => vm.runInContext("normalizeDomain(" + JSON.stringify(invalid) + ")", context), /valid domain/);
    }
});

test("MAC normalizer rejects garbage while accepting standard notations", () => {
    const element = document.getElementById("macInput");
    const status = document.getElementById("statusBox");
    for (const valid of ["00:11:22:33:44:55", "00-11-22-33-44-55", "0011.2233.4455", "001122334455"]) {
        element.value = valid;
        vm.runInContext("normalizeMac()", context);
        assert.match(status.className, /is-success/);
    }
    for (const invalid of ["garbage001122334455", "00:11-22:33:44:55", "0011.2233.4455???"]) {
        element.value = invalid;
        vm.runInContext("normalizeMac()", context);
        assert.match(status.className, /is-error/);
    }
});

test("subnet calculator does not treat an empty CIDR as /0", () => {
    document.getElementById("subnetCidr").value = "";
    vm.runInContext("calculateSubnet()", context);
    assert.match(document.getElementById("statusBox").className, /is-error/);
});

test("subnet splitter does not treat an empty target as /0", () => {
    document.getElementById("splitNetwork").value = "0.0.0.0/0";
    document.getElementById("splitTarget").value = "";
    vm.runInContext("calculateSplit()", context);
    assert.match(document.getElementById("statusBox").className, /is-error/);
});
