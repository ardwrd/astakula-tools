const elements = {
    v4Button: document.querySelector("#v4Button"),
    v7Button: document.querySelector("#v7Button"),
    quantityInput: document.querySelector("#quantityInput"),
    caseSelect: document.querySelector("#caseSelect"),
    hyphenToggle: document.querySelector("#hyphenToggle"),
    generateButton: document.querySelector("#generateButton"),
    regenerateButton: document.querySelector("#regenerateButton"),
    clearButton: document.querySelector("#clearButton"),
    copyButton: document.querySelector("#copyButton"),
    downloadButton: document.querySelector("#downloadButton"),
    output: document.querySelector("#uuidOutput"),
    outputMeta: document.querySelector("#outputMeta"),
    statusBox: document.querySelector("#statusBox")
};

let activeVersion = "v4";
let lastGenerated = [];

function setStatus(message, type = "neutral") {
    elements.statusBox.textContent = message;
    elements.statusBox.className = `status-box is-${type}`;
}

function setVersion(version) {
    activeVersion = version === "v7" ? "v7" : "v4";

    const isV4 = activeVersion === "v4";
    elements.v4Button.classList.toggle("is-active", isV4);
    elements.v7Button.classList.toggle("is-active", !isV4);
    elements.v4Button.setAttribute("aria-selected", String(isV4));
    elements.v7Button.setAttribute("aria-selected", String(!isV4));

    setStatus(`UUID ${activeVersion.slice(1)} selected.`, "neutral");
}

function getQuantity() {
    const value = Number(elements.quantityInput.value);

    if (!Number.isInteger(value) || value < 1 || value > 1000) {
        throw new Error("Quantity must be a whole number between 1 and 1,000.");
    }

    return value;
}

function secureRandomBytes(length) {
    if (!window.crypto?.getRandomValues) {
        throw new Error("Secure random generation is not available in this browser.");
    }

    const bytes = new Uint8Array(length);
    window.crypto.getRandomValues(bytes);
    return bytes;
}

function bytesToUuid(bytes) {
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

    return [
        hex.slice(0, 8),
        hex.slice(8, 12),
        hex.slice(12, 16),
        hex.slice(16, 20),
        hex.slice(20)
    ].join("-");
}

function generateV4() {
    const bytes = secureRandomBytes(16);

    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    return bytesToUuid(bytes);
}

// Keep UUIDv7 values lexically ordered within the same millisecond (RFC 9562).
let lastV7Timestamp = -1;
let lastV7Bytes = null;

function generateV7() {
    let timestamp = Math.max(Date.now(), lastV7Timestamp);
    let bytes;

    if (timestamp === lastV7Timestamp && lastV7Bytes) {
        bytes = lastV7Bytes.slice();
        let overflow = true;
        // Increment only the 74 random bits, preserving version and variant.
        for (let index = 15; index >= 6; index -= 1) {
            const mask = index === 8 ? 0x3f : index === 6 ? 0x0f : 0xff;
            const part = bytes[index] & mask;
            bytes[index] = (bytes[index] & ~mask) | ((part + 1) & mask);
            if (part < mask) {
                overflow = false;
                break;
            }
        }
        if (overflow) {
            timestamp = lastV7Timestamp + 1;
            bytes = secureRandomBytes(16);
        }
    } else {
        bytes = secureRandomBytes(16);
    }

    let time = BigInt(timestamp);
    for (let index = 5; index >= 0; index -= 1) {
        bytes[index] = Number(time & 0xffn);
        time >>= 8n;
    }
    bytes[6] = (bytes[6] & 0x0f) | 0x70;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    lastV7Timestamp = timestamp;
    lastV7Bytes = bytes.slice();
    return bytesToUuid(bytes);
}

function applyOutputFormat(uuid) {
    let value = elements.hyphenToggle.checked
        ? uuid
        : uuid.replaceAll("-", "");

    if (elements.caseSelect.value === "upper") {
        value = value.toUpperCase();
    }

    return value;
}

function updateOutput() {
    elements.output.value = lastGenerated.join("\n");
    elements.outputMeta.textContent = `${lastGenerated.length.toLocaleString()} UUID${lastGenerated.length === 1 ? "" : "s"}`;
}

function generateUuids() {
    try {
        const quantity = getQuantity();
        const generator = activeVersion === "v7" ? generateV7 : generateV4;

        lastGenerated = Array.from(
            { length: quantity },
            () => applyOutputFormat(generator())
        );

        updateOutput();
        setStatus(
            `${quantity.toLocaleString()} UUID ${activeVersion.slice(1)}${quantity === 1 ? "" : "s"} generated.`,
            "success"
        );
    } catch (error) {
        setStatus(error.message, "error");
    }
}

function reformatExistingOutput() {
    if (!lastGenerated.length) {
        return;
    }

    const canonical = lastGenerated.map((uuid) => {
        const compact = uuid.toLowerCase().replaceAll("-", "");
        return [
            compact.slice(0, 8),
            compact.slice(8, 12),
            compact.slice(12, 16),
            compact.slice(16, 20),
            compact.slice(20)
        ].join("-");
    });

    lastGenerated = canonical.map(applyOutputFormat);
    updateOutput();
    setStatus("Output format updated.", "neutral");
}

function clearOutput() {
    lastGenerated = [];
    updateOutput();
    setStatus("Output cleared.", "neutral");
}

async function copyOutput() {
    const value = elements.output.value;

    if (!value) {
        setStatus("Nothing to copy yet.", "error");
        return;
    }

    try {
        await navigator.clipboard.writeText(value);
        setStatus("UUIDs copied to clipboard.", "success");
    } catch {
        elements.output.select();
        document.execCommand("copy");
        setStatus("UUIDs copied to clipboard.", "success");
    }
}

function downloadOutput() {
    const value = elements.output.value;

    if (!value) {
        setStatus("Nothing to download yet.", "error");
        return;
    }

    const blob = new Blob([`${value}\n`], {
        type: "text/plain;charset=utf-8"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const version = activeVersion.toLowerCase();
    const count = lastGenerated.length;

    link.href = url;
    link.download = `uuid-${version}-${count}.txt`;
    link.style.display = "none";

    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus("UUID file downloaded.", "success");
}

elements.v4Button.addEventListener("click", () => setVersion("v4"));
elements.v7Button.addEventListener("click", () => setVersion("v7"));
elements.generateButton.addEventListener("click", generateUuids);
elements.regenerateButton.addEventListener("click", generateUuids);
elements.clearButton.addEventListener("click", clearOutput);
elements.copyButton.addEventListener("click", copyOutput);
elements.downloadButton.addEventListener("click", downloadOutput);
elements.caseSelect.addEventListener("change", reformatExistingOutput);
elements.hyphenToggle.addEventListener("change", reformatExistingOutput);

document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        generateUuids();
    }
});

updateOutput();
