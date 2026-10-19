const MAX_FILE_SIZE = 50 * 1024 * 1024;

const elements = {
    textModeButton: document.querySelector("#textModeButton"),
    fileModeButton: document.querySelector("#fileModeButton"),
    textMode: document.querySelector("#textMode"),
    fileMode: document.querySelector("#fileMode"),
    algorithmSelect: document.querySelector("#algorithmSelect"),
    caseSelect: document.querySelector("#caseSelect"),
    generateButton: document.querySelector("#generateButton"),
    clearButton: document.querySelector("#clearButton"),
    statusBox: document.querySelector("#statusBox"),
    textInput: document.querySelector("#textInput"),
    textMeta: document.querySelector("#textMeta"),
    sourceFile: document.querySelector("#sourceFile"),
    fileDropZone: document.querySelector("#fileDropZone"),
    fileMeta: document.querySelector("#fileMeta"),
    fileName: document.querySelector("#fileName"),
    fileSize: document.querySelector("#fileSize"),
    hashOutput: document.querySelector("#hashOutput"),
    resultMeta: document.querySelector("#resultMeta"),
    copyButton: document.querySelector("#copyButton"),
    downloadButton: document.querySelector("#downloadButton"),
    expectedHash: document.querySelector("#expectedHash"),
    verifyButton: document.querySelector("#verifyButton"),
    verifyResult: document.querySelector("#verifyResult"),
    algorithmSecurityNote: document.querySelector("#algorithmSecurityNote")
};

let activeMode = "text";
let currentFile = null;
let rawDigest = "";
let generationRevision = 0;

