import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const start = source.indexOf("const dnsTypes = ");
const end = source.indexOf('$("dnsLookup").addEventListener("click", dnsLookup);', start);
assert.ok(start >= 0 && end > start, "DNS lookup helpers exist");
const code = source.slice(start, end) + "\n({ dnsLookup, normalizeDomain })";

function harness(fetch) {
    const nodes = new Map();
    const tbody = { rows: [], replaceChildren(...rows) { this.rows = rows; } };
    function node() {
        return {
            value: "", textContent: "", className: "", children: [],
            appendChild(child) { this.children.push(child); },
            replaceChildren(...children) { this.children = children; },
            querySelector() { return tbody; }
        };
    }
    const get = (id) => {
        if (!nodes.has(id)) nodes.set(id, node());
        return nodes.get(id);
    };
    const context = vm.createContext({
        document: { getElementById: get, createElement: node },
        fetch, AbortController, setTimeout, clearTimeout,
        encodeURIComponent, String, Number, Array, Error,
        $: get,
        renderResults(container, items) { container.replaceChildren(...items); },
        setStatus(message, type) {
            const status = get("statusBox");
            status.textContent = message;
            status.className = type;
        }
    });
    const funcs = vm.runInContext(code, context);
    get("dnsDomain").value = "old.example.com";
    get("dnsType").value = "A";
    return { ...funcs, get, tbody };
}

function response(address, name) {
    return { ok: true, json: async () => ({
        Status: 0,
        Answer: [{ name, type: 1, TTL: 30, data: address }]
    }) };
}

test("older DNS response cannot overwrite newer lookup results", async () => {
    const requests = [];
    const h = harness(() => new Promise((resolve) => requests.push(resolve)));
    const first = h.dnsLookup();
    h.get("dnsDomain").value = "new.example.com";
    const second = h.dnsLookup();
    requests[1](response("203.0.113.2", "new.example.com"));
    await second;
    requests[0](response("203.0.113.1", "old.example.com"));
    await first;
    assert.equal(h.tbody.rows.length, 1);
    assert.equal(h.tbody.rows[0].children[0].textContent, "new.example.com");
    assert.match(h.get("statusBox").textContent, /Found 1 A record/);
});

test("invalid new DNS lookup invalidates previously pending request", async () => {
    const requests = [];
    const h = harness(() => new Promise((resolve) => requests.push(resolve)));
    const old = h.dnsLookup();
    h.get("dnsDomain").value = "bad..domain";
    await h.dnsLookup();
    requests[0](response("203.0.113.1", "old.example.com"));
    await old;
    assert.equal(h.tbody.rows.length, 0);
    assert.match(h.get("statusBox").textContent, /valid domain/);
});

test("a stale DNS network error cannot erase a newer successful result", async () => {
    const requests = [];
    const h = harness(() => new Promise((resolve, reject) => requests.push({ resolve, reject })));
    const old = h.dnsLookup();
    h.get("dnsDomain").value = "latest.example.com";
    const latest = h.dnsLookup();
    requests[1].resolve(response("203.0.113.3", "latest.example.com"));
    await latest;
    requests[0].reject(new Error("outdated network error"));
    await old;
    assert.equal(h.tbody.rows.length, 1);
    assert.match(h.get("statusBox").textContent, /Found 1 A record/);
});
