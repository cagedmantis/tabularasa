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
  - `background.ts` - Service worker for extension lifecycle
  - `content.ts` - Content script injected into web pages
  - `popup.ts` - Popup interface logic
- `dist/` - Compiled JavaScript output
- `manifest.json` - Chrome extension configuration
- `popup.html` - Extension popup UI
- `tsconfig.json` - TypeScript configuration

## Chrome Extension Setup

1. Run `npm run build` to compile TypeScript
2. Load the extension in Chrome by going to chrome://extensions/
3. Enable Developer mode and click "Load unpacked"
4. Select this project directory

## Architecture Notes

- Uses Manifest V3 format
- TypeScript compiled to ES2020 modules
- Popup interface lists all open tabs with click-to-switch functionality
- Background service worker handles tab lifecycle events
- Content script available on all pages for future tab management features