function setStatus(message, type = "neutral") {
    elements.statusBox.textContent = message;
    elements.statusBox.className = `status-box is-${type}`;
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

function setMode(mode) {
    activeMode = mode === "file" ? "file" : "text";
    const isText = activeMode === "text";

    elements.textMode.classList.toggle("hidden", !isText);
    elements.fileMode.classList.toggle("hidden", isText);
    elements.textModeButton.classList.toggle("is-active", isText);
    elements.fileModeButton.classList.toggle("is-active", !isText);
    elements.textModeButton.setAttribute("aria-selected", String(isText));
    elements.fileModeButton.setAttribute("aria-selected", String(!isText));

    clearResult(false);
    setStatus(isText ? "Text mode ready." : "File mode ready.", "neutral");
}

function updateTextMeta() {
    elements.textMeta.textContent = `${elements.textInput.value.length.toLocaleString()} chars`;
}

function updateResultMeta() {
    const algorithm = elements.algorithmSelect.value;
    elements.resultMeta.textContent = algorithm;
    elements.algorithmSecurityNote.textContent = ["MD5", "SHA-1"].includes(algorithm)
        ? algorithm + " hanya untuk kompatibilitas legacy: tidak aman terhadap collision dan tidak boleh digunakan untuk verifikasi keaslian berbasis keamanan."
        : "SHA-256, SHA-384, dan SHA-512 lebih sesuai untuk pemeriksaan integritas modern.";
}

function formatDigest(value) {
    return elements.caseSelect.value === "upper"
        ? value.toUpperCase()
        : value.toLowerCase();
}

function clearVerification() {
    elements.verifyResult.textContent = "No comparison yet.";
    elements.verifyResult.className = "verify-result";
}

function renderDigest() {
    elements.hashOutput.value = rawDigest ? formatDigest(rawDigest) : "";
    clearVerification();
}

function clearResult(clearExpected = true) {
    generationRevision += 1;
    rawDigest = "";
    elements.hashOutput.value = "";

    if (clearExpected) {
        elements.expectedHash.value = "";
    }

    clearVerification();
    updateResultMeta();
}

function getTextBytes() {
    const value = elements.textInput.value;

    if (!value) {
        throw new Error("Enter some text first.");
    }

    return new TextEncoder().encode(value);
}

async function getFileBytes() {
    if (!currentFile) {
        throw new Error("Choose a file first.");
    }

    if (currentFile.size > MAX_FILE_SIZE) {
        throw new Error("File is too large. Maximum size is 50 MB.");
    }

    return new Uint8Array(await currentFile.arrayBuffer());
}

function md5Bytes(inputBytes) {
    const bytes = inputBytes instanceof Uint8Array
        ? inputBytes
        : new Uint8Array(inputBytes);

    const originalLength = bytes.length;
    const paddedLength = Math.ceil((originalLength + 9) / 64) * 64;
    const message = new Uint8Array(paddedLength);
    message.set(bytes);
    message[originalLength] = 0x80;

    let bitLength = BigInt(originalLength) * 8n;
    for (let index = 0; index < 8; index += 1) {
        message[paddedLength - 8 + index] = Number(bitLength & 0xffn);
        bitLength >>= 8n;
    }

    let a0 = 0x67452301;
    let b0 = 0xefcdab89;
    let c0 = 0x98badcfe;
    let d0 = 0x10325476;

    const shifts = [
        7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
        5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
        4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
        6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21
    ];

    const constants = Array.from(
        { length: 64 },
        (_, index) => Math.floor(Math.abs(Math.sin(index + 1)) * (2 ** 32)) >>> 0
    );

    const rotateLeft = (value, amount) => (
        ((value << amount) | (value >>> (32 - amount))) >>> 0
    );

    for (let offset = 0; offset < paddedLength; offset += 64) {
        const words = new Uint32Array(16);

        for (let index = 0; index < 16; index += 1) {
            const base = offset + (index * 4);
            words[index] = (
                message[base] |
                (message[base + 1] << 8) |
                (message[base + 2] << 16) |
                (message[base + 3] << 24)
            ) >>> 0;
        }

        let a = a0 >>> 0;
        let b = b0 >>> 0;
        let c = c0 >>> 0;
        let d = d0 >>> 0;

        for (let index = 0; index < 64; index += 1) {
            let f;
            let g;

            if (index < 16) {
                f = (b & c) | ((~b) & d);
                g = index;
            } else if (index < 32) {
                f = (d & b) | ((~d) & c);
                g = ((5 * index) + 1) % 16;
            } else if (index < 48) {
                f = b ^ c ^ d;
                g = ((3 * index) + 5) % 16;
            } else {
                f = c ^ (b | (~d));
                g = (7 * index) % 16;
            }

            const nextD = c;
            const nextC = b;
            const sum = (a + (f >>> 0) + constants[index] + words[g]) >>> 0;
            const nextB = (b + rotateLeft(sum, shifts[index])) >>> 0;

            a = d;
            d = nextD;
            c = nextC;
            b = nextB;
        }

        a0 = (a0 + a) >>> 0;
        b0 = (b0 + b) >>> 0;
        c0 = (c0 + c) >>> 0;
        d0 = (d0 + d) >>> 0;
    }

    const wordToLittleEndianHex = (word) => [0, 8, 16, 24]
        .map((shift) => ((word >>> shift) & 0xff).toString(16).padStart(2, "0"))
        .join("");

    return [a0, b0, c0, d0]
        .map(wordToLittleEndianHex)
        .join("");
}

function bufferToHex(buffer) {
    return Array.from(new Uint8Array(buffer), (byte) => (
        byte.toString(16).padStart(2, "0")
    )).join("");
}

async function digestBytes(bytes, algorithm) {
    if (algorithm === "MD5") {
        return md5Bytes(bytes);
    }

    if (!window.crypto?.subtle) {
        throw new Error("Web Crypto hashing is not available in this browser.");
    }

    const digest = await window.crypto.subtle.digest(algorithm, bytes);
    return bufferToHex(digest);
}

async function generateHash() {
    const algorithm = elements.algorithmSelect.value;
    const requestId = ++generationRevision;

    try {
        elements.generateButton.disabled = true;
        setStatus(`Generating ${algorithm} hash...`, "neutral");

        const bytes = activeMode === "file"
            ? await getFileBytes()
            : getTextBytes();

        const computedDigest = await digestBytes(bytes, algorithm);
        if (requestId !== generationRevision) return; // Editor changed during async hashing.
        rawDigest = computedDigest;
        renderDigest();
        updateResultMeta();

        const sourceLabel = activeMode === "file"
            ? currentFile.name
            : "Text";

        setStatus(`${algorithm} hash generated for ${sourceLabel}.`, "success");
    } catch (error) {
        if (requestId !== generationRevision) return;
        clearResult(false);
        setStatus(error.message, "error");
    } finally {
        elements.generateButton.disabled = false;
    }
}

function clearAll() {
    elements.textInput.value = "";
    elements.sourceFile.value = "";
    currentFile = null;
    elements.fileMeta.textContent = "No file";
    elements.fileName.textContent = "None";
    elements.fileSize.textContent = "0 B";
    updateTextMeta();
    clearResult(true);
    setStatus("Cleared.", "neutral");

    if (activeMode === "text") {
        elements.textInput.focus();
    }
}

async function copyHash() {
    const value = elements.hashOutput.value;

    if (!value) {
        setStatus("Generate a hash first.", "error");
        return;
    }

    try {
        await navigator.clipboard.writeText(value);
        setStatus("Hash copied to clipboard.", "success");
    } catch {
        elements.hashOutput.select();
        document.execCommand("copy");
        setStatus("Hash copied to clipboard.", "success");
    }
}

function downloadHash() {
    const value = elements.hashOutput.value;

    if (!value) {
        setStatus("Generate a hash first.", "error");
        return;
    }

    const algorithm = elements.algorithmSelect.value.toLowerCase().replace("-", "");
    const blob = new Blob([`${value}\n`], {
        type: "text/plain;charset=utf-8"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `${algorithm}-hash.txt`;
    link.style.display = "none";

    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus("Hash file downloaded.", "success");
}

function normalizeHash(value) {
    return String(value || "")
        .trim()
        .replace(/\s+/g, "")
        .toLowerCase();
}

function verifyHash() {
    const actual = normalizeHash(elements.hashOutput.value);
    const expected = normalizeHash(elements.expectedHash.value);

    if (!actual) {
        setStatus("Generate a hash before comparing.", "error");
        return;
    }

    if (!expected) {
        setStatus("Paste an expected hash first.", "error");
        return;
    }

    const matches = actual === expected;

    elements.verifyResult.textContent = matches
        ? "Match — both hashes are identical."
        : "No match — the hashes are different.";
    elements.verifyResult.className = `verify-result ${matches ? "is-match" : "is-mismatch"}`;

    setStatus(matches ? "Hash comparison matched." : "Hash comparison did not match.", matches ? "success" : "error");
}

function setFile(file, source = "selected") {
    if (!file) {
        return;
    }

    if (file.size > MAX_FILE_SIZE) {
        setStatus("File is too large. Maximum size is 50 MB.", "error");
        return;
    }

    currentFile = file;
    elements.sourceFile.value = "";
    elements.fileMeta.textContent = formatBytes(file.size);
    elements.fileName.textContent = file.name || "Unnamed file";
    elements.fileSize.textContent = formatBytes(file.size);
    clearResult(false);

    const verb = source === "pasted" ? "pasted" : "loaded";
    setStatus(`${file.name || "File"} ${verb}.`, "neutral");
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
elements.generateButton.addEventListener("click", generateHash);
elements.clearButton.addEventListener("click", clearAll);
elements.copyButton.addEventListener("click", copyHash);
elements.downloadButton.addEventListener("click", downloadHash);
elements.verifyButton.addEventListener("click", verifyHash);

elements.textInput.addEventListener("input", () => {
    updateTextMeta();
    clearResult(false);
});

elements.algorithmSelect.addEventListener("change", () => {
    clearResult(false);
    updateResultMeta();
    setStatus(`${elements.algorithmSelect.value} selected.`, "neutral");
});

elements.caseSelect.addEventListener("change", () => {
    renderDigest();
    if (rawDigest) {
        setStatus("Output case updated.", "neutral");
    }
});

elements.sourceFile.addEventListener("change", () => {
    setFile(elements.sourceFile.files?.[0]);
});

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
    setFile(event.dataTransfer?.files?.[0]);
});

document.addEventListener("paste", (event) => {
    if (activeMode !== "file") {
        return;
    }

    const file = getClipboardFile(event.clipboardData);
    if (!file) {
        return;
    }

    event.preventDefault();
    elements.fileDropZone.classList.add("is-pasting");
    setFile(file, "pasted");

    window.setTimeout(() => {
        elements.fileDropZone.classList.remove("is-pasting");
    }, 350);
});

document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        generateHash();
    }
});

updateTextMeta();
updateResultMeta();
