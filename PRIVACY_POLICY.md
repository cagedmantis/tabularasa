# Privacy Policy for Tabularasa Chrome Extension

**Effective Date**: January 2025  
**Last Updated**: January 2025

## Overview

Tabularasa is a Chrome extension designed to help users manage their browser tabs and windows more efficiently. We are committed to protecting your privacy and ensuring that your personal information remains secure.

## Data Collection Statement

**Tabularasa does not collect, store, transmit, or share any personal data.**

## What Information We Access

To provide tab management functionality, Tabularasa requires access to certain browser information:

### Tab Information
- **What we access**: Tab titles, URLs, favicon URLs, and tab states (active, pinned, muted, audible)
- **Why we need it**: To display and organize your tabs in the extension interface
- **How we use it**: Information is processed locally in your browser to provide search, filtering, and organization features
- **Data retention**: No tab information is stored permanently; it's only held in memory while the extension is active

### Chrome Tab Groups
- **What we access**: Tab group information including group names, colors, and which tabs belong to each group
- **Why we need it**: To display and manage Chrome's native tab groups
- **How we use it**: Information is used to show tab group organization and provide grouping functionality
- **Data retention**: No group information is stored permanently

### Local Storage
- **What we store**: Saved browsing sessions that you explicitly choose to save
- **Why we need it**: To allow you to restore your browsing sessions later
- **How we use it**: Session data is stored locally using Chrome's secure storage API and is only accessible to the extension
- **Data retention**: Session data is stored until you delete it manually

## What We Do NOT Collect

- Personal information (name, email, phone number, address)
- Browsing history beyond currently open tabs
- Passwords or form data
- Payment information
- Location data
- User behavior analytics
- Crash reports or error logs that contain personal information

## Data Processing

All data processing occurs **locally on your device**:

- **No external servers**: Tabularasa does not communicate with external servers
- **No cloud storage**: Your data never leaves your computer
- **No third-party services**: We do not use analytics, tracking, or advertising services
- **No data transmission**: No information is sent over the internet

## Permissions Explanation

Tabularasa requests the following Chrome permissions, and here's why:

### "tabs" Permission
- **Purpose**: Read tab information (titles, URLs, states) to display in the extension interface
- **Scope**: Only accesses tabs in the current Chrome session
- **Data use**: Information is processed locally and not stored permanently

### "tabGroups" Permission
- **Purpose**: Read and modify Chrome tab groups to provide grouping functionality
- **Scope**: Only accesses tab groups in the current Chrome session
- **Data use**: Information is used to display and manage tab groups

### "storage" Permission
- **Purpose**: Save and restore browsing sessions locally
- **Scope**: Chrome's local storage API only
- **Data use**: Stores session data that you explicitly choose to save

### "activeTab" Permission
- **Purpose**: Switch to and activate tabs when you click on them in the extension
- **Scope**: Only the tab you interact with
- **Data use**: Used to provide tab switching functionality

## Data Security

- **Local processing**: All data processing occurs on your device
- **No transmission**: No data is transmitted over the internet
- **Chrome's security**: We rely on Chrome's built-in security measures for local storage
- **No vulnerabilities**: No external attack vectors since we don't use external services

## Your Rights and Controls

You have complete control over your data:

- **Session management**: You can delete saved sessions at any time
- **Extension removal**: Uninstalling the extension removes all stored data
- **No account required**: No registration or account creation needed
- **Full transparency**: You can inspect all stored data through Chrome's developer tools

## Updates to This Policy

We may update this privacy policy to reflect changes in our data practices or legal requirements. When we do:

- We will update the "Last Updated" date at the top of this policy
- We will notify users of significant changes through extension updates
- Continued use of the extension constitutes acceptance of the updated policy

## Children's Privacy

Tabularasa does not knowingly collect or store information from children under 13 years of age. Since we don't collect any personal information, the extension is safe for users of all ages.

## Contact Information

If you have questions about this privacy policy or our data practices:

- **Chrome Web Store**: Use the support section in the Chrome Web Store listing
- **Reviews**: Leave feedback through the Chrome Web Store review system

## Compliance

This privacy policy is designed to comply with:

- Chrome Web Store Developer Program Policies
- General Data Protection Regulation (GDPR)
- California Consumer Privacy Act (CCPA)
- Children's Online Privacy Protection Act (COPPA)

## Technical Implementation

For transparency, here's how we implement privacy protection:

### Code Architecture
- No external API calls or network requests
- All functions operate on local browser data only
- No analytics or tracking code included
- No third-party libraries that collect data

### Data Flow
1. Extension reads tab information from Chrome API
2. Information is processed locally in browser memory
3. User-initiated session saves are stored locally
4. No data leaves the browser environment

### Storage Implementation
- Uses Chrome's `chrome.storage.local` API exclusively
- No cloud storage or external database connections
- Data is encrypted using Chrome's built-in encryption
- Storage is isolated to the extension's sandbox

## Verification

You can verify our privacy claims by:

- **Inspecting the code**: The extension uses standard Chrome APIs with no external connections
- **Network monitoring**: Use browser developer tools to confirm no external requests
- **Storage inspection**: Check Chrome's extension storage to see what data is stored
- **Open source**: The code is available for security review

---

**Summary**: Tabularasa is a privacy-focused extension that operates entirely locally on your device. We do not collect, store, transmit, or share any personal information. All data processing occurs on your computer, and you maintain complete control over your information.

*This privacy policy applies to Tabularasa Chrome Extension version 1.0.0 and later.*