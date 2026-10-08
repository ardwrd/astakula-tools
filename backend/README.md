# Astakula PDF — Cloudflare Free Foundation

**Active plan: Cloudflare Free only.** This replaces the earlier Workers Paid / Containers prototype. No paid resources, migration, production DNS changes, or document storage have been configured.

## What runs where

- Website: existing GitHub Pages until a future, tested Cloudflare Pages migration.
- API: lightweight **Cloudflare Workers Free** service. It reports availability, processing mode, and the catalog of implemented PDF tools.
- PDF processing: **on the user's own device**, in the existing /pdf/ JavaScript application using pdf-lib.
- No PDF upload, server job queue, user file persistence, external converter service, or Docker Container is used in this Free edition.
- D1 and Cloudflare Queues also have Free tiers, but are not provisioned: there is no meaningful workload requiring them yet.
- R2 has a free allowance but requires activation on the connected account and can incur charges beyond its allowance. It is deliberately **not enabled**.

## Free tier API routes

| Method | Route | Result |
| --- | --- | --- |
| GET | /api/v1/health | API liveness, Free plan |
| GET | /api/v1/config | Browser processing and privacy guarantees |
| GET | /api/v1/pdf/tools | Only currently working browser PDF tools |

All other paths return 404. Document upload POSTs deliberately do not exist.

## Local tests

~~~sh
cd backend/api
npm install
npm run check
npm test
npm run deploy:dry-run
~~~

## Deployment

Only stage the Free Worker initially:

~~~sh
cd backend/api
npx wrangler login
npm run deploy:staging
~~~

The staging Worker can be tested through its default workers.dev URL. Do not connect tools.astakula.com to the Worker: existing DNS still points to GitHub Pages.

## Engineering decisions

1. **Never pretend Workers Free can execute LibreOffice or Ghostscript.** Its CPU limit is 10 ms per invocation.
2. Expand /pdf/ incrementally with browser-based pdf-lib and PDF.js. Split, image-to-PDF, PDF-to-image, watermark, page numbers, etc. can be implemented without a backend.
3. Defer high-fidelity Office conversion, OCR-heavy jobs, digital signing PKI and advanced compression until a viable no-cost runtime has been demonstrated; do not claim feature parity before then.
4. Keep file data in browser memory (no automatic uploads).
5. A future free Cloudflare Pages deployment can host the current static UI without moving off Cloudflare Free.
6. No Cloudflare service should be upgraded, enabled with billable usage, or exposed at the production domain without separately confirming a secure and tested implementation.
