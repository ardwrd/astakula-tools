# Cross-tool browser QA

Automated, headless Chromium smoke tests for Excel Tools, Image Tools, and Bulk Certificate Generator.

Run `cd qa && npm install && npx playwright install chromium && npm run test:browser`.

The suite starts a local static server from the repository root, loads the same pinned SheetJS 0.20.3, JSZip and jsPDF browser bundles used by production, uploads in-memory fixture files and inspects exported bytes. It also checks viewport overflow at 375px.

External library bundles are downloaded once for each run (the BRUT stylesheet and SheetJS) and other expected libraries are served from pinned npm dependencies. No user data is used. Google Fonts are intentionally blocked so the certificate test verifies its fallback behavior.

A passing smoke test does not prove every tool capability or every mobile breakpoint; perform additional device QA for complex real-world spreadsheets, multi-megabyte images and certificate templates.
