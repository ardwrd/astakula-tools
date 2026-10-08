const PDFLib = window.PDFLib;

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_MERGE_FILES = 12;
const MAX_MERGE_TOTAL = 150 * 1024 * 1024;

const elements = {
    modeTabs: [...document.querySelectorAll("[data-mode]")],
    panels: [...document.querySelectorAll("[data-panel]")],
    statusBox: document.querySelector("#statusBox"),

    mergeInput: document.querySelector("#mergeInput"),
    mergeDropZone: document.querySelector("#mergeDropZone"),
    mergeQueue: document.querySelector("#mergeQueue"),
    mergeMeta: document.querySelector("#mergeMeta"),
    mergeButton: document.querySelector("#mergeButton"),
    clearMergeButton: document.querySelector("#clearMergeButton"),

    extractInput: document.querySelector("#extractInput"),
    extractDropZone: document.querySelector("#extractDropZone"),
    extractMeta: document.querySelector("#extractMeta"),
    extractPages: document.querySelector("#extractPages"),
    extractButton: document.querySelector("#extractButton"),
    clearExtractButton: document.querySelector("#clearExtractButton"),

    reorderInput: document.querySelector("#reorderInput"),
    reorderDropZone: document.querySelector("#reorderDropZone"),
    reorderMeta: document.querySelector("#reorderMeta"),
    reorderPages: document.querySelector("#reorderPages"),
    reorderButton: document.querySelector("#reorderButton"),
    clearReorderButton: document.querySelector("#clearReorderButton"),

    rotateInput: document.querySelector("#rotateInput"),
    rotateDropZone: document.querySelector("#rotateDropZone"),
    rotateMeta: document.querySelector("#rotateMeta"),
    rotatePages: document.querySelector("#rotatePages"),
    rotationSelect: document.querySelector("#rotationSelect"),
    rotateButton: document.querySelector("#rotateButton"),
    clearRotateButton: document.querySelector("#clearRotateButton"),

    resultPanel: document.querySelector("#resultPanel"),
    resultMeta: document.querySelector("#resultMeta"),
    resultFilename: document.querySelector("#resultFilename"),
    resultSize: document.querySelector("#resultSize"),
    downloadButton: document.querySelector("#downloadButton")
};

let activeMode = "merge";
let mergeFiles = [];
let singleFiles = {
    extract: null,
    reorder: null,
    rotate: null,
    split: null,
    remove: null,
    watermark: null,
    numbers: null,
    pdfpng: null
};
let pageCounts = {
    extract: 0,
    reorder: 0,
    rotate: 0,
    split: 0,
    remove: 0,
    watermark: 0,
    numbers: 0,
    pdfpng: 0
};
let result = null;

function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";

    const units = ["B", "KB", "MB", "GB"];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / (1024 ** index);
    const decimals = index === 0 ? 0 : value >= 10 ? 1 : 2;

    return `${value.toFixed(decimals)} ${units[index]}`;
}

function isPdf(file) {
    return file && (
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf")
    );
}

function baseName(filename) {
    const name = filename.replace(/\.pdf$/i, "").trim();
    return name || "document";
}

function setStatus(message, state = "neutral") {
    elements.statusBox.textContent = message;
    elements.statusBox.className = `status-box is-${state}`;
}

function clearResult() {
    if (result?.url) URL.revokeObjectURL(result.url);
    result = null;
    elements.resultPanel.classList.add("hidden");
    elements.resultFilename.textContent = "output.pdf";
    elements.resultSize.textContent = "0 B";
    elements.resultMeta.textContent = "Ready";
    elements.downloadButton.textContent = "Download PDF";
}

