const MAX_FILE_SIZE = 5 * 1024 * 1024;
let inputRevision = 0;
let fileReadRevision = 0;

const elements = {
    input: document.querySelector("#jsonInput"),
    output: document.querySelector("#jsonOutput"),
    formatButton: document.querySelector("#formatButton"),
    minifyButton: document.querySelector("#minifyButton"),
    validateButton: document.querySelector("#validateButton"),
    swapButton: document.querySelector("#swapButton"),
    clearButton: document.querySelector("#clearButton"),
    sampleButton: document.querySelector("#sampleButton"),
    copyButton: document.querySelector("#copyButton"),
    downloadButton: document.querySelector("#downloadButton"),
    indentSelect: document.querySelector("#indentSelect"),
    statusBox: document.querySelector("#statusBox"),
    dropZone: document.querySelector("#dropZone"),
    fileInput: document.querySelector("#jsonFile"),
    inputMeta: document.querySelector("#inputMeta"),
    outputMeta: document.querySelector("#outputMeta")
};

const SAMPLE_JSON = {
    name: "Astakula",
    tool: "JSON Formatter",
    features: [
        "format",
        "minify",
        "validate",
        "swap",
        "file paste",
        "dark mode",
        "copy",
        "download"
    ],
    local: true
};

function setStatus(message, type = "neutral") {
    elements.statusBox.textContent = message;
    elements.statusBox.className = `status-box is-${type}`;
}

function updateMeta() {
    const inputLength = elements.input.value.length;
    const outputLength = elements.output.value.length;

    elements.inputMeta.textContent = `${inputLength.toLocaleString()} chars`;
    elements.outputMeta.textContent = `${outputLength.toLocaleString()} chars`;
}

function getInput() {
    const value = elements.input.value.trim();

    if (!value) {
        throw new Error("Paste or load some JSON first.");
    }

    return value;
}

function getErrorDetails(error, source) {
    const message = String(error?.message || "Invalid JSON.");

    const lineColumnMatch = message.match(/line\s+(\d+)\s+column\s+(\d+)/i);
    if (lineColumnMatch) {
        return {
            message,
            line: Number(lineColumnMatch[1]),
            column: Number(lineColumnMatch[2])
        };
    }

    const positionMatch = message.match(/position\s+(\d+)/i);
    if (positionMatch) {
        const position = Number(positionMatch[1]);
        const before = source.slice(0, position);
        const lines = before.split("\n");

        return {
            message,
            line: lines.length,
            column: lines[lines.length - 1].length + 1
        };
    }

    return {
        message,
        line: null,
        column: null
    };
}

function parseJson() {
    const source = getInput();

    try {
        return {
            source,
            value: JSON.parse(source)
        };
    } catch (error) {
        const details = getErrorDetails(error, source);

        if (details.line && details.column) {
            throw new Error(
                `Invalid JSON at line ${details.line}, column ${details.column}. ${details.message}`
            );
        }

        throw new Error(`Invalid JSON. ${details.message}`);
    }
}

function getIndent() {
    const value = Number(elements.indentSelect.value);
    return value === 4 ? 4 : 2;
}

function formatJson() {
    try {
        const { value } = parseJson();
        elements.output.value = JSON.stringify(value, null, getIndent());
        setStatus("Valid JSON. Formatted successfully.", "success");
        updateMeta();
    } catch (error) {
        elements.output.value = "";
        setStatus(error.message, "error");
        updateMeta();
    }
}

function minifyJson() {
    try {
        const { value } = parseJson();
        elements.output.value = JSON.stringify(value);
        setStatus("Valid JSON. Minified successfully.", "success");
        updateMeta();
    } catch (error) {
        elements.output.value = "";
        setStatus(error.message, "error");
        updateMeta();
    }
}

function validateJson() {
    try {
        const { value } = parseJson();
        const type = Array.isArray(value)
            ? "array"
            : value === null
                ? "null"
                : typeof value;

        setStatus(`Valid JSON. Root type: ${type}.`, "success");
    } catch (error) {
        setStatus(error.message, "error");
    }
}

function swapInputOutput() {
    const outputValue = elements.output.value;

    if (!outputValue) {
        setStatus("Generate output before swapping.", "error");
        return;
    }

    const inputValue = elements.input.value;

    inputRevision += 1;
    elements.input.value = outputValue;
    elements.output.value = inputValue;
    elements.fileInput.value = "";

    setStatus("Input and output swapped.", "neutral");
    updateMeta();
    elements.input.focus();
}

function clearAll() {
    inputRevision += 1;
    elements.input.value = "";
    elements.output.value = "";
    elements.fileInput.value = "";
    setStatus("Ready.", "neutral");
    updateMeta();
    elements.input.focus();
}

