/**
 * Astakula PDF API — Cloudflare Free edition.
 *
 * No binary uploads, R2, D1, Queues or paid Cloudflare Containers.
 * This catalog describes only features already implemented in the
 * existing /pdf/ browser application. All PDF bytes remain client-side.
 */
export const toolCatalog = Object.freeze([
  { id: "merge", name: "Merge PDF", available: true, processing: "browser", path: "/pdf/" },
  { id: "extract", name: "Extract PDF Pages", available: true, processing: "browser", path: "/pdf/" },
  { id: "reorder", name: "Reorder PDF Pages", available: true, processing: "browser", path: "/pdf/" },
  { id: "rotate", name: "Rotate PDF", available: true, processing: "browser", path: "/pdf/" }
]);

const allowedPaths = new Set(["/", "/api/v1/health", "/api/v1/config", "/api/v1/pdf/tools"]);

function json(body, status = 200, method = "GET") {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
  return new Response(method === "HEAD" ? null : JSON.stringify(body), { status, headers });
}

export default {
  async fetch(request, env = {}) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      if (!allowedPaths.has(url.pathname)) return json({ error: "not_found" }, 404);
      return new Response(null, { status: 204, headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Cache-Control": "no-store"
      } });
    }
    if (!allowedPaths.has(url.pathname)) return json({ error: "not_found" }, 404, request.method);
    if (request.method !== "GET" && request.method !== "HEAD") {
      return json({ error: "method_not_allowed" }, 405, request.method);
    }
    if (url.pathname === "/api/v1/health" || url.pathname === "/") {
      return json({ status: "ok", service: "astakula-pdf-api", plan: "cloudflare-free",
        environment: env.ENVIRONMENT || "staging" }, 200, request.method);
    }
    if (url.pathname === "/api/v1/config") {
      return json({ processing: "browser", documentUploads: false,
        storage: "none", requiresAccount: false,
        privacy: "PDF files are not uploaded to this API" }, 200, request.method);
    }
    return json({ tools: toolCatalog, count: toolCatalog.length }, 200, request.method);
  }
};
