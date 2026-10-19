const MAX_FILE_SIZE = 20 * 1024 * 1024;
const BYTE_CHUNK_SIZE = 0x8000;

const elements = {
    textModeButton: document.querySelector("#textModeButton"),
    fileModeButton: document.querySelector("#fileModeButton"),
    textMode: document.querySelector("#textMode"),
    fileMode: document.querySelector("#fileMode"),
    statusBox: document.querySelector("#statusBox"),

    textInput: document.querySelector("#textInput"),
    textOutput: document.querySelector("#textOutput"),
    textInputMeta: document.querySelector("#textInputMeta"),
    textOutputMeta: document.querySelector("#textOutputMeta"),
    encodeTextButton: document.querySelector("#encodeTextButton"),
    decodeTextButton: document.querySelector("#decodeTextButton"),
    swapTextButton: document.querySelector("#swapTextButton"),
    clearTextButton: document.querySelector("#clearTextButton"),
    copyTextButton: document.querySelector("#copyTextButton"),
    downloadTextButton: document.querySelector("#downloadTextButton"),

    sourceFile: document.querySelector("#sourceFile"),
    fileDropZone: document.querySelector("#fileDropZone"),
    fileMeta: document.querySelector("#fileMeta"),
    includeDataUrl: document.querySelector("#includeDataUrl"),
    fileBase64Output: document.querySelector("#fileBase64Output"),
    copyFileBase64Button: document.querySelector("#copyFileBase64Button"),
    downloadFileBase64Button: document.querySelector("#downloadFileBase64Button"),
    clearFileButton: document.querySelector("#clearFileButton"),

    fileBase64Input: document.querySelector("#fileBase64Input"),
    decodeMeta: document.querySelector("#decodeMeta"),
    decodedFilename: document.querySelector("#decodedFilename"),
    decodedMime: document.querySelector("#decodedMime"),
    downloadDecodedFileButton: document.querySelector("#downloadDecodedFileButton"),
    clearDecodeButton: document.querySelector("#clearDecodeButton")
};

let currentFile = null;
let currentFileBase64 = "";
let fileReadRevision = 0;

function setStatus(message, type = "neutral") {
    elements.statusBox.textContent = message;
    elements.statusBox.className = `status-box is-${type}`;
}

function setMode(mode) {
    const isText = mode !== "file";

    elements.textMode.classList.toggle("hidden", !isText);
    elements.fileMode.classList.toggle("hidden", isText);

    elements.textModeButton.classList.toggle("is-active", isText);
    elements.fileModeButton.classList.toggle("is-active", !isText);

    elements.textModeButton.setAttribute("aria-selected", String(isText));
    elements.fileModeButton.setAttribute("aria-selected", String(!isText));

    setStatus(isText ? "Text mode ready." : "File mode ready.", "neutral");
}

function updateTextMeta() {
    elements.textInputMeta.textContent = `${elements.textInput.value.length.toLocaleString()} chars`;
    elements.textOutputMeta.textContent = `${elements.textOutput.value.length.toLocaleString()} chars`;
}

function updateDecodeMeta() {
    elements.decodeMeta.textContent = `${elements.fileBase64Input.value.length.toLocaleString()} chars`;
}

function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes < 1) {
        return "0 B";
    }

    const units = ["B", "KB", "MB", "GB"];
    const index = Math.min(
        Math.floor(Math.log(bytes) / Math.log(1024)),
        units.length - 1
    );
    const value = bytes / (1024 ** index);

    return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

function bytesToBase64(bytes) {
    const chunks = [];

    for (let index = 0; index < bytes.length; index += BYTE_CHUNK_SIZE) {
        const slice = bytes.subarray(index, index + BYTE_CHUNK_SIZE);
        chunks.push(String.fromCharCode(...slice));
    }

    return btoa(chunks.join(""));
}

function parseBase64Input(value) {
    const trimmed = String(value || "").trim();

    if (!trimmed) {
        throw new Error("Paste Base64 first.");
    }

    const dataUrlMatch = trimmed.match(
        /^data:([^;,]*)(?:;[^,]*)*;base64,(.*)$/is
    );

    const mime = dataUrlMatch?.[1] || "";
    let base64 = dataUrlMatch ? dataUrlMatch[2] : trimmed;

    base64 = base64
        .replace(/\s+/g, "")
        .replace(/-/g, "+")
        .replace(/_/g, "/");

    if (!base64) {
        throw new Error("Base64 value is empty.");
    }

    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
        throw new Error("Invalid Base64 characters.");
    }

    if (base64.length % 4 === 1) {
        throw new Error("Invalid Base64 length.");
    }

    while (base64.length % 4 !== 0) {
        base64 += "=";
    }

    return {
        base64,
        mime
    };
}

