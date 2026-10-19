import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../app.js", import.meta.url), "utf8");
function makeNode() {
    return {
        value: "", disabled: false, hidden: false, textContent: "", className: "", href: "",
        listeners: {}, children: [],
        addEventListener(type, callback) { this.listeners[type] = callback; },
        replaceChildren(...children) { this.children = children; },
        append(...children) { this.children.push(...children); },
        focus() { this.focused = true; }
    };
}
function harness(fetch) {
    const nodes = new Map();
    const document = {
        getElementById(id) {
            if (!nodes.has(id)) nodes.set(id, makeNode());
            return nodes.get(id);
        },
        createElement() { return makeNode(); }
    };
    document.getElementById("repoInput").value = "ardwrd/astakula-tools";
    let changedUrl = "";
    const window = { location: { href: "https://tools.astakula.com/github/", search: "" },
        history: { replaceState(_state, _title, url) { changedUrl = String(url); } } };
    const context = vm.createContext({ document, window, fetch, AbortController, URL, URLSearchParams,
        Date, Intl, Number, setTimeout, clearTimeout, encodeURIComponent });
    vm.runInContext(source, context);
    const submit = () => document.getElementById("repoForm").listeners.submit({ preventDefault() {} });
    return { nodes, document, submit, get changedUrl() { return changedUrl; } };
}
const sample = {
    full_name: "ardwrd/astakula-tools", name: "astakula-tools", owner: { login: "ardwrd" },
    description: "<img src=x onerror=alert(1)>", stargazers_count: 4, forks_count: 2,
    open_issues_count: 1, language: "JavaScript", license: { spdx_id: "MIT" },
    default_branch: "main", visibility: "public", pushed_at: "2026-10-10T10:00:00Z",
    topics: ["utility"]
};
test("fetches a public repository and inserts descriptions as text", async () => {
    let called = "";
    const h = harness(async (url) => { called = url; return { ok: true, json: async () => sample }; });
    await h.submit();
    assert.equal(called, "https://api.github.com/repos/ardwrd/astakula-tools");
    assert.equal(h.document.getElementById("repoName").textContent, sample.full_name);
    assert.equal(h.document.getElementById("repoDescription").textContent, sample.description);
    assert.equal(h.document.getElementById("repoMetrics").children.length, 8);
    assert.equal(h.document.getElementById("repoTopics").children.length, 1);
    assert.equal(h.document.getElementById("resultContent").hidden, false);
    assert.match(h.changedUrl, /repo=ardwrd%2Fastakula-tools/);
});

test("rejects malformed repository names without making API calls", async () => {
    let count = 0;
    const h = harness(async () => { count++; throw new Error("Unexpected fetch"); });
    for (const bad of ["owner", "https://evil.example/owner/repo", "owner/repo/other", "https://github.com/owner/repo?access_token=secret"]) {
        h.document.getElementById("repoInput").value = bad;
        await h.submit();
        assert.match(h.document.getElementById("statusMessage").className, /is-error/);
        assert.equal(h.document.getElementById("resultContent").hidden, true);
    }
    assert.equal(count, 0);
});

test("HTTP 404 and rate limits surface safe errors", async () => {
    for (const [code, word] of [[404, "tidak ditemukan"], [403, "membatasi"]]) {
        const h = harness(async () => ({ ok: false, status: code }));
        await h.submit();
        assert.match(h.document.getElementById("statusMessage").textContent, new RegExp(word));
        assert.equal(h.document.getElementById("resultContent").hidden, true);
        assert.equal(h.document.getElementById("inspectButton").disabled, false);
    }
});
