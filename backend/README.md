# Astakula PDF Backend — WP-CF-001

Status: **staging foundation on feature branch, NOT deployed**. The existing GitHub Pages website remains unchanged.

## Scope delivered

- Cloudflare Workers + Hono REST API, backed by D1 job state and private R2 storage.
- Cloudflare Queues consumer dispatching work to a Cloudflare Container.
- PDF processing engine in Python with pypdf. Only **Rotate PDF** is implemented for the first end-to-end slice.
- Capability tokens stored as SHA-256 hashes, one-hour job expiration, scheduled file cleanup.
- GitHub Actions typechecking and Python PDF unit tests.

Do not represent Compress, OCR, Repair, Office conversion, or AI features as implemented.

## Staging API

Every endpoint except health requires the X-Staging-Key header, matching the STAGING_API_KEY Worker secret.
Requests for a specific job additionally require Authorization: Bearer JOB_TOKEN.

| Method | Route | Request / effect |
| --- | --- | --- |
| GET | /api/v1/health | API liveness only |
| POST | /api/v1/jobs | JSON {"operation":"rotate","params":{"angle":90}}. Returns id/token/expiry |
| PUT | /api/v1/jobs/:id/input | Raw PDF binary (application/pdf, Content-Length, <=20MiB) |
| POST | /api/v1/jobs/:id/run | Queues PDF rotation |
| GET | /api/v1/jobs/:id | Poll job status |
| GET | /api/v1/jobs/:id/download | Download completed PDF |
| DELETE | /api/v1/jobs/:id | Marks deleted and deletes private R2 files |

The capability token is returned only at job creation and must never be placed in a URL. The processing engine is reachable through its Worker binding, not a public container hostname. Worker-mediated uploads deliberately cap input size for now.

## Cloudflare prerequisites (currently blocked)

1. Enable R2 in the Cloudflare Dashboard.
2. Confirm Workers Paid availability for Cloudflare Containers.
3. Provision private R2 bucket: astakula-pdf-temp-staging.
4. Provision D1 database: astakula-pdf-jobs-staging.
5. Replace REPLACE_WITH_D1_DATABASE_ID inside api/wrangler.jsonc.
6. Create Queues: astakula-pdf-jobs-staging and astakula-pdf-jobs-dlq-staging.
7. Apply D1 migrations with Wrangler before the first API call.
8. Add Worker secret STAGING_API_KEY (never commit actual secret).
9. Deploy staging Worker only; test health, create, upload, process, download and delete.
10. Configure WAF, anti-abuse, billing alerts, object lifecycle, retention and container safety settings before production.

Existing tools.astakula.com DNS must **not** be changed during staging.

## Local validation

~~~bash
cd backend/api
npm install
npm run typecheck

cd ../../services/pdf-processor
python -m pip install -r requirements.txt
python -m unittest discover -s tests -v
~~~

## Security considerations

- Staging is fail-closed for API traffic until STAGING_API_KEY exists.
- User uploads are limited to 20 MiB and must start with a PDF file signature. The engine parses and validates PDF structure.
- PDF documents, file names and bearer tokens must not be written to analytics/logs.
- Tokens are high-entropy random values; D1 holds only hashes.
- Jobs expire after 1 hour; hourly cleanup is **best effort**, not a guarantee of immediate erasure. Deletion and in-flight work need race tests before production.
- Queues can retry deliveries; processing uses status guards. Stress/race testing and a reconciler for stuck jobs are still required.
- No public release until rate limits, abuse prevention, durable failure handling, and resource budgets are verified.
- This foundation intentionally leaves the legacy frontend untouched and does not enable a public upload UI.
