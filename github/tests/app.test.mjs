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
        click() { this.clicked = true; }, remove() { this.removed = true; },
        focus() { this.focused = true; }
    };
}
function harness(fetch) {
    const nodes = new Map();
    const created = [];
    const document = {
        body: { appendChild() {} },
        getElementById(id) {
            if (!nodes.has(id)) nodes.set(id, makeNode());
            return nodes.get(id);
        },
        createElement() { const el = makeNode(); created.push(el); return el; }
    };
    document.getElementById("repoInput").value = "ardwrd/astakula-tools";
    let changedUrl = "";
    const window = { location: { href: "https://tools.astakula.com/github/", search: "" },
        history: { replaceState(_state, _title, url) { changedUrl = String(url); } } };
    const context = vm.createContext({ document, window, fetch, AbortController, URL, URLSearchParams, Blob,
        Date, Intl, Number, setTimeout, clearTimeout, encodeURIComponent });
    vm.runInContext(source, context);
    const submit = () => document.getElementById("repoForm").listeners.submit({ preventDefault() {} });
    return { nodes, document, created, submit, get changedUrl() { return changedUrl; } };
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
    for (const [code, word] of [[404, "tidak ditemukan"], [403, "membatasi"], [429, "membatasi"]]) {
        const h = harness(async () => ({ ok: false, status: code,
            headers: { get(name) { return name === "x-ratelimit-remaining" ? "0" : null; } }
        }));
        await h.submit();
        assert.match(h.document.getElementById("statusMessage").textContent, new RegExp(word));
        assert.equal(h.document.getElementById("resultContent").hidden, true);
        assert.equal(h.document.getElementById("inspectButton").disabled, false);
    }
});

test("exports only selected public metadata to a browser-side JSON download", async () => {
    const h = harness(async () => ({ ok: true, json: async () => sample }));
    await h.submit();
    const button = h.document.getElementById("exportButton");
    assert.equal(button.hidden, false);
    button.listeners.click();
    const link = h.created.find((item) => item.download && item.clicked);
    assert.ok(link, "download link must be clicked");
    assert.equal(link.download, "github-ardwrd-astakula-tools.json");
    assert.equal(link.removed, true);
    h.document.getElementById("repoInput").value = "bad/repo/extra";
    await h.submit();
    assert.equal(button.hidden, true, "never export stale results after a failed search");
});

test("distinguishes ordinary HTTP 403 from exhausted API quota", async () => {
    const h = harness(async () => ({
        ok: false, status: 403,
        headers: { get(name) { return name === "x-ratelimit-remaining" ? "47" : null; } }
    }));
    await h.submit();
    const message = h.document.getElementById("statusMessage").textContent;
    assert.match(message, /ditolak GitHub \(HTTP 403\)/);
    assert.doesNotMatch(message, /membatasi permintaan/);
});

test("rate-limit reset feedback includes time when GitHub supplies it", async () => {
    const reset = String(Math.floor(Date.now() / 1000) + 1800);
    const h = harness(async () => ({
        ok: false, status: 403, headers: { get(name) {
            if (name === "x-ratelimit-remaining") return "0";
            if (name === "x-ratelimit-reset") return reset;
            return null;
        } }
    }));
    await h.submit();
    assert.match(h.document.getElementById("statusMessage").textContent, /Coba kembali setelah/);
});


test("a slow earlier response cannot replace a newer successful search", async () => {
    const requests = [];
    const h = harness((url) => new Promise((resolve) => requests.push({ url, resolve })));
    h.document.getElementById("repoInput").value = "old/first";
    const oldTask = h.submit();
    h.document.getElementById("repoInput").value = "new/latest";
    const newTask = h.submit();

    const latest = { ...sample, full_name: "new/latest", name: "latest", owner: { login: "new" } };
    requests[1].resolve({ ok: true, json: async () => latest });
    await newTask;
    requests[0].resolve({ ok: true, json: async () => sample });
    await oldTask;

    assert.equal(h.document.getElementById("repoName").textContent, "new/latest");
    assert.equal(h.document.getElementById("exportButton").hidden, false);
    assert.match(h.changedUrl, /new%2Flatest/);
    assert.equal(h.document.getElementById("inspectButton").disabled, false);
});

test("an invalid newer input cancels an earlier request and clears stale results", async () => {
    const requests = [];
    const h = harness((url) => new Promise((resolve) => requests.push({ url, resolve })));
    const oldTask = h.submit();
    h.document.getElementById("repoInput").value = "invalid/path/extra";
    await h.submit();
    requests[0].resolve({ ok: true, json: async () => sample });
    await oldTask;
    assert.match(h.document.getElementById("statusMessage").textContent, /owner\/repository/);
    assert.equal(h.document.getElementById("resultContent").hidden, true);
    assert.equal(h.document.getElementById("exportButton").hidden, true);
    assert.equal(h.document.getElementById("inspectButton").disabled, false);
});

test("a stale network failure cannot overwrite the newer success status", async () => {
    const requests = [];
    const h = harness((url) => new Promise((resolve, reject) => requests.push({ url, resolve, reject })));
    const oldTask = h.submit();
    h.document.getElementById("repoInput").value = "new/latest";
    const newTask = h.submit();
    requests[1].resolve({ ok: true, json: async () => ({ ...sample, full_name: "new/latest" }) });
    await newTask;
    requests[0].reject(new Error("Old request failed"));
    await oldTask;
    assert.match(h.document.getElementById("statusMessage").textContent, /Berhasil mengambil/);
    assert.equal(h.document.getElementById("resultContent").hidden, false);
});
