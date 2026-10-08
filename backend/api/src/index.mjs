/**
 * Astakula PDF API — Cloudflare Free edition.
 *
 * No binary uploads, R2, D1, Queues or paid Cloudflare Containers.
 * This catalog describes only features already implemented in the
 * existing /pdf/ browser application. All PDF bytes remain client-side.
 */
export const toolCatalog = Object.freeze([
  { id: "merge", name: "Merge PDFs", available: true, processing: "browser", category: "organize", path: "/pdf/" },
  { id: "split", name: "Split PDF", available: true, processing: "browser", category: "organize", path: "/pdf/" },
  { id: "extract", name: "Extract pages", available: true, processing: "browser", category: "organize", path: "/pdf/" },
  { id: "remove", name: "Remove pages", available: true, processing: "browser", category: "organize", path: "/pdf/" },
  { id: "reorder", name: "Reorder pages", available: true, processing: "browser", category: "organize", path: "/pdf/" },
  { id: "rotate", name: "Rotate pages", available: true, processing: "browser", category: "organize", path: "/pdf/" },
  { id: "images", name: "Images to PDF", available: true, processing: "browser", category: "convert", path: "/pdf/" },
  { id: "pdfpng", name: "PDF to PNG", available: true, processing: "browser", category: "convert", path: "/pdf/" },
  { id: "watermark", name: "Watermark PDF", available: true, processing: "browser", category: "edit", path: "/pdf/" },
  { id: "numbers", name: "Page numbers", available: true, processing: "browser", category: "edit", path: "/pdf/" }
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
