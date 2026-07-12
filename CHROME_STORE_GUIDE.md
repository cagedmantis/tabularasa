# Chrome Web Store Upload Guide for Tabularasa

## Prerequisites

### 1. Chrome Web Store Developer Account
- **Registration**: Register at [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/developer/dashboard)
- **Fee**: Pay one-time $5 registration fee
- **Email**: Use a dedicated developer email for notifications
- **Agreement**: Accept Developer Agreement and Privacy Policies

### 2. Extension Preparation Checklist

#### ✅ Current Status
- [x] Manifest V3 compliant
- [x] Icons (16px, 32px, 48px, 128px) generated
- [x] Extension name: "Tabularasa"
- [x] Version: "1.0.0"
- [x] Basic description: "An advanced Chrome Tab and Window Manager"

#### ⚠️ Required Actions Before Upload

## Step 1: Prepare Extension Package

### Create Distribution Package
```bash
# Use the Makefile to create a clean package
make package

# Or create ZIP for Chrome Web Store
make zip
```

### Manual Package Creation
1. Ensure all files are built: `make build`
2. Create a ZIP file containing:
   - `manifest.json` (in root directory)
   - `dist/` folder with compiled JavaScript
   - `icons/` folder with all PNG icons
   - `manager.html` and `manager.css`

### Package Requirements
- **Max size**: 2GB (current extension is much smaller)
- **Format**: ZIP file
- **Manifest**: Must be in root directory
- **No comments**: Remove any comments from manifest.json

## Step 2: Improve Extension Description

### Current Description Issues
The current description "An advanced Chrome Tab and Window Manager" is too brief.

### Required: Enhanced Description
Create a comprehensive description following this format:

```markdown
**Tabularasa** is a powerful Chrome extension that transforms how you manage your browser tabs and windows. Say goodbye to tab chaos and hello to organized browsing.

**Key Features:**
• **Smart Tab Organization**: Group tabs by domain or Chrome tab groups
• **Advanced Search**: Quickly find tabs by title or URL
• **Bulk Operations**: Select multiple tabs for closing, moving, or grouping
• **Session Management**: Save and restore browsing sessions
• **Duplicate Detection**: Automatically identify and remove duplicate tabs
• **Cross-Window Management**: Move tabs between windows effortlessly
• **Real-Time Updates**: Live tab count and status indicators

**Perfect For:**
- Power users with many open tabs
- Researchers managing multiple projects
- Developers working across multiple repositories
- Anyone who wants better browser organization

**Privacy-Focused**: All data stays local on your device. No external servers or data collection.

Transform your browsing experience with Tabularasa - the ultimate tab management solution.
```

## Step 3: Create Required Visual Assets

### 1. Screenshots (REQUIRED)
**Requirements:**
- **Minimum**: 1 screenshot (1280x800px)
- **Maximum**: 5 screenshots (1280x800px)
- **Format**: PNG or JPEG
- **Content**: Show actual extension functionality

**Screenshots to Create:**
1. **Main Interface**: Extension window showing tab groups
2. **Search Feature**: Search functionality in action
3. **Bulk Operations**: Multiple tabs selected
4. **Session Management**: Session save/restore interface
5. **Settings/Options**: Any configuration options

### 2. Store Icon (REQUIRED)
- **Size**: 128x128px
- **Format**: PNG
- **Status**: ✅ Already created (icons/icon-128.png)

### 3. Promotional Tiles (OPTIONAL but RECOMMENDED)
- **Small Tile**: 440x280px PNG/JPEG
- **Marquee Tile**: 1400x560px PNG/JPEG (for featured placement)

## Step 4: Privacy and Compliance

### Privacy Policy
**Status**: ⚠️ REQUIRED if using permissions
- Extension uses `tabs`, `storage`, `activeTab`, `tabGroups` permissions
- Must create privacy policy explaining data usage
- Can be simple statement: "All data stays local, no external servers"

### Example Privacy Policy
```markdown
# Tabularasa Privacy Policy

Tabularasa is committed to protecting your privacy. This extension:

- Operates entirely locally on your device
- Does not collect any personal information
- Does not transmit data to external servers
- Only accesses tab information to provide functionality
- Stores session data locally using Chrome's storage API

All tab management and session data remains on your device and is never shared with third parties.
```

### Permissions Justification
Be prepared to explain why each permission is needed:
- `tabs`: Read tab information for management
- `storage`: Save sessions locally
- `activeTab`: Switch between tabs
- `tabGroups`: Manage Chrome tab groups

## Step 5: Upload Process

### 1. Access Developer Dashboard
- Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/developer/dashboard)
- Sign in with your Google account

### 2. Upload Extension
- Click "Add new item"
- Upload your ZIP file
- Fill out the listing information

### 3. Complete Listing Information
- **Name**: Tabularasa
- **Summary**: Brief one-line description
- **Description**: Use enhanced description from Step 2
- **Category**: Productivity
- **Language**: English (or your preferred language)
- **Screenshots**: Upload 1-5 screenshots
- **Icon**: Upload 128x128px icon
- **Promotional images**: Upload tiles if created

### 4. Privacy Practices
- **Data usage**: Select appropriate options
- **Privacy policy**: Provide URL or text
- **Permissions**: Justify each permission

### 5. Distribution Settings
- **Pricing**: Free
- **Visibility**: Public
- **Regions**: Select target countries

## Step 6: Review and Submit

### Pre-Submission Checklist
- [ ] Extension package tested and working
- [ ] All required fields completed
- [ ] Screenshots uploaded (minimum 1)
- [ ] Privacy policy provided
- [ ] Permissions justified
- [ ] Description is comprehensive
- [ ] Icons are clear and professional

### Submit for Review
- Click "Submit for review"
- Review process takes 1-7 days typically
- You'll receive email notifications about status

## Step 7: Post-Submission

### Review Process
- **Timeline**: 1-7 days (can be longer for complex extensions)
- **Possible outcomes**: Approved, Rejected, or Needs changes
- **30-day window**: Must publish within 30 days after approval

### If Rejected
- Address feedback provided
- Make necessary changes
- Resubmit for review

### If Approved
- Extension will be available in Chrome Web Store
- Users can install directly from the store
- You can track analytics and reviews

## Additional Tips

### Version Management
- Start with version 1.0.0
- Each update must have higher version number
- Use semantic versioning (major.minor.patch)

### Update Process
- Make changes to extension
- Increment version number in manifest.json
- Create new package
- Upload to dashboard (existing listing)
- Submit for review

### Publishing Limits
- Maximum 20 extensions per developer account
- No limit on themes

### Best Practices
- Monitor user reviews and feedback
- Keep extension updated with Chrome changes
- Respond to user questions
- Maintain consistent branding

## Quick Start Commands

```bash
# Prepare for upload
make build
make package
make zip

# The ZIP file will be created with timestamp
# Upload this file to Chrome Web Store
```

## Support Resources

- [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/developer/dashboard)
- [Chrome Extensions Documentation](https://developer.chrome.com/docs/extensions/)
- [Chrome Web Store Policies](https://developer.chrome.com/docs/webstore/program-policies/)
- [Publishing Guide](https://developer.chrome.com/docs/webstore/publish)

---

**Next Steps**: Follow steps 1-7 in order, focusing on creating screenshots and improving the description before upload.