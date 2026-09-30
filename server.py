"""LeseWelt – kleiner lokaler Webserver.

Startet die App auf http://localhost:8080 und zeigt die Adresse,
mit der du sie auf dem Handy (gleiches WLAN) öffnen kannst.
"""
import http.server
import os
import socket
import socketserver
import sys
import webbrowser

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
ROOT = os.path.dirname(os.path.abspath(__file__))


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".webmanifest": "application/manifest+json",
        ".svg": "image/svg+xml",
        ".json": "application/json",
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass  # ruhig bleiben


def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except OSError:
        return None
    finally:
        s.close()


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


if __name__ == "__main__":
    with Server(("0.0.0.0", PORT), Handler) as httpd:
        ip = lan_ip()
        print()
        print("  LeseWelt laeuft!")
        print(f"  Laptop:  http://localhost:{PORT}")
        if ip:
            print(f"  Handy:   http://{ip}:{PORT}   (gleiches WLAN)")
        print()
        print("  Zum Beenden dieses Fenster schliessen oder Strg+C druecken.")
        if "--no-browser" not in sys.argv:
            webbrowser.open(f"http://localhost:{PORT}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
