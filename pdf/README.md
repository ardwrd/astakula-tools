# PDF Tools Hub — WP-PDF-001 / WP-PDF-002

Development branch: feature/cloudflare-foundation. Existing production URL /pdf/ is preserved, not repointed.

## Browser features (10)

Legacy, retained: merge, extract, reorder, rotate.

New:
- Split PDF into one PDF per page; ZIP download; up to 40 pages.
- Remove Pages via ranges while retaining at least one page.
- PNG/JPG to PDF, up to 12 images, 15 MB each, fitted to A4.
- PDF to PNG via PDF.js / JSZip, 25 pages max and 20 MB input max.
- Text Watermark using basic ASCII, centrally placed.
- Page Numbers, N / total, at bottom right or center.

PDF bytes are processed only in the browser. Third-party browser libraries load from CDN, but files are never intentionally uploaded to them or to Astakula.

## Planned, disabled

Advanced compression, OCR, Office conversions, repair, encrypted PDFs, and certificate-backed signatures await a Proxmox-native processor. Planned cards do not offer fake actions.

## Tests

Run in the pdf/ directory:

~~~bash
npm install
npm test
node --check js/extended-tools.mjs
node --check js/app.js
~~~

Manual acceptance checks:
1. Merge, extract, reorder, and rotate a sample PDF; compare with baseline.
2. Split a three-page PDF; ZIP must contain 3 readable one-page PDF files.
3. Remove a page range, reject removing all pages.
4. Convert PNG and JPEG into separate PDF pages.
5. Render a short PDF into PNG ZIP.
6. Apply text watermark and page numbering.
7. Test search, category filters, dark mode, keyboard, and mobile.
8. Confirm no file upload API receives document bytes.

Proxmox integration remains future work behind explicit opt-in and authenticated Cloudflare Tunnel. No backend processing is activated in this phase.
