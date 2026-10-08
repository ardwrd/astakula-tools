import test from "node:test";
import assert from "node:assert/strict";
import api, { toolCatalog } from "../src/index.mjs";

const env = { ENVIRONMENT: "test" };
const req = (path, method = "GET") => api.fetch(new Request("https://example.test" + path, { method }), env);

test("GET /api/v1/health returns a free-tier service", async () => {
  const response = await req("/api/v1/health");
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.plan, "cloudflare-free");
  assert.equal(body.status, "ok");
});

test("capabilities expose only real browser features", async () => {
  const response = await req("/api/v1/pdf/tools");
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.count, 10);
  assert.deepEqual(body.tools.map(t => t.id), ["merge", "split", "extract", "remove", "reorder", "rotate", "images", "pdfpng", "watermark", "numbers"]);
  assert.ok(toolCatalog.every(t => t.processing === "browser" && t.available === true));
});

test("privacy config declares no document uploads", async () => {
  const response = await req("/api/v1/config");
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.documentUploads, false);
  assert.equal(body.storage, "none");
});

test("rejects POST and unknown routes", async () => {
  assert.equal((await req("/api/v1/pdf/tools", "POST")).status, 405);
  assert.equal((await req("/api/v1/jobs", "POST")).status, 404);
});

test("HEAD has no response body", async () => {
  const response = await req("/api/v1/health", "HEAD");
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "");
});

test("CORS preflight only responds to supported routes", async () => {
  const response = await req("/api/v1/pdf/tools", "OPTIONS");
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), "*");
  assert.equal((await req("/does-not-exist", "OPTIONS")).status, 404);
});
