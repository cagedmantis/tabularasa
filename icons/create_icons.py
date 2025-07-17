#!/usr/bin/env python3
"""
Script to create notebook and fountain pen icon files for the Tabularasa extension
Creates SVG icons with a notebook and fountain pen design and converts them to PNG format
"""

import os
import subprocess
from xml.etree import ElementTree as ET

def create_svg_icon(size):
    """Create an SVG icon with a notebook and fountain pen design, optimized for different sizes"""
    svg = ET.Element('svg', {
        'xmlns': 'http://www.w3.org/2000/svg',
        'width': str(size),
        'height': str(size),
        'viewBox': '0 0 24 24',
        'fill': 'none',
        'stroke': 'currentColor',
        'stroke-width': '1.5',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round'
    })
    
    # Adjust design complexity based on size
    if size <= 16:
        # Simplified design for small sizes
        # Notebook cover with better contrast
        notebook = ET.SubElement(svg, 'rect', {
            'x': '4',
            'y': '7',
            'width': '14',
            'height': '11',
            'rx': '1.5',
            'fill': '#7c3aed',
            'stroke': '#5b21b6',
            'stroke-width': '1'
        })
        
        # Simple binding line
        binding = ET.SubElement(svg, 'line', {
            'x1': '6.5',
            'y1': '7',
            'x2': '6.5',
            'y2': '18',
            'stroke': '#5b21b6',
            'stroke-width': '2'
        })
        
        # Simplified pen - just a diagonal line with contrasting color
        pen = ET.SubElement(svg, 'line', {
            'x1': '12',
            'y1': '6',
            'x2': '18',
            'y2': '12',
            'stroke': '#fbbf24',
            'stroke-width': '3',
            'stroke-linecap': 'round'
        })
        
        # Pen tip
        pen_tip = ET.SubElement(svg, 'circle', {
            'cx': '18',
            'cy': '12',
            'r': '1',
            'fill': '#f59e0b',
            'stroke': 'none'
        })
        
    elif size <= 32:
        # Medium complexity for medium sizes
        # Notebook shadow
        shadow = ET.SubElement(svg, 'rect', {
            'x': '3.5',
            'y': '6.5',
            'width': '15',
            'height': '12',
            'rx': '1',
            'fill': '#d1d5db',
            'stroke': 'none'
        })
        
        # Notebook cover
        notebook = ET.SubElement(svg, 'rect', {
            'x': '3',
            'y': '6',
            'width': '15',
            'height': '12',
            'rx': '1',
            'fill': '#7c3aed',
            'stroke': '#5b21b6',
            'stroke-width': '1'
        })
        
        # Simplified spiral binding
        spiral1 = ET.SubElement(svg, 'circle', {
            'cx': '6',
            'cy': '8.5',
            'r': '0.8',
            'fill': 'none',
            'stroke': '#5b21b6',
            'stroke-width': '1.5'
        })
        
        spiral2 = ET.SubElement(svg, 'circle', {
            'cx': '6',
            'cy': '12',
            'r': '0.8',
            'fill': 'none',
            'stroke': '#5b21b6',
            'stroke-width': '1.5'
        })
        
        spiral3 = ET.SubElement(svg, 'circle', {
            'cx': '6',
            'cy': '15.5',
            'r': '0.8',
            'fill': 'none',
            'stroke': '#5b21b6',
            'stroke-width': '1.5'
        })
        
        # Fountain pen body
        pen_body = ET.SubElement(svg, 'ellipse', {
            'cx': '14',
            'cy': '7',
            'rx': '0.8',
            'ry': '4',
            'fill': '#374151',
            'stroke': '#1f2937',
            'stroke-width': '0.5',
            'transform': 'rotate(25 14 7)'
        })
        
        # Fountain pen tip
        pen_tip = ET.SubElement(svg, 'ellipse', {
            'cx': '17',
            'cy': '9.5',
            'rx': '0.5',
            'ry': '1.3',
            'fill': '#fbbf24',
            'stroke': '#f59e0b',
            'stroke-width': '0.5',
            'transform': 'rotate(25 17 9.5)'
        })
        
    else:
        # Full detail for larger sizes
        # Notebook shadow for depth
        shadow = ET.SubElement(svg, 'rect', {
            'x': '3.5',
            'y': '6.5',
            'width': '16',
            'height': '13',
            'rx': '1',
            'fill': '#d1d5db',
            'stroke': 'none'
        })
        
        # Notebook cover
        notebook = ET.SubElement(svg, 'rect', {
            'x': '3',
            'y': '6',
            'width': '16',
            'height': '13',
            'rx': '1',
            'fill': '#7c3aed',
            'stroke': '#5b21b6',
            'stroke-width': '1'
        })
        
        # Notebook spiral binding
        spiral1 = ET.SubElement(svg, 'circle', {
            'cx': '6',
            'cy': '8',
            'r': '0.8',
            'fill': 'none',
            'stroke': '#5b21b6',
            'stroke-width': '1'
        })
        
        spiral2 = ET.SubElement(svg, 'circle', {
            'cx': '6',
            'cy': '10.5',
            'r': '0.8',
            'fill': 'none',
            'stroke': '#5b21b6',
            'stroke-width': '1'
        })
        
        spiral3 = ET.SubElement(svg, 'circle', {
            'cx': '6',
            'cy': '13',
            'r': '0.8',
            'fill': 'none',
            'stroke': '#5b21b6',
            'stroke-width': '1'
        })
        
        spiral4 = ET.SubElement(svg, 'circle', {
            'cx': '6',
            'cy': '15.5',
            'r': '0.8',
            'fill': 'none',
            'stroke': '#5b21b6',
            'stroke-width': '1'
        })
        
        # Notebook lines to represent pages
        line1 = ET.SubElement(svg, 'line', {
            'x1': '9',
            'y1': '9',
            'x2': '16',
            'y2': '9',
            'stroke': '#a855f7',
            'stroke-width': '0.8'
        })
        
        line2 = ET.SubElement(svg, 'line', {
            'x1': '9',
            'y1': '11',
            'x2': '15',
            'y2': '11',
            'stroke': '#a855f7',
            'stroke-width': '0.8'
        })
        
        line3 = ET.SubElement(svg, 'line', {
            'x1': '9',
            'y1': '13',
            'x2': '16',
            'y2': '13',
            'stroke': '#a855f7',
            'stroke-width': '0.8'
        })
        
        line4 = ET.SubElement(svg, 'line', {
            'x1': '9',
            'y1': '15',
            'x2': '14',
            'y2': '15',
            'stroke': '#a855f7',
            'stroke-width': '0.8'
        })
        
        # Fountain pen cap
        pen_cap = ET.SubElement(svg, 'ellipse', {
            'cx': '10',
            'cy': '4',
            'rx': '0.8',
            'ry': '2.5',
            'fill': '#1f2937',
            'stroke': '#111827',
            'stroke-width': '0.5',
            'transform': 'rotate(25 10 4)'
        })
        
        # Fountain pen body
        pen_body = ET.SubElement(svg, 'ellipse', {
            'cx': '14',
            'cy': '7',
            'rx': '0.7',
            'ry': '4',
            'fill': '#374151',
            'stroke': '#1f2937',
            'stroke-width': '0.5',
            'transform': 'rotate(25 14 7)'
        })
        
        # Fountain pen tip
        pen_tip = ET.SubElement(svg, 'ellipse', {
            'cx': '17',
            'cy': '9.5',
            'rx': '0.4',
            'ry': '1.2',
            'fill': '#fbbf24',
            'stroke': '#f59e0b',
            'stroke-width': '0.5',
            'transform': 'rotate(25 17 9.5)'
        })
        
        # Pen clip
        pen_clip = ET.SubElement(svg, 'path', {
            'd': 'M 8.5 2.5 Q 8 2 8 3 Q 8 4 8.5 3.5',
            'fill': 'none',
            'stroke': '#6b7280',
            'stroke-width': '0.8',
            'stroke-linecap': 'round'
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