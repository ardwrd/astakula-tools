import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

function node() {
    return {
        value: "", textContent: "", className: "", dataset: {},
        classList: { toggle() {} }, listeners: {}, addEventListener(type, handler) { this.listeners[type] = handler; },
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
    document.getElementById("integerConvert").listeners.click();
    assert.match(document.getElementById("statusBox").className, /is-error/);
    integer.value = "4294967295";
    document.getElementById("integerConvert").listeners.click();
    assert.equal(document.getElementById("ipv4Input").value, "255.255.255.255");
    assert.match(document.getElementById("statusBox").className, /is-success/);
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

test("distinguishes CGNAT, documentation and benchmark IPv4 blocks", () => {
    const cases = [
        ["10.0.0.1", "Private (RFC1918)"],
        ["100.64.0.1", "Shared CGNAT (RFC6598)"],
        ["100.127.255.254", "Shared CGNAT (RFC6598)"],
        ["192.0.2.1", "Documentation (TEST-NET)"],
        ["198.51.100.10", "Documentation (TEST-NET)"],
        ["203.0.113.20", "Documentation (TEST-NET)"],
        ["198.18.0.1", "Benchmark testing (RFC2544)"],
        ["198.19.255.254", "Benchmark testing (RFC2544)"],
        ["127.0.0.1", "Loopback"],
        ["8.8.8.8", "Public / globally routable candidate"]
    ];
    for (const [address, expected] of cases) {
        const expr = "ipv4Class(parseIPv4(" + JSON.stringify(address) + ").octets)";
        assert.equal(vm.runInContext(expr, context), expected, address);
    }
    assert.equal(vm.runInContext('ipv4Class(parseIPv4("100.128.0.1").octets)', context),
        "Public / globally routable candidate");
});
