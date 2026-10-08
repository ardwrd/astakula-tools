import { removePages, splitPages, imagesToPdf, addWatermark, addPageNumbers }
  from "./pdf-operations.mjs";

const core = window.AstakulaPDF;
const lib = window.PDFLib;
const byId = (id) => document.getElementById(id);
const singleModes = ["split", "remove", "watermark", "numbers", "pdfpng"];
let images = [];
let busy = false;

for (const mode of singleModes) {
  core.setupDropZone(byId(mode + "DropZone"), byId(mode + "Input"), (files) => {
    core.handleSingleFiles(mode, files);
  });
  byId("clear" + mode + "Button").addEventListener("click", () => {
    core.clearSingle(mode);
    if (mode === "remove") byId("removePages").value = "";
    if (mode === "watermark") byId("watermarkText").value = "";
  });
}

async function run(mode, description, handler) {
  if (busy) return;
  const button = byId(mode + "Button");
  busy = true;
  button.disabled = true;
  core.setStatus(description, "working");
  try {
    if (!lib?.PDFDocument) throw new Error("PDF library is still loading. Refresh and retry.");
    await handler();
  } catch (error) {
    core.setStatus(error?.message || "Unable to process this file.", "error");
  } finally {
    busy = false;
    button.disabled = false;
  }
}

async function bytesFor(mode) {
  const file = core.getFile(mode);
  if (!file) throw new Error("Choose a PDF first.");
  return { file, bytes: await file.arrayBuffer() };
}

byId("splitButton").addEventListener("click", () => run("split", "Splitting pages…", async () => {
  if (!window.JSZip) throw new Error("ZIP library unavailable. Refresh and retry.");
  const { file, bytes } = await bytesFor("split");
  const parts = await splitPages(lib, bytes, 40);
  const zip = new window.JSZip();
  for (const part of parts) zip.file(part.name, part.bytes);
  const output = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 4 } });
  core.setResult(output, core.baseName(file.name) + "-split.zip", parts.length + " individual PDFs", "application/zip");
  core.setStatus("Split " + parts.length + " pages into separate PDFs.", "success");
}));

byId("removeButton").addEventListener("click", () => run("remove", "Removing pages…", async () => {
  const { file, bytes } = await bytesFor("remove");
  const result = await removePages(lib, bytes, byId("removePages").value);
  core.setResult(result.bytes, core.baseName(file.name) + "-removed.pdf", result.pages + " pages remaining");
  core.setStatus("Selected pages removed from your PDF.", "success");
}));

byId("watermarkButton").addEventListener("click", () => run("watermark", "Adding watermark…", async () => {
  const { file, bytes } = await bytesFor("watermark");
  const opacity = Number(byId("watermarkOpacity").value);
  const result = await addWatermark(lib, bytes, byId("watermarkText").value, opacity);
  core.setResult(result.bytes, core.baseName(file.name) + "-watermarked.pdf", result.pages + " pages");
  core.setStatus("Watermark added to every page.", "success");
}));

byId("numbersButton").addEventListener("click", () => run("numbers", "Adding page numbers…", async () => {
  const { file, bytes } = await bytesFor("numbers");
  const result = await addPageNumbers(lib, bytes, byId("numberPosition").value);
  core.setResult(result.bytes, core.baseName(file.name) + "-numbered.pdf", result.pages + " numbered pages");
  core.setStatus("Page numbers added.", "success");
}));

function imageIsAllowed(file) {
  return file && (/^image\/(png|jpeg)$/.test(file.type) || /\.(png|jpe?g)$/i.test(file.name));
}

function setImages(files) {
  const picked = [...files];
  if (!picked.length) return;
  if (picked.length > 12 || picked.some(f => !imageIsAllowed(f) || f.size > 15 * 1024 * 1024)) {
    core.setStatus("Choose 1–12 valid PNG/JPEG images, up to 15 MB each.", "error");
    return;
  }
  images = picked;
  core.clearResult();
  const list = byId("imagesList");
  list.replaceChildren();
  for (const [index, file] of images.entries()) {
    const row = document.createElement("div");
    row.className = "image-list-item";
    const title = document.createElement("strong");
    title.textContent = String(index + 1).padStart(2, "0") + "  " + file.name;
    const size = document.createElement("span");
    size.textContent = core.formatBytes(file.size);
    row.append(title, size);
    list.append(row);
  }
  list.classList.remove("hidden");
  byId("imagesMeta").textContent = images.length + (images.length === 1 ? " image" : " images");
  core.setStatus(images.length + " images ready to convert to PDF.", "success");
}

