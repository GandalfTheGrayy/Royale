"""Pehlevan Royale için yerel Türkçe kadın sesi köprüsü.

HTTP isteğini Edge TTS'nin tr-TR-EmelNeural sesine çevirir. Kullanıcı metni
diske yazılmaz ve terminale kaydedilmez.
"""

import asyncio
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import edge_tts


HOST = "127.0.0.1"
PORT = 8765
VOICE = "tr-TR-EmelNeural"
ALLOWED_ORIGINS = {"http://127.0.0.1:5173", "http://localhost:5173"}


async def synthesize(text: str) -> bytes:
    audio = bytearray()
    communicator = edge_tts.Communicate(text, VOICE, rate="-2%", pitch="-2Hz")
    async for chunk in communicator.stream():
        if chunk["type"] == "audio":
            audio.extend(chunk["data"])
    return bytes(audio)


class VoiceHandler(BaseHTTPRequestHandler):
    def _cors(self) -> None:
        origin = self.headers.get("Origin", "")
        if origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")

    def _json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self._cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self._cors()
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/health":
            self._json(200, {"ok": True, "voice": VOICE})
            return
        self._json(404, {"error": "Bulunamadı."})

    def do_POST(self) -> None:  # noqa: N802
        if self.path != "/speak":
            self._json(404, {"error": "Bulunamadı."})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(min(length, 8192)))
            text = str(payload.get("text", "")).strip()
            if not text or len(text) > 600:
                self._json(400, {"error": "Metin 1-600 karakter olmalı."})
                return
            audio = asyncio.run(synthesize(text))
            if not audio:
                raise RuntimeError("Ses verisi oluşmadı.")
            self.send_response(200)
            self._cors()
            self.send_header("Content-Type", "audio/mpeg")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(audio)))
            self.end_headers()
            self.wfile.write(audio)
        except (json.JSONDecodeError, ValueError):
            self._json(400, {"error": "Geçersiz istek."})
        except Exception:
            self._json(502, {"error": "Türkçe ses üretilemedi."})

    def log_message(self, format: str, *args: object) -> None:
        print(f"[voice] {self.command} {self.path} -> {args[1] if len(args) > 1 else ''}")


if __name__ == "__main__":
    print(f"Vera Türkçe ses köprüsü: http://{HOST}:{PORT} ({VOICE})")
    ThreadingHTTPServer((HOST, PORT), VoiceHandler).serve_forever()
