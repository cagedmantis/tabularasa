#!/usr/bin/env python3
"""
Script to create Chrome Web Store screenshots for Tabularasa extension
This script provides instructions and tools to help create the required screenshots
"""

import os
import subprocess
import sys

def create_screenshots_dir():
    """Create screenshots directory if it doesn't exist"""
    if not os.path.exists('screenshots'):
        os.makedirs('screenshots')
    print("✅ Screenshots directory ready")

def check_requirements():
    """Check if required tools are available"""
    requirements = {
        'google-chrome': 'Google Chrome browser',
        'python3': 'Python 3',
    }
    
    print("🔍 Checking requirements...")
    missing = []
    
    for tool, description in requirements.items():
        try:
            subprocess.run([tool, '--version'], capture_output=True, check=True)
            print(f"✅ {description} found")
        except (subprocess.CalledProcessError, FileNotFoundError):
            print(f"❌ {description} not found")
            missing.append(tool)
    
    if missing:
        print(f"⚠️  Missing tools: {', '.join(missing)}")
        return False
    
    return True

def generate_screenshot_instructions():
    """Generate detailed instructions for creating screenshots"""
    instructions = """
📸 CHROME WEB STORE SCREENSHOTS CREATION GUIDE

Required: 5 screenshots at 1280x800 pixels (PNG format)

METHOD 1: Using the Extension Interface (Recommended)
1. Build and load the extension:
   make build
   make chrome-dev

2. Open the extension by clicking the Tabularasa icon

3. Set up different scenarios:
   - Have multiple tabs open from different domains
   - Create some tab groups
   - Select some tabs to show selection functionality
   - Save a session to show session management

4. Take screenshots:
   - Use Chrome's built-in screenshot tool (DevTools > Screenshot)
   - Or use system screenshot tool (macOS: Cmd+Shift+4, Windows: Snipping Tool)
   - Save as PNG files: screenshot-1.png, screenshot-2.png, etc.

METHOD 2: Using the HTML Generator
1. Open screenshots/generate_screenshots.html in Chrome
2. Use Chrome DevTools (F12) to set viewport to 1280x800
3. Take screenshots of each demo interface
4. Save as PNG files

SCREENSHOT REQUIREMENTS:
- Screenshot 1: Main interface with domain grouping
- Screenshot 2: Search and filter functionality  
- Screenshot 3: Session management interface
- Screenshot 4: Bulk operations and tab selection
- Screenshot 5: Settings and preferences

TIPS:
- Use realistic tab titles and URLs
- Show meaningful tab counts (10-20 tabs)
- Include variety in domain names
- Show both active and selected tabs
- Use clear, readable text
- Avoid cluttered layouts

FILES TO CREATE:
- screenshots/screenshot-1.png (1280x800)
- screenshots/screenshot-2.png (1280x800)
- screenshots/screenshot-3.png (1280x800)
- screenshots/screenshot-4.png (1280x800)
- screenshots/screenshot-5.png (1280x800)
"""
    
    print(instructions)
    
    # Write instructions to file
    with open('screenshots/INSTRUCTIONS.md', 'w') as f:
        f.write(instructions)
    
    print("📄 Instructions saved to screenshots/INSTRUCTIONS.md")

def validate_screenshots():
    """Validate that screenshots meet requirements"""
    required_files = [
        'screenshots/screenshot-1.png',
        'screenshots/screenshot-2.png',
        'screenshots/screenshot-3.png',
        'screenshots/screenshot-4.png',
        'screenshots/screenshot-5.png'
    ]
    
    print("🔍 Validating screenshots...")
    
    missing = []
    for file_path in required_files:
        if os.path.exists(file_path):
            # Check file size (basic validation)
            size = os.path.getsize(file_path)
            if size > 1000:  # At least 1KB
                print(f"✅ {file_path} found ({size:,} bytes)")
            else:
                print(f"❌ {file_path} too small ({size} bytes)")
                missing.append(file_path)
        else:
            print(f"❌ {file_path} not found")
            missing.append(file_path)
    
    if missing:
        print(f"⚠️  Missing or invalid screenshots: {len(missing)}")
        return False
    
    print("✅ All screenshots present and valid")
    return True

def main():
    """Main function"""
    print("🚀 Tabularasa Chrome Web Store Screenshots Generator")
    print("=" * 60)
    
    create_screenshots_dir()
    
    if len(sys.argv) > 1 and sys.argv[1] == 'validate':
        validate_screenshots()
        return
    
    if len(sys.argv) > 1 and sys.argv[1] == 'check':
        check_requirements()
        return
    
    print("\n📋 Available commands:")
    print("  python3 screenshots/create_screenshots.py          - Show instructions")
    print("  python3 screenshots/create_screenshots.py check    - Check requirements")
    print("  python3 screenshots/create_screenshots.py validate - Validate screenshots")
    print()
    
    generate_screenshot_instructions()

if __name__ == '__main__':
    main()