core.setupDropZone(byId("imagesDropZone"), byId("imagesInput"), setImages);
byId("clearimagesButton").addEventListener("click", () => {
  images = [];
  byId("imagesInput").value = "";
  byId("imagesMeta").textContent = "No images";
  byId("imagesList").replaceChildren();
  byId("imagesList").classList.add("hidden");
  core.clearResult();
  core.setStatus("Choose PNG or JPEG images to continue.", "neutral");
});

byId("imagesButton").addEventListener("click", () => run("images", "Creating PDF from images…", async () => {
  if (!images.length) throw new Error("Choose one or more images first.");
  const inputs = [];
  for (const image of images) inputs.push({ bytes: await image.arrayBuffer() });
  const result = await imagesToPdf(lib, inputs);
  core.setResult(result.bytes, "images-to-pdf.pdf", result.pages + " image pages");
  core.setStatus("Converted " + result.pages + " images into a PDF.", "success");
}));

async function canvasToPng(canvas) {
  const blob = await new Promise((resolve, reject) =>
    canvas.toBlob(result => result ? resolve(result) : reject(new Error("Could not export PNG.")), "image/png"));
  return new Uint8Array(await blob.arrayBuffer());
}

byId("pdfpngButton").addEventListener("click", () => run("pdfpng", "Rendering PDF pages…", async () => {
  const { file, bytes } = await bytesFor("pdfpng");
  if (file.size > 20 * 1024 * 1024) throw new Error("PDF to PNG supports files up to 20 MB.");
  if (!window.pdfjsLib || !window.JSZip) throw new Error("Rendering library unavailable. Refresh and retry.");
  const pdfjs = window.pdfjsLib;
  pdfjs.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
  const loading = pdfjs.getDocument({ data: new Uint8Array(bytes) });
  let documentPdf;
  try {
    documentPdf = await loading.promise;
    if (documentPdf.numPages > 25) throw new Error("PDF to PNG supports up to 25 pages per run.");
    const zip = new window.JSZip();
    for (let i = 1; i <= documentPdf.numPages; i += 1) {
      core.setStatus("Rendering page " + i + " / " + documentPdf.numPages + "…", "working");
      const page = await documentPdf.getPage(i);
      const viewport = page.getViewport({ scale: 1.4 });
      if (viewport.width * viewport.height > 12000000) throw new Error("This PDF page is too large to render safely.");
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("Canvas rendering is not available in this browser.");
      await page.render({ canvasContext: context, viewport, background: "white" }).promise;
      zip.file("page-" + String(i).padStart(3, "0") + ".png", await canvasToPng(canvas));
      page.cleanup();
      canvas.width = canvas.height = 0;
    }
    const output = await zip.generateAsync({ type: "uint8array", compression: "STORE" });
    core.setResult(output, core.baseName(file.name) + "-png.zip", documentPdf.numPages + " PNG images", "application/zip");
    core.setStatus("Rendered " + documentPdf.numPages + " pages as PNG.", "success");
  } finally {
    await loading.destroy();
  }
}));

// Catalog is progressive enhancement: all tool buttons continue to work without filtering.
const catalogSearch = byId("toolSearch");
const filterButtons = [...document.querySelectorAll("[data-catalog-filter]")];
const cards = [...document.querySelectorAll("[data-tool-card]")];
let activeCategory = "all";

function updateCatalog() {
  const query = catalogSearch.value.trim().toLocaleLowerCase("en");
  let visible = 0;
  for (const card of cards) {
    const categoryMatch = activeCategory === "all" || card.dataset.category === activeCategory;
    const match = categoryMatch && card.textContent.toLocaleLowerCase("en").includes(query);
    card.classList.toggle("hidden", !match);
    if (match) visible += 1;
  }
  byId("catalogCount").textContent = visible + " tools shown";
}
catalogSearch.addEventListener("input", updateCatalog);
filterButtons.forEach(button => button.addEventListener("click", () => {
  activeCategory = button.dataset.catalogFilter;
  filterButtons.forEach(tab => {
    const selected = tab === button;
    tab.classList.toggle("is-active", selected);
    tab.setAttribute("aria-pressed", String(selected));
  });
  updateCatalog();
}));
document.querySelectorAll("[data-tool-select]").forEach(button => button.addEventListener("click", () => {
  const mode = button.dataset.toolSelect;
  core.selectMode(mode);
  document.querySelectorAll("[data-tool-select]").forEach(card => {
    card.classList.toggle("is-selected", card === button);
    card.setAttribute("aria-pressed", String(card === button));
  });
  byId("workspace").scrollIntoView({ behavior: "smooth", block: "start" });
}));
updateCatalog();
