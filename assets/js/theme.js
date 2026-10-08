(() => {
    const SITE_NAME = "Astakula Tools";
    const SITE_URL = "https://tools.astakula.com/";
    const PARENT_BRAND = "Astakula";
    const PARENT_URL = "https://astakula.com/";
    const AUTHOR_NAME = "Ariyo Ardiwardana";
    const AUTHOR_ID = `${SITE_URL}#ariyo-ardiwardana`;
    const ORGANIZATION_ID = `${PARENT_URL}#organization`;
    const WEBSITE_ID = `${SITE_URL}#website`;

    const TOOL_SEO = {
        qr: {
            name: "QR Code Generator",
            title: "QR Code Generator — Astakula Tools",
            description: "Create QR codes for URLs, text, WhatsApp, Wi-Fi, email, phone, SMS, contacts, locations, and calendar events, then export PNG or SVG.",
            category: "UtilitiesApplication",
            question: "What is a QR code generator?",
            answer: "A QR code generator converts supported text or structured data into a scannable QR code. This tool supports URLs, text, WhatsApp, Wi-Fi, email, phone, SMS, vCard contacts, locations, and calendar events.",
            howTo: [
                "Choose the QR type that matches the data you want to encode.",
                "Enter the required details and generate the QR code.",
                "Check the preview, then download the result as PNG or SVG."
            ],
            useCases: ["Share a web link or message", "Create Wi-Fi or contact QR codes", "Prepare location or calendar-event QR codes"],
            features: ["URL and text QR codes", "WhatsApp and Wi-Fi payloads", "Contact, location, and event payloads", "PNG and SVG export"],
            faq: [
                { q: "Does Astakula Tools upload the QR data?", a: "No Astakula application backend is used by the QR generator. The QR payload is assembled and rendered in the browser." },
                { q: "Can a QR code itself expire?", a: "The generated QR image has no built-in expiry. A QR code that points to an external URL can stop being useful if that destination changes or becomes unavailable." },
                { q: "Which download formats are supported?", a: "The QR generator exports PNG and SVG files." }
            ],
            related: ["json", "base64", "image"]
        },
        json: {
            name: "JSON Formatter",
            title: "JSON Formatter — Astakula Tools",
            description: "Format, minify, validate, copy, and download JSON in the browser, with file drop, paste, and indentation controls.",
            category: "DeveloperApplication",
            question: "What is a JSON formatter?",
            answer: "A JSON formatter turns valid JSON into a readable, consistently indented structure. Astakula Tools can also minify and validate JSON using the browser's JSON parser.",
            howTo: [
                "Paste JSON text or choose a .json file.",
                "Select Format, Minify, or Validate depending on the task.",
                "Copy the output or download it as a .json file."
            ],
            useCases: ["Read minified API responses", "Validate JSON before using it in an application", "Normalize JSON formatting for debugging or sharing"],
            features: ["JSON formatting", "JSON minification", "JSON validation", "Copy and download output"],
            faq: [
                { q: "Is JSON processing sent to an Astakula server?", a: "No. The current implementation parses, formats, and minifies JSON in the browser." },
                { q: "What indentation options are available?", a: "Formatted output can use two or four spaces for indentation." },
                { q: "Can I open a JSON file instead of pasting text?", a: "Yes. The tool accepts .json files through the file picker, drag and drop, or supported paste workflows." }
            ],
            related: ["base64", "hash", "excel"]
        },
        base64: {
            name: "Base64 Encoder & Decoder",
            title: "Base64 Encoder & Decoder — Astakula Tools",
            description: "Encode and decode Base64 text or files in the browser, including optional Data URL output and downloadable decoded files.",
            category: "DeveloperApplication",
            question: "What is a Base64 encoder and decoder?",
            answer: "A Base64 encoder converts text or binary data into a Base64 representation, while a decoder reverses that representation. This tool supports UTF-8 text, files, and Data URL prefixes.",
            howTo: [
                "Choose Text or File mode.",
                "Enter text, select a file, or paste Base64 data.",
                "Encode or decode, then copy or download the result."
            ],
            useCases: ["Encode UTF-8 text", "Convert a file to Base64 or a Data URL", "Decode Base64 back into a downloadable file"],
            features: ["UTF-8 text encode and decode", "File-to-Base64 conversion", "Data URL support", "Decoded file download"],
            faq: [
                { q: "Are files uploaded for Base64 conversion?", a: "No Astakula application backend receives the selected file. File encoding and decoding are performed in the browser." },
                { q: "What is the file-size limit?", a: "The current file workflow accepts files up to 20 MB." },
                { q: "Can the tool include a Data URL prefix?", a: "Yes. File-to-Base64 mode can optionally include a data: URL prefix, and the decoder can read Base64 Data URLs." }
            ],
            related: ["json", "hash", "image"]
        },
        uuid: {
            name: "UUID Generator",
            title: "UUID Generator — Astakula Tools",
            description: "Generate UUID v4 or UUID v7 values in the browser, individually or in batches, with case and hyphen options.",
            category: "DeveloperApplication",
            question: "What is a UUID generator?",
            answer: "A UUID generator creates universally unique identifier values for use as IDs in software and data systems. This tool generates UUID v4 and time-ordered UUID v7 values in the browser.",
            howTo: [
                "Choose UUID v4 or UUID v7.",
                "Set the quantity, letter case, and hyphen preference.",
                "Generate the values, then copy them or download a text file."
            ],
            useCases: ["Create IDs for test data", "Generate identifiers for application records", "Prepare bulk UUID lists for development tasks"],
            features: ["UUID v4 generation", "UUID v7 generation", "Bulk generation up to 1000 values", "Case and hyphen options"],
            faq: [
                { q: "Where are UUIDs generated?", a: "UUID generation runs in the browser and does not require an Astakula application server." },
                { q: "How many UUIDs can I generate at once?", a: "The current interface allows between 1 and 1000 UUIDs per batch." },
                { q: "What is the difference between UUID v4 and v7 here?", a: "UUID v4 uses random data, while UUID v7 includes a Unix millisecond timestamp with random bits so generated values are time-ordered." }
            ],
            related: ["hash", "json", "base64"]
        },
        hash: {
            name: "Hash Generator",
            title: "Hash Generator — Astakula Tools",
            description: "Generate and compare MD5, SHA-1, SHA-256, SHA-384, and SHA-512 hashes for text or files directly in the browser.",
            category: "DeveloperApplication",
            question: "What is a hash generator?",
            answer: "A hash generator calculates a fixed-length digest from text or file data using a selected algorithm. Astakula Tools supports MD5, SHA-1, SHA-256, SHA-384, and SHA-512 and can compare a generated digest with an expected value.",
            howTo: [
                "Choose Text or File mode and select a hash algorithm.",
                "Enter text or choose the file you want to hash.",
                "Generate the digest, then copy, download, or compare it."
            ],
            useCases: ["Check whether a downloaded file matches a published checksum", "Generate a digest for text or file data", "Compare two hash values"],
            features: ["MD5 and SHA hashing", "Text and file input", "Digest comparison", "Lowercase or uppercase output"],
            faq: [
                { q: "Are files uploaded before hashing?", a: "No Astakula application backend receives the selected file. The file is read and hashed in the browser." },
                { q: "What is the maximum file size?", a: "The current file input accepts files up to 50 MB." },
                { q: "Does a matching hash prove a file is safe?", a: "No. A matching digest only shows that the compared data produced the same hash value; it is not a malware or security scan." }
            ],
            related: ["base64", "uuid", "json"]
        },
        image: {
            name: "Image Tools",
            title: "Image Tools — Astakula Tools",
            description: "Compress, resize, crop, convert, optimize, and inspect PNG, JPEG, WebP, or AVIF images in the browser, including batch processing.",
            category: "MultimediaApplication",
            question: "What can Astakula Image Tools do?",
            answer: "Astakula Image Tools combines common browser-based image workflows in one page: compression, resizing, cropping, format conversion, optimization, and basic file information. Supported source formats include PNG, JPEG, WebP, and AVIF where the browser can decode them.",
            howTo: [
                "Add one or more supported images.",
                "Choose Compress, Resize, Crop, Convert, Optimize, or Info and adjust the available settings.",
                "Process the images and download individual outputs or all completed results."
            ],
            useCases: ["Reduce image file size", "Prepare social or web image dimensions", "Convert between common browser-supported formats"],
            features: ["Image compression", "Resize and crop", "PNG, JPEG, WebP, and AVIF workflows", "Batch processing and basic image information"],
            faq: [
                { q: "Are selected images uploaded to Astakula?", a: "No Astakula application backend receives the selected images. The current implementation processes them with browser APIs." },
                { q: "Does Optimize remove image metadata?", a: "The Optimize workflow re-encodes image pixels through canvas. The current interface is designed to strip embedded metadata from exported files rather than preserve it." },
                { q: "Does AVIF always work?", a: "AVIF support depends on the browser's ability to decode or encode that format. The interface marks AVIF conversion support as browser-dependent." }
            ],
            related: ["gif", "favicon", "pdf"]
        },
        pdf: {
            name: "PDF Tools Hub",
            title: "PDF Tools Hub — Astakula Tools",
            description: "Use 10 free browser-based tools to merge, split, organize, convert images, watermark, and number PDF pages locally.",
            category: "UtilitiesApplication",
            question: "What can the Astakula PDF Tools Hub do?",
            answer: "Astakula PDF Tools lets you merge, split, extract, remove, reorder, rotate, watermark, and number PDF pages, convert PNG/JPG to PDF, and render PDF pages as PNG. Operations run in your browser.",
            howTo: [
                "Choose an available tool from the catalog or workspace tabs.",
                "Add your PDF or images, then configure the relevant options.",
                "Process the document locally and download the PDF or ZIP result."
            ],
            useCases: ["Organize and edit PDF pages", "Convert JPG and PNG images to PDF", "Export PDF pages as PNG", "Add text watermarks and page numbers"],
            features: ["PDF merge and split", "Page extraction and removal", "Page reordering and rotation", "Image to PDF and PDF to PNG", "Text watermark", "Page numbering"],
            faq: [
                { q: "Does Astakula upload the documents I select?", a: "No. The currently available PDF tools process the selected documents locally in your browser, not on an Astakula processing server." },
                { q: "Can I use password-protected PDFs?", a: "No. Encrypted PDF processing is planned for a future native processing engine." },
                { q: "Do the converted PNG images preserve selectable PDF text?", a: "No. PDF to PNG rasterizes each PDF page into an image and delivers images together in a ZIP file." },
                { q: "Which features require a processing server?", a: "OCR, advanced compression, file repair, and high-fidelity Office conversion are planned, not yet available." }
            ],
            related: ["image", "excel", "gif"]
        },
        gif: {
            name: "GIF Maker",
            title: "GIF Maker — Astakula Tools",
            description: "Create an animated GIF from PNG, JPEG, WebP, or AVIF images with frame order, delay, size, fit, palette, background, and loop controls.",
            category: "MultimediaApplication",
            question: "What is the Astakula GIF Maker?",
            answer: "The Astakula GIF Maker combines a sequence of source images into an animated GIF. You can reorder frames, change timing, choose output dimensions and fitting behavior, set palette size, and control looping.",
            howTo: [
                "Add at least two supported source images.",
                "Arrange the frame order and choose GIF settings such as delay, dimensions, colors, and looping.",
                "Create the GIF, review the preview, and download the result."
            ],
            useCases: ["Create simple frame animations", "Turn screenshots or design frames into a looping GIF", "Prepare lightweight animated assets"],
            features: ["Image-sequence GIF creation", "Frame reordering", "Delay and loop controls", "64, 128, or 256-color palettes"],
            faq: [
                { q: "Are source frames uploaded to Astakula?", a: "No Astakula application backend receives the source frames. GIF encoding runs in the browser." },
                { q: "How many source frames can I add?", a: "The current interface accepts up to 30 frames, with a 15 MB limit per file and a 180 MB aggregate source limit." },
                { q: "Why can GIF colors look different from the source images?", a: "GIF uses a limited color palette. This tool allows 64, 128, or 256 colors per frame, so photographic images can show color reduction." }
            ],
            related: ["image", "favicon", "pdf"]
        },
        favicon: {
            name: "Favicon Generator",
            title: "Favicon Generator — Astakula Tools",
            description: "Generate favicon.ico, browser PNG icons, an Apple touch icon, web app icons, a web manifest, and recommended HTML tags from one image.",
            category: "DeveloperApplication",
            question: "What does a favicon generator create?",
            answer: "A favicon generator turns one source image into the icon files commonly referenced by websites and web apps. This tool creates favicon.ico, PNG browser icons, an Apple touch icon, 192 and 512 pixel web app icons, a manifest, and recommended HTML tags.",
            howTo: [
                "Choose a PNG, JPEG, WebP, AVIF, or SVG source image.",
                "Set image fitting, padding, and background behavior.",
                "Generate the package, then download individual assets, favicon.ico, or the ZIP package."
            ],
            useCases: ["Prepare a favicon set for a website", "Generate Apple and web app icons", "Create a reusable icon package from a single brand image"],
            features: ["Multi-size favicon.ico", "PNG browser icons", "Apple and web app icons", "Web manifest and HTML reference tags"],
            faq: [
                { q: "Is the source image uploaded to Astakula?", a: "No Astakula application backend receives the source image. The icon assets are rendered in the browser." },
                { q: "Which source formats are accepted?", a: "The current file input accepts PNG, JPEG, WebP, AVIF, and SVG files up to 15 MB." },
                { q: "What is included in the generated package?", a: "The package includes favicon.ico, 16, 32, and 48 pixel PNGs, a 180 pixel Apple touch icon, 192 and 512 pixel web app icons, site.webmanifest, and recommended HTML tags." }
            ],
            related: ["image", "gif", "json"]
        },
        excel: {
            name: "Excel Tools",
            title: "Excel Tools — Astakula Tools",
            description: "View, convert, clean, split, merge, search, sort, and deduplicate XLSX, XLS, CSV, or JSON spreadsheet data in the browser.",
            category: "BusinessApplication",
            question: "What can Astakula Excel Tools do?",
            answer: "Astakula Excel Tools is a data-focused spreadsheet workspace for XLSX, XLS, CSV, and JSON files. It can preview data, convert formats, split or combine workbook data, clean rows and columns, sort values, and find or remove duplicates.",
            howTo: [
                "Open a supported spreadsheet file.",
                "Choose Viewer, Convert, Workbook, Clean data, or Duplicates.",
                "Review the working data and export the result in the required format."
            ],
            useCases: ["Inspect spreadsheet data without opening a desktop office suite", "Convert worksheet data to CSV or JSON", "Clean and deduplicate tabular data before reuse"],
            features: ["Spreadsheet viewer", "XLSX, CSV, and JSON export", "Workbook split and merge workflows", "Cleaning, sorting, and duplicate handling"],
            faq: [
                { q: "Are spreadsheet contents uploaded to Astakula?", a: "No Astakula application backend receives the selected spreadsheet. Parsing and transformations run in the browser." },
                { q: "Which formats can I open?", a: "The current tool accepts XLSX, XLS, CSV, and JSON files up to 50 MB for the main workbook workflow." },
                { q: "Will complex Excel formatting always be preserved?", a: "No. The tool is intentionally data-focused. Macros, charts, pivot tables, and advanced formatting are not guaranteed to survive transformations." }
            ],
            related: ["json", "pdf", "base64"]
        },
        network: {
            name: "Network Tools",
            title: "Network Tools — Astakula Tools",
            description: "Calculate IPv4 subnets and ranges, split CIDR blocks, convert IP and MAC values, estimate bandwidth, reference common ports, and inspect DNS records.",
            category: "DeveloperApplication",
            question: "What are Astakula Network Tools?",
            answer: "Astakula Network Tools groups practical IPv4, CIDR, MAC, bandwidth, port, and DNS utilities in one browser workspace. Most calculations are local; DNS inspection sends the requested domain and record type to Cloudflare's public DNS-over-HTTPS resolver.",
            howTo: [
                "Choose the network utility you need, such as Subnet, IP Range, IPv4, MAC, Bandwidth, Ports, or DNS.",
                "Enter the required address, range, rate, search term, or DNS query.",
                "Run the calculation or lookup and review the generated results."
            ],
            useCases: ["Calculate subnet and host ranges", "Convert or normalize IPv4 and MAC values", "Inspect common ports or public DNS records"],
            features: ["IPv4 subnet and range calculations", "Subnet splitting", "IPv4 and MAC conversion", "Bandwidth estimates, port reference, and DNS inspection"],
            faq: [
                { q: "Which Network Tools operations stay in the browser?", a: "Subnet, IP range, subnet split, IPv4, MAC, bandwidth, and port-reference operations are implemented locally in the browser." },
                { q: "Does DNS Inspector contact an external service?", a: "Yes. DNS Inspector sends the requested domain and record type to Cloudflare's public DNS-over-HTTPS resolver." },
                { q: "Does Astakula Tools keep a network-history database?", a: "The current repository contains no application database, login system, or stored network-history feature." }
            ],
            related: ["hash", "json", "uuid"]
        }
    };

    const earlyTheme = (() => {
        try {
            const stored = localStorage.getItem("tools-astakula-theme") || localStorage.getItem("tools-astakula-json-theme");
            if (stored === "dark" || stored === "light") return stored;
        } catch {
            // Ignore storage failures and use the system preference.
        }
        return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    })();
    document.documentElement.dataset.theme = earlyTheme;

    const currentScript = document.currentScript;
    const scriptBase = currentScript?.src ? new URL("./", currentScript.src) : new URL("/assets/js/", window.location.origin);

    function escapeHtml(value) {
        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function currentToolSlug() {
        const parts = window.location.pathname.split("/").filter(Boolean);
        const slug = parts[parts.length - 1] || "";
        return Object.prototype.hasOwnProperty.call(TOOL_SEO, slug) ? slug : null;
    }

    function upsertMeta(selector, attributeName, attributeValue, content) {
        let meta = document.head.querySelector(selector);
        if (!meta) {
            meta = document.createElement("meta");
            meta.setAttribute(attributeName, attributeValue);
            document.head.appendChild(meta);
        }
        meta.setAttribute("content", content);
    }

    function upsertCanonical(url) {
        let canonical = document.head.querySelector('link[rel="canonical"]');
        if (!canonical) {
            canonical = document.createElement("link");
            canonical.rel = "canonical";
            document.head.appendChild(canonical);
        }
        canonical.href = url;
    }

    function installToolMetadata() {
        const slug = currentToolSlug();
        if (!slug) return;

        const seo = TOOL_SEO[slug];
        const canonicalUrl = `${SITE_URL}${slug}/`;

        document.title = seo.title;
        upsertMeta('meta[name="description"]', "name", "description", seo.description);
        upsertMeta('meta[name="robots"]', "name", "robots", "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1");
        upsertMeta('meta[name="author"]', "name", "author", AUTHOR_NAME);
        upsertMeta('meta[property="og:type"]', "property", "og:type", "website");
        upsertMeta('meta[property="og:locale"]', "property", "og:locale", "en_US");
        upsertMeta('meta[property="og:title"]', "property", "og:title", seo.title);
        upsertMeta('meta[property="og:description"]', "property", "og:description", seo.description);
        upsertMeta('meta[property="og:url"]', "property", "og:url", canonicalUrl);
        upsertMeta('meta[property="og:site_name"]', "property", "og:site_name", SITE_NAME);
        upsertMeta('meta[name="twitter:card"]', "name", "twitter:card", "summary");
        upsertMeta('meta[name="twitter:title"]', "name", "twitter:title", seo.title);
        upsertMeta('meta[name="twitter:description"]', "name", "twitter:description", seo.description);
        upsertCanonical(canonicalUrl);

        let schema = document.getElementById("tools-astakula-seo-schema");
        if (!schema) {
            schema = document.createElement("script");
            schema.id = "tools-astakula-seo-schema";
            schema.type = "application/ld+json";
            document.head.appendChild(schema);
        }

        schema.textContent = JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "Organization",
                    "@id": ORGANIZATION_ID,
                    "name": PARENT_BRAND,
                    "url": PARENT_URL
                },
                {
                    "@type": "Person",
                    "@id": AUTHOR_ID,
                    "name": AUTHOR_NAME,
                    "affiliation": { "@id": ORGANIZATION_ID }
                },
                {
                    "@type": "WebPage",
                    "@id": `${canonicalUrl}#webpage`,
                    "url": canonicalUrl,
                    "name": seo.title,
                    "description": seo.description,
                    "inLanguage": "en",
                    "isPartOf": { "@id": WEBSITE_ID },
                    "author": { "@id": AUTHOR_ID },
                    "breadcrumb": { "@id": `${canonicalUrl}#breadcrumb` },
                    "mainEntity": { "@id": `${canonicalUrl}#app` }
                },
                {
                    "@type": "BreadcrumbList",
                    "@id": `${canonicalUrl}#breadcrumb`,
                    "itemListElement": [
                        { "@type": "ListItem", "position": 1, "name": SITE_NAME, "item": SITE_URL },
                        { "@type": "ListItem", "position": 2, "name": seo.name, "item": canonicalUrl }
                    ]
                },
                {
                    "@type": "WebApplication",
                    "@id": `${canonicalUrl}#app`,
                    "name": seo.name,
                    "url": canonicalUrl,
                    "description": seo.description,
                    "applicationCategory": seo.category,
                    "operatingSystem": "Any",
                    "browserRequirements": "Requires JavaScript and a modern web browser",
                    "featureList": seo.features.join("; "),
                    "isAccessibleForFree": true,
                    "creator": { "@id": AUTHOR_ID },
                    "publisher": { "@id": ORGANIZATION_ID }
                },
                {
                    "@type": "FAQPage",
                    "@id": `${canonicalUrl}#faq`,
                    "mainEntity": seo.faq.map((item) => ({
                        "@type": "Question",
                        "name": item.q,
                        "acceptedAnswer": { "@type": "Answer", "text": item.a }
                    }))
                }
            ]
        });
    }

    function installEnhancementStyles() {
        if (document.getElementById("astakula-seo-aeo-geo-styles")) return;
        const style = document.createElement("style");
        style.id = "astakula-seo-aeo-geo-styles";
        style.textContent = `
            .seo-content { margin-top: 72px; padding: 30px; background: var(--ta-surface); color: var(--ta-text); border: var(--ta-border-heavy) solid var(--ta-border); box-shadow: var(--ta-shadow-lg); }
            .seo-content .seo-answer { max-width: 900px; }
            .seo-content .seo-answer h2, .seo-content .faq-section > h2, .seo-content .related-tools > h2 { margin: 6px 0 12px; font-size: clamp(26px, 3vw, 38px); line-height: 1.08; letter-spacing: -.035em; }
            .seo-content .seo-answer p { margin: 0; max-width: 880px; color: var(--ta-muted); font-size: 15px; line-height: 1.7; }
            .seo-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; margin-top: 26px; }
            .seo-card { padding: 20px; background: var(--ta-bg); border: var(--ta-border-width) solid var(--ta-border); }
            .seo-card h2 { margin: 0 0 12px; font-size: 20px; letter-spacing: -.025em; }
            .seo-card ol, .seo-card ul { margin: 0; padding-left: 20px; color: var(--ta-muted); }
            .seo-card li + li { margin-top: 8px; }
            .faq-section, .related-tools { margin-top: 30px; }
            .faq-list { display: grid; gap: 10px; }
            .faq-list details { background: var(--ta-bg); border: var(--ta-border-width) solid var(--ta-border); }
            .faq-list summary { cursor: pointer; padding: 14px 16px; font-weight: 850; }
            .faq-list details p { margin: 0; padding: 0 16px 16px; color: var(--ta-muted); line-height: 1.65; }
            .related-links { display: flex; flex-wrap: wrap; gap: 10px; }
            .related-links a, .ta-footer-links a { text-decoration: underline; text-underline-offset: 3px; }
            .related-links a { padding: 10px 12px; background: var(--ta-bg); border: var(--ta-border-width) solid var(--ta-border); font-size: 12px; font-weight: 850; text-decoration: none; }
            .related-links a:hover { background: var(--ta-yellow); color: var(--ta-on-accent); }
            .creator-note { margin: 28px 0 0; padding-top: 20px; border-top: var(--ta-border-width) solid var(--ta-border); color: var(--ta-muted); font-size: 12px; line-height: 1.6; }
            .site-footer-inner { flex-wrap: wrap; }
            .ta-footer-links { display: flex; flex-wrap: wrap; gap: 14px; margin-left: auto; font-size: 12px; }
            .legal-main { width: min(calc(100% - 40px), 980px); margin: 0 auto; padding: 56px 0 80px; }
            .legal-hero { padding: 42px; background: var(--ta-yellow); color: var(--ta-on-accent); border: var(--ta-border-heavy) solid var(--ta-border); box-shadow: var(--ta-shadow-lg); }
            .legal-hero h1 { margin: 0; font-size: clamp(42px, 7vw, 72px); line-height: .98; letter-spacing: -.05em; }
            .legal-hero p { max-width: 720px; margin: 18px 0 0; line-height: 1.65; }
            .legal-card { margin-top: 26px; padding: 28px; background: var(--ta-surface); border: var(--ta-border-heavy) solid var(--ta-border); box-shadow: var(--ta-shadow-md); }
            .legal-card h2 { margin: 0 0 12px; font-size: 24px; letter-spacing: -.03em; }
            .legal-card h3 { margin: 22px 0 8px; font-size: 17px; }
            .legal-card p, .legal-card li { color: var(--ta-muted); line-height: 1.7; }
            .legal-card ul { padding-left: 20px; }
            .legal-meta { margin: 0 0 20px; color: var(--ta-muted); font-size: 12px; }
            .legal-card a { text-decoration: underline; text-underline-offset: 3px; }
            @media (max-width: 760px) {
                .seo-content { margin-top: 48px; padding: 20px 16px; box-shadow: 5px 5px 0 #050607; }
                .seo-grid { grid-template-columns: 1fr; }
                .ta-footer-links { margin-left: 0; }
                .legal-main { width: calc(100% - 28px); padding: 32px 0 56px; }
                .legal-hero { padding: 30px 24px; }
                .legal-card { padding: 22px 18px; }
            }
        `;
        document.head.appendChild(style);
    }

    function normalizeBranding() {
        document.querySelectorAll(".brand-wordmark").forEach((node) => { node.textContent = SITE_NAME; });
        document.querySelectorAll("a.brand").forEach((node) => {
            if (!node.querySelector(".brand-wordmark")) node.textContent = SITE_NAME;
            node.setAttribute("aria-label", `${SITE_NAME} Home`);
        });
        document.querySelectorAll(".site-footer-inner > p:first-child").forEach((node) => { node.textContent = SITE_NAME; });
    }

    function installFooterLinks() {
        document.querySelectorAll(".site-footer-inner").forEach((footer) => {
            if (footer.querySelector("[data-footer-links]")) return;
            const nav = document.createElement("nav");
            nav.className = "ta-footer-links";
            nav.dataset.footerLinks = "true";
            nav.setAttribute("aria-label", "Legal and site links");
            nav.innerHTML = `<a href="/">Tools</a><a href="/privacy/">Privacy Policy</a><a href="/terms/">Terms of Service</a><a href="${PARENT_URL}" target="_blank" rel="noopener noreferrer">Astakula</a>`;
            footer.appendChild(nav);
        });
    }

    function installToolContent() {
        const slug = currentToolSlug();
        if (!slug || document.querySelector("[data-seo-content]")) return;
        const seo = TOOL_SEO[slug];
        const main = document.querySelector("main");
        if (!main) return;

        const section = document.createElement("section");
        section.className = "seo-content";
        section.dataset.seoContent = "true";
        section.setAttribute("aria-label", `${seo.name} information`);

        const howTo = seo.howTo.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
        const useCases = seo.useCases.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
        const faq = seo.faq.map((item) => `<details><summary>${escapeHtml(item.q)}</summary><p>${escapeHtml(item.a)}</p></details>`).join("");
        const related = seo.related.map((relatedSlug) => {
            const relatedTool = TOOL_SEO[relatedSlug];
            return `<a href="/${relatedSlug}/">${escapeHtml(relatedTool.name)}</a>`;
        }).join("");

        section.innerHTML = `
            <div class="seo-answer">
                <p class="section-number">ABOUT THIS TOOL</p>
                <h2>${escapeHtml(seo.question)}</h2>
                <p>${escapeHtml(seo.answer)}</p>
            </div>
            <div class="seo-grid">
                <article class="seo-card">
                    <h2>How to use ${escapeHtml(seo.name)}</h2>
                    <ol>${howTo}</ol>
                </article>
                <article class="seo-card">
                    <h2>Common use cases</h2>
                    <ul>${useCases}</ul>
                </article>
            </div>
            <section class="faq-section" aria-labelledby="${slug}-faq-heading">
                <h2 id="${slug}-faq-heading">Frequently asked questions</h2>
                <div class="faq-list">${faq}</div>
            </section>
            <nav class="related-tools" aria-labelledby="${slug}-related-heading">
                <h2 id="${slug}-related-heading">Related tools</h2>
                <div class="related-links">${related}</div>
            </nav>
            <p class="creator-note">${SITE_NAME} is a collection of web-based utilities developed by ${AUTHOR_NAME} under ${PARENT_BRAND}. Tool capabilities and privacy notes on this page describe the current implementation.</p>
        `;

        main.appendChild(section);
    }

    function installEnhancements() {
        installEnhancementStyles();
        installToolMetadata();

        const ready = () => {
            normalizeBranding();
            installFooterLinks();
            installToolContent();
        };

        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", ready, { once: true });
        } else {
            ready();
        }
    }

    const core = document.createElement("script");
    core.src = new URL("theme-core.js?v=1", scriptBase).href;
    core.async = false;
    core.addEventListener("load", installEnhancements, { once: true });
    core.addEventListener("error", installEnhancements, { once: true });
    document.head.appendChild(core);
})();
