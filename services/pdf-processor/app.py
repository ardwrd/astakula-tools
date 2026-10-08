"""Isolated PDF processor. The service must not be exposed directly on the Internet."""
from __future__ import annotations

import io
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit

from pypdf import PdfReader, PdfWriter

MAX_INPUT_BYTES = 20 * 1024 * 1024
ANGLES = {90, 180, 270}


def rotate_pdf(data: bytes, angle: int) -> bytes:
    if angle not in ANGLES:
        raise ValueError("invalid_angle")
    if not data.startswith(b"%PDF-"):
        raise ValueError("invalid_pdf")
    try:
        reader = PdfReader(io.BytesIO(data), strict=False)
        if reader.is_encrypted:
            raise ValueError("encrypted_pdf")
        if not reader.pages:
            raise ValueError("empty_pdf")
        writer = PdfWriter()
        for page in reader.pages:
            writer.add_page(page.rotate(angle))
        output = io.BytesIO()
        writer.write(output)
        return output.getvalue()
    except ValueError:
        raise
    except Exception as exc:
        raise ValueError("invalid_pdf") from exc


class Handler(BaseHTTPRequestHandler):
    server_version = "AstakulaPDFProcessor/0.1"

    def error(self, status: int, code: str) -> None:
        body = json.dumps({"error": code}).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        if urlsplit(self.path).path != "/health":
            return self.error(404, "not_found")
        body = b'{"status":"ok"}'
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self) -> None:
        parsed = urlsplit(self.path)
        if parsed.path != "/rotate":
            return self.error(404, "not_found")
        try:
            length = int(self.headers.get("Content-Length", "-1"))
        except ValueError:
            return self.error(400, "invalid_length")
        if length < 5 or length > MAX_INPUT_BYTES:
            return self.error(413, "invalid_size")
        if self.headers.get("Content-Type", "").split(";")[0].strip() != "application/pdf":
            return self.error(415, "invalid_content_type")
        raw_angle = parse_qs(parsed.query).get("angle", [""])[0]
        try:
            angle = int(raw_angle)
            payload = self.rfile.read(length)
            if len(payload) != length:
                raise ValueError("truncated_upload")
            output = rotate_pdf(payload, angle)
        except (ValueError, TypeError) as exc:
            code = str(exc)
            if code not in {"invalid_angle", "invalid_pdf", "encrypted_pdf", "empty_pdf", "truncated_upload"}:
                code = "invalid_pdf"
            return self.error(422, code)
        self.send_response(200)
        self.send_header("Content-Type", "application/pdf")
        self.send_header("Content-Length", str(len(output)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(output)

    def log_message(self, fmt: str, *args: object) -> None:
        # Never log user document bytes or capability tokens.
        pass


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", int(os.getenv("PORT", "8080"))), Handler).serve_forever()
