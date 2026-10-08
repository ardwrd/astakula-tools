# Astakula Tools

A growing collection of practical browser-based utilities developed by Ariyo Ardiwardana under Astakula.

Live site: https://tools.astakula.com/

Most tools process user input directly in the browser. No Astakula application backend is used for ordinary file-processing workflows. Features that intentionally contact external services are documented in the interface and Privacy Policy.

## Available tools

| Tool | Route | Main use |
| --- | --- | --- |
| QR Code Generator | `/qr/` | Generate QR codes for URLs, text, WhatsApp, Wi-Fi, contacts, locations, calendar events, and more |
| JSON Formatter | `/json/` | Format, minify, validate, copy, and download JSON |
| Base64 Encoder & Decoder | `/base64/` | Encode/decode UTF-8 text and files |
| UUID Generator | `/uuid/` | Generate UUID v4 and v7 individually or in bulk |
| Hash Generator | `/hash/` | Generate and compare MD5 and SHA hashes |
| Image Tools | `/image/` | Compress, resize, crop, convert, optimize, and inspect images |
| PDF Tools | `/pdf/` | Merge, extract, reorder, and rotate PDF pages |
| GIF Maker | `/gif/` | Create animated GIFs from image sequences |
| Favicon Generator | `/favicon/` | Generate favicon, Apple touch, and web-app icon packages |
| Excel Tools | `/excel/` | View, convert, clean, split, merge, sort, and deduplicate spreadsheet data |
| Network Tools | `/network/` | Subnet, IP, MAC, bandwidth, port-reference, and DNS utilities |
| Social Media Tools | `/social/` | Carousel splitting, profile-grid preview, and social-media safe-zone guides |
| Work Schedule Generator | `/schedule/` | Build monthly staff schedules, record requested days off, validate assignments, and export Excel |
| Bulk Certificate Generator | `/certificate/` | Merge a finished certificate design with spreadsheet participant data and generate certificates in bulk |
| Color Palette Generator | `/color/` | Extract representative colors, build structured OKLCH palettes, generate tonal scales, and check WCAG contrast |

## Tool details

### QR Code Generator
Supports URL, plain text, WhatsApp, Wi-Fi, email, phone, SMS, vCard, location, and calendar-event payloads, with PNG and SVG export.

### JSON Formatter
Supports formatting, minifying, validation, copy, download, drag-and-drop and pasted `.json` files, input/output swap, and 2/4-space indentation.

### Base64
Supports UTF-8 text encode/decode, input/output swap, file-to-Base64 encoding, optional Data URL output, pasted or dropped files up to 20 MB, and Base64/Data URL decoding back to downloadable files.

### UUID Generator
Supports UUID v4 and UUID v7, 1–1000 values per batch, lowercase or uppercase output, optional hyphen removal, copy, regeneration, and `.txt` download.

### Hash Generator
Supports MD5, SHA-1, SHA-256, SHA-384, and SHA-512 for text or files up to 50 MB, lowercase or uppercase digest output, copy, `.txt` download, and hash comparison.

### Image Tools
Provides browser-side image compression, resize, crop, format conversion, optimization, and basic image inspection. PNG, JPEG, WebP, and AVIF workflows depend on browser decoding/encoding support. Batch operations are available where applicable.

### PDF Tools
Supports local PDF merge, page extraction, page reordering, and page rotation. Merge mode supports up to 12 PDFs, with 50 MB per-file and 150 MB aggregate limits. Password-protected PDFs are not supported.

### GIF Maker
Supports PNG, JPEG, WebP, and AVIF source frames, frame reordering, configurable delay, palette size, contain/cover fitting, custom output dimensions, background color, loop control, preview, and GIF download. Up to 30 source frames can be queued.

### Favicon Generator
Accepts PNG, JPEG, WebP, AVIF, and SVG sources up to 15 MB. It generates a multi-size `favicon.ico`, browser PNGs, Apple touch icon, 192/512 px web-app icons, `site.webmanifest`, recommended HTML tags, and a ZIP package.

### Excel Tools
Accepts XLSX, XLS, CSV, and JSON files up to 50 MB. Features include spreadsheet preview/search, XLSX/CSV/JSON export, sheet extraction, workbook splitting, workbook merge, sheet combining, empty-row/column cleanup, whitespace trimming, find/replace, column rename, sorting, and duplicate detection/removal. The tool is data-first; complex macros, charts, pivots, and advanced formatting are not guaranteed to survive transformations.

### Network Tools
Includes an IPv4 subnet calculator, CIDR reference, exact IP-range-to-CIDR summarization, subnet splitting, IPv4 binary/hex/integer conversion, MAC normalization and flag inspection, bandwidth conversion, ideal transfer-time estimation, common-port reference, and DNS record inspection. Network calculations run locally; DNS inspection sends the requested domain and record type to Cloudflare's public DNS-over-HTTPS resolver.