function loadSample() {
    inputRevision += 1;
    elements.input.value = JSON.stringify(SAMPLE_JSON, null, 2);
    elements.output.value = "";
    elements.fileInput.value = "";
    setStatus("Sample loaded.", "neutral");
    updateMeta();
}

async function copyOutput() {
    const value = elements.output.value;

    if (!value) {
        setStatus("Nothing to copy yet.", "error");
        return;
    }

    try {
        await navigator.clipboard.writeText(value);
        setStatus("Output copied to clipboard.", "success");
    } catch {
        elements.output.select();
        document.execCommand("copy");
        setStatus("Output copied to clipboard.", "success");
    }
}

function downloadOutput() {
    const value = elements.output.value;

    if (!value) {
        setStatus("Nothing to download yet.", "error");
        return;
    }

    const blob = new Blob([value], {
        type: "application/json;charset=utf-8"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "formatted.json";
    link.style.display = "none";

    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 1000);

    setStatus("JSON file downloaded.", "success");
}

function isJsonFile(file) {
    if (!file) {
        return false;
    }

    const fileName = String(file.name || "").toLowerCase();
    const fileType = String(file.type || "").toLowerCase();

    return (
        fileType === "application/json" ||
        fileType === "text/json" ||
        fileName.endsWith(".json")
    );
}

async function loadFile(file, source = "selected") {
    if (!file) {
        return false;
    }

    if (file.size > MAX_FILE_SIZE) {
        setStatus("File is too large. Maximum size is 5 MB.", "error");
        return false;
    }

    if (!isJsonFile(file)) {
        setStatus("Choose or paste a .json file.", "error");
        return false;
    }

    const requestId = ++fileReadRevision;
    const initialInputRevision = inputRevision;
    try {
        const contents = await file.text();
        if (requestId !== fileReadRevision || inputRevision !== initialInputRevision) {
            return false; // A newer file or user edit takes precedence.
        }
        inputRevision += 1;
        elements.input.value = contents;
        elements.output.value = "";
        elements.fileInput.value = "";

        const fileName = file.name || "JSON file";
        const verb = source === "pasted" ? "pasted" : "loaded";

        setStatus(`${fileName} ${verb}.`, "neutral");
        updateMeta();
        return true;
    } catch {
        setStatus("Could not read that file.", "error");
        return false;
    }
}

function getClipboardFile(clipboardData) {
    if (!clipboardData) {
        return null;
    }

    if (clipboardData.files?.length) {
        return Array.from(clipboardData.files).find(isJsonFile) || clipboardData.files[0];
    }

    if (clipboardData.items?.length) {
        for (const item of clipboardData.items) {
            if (item.kind !== "file") {
                continue;
            }

            const file = item.getAsFile();
            if (file) {
                return file;
            }
        }
    }

    return null;
}

elements.formatButton.addEventListener("click", formatJson);
elements.minifyButton.addEventListener("click", minifyJson);
elements.validateButton.addEventListener("click", validateJson);
elements.swapButton.addEventListener("click", swapInputOutput);
elements.clearButton.addEventListener("click", clearAll);
elements.sampleButton.addEventListener("click", loadSample);
elements.copyButton.addEventListener("click", copyOutput);
elements.downloadButton.addEventListener("click", downloadOutput);

elements.input.addEventListener("input", () => {
    inputRevision += 1;
    updateMeta();
});
elements.output.addEventListener("input", updateMeta);

elements.fileInput.addEventListener("change", () => {
    loadFile(elements.fileInput.files?.[0]);
});

["dragenter", "dragover"].forEach((eventName) => {
    elements.dropZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        event.stopPropagation();
        elements.dropZone.classList.add("is-dragging");
    });
});

["dragleave", "drop"].forEach((eventName) => {
    elements.dropZone.addEventListener(eventName, (event) => {
        event.preventDefault();
        event.stopPropagation();
        elements.dropZone.classList.remove("is-dragging");
    });
});

elements.dropZone.addEventListener("drop", (event) => {
    loadFile(event.dataTransfer?.files?.[0]);
});

document.addEventListener("paste", async (event) => {
    const file = getClipboardFile(event.clipboardData);

    if (!file) {
        return;
    }

    event.preventDefault();
    elements.dropZone.classList.add("is-pasting");

    try {
        await loadFile(file, "pasted");
    } finally {
        window.setTimeout(() => {
            elements.dropZone.classList.remove("is-pasting");
        }, 350);
    }
});

document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        formatJson();
    }
});

updateMeta();
