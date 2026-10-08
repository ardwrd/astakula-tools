import { getContainer } from "@cloudflare/containers";
import type { Bindings, JobRow, PdfMessage } from "./types";
import { isPdf, nowIso } from "./security";

const MAX_OUTPUT_BYTES = 30 * 1024 * 1024;
const MAX_ATTEMPTS = 3;

async function processMessage(message: Message<PdfMessage>, env: Bindings) {
  const id = message.body?.jobId;
  if (!id || !/^[a-f0-9-]{36}$/.test(id)) {
    message.ack();
    return;
  }
  const job = await env.DB.prepare("SELECT * FROM jobs WHERE id = ?")
    .bind(id).first<JobRow>();
  if (!job || job.status !== "queued" || job.expires_at <= nowIso()) {
    message.ack();
    return;
  }

  const lock = await env.DB.prepare(
    "UPDATE jobs SET status = 'processing', attempt_count = attempt_count + 1, updated_at = ? WHERE id = ? AND status = 'queued'"
  ).bind(nowIso(), id).run();
  if (lock.meta.changes !== 1) {
    message.ack();
    return;
  }

  try {
    const input = await env.FILES.get(job.input_key);
    if (!input) throw new Error("input_missing");
    const original = await input.arrayBuffer();
    if (original.byteLength > 20 * 1024 * 1024 || !isPdf(new Uint8Array(original))) {
      throw new Error("invalid_input");
    }

    const params = JSON.parse(job.params_json) as { angle: number };
    const container = getContainer(
      env.PDF_PROCESSOR,
      "pdf-processor-0"
    );
    const response = await container.fetch(
      new Request("http://processor.internal/rotate?angle=" + params.angle, {
        method: "POST",
        headers: { "Content-Type": "application/pdf" },
        body: original,
        signal: AbortSignal.timeout(120000)
      })
    );
    if (!response.ok) throw new Error("processor_rejected");

    const result = await response.arrayBuffer();
    if (result.byteLength < 5 || result.byteLength > MAX_OUTPUT_BYTES ||
        !isPdf(new Uint8Array(result))) {
      throw new Error("invalid_output");
    }
    await env.FILES.put(job.output_key, result, {
      httpMetadata: { contentType: "application/pdf" }
    });

    const completed = await env.DB.prepare(
      "UPDATE jobs SET status = 'completed', output_bytes = ?, error_code = NULL, updated_at = ? WHERE id = ? AND status = 'processing'"
    ).bind(result.byteLength, nowIso(), id).run();

    if (completed.meta.changes !== 1) {
      await env.FILES.delete(job.output_key);
    }
    message.ack();
  } catch (err) {
    // Queues deliver at least once; keep retry bounded and always verify DB state.
    const attempts = job.attempt_count + 1;
    const terminal = attempts >= MAX_ATTEMPTS;
    const updated = await env.DB.prepare(
      "UPDATE jobs SET status = ?, error_code = ?, updated_at = ? WHERE id = ? AND status = 'processing'"
    ).bind(terminal ? "failed" : "queued", "processing_error", nowIso(), id).run();
    if (!terminal && updated.meta.changes === 1) message.retry({ delaySeconds: 30 });
    else message.ack();
  }
}

export async function processQueue(batch: MessageBatch<PdfMessage>, env: Bindings) {
  for (const message of batch.messages) {
    try {
      await processMessage(message, env);
    } catch (error) {
      // Avoid logging token values or user file contents.
      console.error("pdf_job_queue_failure");
      message.retry({ delaySeconds: 60 });
    }
  }
}

/** Reclaims expired objects before deleting their D1 records. Re-runs hourly. */
export async function cleanupExpired(env: Bindings) {
  const expiry = nowIso();
  const rows = await env.DB.prepare(
    "SELECT id, input_key, output_key FROM jobs WHERE expires_at <= ? LIMIT 100"
  ).bind(expiry).all<Pick<JobRow, "id" | "input_key" | "output_key">>();
  for (const job of rows.results) {
    try {
      await env.FILES.delete([job.input_key, job.output_key]);
      await env.DB.prepare("DELETE FROM jobs WHERE id = ? AND expires_at <= ?")
        .bind(job.id, expiry).run();
    } catch {
      console.error("pdf_expiry_cleanup_failure");
    }
  }
}
