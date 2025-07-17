/**
 * Create simple PNG icons using Canvas API in Node.js
 * This creates basic colored rectangles as placeholder icons
 */

const fs = require('fs');
const path = require('path');

// Create a simple base64 PNG for each size
function createSimplePNG(size) {
    // Create a simple PNG data URL with a gradient background and tab icon
    const canvas = `
        <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
                </linearGradient>
            </defs>
            <rect width="${size}" height="${size}" fill="url(#grad1)" rx="${size * 0.1}"/>
            <rect x="${size * 0.15}" y="${size * 0.3}" width="${size * 0.3}" height="${size * 0.4}" fill="white" rx="${size * 0.05}"/>
            <rect x="${size * 0.55}" y="${size * 0.3}" width="${size * 0.3}" height="${size * 0.4}" fill="white" rx="${size * 0.05}"/>
            <line x1="${size * 0.2}" y1="${size * 0.4}" x2="${size * 0.4}" y2="${size * 0.4}" stroke="#667eea" stroke-width="${size * 0.03}"/>
            <line x1="${size * 0.2}" y1="${size * 0.5}" x2="${size * 0.35}" y2="${size * 0.5}" stroke="#667eea" stroke-width="${size * 0.03}"/>
            <line x1="${size * 0.6}" y1="${size * 0.4}" x2="${size * 0.8}" y2="${size * 0.4}" stroke="#667eea" stroke-width="${size * 0.03}"/>
            <line x1="${size * 0.6}" y1="${size * 0.5}" x2="${size * 0.75}" y2="${size * 0.5}" stroke="#667eea" stroke-width="${size * 0.03}"/>
        </svg>
    `;

    return canvas;
}

// Create icons for all required sizes
const sizes = [16, 32, 48, 128];

sizes.forEach(size => {
    const svgContent = createSimplePNG(size);
    const filename = `icon-${size}.svg`;
    const filepath = path.join(__dirname, filename);
    
    fs.writeFileSync(filepath, svgContent);
    console.log(`Created ${filename}`);
});

console.log('\\nIcon creation complete!');
console.log('SVG icons created. For PNG conversion, you can:');
console.log('1. Use an online SVG to PNG converter');
console.log('2. Install rsvg-convert: brew install librsvg (macOS) or apt-get install librsvg2-bin (Ubuntu)');
console.log('3. Install ImageMagick: brew install imagemagick (macOS) or apt-get install imagemagick (Ubuntu)');
console.log('4. Use the SVG files directly (Chrome supports SVG icons)');