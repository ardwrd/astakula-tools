import { Hono } from "hono";
import { cleanupExpired, processQueue } from "./queue";
import { authorizedJob, hashToken, isPdf, issueToken, JOB_TTL_MS, MAX_FILE_BYTES, nowIso, publicJob, validAngle } from "./security";
import type { Bindings, JobRow, PdfMessage } from "./types";

export { PdfProcessor } from "./worker-container";

const app = new Hono<{ Bindings: Bindings }>();

app.use("/api/v1/*", async (c, next) => {
  if (c.req.path === "/api/v1/health") return next();
  // Staging deployment is intentionally fail-closed until this secret is set.
  const key = c.env.STAGING_API_KEY;
  if (!key) return c.json({ error: "staging_api_key_not_configured" }, 503);
  if (c.req.header("x-staging-key") !== key) {
    return c.json({ error: "staging_access_denied" }, 401);
  }
  await next();
});

app.get("/api/v1/health", (c) => c.json({ status: "ok", service: "astakula-pdf-api", environment: "staging" }));

app.post("/api/v1/jobs", async (c) => {
  const body: unknown = await c.req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return c.json({ error: "invalid_request" }, 400);
  }
  const value = body as Record<string, unknown>;
  const params = value.params;
  if (value.operation !== "rotate" || !params || typeof params !== "object" || Array.isArray(params)) {
    return c.json({ error: "unsupported_operation" }, 422);
  }
  const angle = (params as Record<string, unknown>).angle;
  if (!validAngle(angle)) return c.json({ error: "angle_must_be_90_180_or_270" }, 422);

  const id = crypto.randomUUID();
  const token = issueToken();
  const now = nowIso();
  const expiresAt = new Date(Date.now() + JOB_TTL_MS).toISOString();
  await c.env.DB.prepare(
    "INSERT INTO jobs (id, token_hash, operation, params_json, status, input_key, output_key, created_at, updated_at, expires_at) VALUES (?, ?, ?, ?, 'awaiting_upload', ?, ?, ?, ?, ?)"
  ).bind(
    id, await hashToken(token), "rotate", JSON.stringify({ angle }),
    "jobs/" + id + "/input.pdf", "jobs/" + id + "/output.pdf",
    now, now, expiresAt
  ).run();

  return c.json({ id, token, status: "awaiting_upload", expiresAt }, 201, {
    "Cache-Control": "no-store"
  });
});

app.put("/api/v1/jobs/:id/input", async (c) => {
  const auth = await authorizedJob(c, c.req.param("id"));
  if (auth.response) return auth.response;
  const job = auth.job!;
  if (job.status !== "awaiting_upload") return c.json({ error: "incorrect_job_state" }, 409);

  const length = Number(c.req.header("content-length"));
  const max = Math.min(Number(c.env.MAX_UPLOAD_BYTES) || MAX_FILE_BYTES, MAX_FILE_BYTES);
  if (!Number.isSafeInteger(length) || length < 5 || length > max) {
    return c.json({ error: "missing_or_invalid_content_length" }, 413);
  }
  if (c.req.header("content-type")?.split(";")[0]?.trim() !== "application/pdf") {
    return c.json({ error: "only_application_pdf_supported" }, 415);
  }

  const contents = await c.req.raw.arrayBuffer();
  if (contents.byteLength !== length || !isPdf(new Uint8Array(contents))) {
    return c.json({ error: "invalid_pdf_upload" }, 422);
  }
  await c.env.FILES.put(job.input_key, contents, {
    httpMetadata: { contentType: "application/pdf" }
  });
  const updated = await c.env.DB.prepare(
    "UPDATE jobs SET status = 'uploaded', input_bytes = ?, updated_at = ? WHERE id = ? AND status = 'awaiting_upload'"
  ).bind(length, nowIso(), job.id).run();
  if (updated.meta.changes !== 1) {
    return c.json({ error: "upload_conflict" }, 409);
  }
  return c.json({ id: job.id, status: "uploaded", bytes: length }, 200);
});

app.post("/api/v1/jobs/:id/run", async (c) => {
  const auth = await authorizedJob(c, c.req.param("id"));
  if (auth.response) return auth.response;
  const job = auth.job!;
  if (job.status !== "uploaded") return c.json({ error: "incorrect_job_state" }, 409);
  if (!await c.env.FILES.head(job.input_key)) return c.json({ error: "input_missing" }, 409);

  const result = await c.env.DB.prepare(
    "UPDATE jobs SET status = 'queued', updated_at = ? WHERE id = ? AND status = 'uploaded'"
  ).bind(nowIso(), job.id).run();
  if (result.meta.changes !== 1) return c.json({ error: "queue_conflict" }, 409);
  try {
    await c.env.PDF_JOBS.send({ jobId: job.id });
  } catch {
    await c.env.DB.prepare(
      "UPDATE jobs SET status = 'uploaded' WHERE id = ? AND status = 'queued'"
    ).bind(job.id).run();
    return c.json({ error: "queue_unavailable" }, 503);
  }
  return c.json({ id: job.id, status: "queued" }, 202);
});

app.get("/api/v1/jobs/:id", async (c) => {
  const auth = await authorizedJob(c, c.req.param("id"));
  if (auth.response) return auth.response;
  c.header("Cache-Control", "no-store");
  return c.json(publicJob(auth.job!));
});

app.get("/api/v1/jobs/:id/download", async (c) => {
  const auth = await authorizedJob(c, c.req.param("id"));
  if (auth.response) return auth.response;
  const job = auth.job!;
  if (job.status !== "completed") return c.json({ error: "result_not_ready" }, 409);
  const output = await c.env.FILES.get(job.output_key);
  if (!output) return c.json({ error: "result_missing" }, 404);
  return new Response(output.body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="astakula-result.pdf"',
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
});

app.delete("/api/v1/jobs/:id", async (c) => {
  const auth = await authorizedJob(c, c.req.param("id"));
  if (auth.response) return auth.response;
  const job = auth.job!;
  await c.env.DB.prepare(
    "UPDATE jobs SET status = 'deleted', updated_at = ? WHERE id = ?"
  ).bind(nowIso(), job.id).run();
  await c.env.FILES.delete([job.input_key, job.output_key]);
  return c.json({ id: job.id, status: "deleted" });
});

app.onError((error, c) => {
  console.error("pdf_api_error");
  return c.json({ error: "internal_error" }, 500);
});

app.notFound((c) => c.json({ error: "not_found" }, 404));

export default {
  fetch(request: Request, env: Bindings, ctx: ExecutionContext) {
    return app.fetch(request, env, ctx);
  },
  async queue(batch: MessageBatch<PdfMessage>, env: Bindings) {
    await processQueue(batch, env);
  },
  async scheduled(_controller: ScheduledController, env: Bindings) {
    await cleanupExpired(env);
  }
};