function base64ToBytes(value, maxDecodedBytes = Infinity) {
    const parsed = parseBase64Input(value);
    const padding = parsed.base64.endsWith("==") ? 2 : parsed.base64.endsWith("=") ? 1 : 0;
    const decodedBytes = (parsed.base64.length / 4) * 3 - padding;
    if (decodedBytes > maxDecodedBytes) {
        throw new Error("Decoded file exceeds the 20 MB size limit.");
    }
    let binary;

    try {
        binary = atob(parsed.base64);
    } catch {
        throw new Error("Invalid Base64 data.");
    }

    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }

    return {
        bytes,
        mime: parsed.mime
    };
}

function getTextInput() {
    if (!elements.textInput.value) {
        throw new Error("Enter some text first.");
    }

    return elements.textInput.value;
}

function encodeText() {
    try {
        const source = getTextInput();
        const bytes = new TextEncoder().encode(source);

        elements.textOutput.value = bytesToBase64(bytes);
        updateTextMeta();
        setStatus("Text encoded to Base64.", "success");
    } catch (error) {
        elements.textOutput.value = "";
        updateTextMeta();
        setStatus(error.message, "error");
    }
}

function decodeText() {
    try {
        const source = getTextInput();
        const { bytes } = base64ToBytes(source);
        const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);

        elements.textOutput.value = decoded;
        updateTextMeta();
        setStatus("Base64 decoded as UTF-8 text.", "success");
    } catch (error) {
        elements.textOutput.value = "";
        updateTextMeta();

        const message = error instanceof TypeError
            ? "The decoded bytes are not valid UTF-8 text. Use File mode for binary data."
            : error.message;

        setStatus(message, "error");
    }
}

function swapText() {
    if (!elements.textOutput.value) {
        setStatus("Generate output before swapping.", "error");
        return;
    }

    const input = elements.textInput.value;
    elements.textInput.value = elements.textOutput.value;
    elements.textOutput.value = input;

    updateTextMeta();
    setStatus("Input and output swapped.", "neutral");
    elements.textInput.focus();
}

function clearText() {
    elements.textInput.value = "";
    elements.textOutput.value = "";
    updateTextMeta();
    setStatus("Text cleared.", "neutral");
    elements.textInput.focus();
}

async function copyValue(value, emptyMessage = "Nothing to copy yet.") {
    if (!value) {
        setStatus(emptyMessage, "error");
        return;
    }

    try {
        await navigator.clipboard.writeText(value);
        setStatus("Copied to clipboard.", "success");
    } catch {
        const helper = document.createElement("textarea");
        helper.value = value;
        helper.style.position = "fixed";
        helper.style.opacity = "0";
        document.body.appendChild(helper);
        helper.select();
        document.execCommand("copy");
        helper.remove();
        setStatus("Copied to clipboard.", "success");
    }
}

