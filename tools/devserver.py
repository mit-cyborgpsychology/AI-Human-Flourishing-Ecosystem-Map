#!/usr/bin/env python3
"""Static dev server for the atlas.

Identical to `python3 -m http.server` except it sends `Cache-Control: no-store`.
Without it browsers heuristically cache the ES modules and CSVs, so edits to
js/*.js or data/*.csv silently keep serving the previous version.
"""
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8471
    ThreadingHTTPServer(("", port), NoCacheHandler).serve_forever()
