import type { Context } from "hono";
import type { Bindings, JobRow } from "./types";

export const JOB_TTL_MS = 60 * 60 * 1000;
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
const encoder = new TextEncoder();

function hex(data: Uint8Array): string {
  return Array.from(data, (n) => n.toString(16).padStart(2, "0")).join("");
}

export function issueToken(): string {
  return hex(crypto.getRandomValues(new Uint8Array(32)));
}

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(token));
  return hex(new Uint8Array(digest));
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function validAngle(value: unknown): value is 90 | 180 | 270 {
  return value === 90 || value === 180 || value === 270;
}

export function isPdf(bytes: Uint8Array): boolean {
  return bytes.length >= 5 && bytes[0] === 37 && bytes[1] === 80 &&
    bytes[2] === 68 && bytes[3] === 70 && bytes[4] === 45;
}

export function publicJob(job: JobRow) {
  return {
    id: job.id,
    operation: job.operation,
    status: job.status,
    attempts: job.attempt_count,
    inputBytes: job.input_bytes,
    outputBytes: job.output_bytes,
    errorCode: job.error_code,
    createdAt: job.created_at,
    updatedAt: job.updated_at,
    expiresAt: job.expires_at
  };
}

export async function authorizedJob(
  c: Context<{ Bindings: Bindings }>,
  id: string
): Promise<{ job: JobRow | null; response?: Response }> {
  const auth = c.req.header("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!/^[a-f0-9]{64}$/.test(token)) {
    return { job: null, response: c.json({ error: "unauthorized" }, 401) };
  }
  const job = await c.env.DB.prepare("SELECT * FROM jobs WHERE id = ?")
    .bind(id).first<JobRow>();
  if (!job || job.token_hash !== await hashToken(token)) {
    return { job: null, response: c.json({ error: "unauthorized" }, 401) };
  }
  if (job.status === "deleted" || job.expires_at <= nowIso()) {
    return { job: null, response: c.json({ error: "expired_or_deleted" }, 410) };
  }
  return { job };
}
