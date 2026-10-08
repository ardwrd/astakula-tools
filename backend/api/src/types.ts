import type { PdfProcessor } from "./worker-container";
export interface Bindings {
  DB: D1Database;
  FILES: R2Bucket;
  PDF_JOBS: Queue<PdfMessage>;
  PDF_PROCESSOR: DurableObjectNamespace<PdfProcessor>;
  ENVIRONMENT: string;
  MAX_UPLOAD_BYTES: string;
  STAGING_API_KEY?: string;
}

export type JobStatus =
  | "awaiting_upload" | "uploaded" | "queued" | "processing"
  | "completed" | "failed" | "deleted";

export interface JobRow {
  id: string;
  token_hash: string;
  operation: "rotate";
  params_json: string;
  status: JobStatus;
  input_key: string;
  output_key: string;
  input_bytes: number | null;
  output_bytes: number | null;
  attempt_count: number;
  error_code: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
}

export interface PdfMessage {
  jobId: string;
}