function downloadTextFile(value, filename) {
    if (!value) {
        setStatus("Nothing to download yet.", "error");
        return;
    }

    const blob = new Blob([value], {
        type: "text/plain;charset=utf-8"
    });

    downloadBlob(blob, filename);
    setStatus(`${filename} downloaded.`, "success");
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    link.style.display = "none";

    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function renderFileOutput() {
    if (!currentFile || !currentFileBase64) {
        elements.fileBase64Output.value = "";
        return;
    }

    elements.fileBase64Output.value = elements.includeDataUrl.checked
        ? `data:${currentFile.type || "application/octet-stream"};base64,${currentFileBase64}`
        : currentFileBase64;
}

async function loadFile(file, source = "selected") {
    const requestId = ++fileReadRevision;
    if (!file) {
        return;
    }

    if (file.size > MAX_FILE_SIZE) {
        setStatus("File is too large. Maximum size is 20 MB.", "error");
        return;
    }

    try {
        const buffer = await file.arrayBuffer();
        if (requestId !== fileReadRevision) return; // A newer file or clear action won.
        currentFile = file;
        currentFileBase64 = bytesToBase64(new Uint8Array(buffer));

        elements.fileMeta.textContent = `${file.name} · ${formatBytes(file.size)}`;
        renderFileOutput();

        const verb = source === "pasted" ? "pasted and encoded" : "encoded";
        setStatus(`${file.name} ${verb}.`, "success");
    } catch {
        if (requestId === fileReadRevision) setStatus("Could not read that file.", "error");
    }
}

function clearFileEncode() {
    fileReadRevision += 1;
    currentFile = null;
    currentFileBase64 = "";
    elements.sourceFile.value = "";
    elements.fileBase64Output.value = "";
    elements.fileMeta.textContent = "No file";
    elements.includeDataUrl.checked = false;
    setStatus("File encoder cleared.", "neutral");
}

function clearFileDecode() {
    elements.fileBase64Input.value = "";
    elements.decodedFilename.value = "decoded-file";
    elements.decodedMime.value = "";
    updateDecodeMeta();
    setStatus("File decoder cleared.", "neutral");
    elements.fileBase64Input.focus();
}

function getExtensionForMime(mime) {
    const extensions = {
        "text/plain": "txt",
        "application/json": "json",
        "application/pdf": "pdf",
        "application/zip": "zip",
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/gif": "gif",
        "image/webp": "webp",
        "image/svg+xml": "svg",
        "audio/mpeg": "mp3",
        "audio/wav": "wav",
        "video/mp4": "mp4"
    };

    return extensions[mime] || "";
}

function getDecodedFilename(filename, mime) {
    const cleaned = String(filename || "decoded-file").trim() || "decoded-file";

    if (/\.[A-Za-z0-9]{1,8}$/.test(cleaned)) {
        return cleaned;
    }

    const extension = getExtensionForMime(mime);
    return extension ? `${cleaned}.${extension}` : cleaned;
}

function downloadDecodedFile() {
    try {
        const { bytes, mime: dataUrlMime } = base64ToBytes(elements.fileBase64Input.value, MAX_FILE_SIZE);
        const mime = dataUrlMime || elements.decodedMime.value.trim() || "application/octet-stream";
        const filename = getDecodedFilename(elements.decodedFilename.value, mime);
        const blob = new Blob([bytes], { type: mime });

        if (dataUrlMime && !elements.decodedMime.value.trim()) {
            elements.decodedMime.value = dataUrlMime;
        }

        downloadBlob(blob, filename);
        setStatus(`${filename} decoded and downloaded.`, "success");
    } catch (error) {
        setStatus(error.message, "error");
    }
}

function getClipboardFile(clipboardData) {
    if (!clipboardData) {
        return null;
    }

    if (clipboardData.files?.length) {
        return clipboardData.files[0];
    }

    if (clipboardData.items?.length) {
        for (const item of clipboardData.items) {
            if (item.kind === "file") {
                const file = item.getAsFile();
                if (file) {
                    return file;
                }
            }
        }
    }

    return null;
}

elements.textModeButton.addEventListener("click", () => setMode("text"));
elements.fileModeButton.addEventListener("click", () => setMode("file"));

elements.encodeTextButton.addEventListener("click", encodeText);
elements.decodeTextButton.addEventListener("click", decodeText);
elements.swapTextButton.addEventListener("click", swapText);
elements.clearTextButton.addEventListener("click", clearText);
elements.copyTextButton.addEventListener("click", () => copyValue(elements.textOutput.value));
elements.downloadTextButton.addEventListener("click", () => downloadTextFile(elements.textOutput.value, "base64-result.txt"));

elements.textInput.addEventListener("input", updateTextMeta);
elements.textOutput.addEventListener("input", updateTextMeta);

elements.sourceFile.addEventListener("change", () => {
    loadFile(elements.sourceFile.files?.[0]);
});

elements.includeDataUrl.addEventListener("change", renderFileOutput);
elements.copyFileBase64Button.addEventListener("click", () => copyValue(elements.fileBase64Output.value));
elements.downloadFileBase64Button.addEventListener("click", () => downloadTextFile(elements.fileBase64Output.value, "base64-file.txt"));
elements.clearFileButton.addEventListener("click", clearFileEncode);

elements.fileBase64Input.addEventListener("input", updateDecodeMeta);
elements.downloadDecodedFileButton.addEventListener("click", downloadDecodedFile);
elements.clearDecodeButton.addEventListener("click", clearFileDecode);

["dragenter", "dragover"].forEach((eventName) => {
    elements.fileDropZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        event.stopPropagation();
        elements.fileDropZone.classList.add("is-dragging");
    });
});

["dragleave", "drop"].forEach((eventName) => {
    elements.fileDropZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        event.stopPropagation();
        elements.fileDropZone.classList.remove("is-dragging");
    });
});

elements.fileDropZone.addEventListener("drop", (event) => {
    loadFile(event.dataTransfer?.files?.[0]);
});

document.addEventListener("paste", async (event) => {
    if (elements.fileMode.classList.contains("hidden")) {
        return;
    }

    const file = getClipboardFile(event.clipboardData);
    if (!file) {
        return;
    }

    event.preventDefault();
    elements.fileDropZone.classList.add("is-pasting");

    try {
        await loadFile(file, "pasted");
    } finally {
        window.setTimeout(() => {
            elements.fileDropZone.classList.remove("is-pasting");
        }, 350);
    }
});

document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        if (!elements.textMode.classList.contains("hidden")) {
            event.preventDefault();
            encodeText();
        }
    }
});

updateTextMeta();
updateDecodeMeta();
setMode("text");
