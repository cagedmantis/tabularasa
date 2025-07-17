#!/usr/bin/env python3
"""
Script to create simple icon files for the Tabula Rasa extension
Creates SVG icons and converts them to PNG format
"""

import os
import subprocess
from xml.etree import ElementTree as ET

def create_svg_icon(size):
    """Create an SVG icon with the specified size"""
    svg = ET.Element('svg', {
        'xmlns': 'http://www.w3.org/2000/svg',
        'width': str(size),
        'height': str(size),
        'viewBox': '0 0 24 24',
        'fill': 'none',
        'stroke': 'currentColor',
        'stroke-width': '2',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round'
    })
    
    # Create a simple tab icon design
    # Background rectangle
    bg_rect = ET.SubElement(svg, 'rect', {
        'x': '2',
        'y': '6',
        'width': '20',
        'height': '12',
        'rx': '2',
        'fill': '#667eea',
        'stroke': '#667eea'
    })
    
    # Tab representations
    tab1 = ET.SubElement(svg, 'rect', {
        'x': '4',
        'y': '8',
        'width': '6',
        'height': '8',
        'rx': '1',
        'fill': 'white',
        'stroke': 'white'
    })
    
    tab2 = ET.SubElement(svg, 'rect', {
        'x': '12',
        'y': '8',
        'width': '6',
        'height': '8',
        'rx': '1',
        'fill': 'white',
        'stroke': 'white'
    })
    
    # Small lines to represent content
    line1 = ET.SubElement(svg, 'line', {
        'x1': '5',
        'y1': '10',
        'x2': '9',
        'y2': '10',
        'stroke': '#667eea',
        'stroke-width': '1'
    })
    
    line2 = ET.SubElement(svg, 'line', {
        'x1': '5',
        'y1': '12',
        'x2': '8',
        'y2': '12',
        'stroke': '#667eea',
        'stroke-width': '1'
    })
    
    line3 = ET.SubElement(svg, 'line', {
        'x1': '13',
        'y1': '10',
        'x2': '17',
        'y2': '10',
        'stroke': '#667eea',
        'stroke-width': '1'
    })
    
    line4 = ET.SubElement(svg, 'line', {
        'x1': '13',
        'y1': '12',
        'x2': '16',
        'y2': '12',
        'stroke': '#667eea',
        'stroke-width': '1'
    })
    
    return ET.tostring(svg, encoding='unicode')

def create_icons():
    """Create all required icon sizes"""
    sizes = [16, 32, 48, 128]
    
    for size in sizes:
        # Create SVG content
        svg_content = create_svg_icon(size)
        
        # Save SVG file
        svg_filename = f'icon-{size}.svg'
        svg_path = os.path.join('icons', svg_filename)
        
        with open(svg_path, 'w') as f:
            f.write(svg_content)
        
        print(f"Created {svg_filename}")
        
        # Try to convert to PNG using different methods
        png_filename = f'icon-{size}.png'
        png_path = os.path.join('icons', png_filename)
        
        # Method 1: Try using rsvg-convert (if available)
        try:
            subprocess.run([
                'rsvg-convert', 
                '-w', str(size), 
                '-h', str(size), 
                '-o', png_path, 
                svg_path
            ], check=True, capture_output=True)
            print(f"Created {png_filename} using rsvg-convert")
            continue
        except (subprocess.CalledProcessError, FileNotFoundError):
            pass
        
        # Method 2: Try using ImageMagick (if available)
        try:
            subprocess.run([
                'convert', 
                '-background', 'transparent',
                '-size', f'{size}x{size}',
                svg_path, 
                png_path
            ], check=True, capture_output=True)
            print(f"Created {png_filename} using ImageMagick")
            continue
        except (subprocess.CalledProcessError, FileNotFoundError):
            pass
        
        # Method 3: Try using Inkscape (if available)
        try:
            subprocess.run([
                'inkscape',
                '--export-type=png',
                f'--export-width={size}',
                f'--export-height={size}',
                f'--export-filename={png_path}',
                svg_path
            ], check=True, capture_output=True)
            print(f"Created {png_filename} using Inkscape")
            continue
        except (subprocess.CalledProcessError, FileNotFoundError):
            pass
        
        print(f"Warning: Could not create {png_filename} - no SVG converter found")
        print("Please install rsvg-convert, ImageMagick, or Inkscape to generate PNG icons")

if __name__ == '__main__':
    create_icons()