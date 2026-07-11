#!/usr/bin/env python3
"""Render Chrome Web Store screenshots (1280x800 PNG) with headless Chrome.

Builds scenario variants of screenshots/generate_screenshots.html and
captures each one, plus a 440x280 small promotional tile. Outputs land in
the screenshots/ directory.
"""

import os
import shutil
import subprocess
import sys
import tempfile

SCREENSHOTS_DIR = os.path.dirname(os.path.abspath(__file__))
DEMO_HTML = os.path.join(SCREENSHOTS_DIR, 'generate_screenshots.html')

CHROME_CANDIDATES = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    'google-chrome',
    'google-chrome-stable',
    'chromium-browser',
    'chromium',
]

# Strip the demo chrome (title bar, padding, shadows) so the container fills
# the viewport exactly at 1280x800.
BASE_CSS = """
<style>
  body { margin: 0; padding: 0; background: #fff; }
  .screenshot-title { display: none; }
  .screenshot-container {
    margin: 0; width: 1280px; height: 800px;
    border-radius: 0; box-shadow: none;
  }
  .demo-highlight, .demo-annotation { display: none; }
</style>
"""

# Pad each domain group with extra mock tabs so the counts shown in the
# group headers (5 / 3 / 4) match what is visible.
FILL_JS = """
<script>
  var extras = [
    ['Pull Requests - tabularasa', 'github.com/user/tabularasa/pulls'],
    ['GitHub Actions - CI runs', 'github.com/user/tabularasa/actions'],
    ['Manifest V3 service worker lifecycle', 'stackoverflow.com/questions/mv3-service-worker'],
    ['chrome.tabs API reference', 'developer.chrome.com/docs/extensions/reference/api/tabs'],
    ['chrome.tabGroups API reference', 'developer.chrome.com/docs/extensions/reference/api/tabGroups'],
    ['Manifest V3 migration guide', 'developer.chrome.com/docs/extensions/develop/migrate'],
  ];
  var groupFor = [0, 0, 1, 2, 2, 2];
  var groups = document.querySelectorAll('.tab-group');
  extras.forEach(function (extra, i) {
    var group = groups[groupFor[i]];
    var item = group.querySelector('.tab-item:last-child').cloneNode(true);
    item.classList.remove('active', 'selected');
    item.querySelector('.tab-checkbox').checked = false;
    item.querySelector('.tab-title').textContent = extra[0];
    item.querySelector('.tab-url').textContent = extra[1];
    group.appendChild(item);
  });
</script>
"""

SEARCH_SCENARIO_JS = """
<script>
  document.querySelector('.search-input').value = 'github';
  document.querySelectorAll('.tab-group').forEach(function (group) {
    var title = group.querySelector('.tab-group-title').textContent;
    if (title.indexOf('github') === -1) { group.style.display = 'none'; }
  });
  document.querySelector('.tab-count').textContent = '5 matching tabs';
  document.querySelector('.selected-count').textContent = '1 selected';
  document.querySelectorAll('.btn-danger').forEach(function (btn) {
    if (btn.textContent.indexOf('Close Selected') !== -1) {
      btn.textContent = 'Close Selected (1)';
    }
  });
</script>
"""

BULK_SCENARIO_JS = """
<script>
  var items = document.querySelectorAll('.tab-item');
  items.forEach(function (item) {
    item.classList.remove('active');
    item.classList.add('selected');
    item.querySelector('.tab-checkbox').checked = true;
  });
  document.querySelector('.selected-count').textContent = items.length + ' selected';
  document.querySelectorAll('.btn-danger').forEach(function (btn) {
    if (btn.textContent.indexOf('Close Selected') !== -1) {
      btn.textContent = 'Close Selected (' + items.length + ')';
    }
  });
</script>
"""

PROMO_TILE_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  body {
    margin: 0; width: 440px; height: 280px; overflow: hidden;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; color: white;
  }
  img { width: 96px; height: 96px; margin-bottom: 16px; }
  h1 { margin: 0 0 8px; font-size: 36px; font-weight: 600; letter-spacing: 1px; }
  p { margin: 0; font-size: 15px; opacity: 0.9; }
</style>
</head>
<body>
  <img src="ICON_SRC" alt="">
  <h1>Tabularasa</h1>
  <p>Advanced tab &amp; window management for Chrome</p>
</body>
</html>
"""


def find_chrome():
    for candidate in CHROME_CANDIDATES:
        path = candidate if os.path.isabs(candidate) else shutil.which(candidate)
        if path and os.path.exists(path):
            return path
    return None


def capture(chrome, html_path, out_path, width, height):
    result = subprocess.run(
        [
            chrome, '--headless=new', '--disable-gpu', '--hide-scrollbars',
            '--force-device-scale-factor=1',
            '--window-size=%d,%d' % (width, height),
            '--screenshot=%s' % out_path,
            'file://%s' % html_path,
        ],
        capture_output=True, text=True,
    )
    if result.returncode != 0 or not os.path.exists(out_path):
        print('Chrome failed for %s:\n%s' % (out_path, result.stderr))
        return False
    print('Created %s' % out_path)
    return True


def main():
    chrome = find_chrome()
    if not chrome:
        print('Google Chrome not found; cannot capture screenshots.')
        return 1

    with open(DEMO_HTML) as f:
        demo = f.read()
    demo = demo.replace('</head>', BASE_CSS + '</head>')

    scenarios = [
        ('screenshot-1.png', FILL_JS),
        ('screenshot-2.png', FILL_JS + SEARCH_SCENARIO_JS),
        ('screenshot-3.png', FILL_JS + BULK_SCENARIO_JS),
    ]

    ok = True
    with tempfile.TemporaryDirectory() as tmp:
        for name, scenario_js in scenarios:
            html = demo.replace('</body>', scenario_js + '</body>')
            html_path = os.path.join(tmp, name.replace('.png', '.html'))
            with open(html_path, 'w') as f:
                f.write(html)
            out = os.path.join(SCREENSHOTS_DIR, name)
            ok = capture(chrome, html_path, out, 1280, 800) and ok

        icon = os.path.join(SCREENSHOTS_DIR, '..', 'icons', 'icon-128.png')
        tile_html = PROMO_TILE_HTML.replace('ICON_SRC', 'file://%s' % os.path.abspath(icon))
        tile_path = os.path.join(tmp, 'promo-tile.html')
        with open(tile_path, 'w') as f:
            f.write(tile_html)
        out = os.path.join(SCREENSHOTS_DIR, 'promo-small-440x280.png')
        ok = capture(chrome, tile_path, out, 440, 280) and ok

    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
