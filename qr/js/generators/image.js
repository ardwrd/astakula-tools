import { ValidationError, required } from "../core/validator.js";
import { isValidUrl } from "../core/utils.js";

export const VIEWER_PATH = "https://tools.astakula.com/qr/image/#i=";
export const MAX_IMAGE_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_QR_PAYLOAD_CHARS = 1650;

export function toBase64Url(base64) {
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function validateImageUrl(value) {
    const raw = String(value || "").trim();
    required(raw, "URL gambar");
    if (!isValidUrl(raw) || raw.length > 1600) {
        throw new ValidationError("Gunakan URL gambar http/https yang valid (maks. 1600 karakter).", "url");
    }
    return raw;
}

async function createThumbnail(file) {
    if (!file || typeof file.arrayBuffer !== "function") {
        throw new ValidationError("Pilih file gambar terlebih dahulu.", "image");
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        throw new ValidationError("Hanya gambar JPG, PNG, dan WebP yang didukung.", "image");
    }
    if (!file.size || file.size > MAX_IMAGE_FILE_BYTES) {
        throw new ValidationError("Ukuran file harus antara 1 byte dan 10 MB.", "image");
    }
    let bitmap;
    try {
        bitmap = await createImageBitmap(file);
    } catch {
        throw new ValidationError("File gambar tidak bisa dibuka. Gunakan JPG, PNG, atau WebP.", "image");
    }
    try {
        if (!bitmap.width || !bitmap.height || bitmap.width > 4000 || bitmap.height > 4000 ||
            bitmap.width * bitmap.height > 12000000) {
            throw new ValidationError("Dimensi terlalu besar: maksimal 12 megapiksel dan 4000 px per sisi.", "image");
        }
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { alpha: false });
        if (!ctx) throw new Error("Browser ini tidak mendukung pemrosesan gambar.");
        for (const maxSide of [80, 64, 48, 40, 32, 24]) {
            const factor = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
            canvas.width = Math.max(1, Math.round(bitmap.width * factor));
            canvas.height = Math.max(1, Math.round(bitmap.height * factor));
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
            for (const quality of [0.48, 0.35, 0.26, 0.17]) {
                const encoded = canvas.toDataURL("image/jpeg", quality);
                if (!encoded.startsWith("data:image/jpeg;base64,")) {
                    throw new Error("Browser tidak mendukung encoding JPEG.");
                }
                const token = toBase64Url(encoded.split(",")[1]);
                const payload = VIEWER_PATH + token;
                if (payload.length <= MAX_QR_PAYLOAD_CHARS) {
                    return { payload, width: canvas.width, height: canvas.height,
                        compressedBytes: Math.floor(token.length * 0.75) };
                }
            }
        }
        throw new ValidationError(
            "Gambar terlalu kompleks untuk satu QR. Gunakan mode URL gambar agar lebih mudah dipindai.",
            "image"
        );
    } finally {
        bitmap.close();
    }
}

const imageGenerator = {
    id: "image",
    label: "Image to QR",
    description: "QR untuk gambar: unggah thumbnail kecil yang tersimpan di QR, atau gunakan tautan gambar asli.",
    icon: "image",
    fields: [
        {
            name: "mode", label: "Cara kerja", type: "select", default: "file",
            options: [
                { value: "file", label: "Unggah gambar (thumbnail mini dalam QR)" },
                { value: "url", label: "Tautan gambar (kualitas asli)" }
            ],
            help: "Mode unggah menyimpan data gambar mini di QR dan membuka penampil Astakula saat dipindai. Mode tautan membuka URL gambar publik."
        },
        {
            name: "image", label: "Pilih JPG, PNG, atau WebP", type: "file",
            accept: "image/jpeg,image/png,image/webp", required: true,
            visibleWhen: { field: "mode", equals: "file" },
            help: "Maksimal 10 MB. Gambar diperkecil drastis; foto resolusi asli tidak bisa dimuat utuh ke satu QR. File tidak diunggah."
        },
        {
            name: "url", label: "URL gambar online", type: "url",
            placeholder: "https://example.com/foto.jpg", required: true,
            visibleWhen: { field: "mode", equals: "url" },
            help: "Tautan harus bisa diakses oleh orang yang memindai QR. Tidak ada upload file."
        }
    ],
    async generate(data) {
        if (data.mode === "url") {
            const payload = validateImageUrl(data.url);
            return { payload, preview: { title: "Image URL", value: payload,
                details: [{ label: "Mode", value: "Tautan gambar asli" }] } };
        }
        if (data.mode !== "file") {
            throw new ValidationError("Pilih cara membuat QR.", "mode");
        }
        const result = await createThumbnail(data.image);
        return {
            payload: result.payload,
            preview: {
                title: "Image to QR",
                value: result.width + " × " + result.height + " px (thumbnail)",
                details: [
                    { label: "Ukuran QR", value: "~" + result.compressedBytes + " byte gambar" },
                    { label: "Privasi", value: "Thumbnail dalam fragment URL; tidak diunggah ke server" },
                    { label: "Catatan", value: "QR padat dapat sulit dipindai. Halaman penampil perlu koneksi internet." }
                ]
            }
        };
    }
};

export default imageGenerator;