function setResult(bytes, filename, label, contentType = "application/pdf") {
    clearResult();

    const blob = new Blob([bytes], { type: contentType });
    const url = URL.createObjectURL(blob);

    result = { blob, url, filename };
    elements.resultFilename.textContent = filename;
    elements.resultSize.textContent = formatBytes(blob.size);
    elements.resultMeta.textContent = label;
    elements.downloadButton.textContent = filename.toLowerCase().endsWith(".zip") ? "Download ZIP" : "Download PDF";
    elements.resultPanel.classList.remove("hidden");
    elements.resultPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function downloadResult() {
    if (!result) {
        setStatus("Create a PDF result first.", "error");
        return;
    }

    const link = document.createElement("a");
    link.href = result.url;
    link.download = result.filename;
    document.body.append(link);
    link.click();
    link.remove();
}

function fileKey(file) {
    return `${file.name}:${file.size}:${file.lastModified}`;
}

async function loadPdf(file) {
    if (!PDFLib?.PDFDocument) {
        throw new Error("PDF library did not load. Refresh the page and try again.");
    }

    try {
        const bytes = await file.arrayBuffer();
        return await PDFLib.PDFDocument.load(bytes, { updateMetadata: false });
    } catch (error) {
        const message = String(error?.message || error || "");
        if (/encrypted|password/i.test(message)) {
            throw new Error("Password-protected or encrypted PDFs are not supported.");
        }
        throw new Error(`Could not read ${file.name}. Make sure it is a valid PDF.`);
    }
}

async function inspectSingleFile(mode, file) {
    if (!isPdf(file)) {
        throw new Error("Choose a PDF file.");
    }
    if (file.size > MAX_FILE_SIZE) {
        throw new Error("The PDF must be 50 MB or smaller.");
    }

    const pdf = await loadPdf(file);
    const count = pdf.getPageCount();
    if (!count) throw new Error("The PDF has no pages.");

    singleFiles[mode] = file;
    pageCounts[mode] = count;
    clearResult();
    updateSingleMeta(mode);
    setStatus(`${file.name} loaded · ${count} ${count === 1 ? "page" : "pages"}.`, "success");
}

function updateSingleMeta(mode) {
    const file = singleFiles[mode];
    const count = pageCounts[mode];
    const target = elements[`${mode}Meta`];

    target.textContent = file
        ? `${count} ${count === 1 ? "page" : "pages"} · ${formatBytes(file.size)}`
        : "No file";
}

function clearSingle(mode) {
    singleFiles[mode] = null;
    pageCounts[mode] = 0;
    elements[`${mode}Input`].value = "";
    updateSingleMeta(mode);
    clearResult();

    if (mode === "extract") elements.extractPages.value = "";
    if (mode === "reorder") elements.reorderPages.value = "";
    if (mode === "rotate") {
        elements.rotatePages.value = "";
        elements.rotationSelect.value = "90";
    }

    setStatus("Choose a PDF to continue.", "neutral");
}

function renderMergeQueue() {
    elements.mergeQueue.replaceChildren();
    elements.mergeQueue.classList.toggle("hidden", mergeFiles.length === 0);

    const total = mergeFiles.reduce((sum, file) => sum + file.size, 0);
    elements.mergeMeta.textContent = mergeFiles.length
        ? `${mergeFiles.length} ${mergeFiles.length === 1 ? "file" : "files"} · ${formatBytes(total)}`
        : "0 files";

    mergeFiles.forEach((file, index) => {
        const item = document.createElement("div");
        item.className = "queue-item";

        const order = document.createElement("span");
        order.className = "queue-order";
        order.textContent = String(index + 1).padStart(2, "0");

        const copy = document.createElement("div");
        copy.className = "queue-copy";
        const name = document.createElement("strong");
        name.textContent = file.name;
        name.title = file.name;
        const meta = document.createElement("span");
        meta.textContent = formatBytes(file.size);
        copy.append(name, meta);

        const actions = document.createElement("div");
        actions.className = "queue-actions";

        const up = document.createElement("button");
        up.className = "brut-btn brut-btn--sm";
        up.type = "button";
        up.textContent = "↑";
        up.setAttribute("aria-label", `Move ${file.name} up`);
        up.disabled = index === 0;
        up.addEventListener("click", () => moveMergeFile(index, index - 1));

        const down = document.createElement("button");
        down.className = "brut-btn brut-btn--sm";
        down.type = "button";
        down.textContent = "↓";
        down.setAttribute("aria-label", `Move ${file.name} down`);
        down.disabled = index === mergeFiles.length - 1;
        down.addEventListener("click", () => moveMergeFile(index, index + 1));

        const remove = document.createElement("button");
        remove.className = "brut-btn brut-btn--sm";
        remove.type = "button";
        remove.textContent = "Remove";
        remove.addEventListener("click", () => {
            mergeFiles.splice(index, 1);
            clearResult();
            renderMergeQueue();
            setStatus(mergeFiles.length ? `${mergeFiles.length} PDFs ready to merge.` : "Choose PDF files to merge.", "neutral");
        });

        actions.append(up, down, remove);
        item.append(order, copy, actions);
        elements.mergeQueue.append(item);
    });
}

function moveMergeFile(from, to) {
    if (to < 0 || to >= mergeFiles.length) return;
    const [file] = mergeFiles.splice(from, 1);
    mergeFiles.splice(to, 0, file);
    clearResult();
    renderMergeQueue();
}

function addMergeFiles(incoming) {
    const validIncoming = [...incoming];
    if (!validIncoming.length) return;

    const existing = new Set(mergeFiles.map(fileKey));
    let rejected = 0;
    let duplicate = 0;

    for (const file of validIncoming) {
        if (mergeFiles.length >= MAX_MERGE_FILES) break;

        if (!isPdf(file) || file.size > MAX_FILE_SIZE) {
            rejected += 1;
            continue;
        }

        if (existing.has(fileKey(file))) {
            duplicate += 1;
            continue;
        }

        const total = mergeFiles.reduce((sum, item) => sum + item.size, 0) + file.size;
        if (total > MAX_MERGE_TOTAL) {
            rejected += 1;
            continue;
        }

        mergeFiles.push(file);
        existing.add(fileKey(file));
    }

    elements.mergeInput.value = "";
    clearResult();
    renderMergeQueue();

    if (!mergeFiles.length) {
        setStatus("No PDFs were added. Use valid files up to 50 MB each.", "error");
        return;
    }

    const notes = [];
    if (rejected) notes.push(`${rejected} rejected`);
    if (duplicate) notes.push(`${duplicate} duplicate`);
    setStatus(`${mergeFiles.length} PDFs ready${notes.length ? ` · ${notes.join(", ")}` : ""}.`, "neutral");
}

function clearMerge() {
    mergeFiles = [];
    elements.mergeInput.value = "";
    clearResult();
    renderMergeQueue();
    setStatus("Choose PDF files to merge.", "neutral");
}

function parsePageExpression(expression, pageCount, { allowEmpty = false } = {}) {
    const value = expression.trim();

    if (!value) {
        if (allowEmpty) return Array.from({ length: pageCount }, (_, index) => index + 1);
        throw new Error("Enter at least one page number or range.");
    }

    const pages = [];
    const tokens = value.split(",").map((token) => token.trim()).filter(Boolean);

    if (!tokens.length) throw new Error("Enter a valid page expression.");

    for (const token of tokens) {
        const single = token.match(/^(\d+)$/);
        const range = token.match(/^(\d+)\s*-\s*(\d+)$/);

        if (single) {
            const page = Number(single[1]);
            if (page < 1 || page > pageCount) {
                throw new Error(`Page ${page} is outside this ${pageCount}-page PDF.`);
            }
            pages.push(page);
            continue;
        }

        if (range) {
            const start = Number(range[1]);
            const end = Number(range[2]);
            if (start < 1 || start > pageCount || end < 1 || end > pageCount) {
                throw new Error(`Range ${token} is outside this ${pageCount}-page PDF.`);
            }

            const step = start <= end ? 1 : -1;
            for (let page = start; step > 0 ? page <= end : page >= end; page += step) {
                pages.push(page);
            }
            continue;
        }

        throw new Error(`“${token}” is not a valid page number or range.`);
    }

    return pages;
}

async function mergePdfs() {
    if (mergeFiles.length < 2) {
        throw new Error("Choose at least two PDFs to merge.");
    }

    const output = await PDFLib.PDFDocument.create();
    let totalPages = 0;

    for (const file of mergeFiles) {
        setStatus(`Reading ${file.name}…`, "working");
        const source = await loadPdf(file);
        const copied = await output.copyPages(source, source.getPageIndices());
        copied.forEach((page) => output.addPage(page));
        totalPages += copied.length;
    }

    const bytes = await output.save({ useObjectStreams: true });
    setResult(bytes, "merged.pdf", `${totalPages} ${totalPages === 1 ? "page" : "pages"}`);
    setStatus(`${mergeFiles.length} PDFs merged into ${totalPages} pages.`, "success");
}

async function extractPages() {
    const file = singleFiles.extract;
    if (!file) throw new Error("Choose a PDF first.");

    const pageNumbers = parsePageExpression(elements.extractPages.value, pageCounts.extract);
    const source = await loadPdf(file);
    const output = await PDFLib.PDFDocument.create();
    const copied = await output.copyPages(source, pageNumbers.map((page) => page - 1));
    copied.forEach((page) => output.addPage(page));

    const bytes = await output.save({ useObjectStreams: true });
    setResult(bytes, `${baseName(file.name)}-pages.pdf`, `${copied.length} ${copied.length === 1 ? "page" : "pages"}`);
    setStatus(`${copied.length} pages extracted.`, "success");
}

async function reorderPages() {
    const file = singleFiles.reorder;
    if (!file) throw new Error("Choose a PDF first.");

    const pageNumbers = parsePageExpression(elements.reorderPages.value, pageCounts.reorder);
    const unique = new Set(pageNumbers);

    if (pageNumbers.length !== pageCounts.reorder || unique.size !== pageCounts.reorder) {
        throw new Error(`Reorder must include every page exactly once. This PDF has ${pageCounts.reorder} pages.`);
    }

    const source = await loadPdf(file);
    const output = await PDFLib.PDFDocument.create();
    const copied = await output.copyPages(source, pageNumbers.map((page) => page - 1));
    copied.forEach((page) => output.addPage(page));

    const bytes = await output.save({ useObjectStreams: true });
    setResult(bytes, `${baseName(file.name)}-reordered.pdf`, `${copied.length} pages`);
    setStatus("Page order updated.", "success");
}

async function rotatePages() {
    const file = singleFiles.rotate;
    if (!file) throw new Error("Choose a PDF first.");

    const pageNumbers = parsePageExpression(elements.rotatePages.value, pageCounts.rotate, { allowEmpty: true });
    const rotation = Number(elements.rotationSelect.value);
    const pdf = await loadPdf(file);

    for (const pageNumber of new Set(pageNumbers)) {
        const page = pdf.getPage(pageNumber - 1);
        const current = page.getRotation().angle || 0;
        page.setRotation(PDFLib.degrees((current + rotation) % 360));
    }

    const bytes = await pdf.save({ useObjectStreams: true });
    setResult(bytes, `${baseName(file.name)}-rotated.pdf`, `${new Set(pageNumbers).size} pages rotated`);
    setStatus(`${new Set(pageNumbers).size} pages rotated by ${rotation}° clockwise.`, "success");
}

async function runAction(button, workingMessage, action) {
    if (button.disabled) return;

    const actionButtons = [
        elements.mergeButton,
        elements.extractButton,
        elements.reorderButton,
        elements.rotateButton
    ];

    actionButtons.forEach((item) => { item.disabled = true; });
    setStatus(workingMessage, "working");

    try {
        await action();
    } catch (error) {
        setStatus(error.message || "Could not process this PDF.", "error");
    } finally {
        actionButtons.forEach((item) => { item.disabled = false; });
    }
}

function selectMode(mode) {
    activeMode = mode;
    clearResult();

    elements.modeTabs.forEach((tab) => {
        const active = tab.dataset.mode === mode;
        tab.classList.toggle("is-active", active);
        tab.setAttribute("aria-selected", String(active));
    });

    elements.panels.forEach((panel) => {
        panel.classList.toggle("hidden", panel.dataset.panel !== mode);
    });

    if (mode === "merge") {
        setStatus(mergeFiles.length ? `${mergeFiles.length} PDFs ready to merge.` : "Choose PDF files to merge.", "neutral");
    } else if (singleFiles[mode]) {
        setStatus(`${singleFiles[mode].name} loaded · ${pageCounts[mode]} pages.`, "neutral");
    } else {
        setStatus("Choose a PDF to continue.", "neutral");
    }
}

function setupDropZone(zone, input, onFiles) {
    ["dragenter", "dragover"].forEach((eventName) => {
        zone.addEventListener(eventName, (event) => {
            event.preventDefault();
            zone.classList.add("is-dragging");
        });
    });

    ["dragleave", "drop"].forEach((eventName) => {
        zone.addEventListener(eventName, (event) => {
            event.preventDefault();
            zone.classList.remove("is-dragging");
        });
    });

    zone.addEventListener("drop", (event) => {
        onFiles([...event.dataTransfer.files]);
    });

    input.addEventListener("change", () => {
        onFiles([...input.files]);
    });
}

async function handleSingleFiles(mode, files) {
    const file = files.find(isPdf) || files[0];
    if (!file) return;

    try {
        setStatus(`Reading ${file.name}…`, "working");
        await inspectSingleFile(mode, file);
    } catch (error) {
        singleFiles[mode] = null;
        pageCounts[mode] = 0;
        elements[`${mode}Input`].value = "";
        updateSingleMeta(mode);
        clearResult();
        setStatus(error.message || "Could not read this PDF.", "error");
    }
}

setupDropZone(elements.mergeDropZone, elements.mergeInput, addMergeFiles);
setupDropZone(elements.extractDropZone, elements.extractInput, (files) => handleSingleFiles("extract", files));
setupDropZone(elements.reorderDropZone, elements.reorderInput, (files) => handleSingleFiles("reorder", files));
setupDropZone(elements.rotateDropZone, elements.rotateInput, (files) => handleSingleFiles("rotate", files));

elements.modeTabs.forEach((tab) => {
    tab.addEventListener("click", () => selectMode(tab.dataset.mode));
});

elements.mergeButton.addEventListener("click", () => runAction(elements.mergeButton, "Merging PDFs…", mergePdfs));
elements.extractButton.addEventListener("click", () => runAction(elements.extractButton, "Extracting pages…", extractPages));
elements.reorderButton.addEventListener("click", () => runAction(elements.reorderButton, "Reordering pages…", reorderPages));
elements.rotateButton.addEventListener("click", () => runAction(elements.rotateButton, "Rotating pages…", rotatePages));

elements.clearMergeButton.addEventListener("click", clearMerge);
elements.clearExtractButton.addEventListener("click", () => clearSingle("extract"));
elements.clearReorderButton.addEventListener("click", () => clearSingle("reorder"));
elements.clearRotateButton.addEventListener("click", () => clearSingle("rotate"));
elements.downloadButton.addEventListener("click", downloadResult);

document.addEventListener("paste", (event) => {
    const files = [...(event.clipboardData?.files || [])].filter(isPdf);
    if (!files.length) return;

    event.preventDefault();
    const zone = activeMode === "merge" ? elements.mergeDropZone : elements[`${activeMode}DropZone`];
    if (!zone) return;
    zone.classList.add("is-pasting");
    window.setTimeout(() => zone.classList.remove("is-pasting"), 350);

    if (activeMode === "merge") {
        addMergeFiles(files);
    } else {
        handleSingleFiles(activeMode, files);
    }
});

window.addEventListener("beforeunload", () => {
    if (result?.url) URL.revokeObjectURL(result.url);
});

// Expose a small adapter so independent browser tools reuse existing UI,
// file validation, download lifecycle, and status management.
for (const mode of ["split", "remove", "watermark", "numbers", "pdfpng"]) {
    for (const suffix of ["Input", "DropZone", "Meta"]) {
        elements[mode + suffix] = document.getElementById(mode + suffix);
    }
}
window.AstakulaPDF = {
    selectMode, setStatus, setResult, clearResult, loadPdf, formatBytes, baseName,
    inspectSingleFile, handleSingleFiles, clearSingle, setupDropZone,
    getFile: (mode) => singleFiles[mode],
    getPageCount: (mode) => pageCounts[mode],
    getActiveMode: () => activeMode
};
renderMergeQueue();
selectMode("merge");
