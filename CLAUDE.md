# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Chrome Tab Manager Extension called "tabularasa" built with TypeScript.

## Development Commands

- `npm install` - Install dependencies
- `npm run build` - Compile TypeScript to JavaScript
- `npm run watch` - Watch for changes and recompile
- `npm run clean` - Remove build artifacts

## Project Structure

- `src/` - TypeScript source files
  - `background.ts` - Service worker for extension lifecycle and window management
  - `content.ts` - Content script injected into web pages
  - `manager.ts` - Tab management window logic
- `dist/` - Compiled JavaScript output
- `manifest.json` - Chrome extension configuration
- `manager.html` - Tab management window UI
- `tsconfig.json` - TypeScript configuration

## Chrome Extension Setup

1. Run `npm run build` to compile TypeScript
2. Load the extension in Chrome by going to chrome://extensions/
3. Enable Developer mode and click "Load unpacked"
4. Select this project directory

## Architecture Notes

- Uses Manifest V3 format
- TypeScript compiled to ES2020 modules
- Tab management opens in a dedicated window (900x600px)
- Features include:
  - View all tabs grouped by window
  - Search/filter tabs
  - Click to switch to any tab
  - Close individual tabs or selected tabs
  - Close duplicate tabs automatically
  - Multi-select tabs with Ctrl/Cmd+click
- Background service worker handles extension action clicks and window management
- Content script available on all pages for future tab management features