### Social Media Tools
The Social category currently includes carousel splitting, profile-grid preview, and adjustable safe-zone guides. Safe-zone presets are practical guides, not official platform specifications.

### Work Schedule Generator
Creates monthly employee work/shift schedules with configurable shifts and minimum coverage. Requested dates are treated as unavailable during generation, while manual overrides are flagged by validation. Projects are stored locally in IndexedDB and can be backed up/imported as JSON or exported to XLSX.

### Bulk Certificate Generator
Uploads an almost-finished certificate design plus spreadsheet participant data, exposes detected columns as dynamic fields, allows field placement and typography controls, previews recipients, and exports PNG batches or a multi-page PDF. Certificate templates and spreadsheet data remain browser-side; selected web fonts are requested from Google Fonts.

### Color Palette Generator
The Color Palette Generator uses a fast, interactive palette-board workflow while keeping explicit color-system rules underneath:

- generates 2–10 swatches with Brand, UI System, Monochromatic, Analogous, Complementary, Split Complementary, Triadic, or Extracted modes;
- press Space or use the Generate button to regenerate only unlocked swatches;
- lock exact HEX values, edit HEX directly, drag or move swatches to reorder them, and add/remove colors without leaving the main palette board;
- accepts PNG, JPEG, WebP, or AVIF images and extracts perceptually distinct candidates using Oklab clustering;
- keeps technical inspection in a separate Analyze dialog with OKLCH values, 50–950 tonal scales, pairwise WCAG 2.2 contrast ratios, and heuristic palette signals;
- reduces OKLCH chroma where needed to map generated colors into the sRGB gamut;
- exports a HEX list, CSS variables, JSON, and a PNG palette sheet.

The interactive workflow is designed for rapid exploration, but harmony labels and quality signals remain suggestions rather than claims that a palette is objectively suitable for a brand. All image analysis and palette generation runs in the browser; source images are not uploaded to an Astakula application backend.

## Privacy and data flow

Most transformations run locally in the browser. Important exceptions or persistent browser behavior currently include:

- **DNS Inspector:** sends the requested domain and record type to Cloudflare DNS-over-HTTPS.
- **Work Schedule Generator:** stores editable schedule projects in the browser's IndexedDB until site data is cleared or the projects are deleted.
- **Theme preference:** stored in `localStorage`.
- **Bulk Certificate Generator:** loads selected web fonts from Google Fonts; participant spreadsheets and certificate templates are processed locally.
- **Color Palette Generator:** source images and generated palettes are processed locally in the browser and are not stored by an Astakula backend.
- **CDN libraries:** several tools load browser libraries from jsDelivr. Loading those assets creates normal requests to jsDelivr, but Astakula application code does not intentionally send tool-input contents to the CDN.

See `/privacy/` for the public Privacy Policy.

## UI

The UI uses a shared neobrutalist design system. The BRUT package `@sprtn/ui@1.3.2` is loaded through jsDelivr and normalized by the shared Astakula styles.

- `assets/css/astakula.css` is the static source of truth for shared design tokens, site chrome, light/dark colors, focus treatment, BRUT compatibility, SEO-content presentation, and shared responsive behavior.
- Tool-level `style.css` files contain tool-specific layouts and visualizations only.
- `assets/js/theme-core.js` owns theme behavior; visual theme rules remain in CSS rather than being injected at runtime.
- `assets/js/theme.js` provides shared metadata/branding/footer enhancements for routes that use them.

## Browser dependencies

Current browser-side libraries include:

- `pdf-lib@1.17.1` for PDF page operations.
- `pdfjs-dist@4.10.38` for rendering the first page of an uploaded PDF certificate template.
- `gifenc@1.0.3` for GIF encoding.
- `jszip@3.10.1` for ZIP creation.
- `xlsx@0.18.5` for spreadsheet parsing/writing.
- `jspdf@2.5.2` for certificate PDF export.
- Google Fonts API for fonts selected inside Bulk Certificate Generator.

The Color Palette Generator uses browser APIs and its own JavaScript color-conversion routines, so it adds no new runtime library dependency.

## Project structure

```text
astakula-tools/
├── assets/
│   ├── css/
│   │   ├── astakula.css
│   │   └── legal.css
│   └── js/
│       ├── theme.js
│       └── theme-core.js
├── qr/
├── json/
├── base64/
├── uuid/
├── hash/
├── image/
├── pdf/
├── gif/
├── favicon/
├── excel/
├── network/
├── social/
├── schedule/
├── certificate/
├── color/
│   ├── index.html
│   ├── style.css
│   └── app.js
├── privacy/
├── terms/
├── 404.html
├── favicon.svg
├── index.html
├── robots.txt
└── sitemap.xml
```

## SEO / AEO / GEO

Production pages use canonical URLs under `https://tools.astakula.com/`, descriptive metadata, Open Graph/Twitter metadata, structured data where appropriate, and visible explanatory content for indexable utility pages. `robots.txt` points to the canonical sitemap.

## License

MIT
