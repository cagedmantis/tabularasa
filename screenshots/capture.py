#!/usr/bin/env python3
"""Render the Chrome Web Store screenshots (1280x800 PNG) and the small promo
tile (440x280) with headless Chrome.

The screenshots are the real extension: manager.html, manager.css and
dist/manager.js (run `make build` first), with screenshots/stub-chrome.js
standing in for the chrome.* APIs with demo tabs. A small server on
127.0.0.1 serves the repository and answers the favicon requests with letter
tiles, so nothing is fetched from the network. Run through `make screenshots`.
"""

import hashlib
import html
import http.server
import os
import shutil
import subprocess
import sys
import threading
import urllib.parse

SCREENSHOTS_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(SCREENSHOTS_DIR)

CHROME_CANDIDATES = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'google-chrome',
    'google-chrome-stable',
    'chromium-browser',
    'chromium',
]

# Run after the manager has rendered: each drives the real UI.
SELECT_GROUP_JS = """
  document.querySelectorAll('.tab-item').forEach(function (row) {
    var title = row.querySelector('.tab-title').textContent;
    if (/pull request|tabGroups/i.test(title)) {
      row.querySelector('.tab-checkbox').click();
    }
  });
"""
GROUPS_VIEW_JS = "document.getElementById('view-toggle').click();"
SEARCH_JS = """
  var input = document.getElementById('search-input');
  input.value = 'github';
  input.dispatchEvent(new Event('input', { bubbles: true }));
"""
SESSIONS_JS = "document.getElementById('sessions-toggle').click();"

# (file, scheme, scenario)
SHOTS = [
    ('screenshot-1.png', 'light', SELECT_GROUP_JS),
    ('screenshot-2.png', 'light', GROUPS_VIEW_JS),
    ('screenshot-3.png', 'dark', SEARCH_JS),
    ('screenshot-4.png', 'light', SESSIONS_JS),
]

PROMO_TILE_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  @font-face { font-family: "Geist"; src: url("/fonts/Geist.woff2") format("woff2"); font-weight: 100 900; }
  body {
    margin: 0; width: 440px; height: 280px; overflow: hidden;
    background: #0B0D11; color: #E8EBF0;
    font-family: "Geist", system-ui, sans-serif;
    display: flex; flex-direction: column; justify-content: center;
    padding: 0 48px; box-sizing: border-box;
  }
  img { width: 72px; height: 72px; margin-bottom: 24px; }
  h1 { margin: 0 0 8px; font-size: 34px; font-weight: 600; letter-spacing: -0.01em; }
  p { margin: 0; font-size: 16px; color: #B9C0C9; }
  p b { color: #FACC15; font-weight: 500; }
</style>
</head>
<body>
  <img src="/icons/logo.svg" alt="">
  <h1>Tabularasa</h1>
  <p>Every tab, every window, one list. <b>All local.</b></p>
</body>
</html>
"""

TILE_COLORS = ['#3B4A63', '#4B5361', '#5B4A6B', '#2F5A57', '#6B4F3A', '#3F5B3A', '#5A3B4E']


def favicon_svg(page_url):
    """A letter tile for the page's host, standing in for its favicon."""
    host = urllib.parse.urlparse(page_url).hostname or '?'
    name = host[4:] if host.startswith('www.') else host
    color = TILE_COLORS[int(hashlib.sha256(name.encode()).hexdigest(), 16) % len(TILE_COLORS)]
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">'
        '<rect width="32" height="32" rx="6" fill="%s"/>'
        '<text x="16" y="22" text-anchor="middle" font-family="sans-serif" font-size="18" '
        'font-weight="700" fill="#FFFFFF">%s</text></svg>' % (color, html.escape(name[0].upper()))
    ).encode()


def shot_page(origin, scenario):
    """manager.html with the stub API before the real script and the scenario after it."""
    with open(os.path.join(ROOT, 'manager.html')) as f:
        page = f.read()
    stub = ('<script>window.STUB_ORIGIN = %r;</script>\n'
            '    <script src="screenshots/stub-chrome.js"></script>\n'
            '    <script src="dist/manager.js"></script>' % origin)
    scenario = ('\n    <script>setTimeout(function () {%s}, 400);</script>' % scenario) if scenario else ''
    assert '<script src="dist/manager.js"></script>' in page
    return page.replace('<script src="dist/manager.js"></script>', stub + scenario).encode()


class Handler(http.server.SimpleHTTPRequestHandler):
    pages = {}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_GET(self):
        url = urllib.parse.urlparse(self.path)
        if url.path == '/_favicon/':
            page_url = urllib.parse.parse_qs(url.query).get('pageUrl', [''])[0]
            return self.respond(favicon_svg(page_url), 'image/svg+xml')
        if url.path in self.pages:
            return self.respond(self.pages[url.path], 'text/html; charset=utf-8')
        return super().do_GET()

    def respond(self, body, content_type):
        self.send_response(200)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass


def find_chrome():
    for candidate in CHROME_CANDIDATES:
        path = candidate if os.path.isabs(candidate) else shutil.which(candidate)
        if path and os.path.exists(path):
            return path
    return None


def capture(chrome, url, out_path, width, height, scheme='light'):
    result = subprocess.run(
        [
            chrome, '--headless=new', '--disable-gpu', '--hide-scrollbars',
            '--force-device-scale-factor=1',
            '--run-all-compositor-stages-before-draw', '--virtual-time-budget=5000',
            *(['--force-dark-mode', '--blink-settings=preferredColorScheme=0'] if scheme == 'dark' else []),
            # Set by the Docker assets image, where Chrome's sandbox cannot run.
            *os.environ.get('CHROME_EXTRA_FLAGS', '').split(),
            '--window-size=%d,%d' % (width, height),
            '--screenshot=%s' % out_path,
            url,
        ],
        capture_output=True, text=True,
    )
    if result.returncode != 0 or not os.path.exists(out_path):
        print('Chrome failed for %s:\n%s' % (out_path, result.stderr))
        return False
    print('Created %s' % os.path.relpath(out_path, ROOT))
    return True


def main():
    chrome = find_chrome()
    if not chrome:
        print('Google Chrome not found; cannot capture screenshots.')
        return 1
    if not os.path.exists(os.path.join(ROOT, 'dist', 'manager.js')):
        print('dist/manager.js is missing; run make build first.')
        return 1

    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    origin = 'http://127.0.0.1:%d' % server.server_address[1]
    threading.Thread(target=server.serve_forever, daemon=True).start()

    ok = True
    try:
        for name, scheme, scenario in SHOTS:
            path = '/__%s.html' % name[:-4]
            Handler.pages[path] = shot_page(origin, scenario)
            out = os.path.join(SCREENSHOTS_DIR, name)
            ok = capture(chrome, origin + path, out, 1280, 800, scheme) and ok

        Handler.pages['/__promo.html'] = PROMO_TILE_HTML.encode()
        out = os.path.join(SCREENSHOTS_DIR, 'promo-small-440x280.png')
        ok = capture(chrome, origin + '/__promo.html', out, 440, 280) and ok
    finally:
        server.shutdown()

    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
