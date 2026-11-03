#!/usr/bin/env python3
"""Render the extension icons from their SVG sources.

The mark: three list rows on a slate tile, the middle one marked in yellow.
Each size has its own hand-tuned SVG (icons/icon-<size>.svg), aligned to the
pixel grid so 16px stays crisp; icons/logo.svg is the 128px drawing, used by
the manager page header. Run through `make icons` (rsvg-convert in Docker).
"""

import os
import subprocess

ICONS_DIR = os.path.dirname(os.path.abspath(__file__))
SIZES = (16, 32, 48, 128)


def main():
    for size in SIZES:
        svg = os.path.join(ICONS_DIR, 'icon-%d.svg' % size)
        png = os.path.join(ICONS_DIR, 'icon-%d.png' % size)
        subprocess.run(['rsvg-convert', '--width', str(size), '--height', str(size),
                        '--output', png, svg], check=True)
        print('Rendered %s' % os.path.relpath(png, os.path.dirname(ICONS_DIR)))


if __name__ == '__main__':
    main()
