(() => {
    const el = (id) => document.getElementById(id);
    const note = el("viewerMessage");
    const img = el("viewerImage");
    const download = el("viewerDownload");
    const match = location.hash.match(/^#i=([a-zA-Z0-9_-]{100,1800})$/);
    if (!match) {
        note.textContent = "Data gambar tidak ditemukan. Pindai QR Image to QR yang valid.";
        return;
    }
    try {
        const token = match[1];
        const padded = token.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - token.length % 4) % 4);
        const binary = atob(padded);
        if (binary.length > 1250 || binary.charCodeAt(0) !== 255 ||
            binary.charCodeAt(1) !== 216 || binary.charCodeAt(2) !== 255) {
            throw new Error("Not a JPEG thumbnail");
        }
        const dataUrl = "data:image/jpeg;base64," + padded;
        img.onload = () => {
            img.hidden = false;
            download.hidden = false;
            download.href = dataUrl;
            note.textContent = "Ini thumbnail kecil yang tersimpan dalam QR, bukan foto resolusi asli.";
        };
        img.onerror = () => {
            note.textContent = "Data gambar rusak atau tidak bisa ditampilkan.";
        };
        img.src = dataUrl;
    } catch {
        note.textContent = "Data QR tidak valid. Coba buat QR ulang melalui Astakula Tools.";
    }
})();
