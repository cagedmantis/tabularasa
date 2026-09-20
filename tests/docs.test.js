/**
 * Keeps the published documents honest about the manifest. A privacy policy or
 * store listing that names different permissions than the extension requests
 * is a Chrome Web Store review flag, and it has drifted before.
 */

const fs = require('fs');
const path = require('path');

const read = (file) => fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const permissions = [...manifest.permissions].sort();

describe('published documents match the manifest', () => {
    test('the privacy policy explains exactly the permissions requested', () => {
        const explained = Array.from(read('PRIVACY_POLICY.md').matchAll(/^### "([A-Za-z]+)"$/gm))
            .map(match => match[1])
            .sort();

        expect(explained).toEqual(permissions);
    });

    test('the store submission justifies exactly the permissions requested', () => {
        const section = read('STORE_SUBMISSION.md')
            .split('### Permission justifications')[1]
            .split('### Remote code')[0];
        const justified = Array.from(section.matchAll(/^- \*\*([A-Za-z]+)\*\*:/gm))
            .map(match => match[1])
            .sort();

        expect(justified).toEqual(permissions);
    });

    test('no document mentions a permission the extension does not request', () => {
        const known = ['activeTab', 'history', 'bookmarks', 'cookies', 'webRequest', 'scripting', 'management'];
        const documents = ['PRIVACY_POLICY.md', 'STORE_SUBMISSION.md', 'CHROME_STORE_GUIDE.md', 'CHROME_STORE_DESCRIPTION.md'];

        documents.forEach(file => {
            known.filter(name => !permissions.includes(name)).forEach(name => {
                expect({ file, mentions: name, found: read(file).includes(`\`${name}\``) || read(file).includes(`"${name}"`) })
                    .toEqual({ file, mentions: name, found: false });
            });
        });
    });

    test('the store submission quotes the manifest description', () => {
        expect(read('STORE_SUBMISSION.md')).toContain(manifest.description);
    });

    test('the guide lists exactly the permissions requested', () => {
        const section = read('CHROME_STORE_GUIDE.md')
            .split('### Permissions Justification')[1]
            .split('## Step 5')[0];
        const listed = Array.from(section.matchAll(/^- `([A-Za-z]+)`:/gm))
            .map(match => match[1])
            .sort();

        expect(listed).toEqual(permissions);
    });

    test('the privacy policy keeps the statements the store requires', () => {
        const policy = read('PRIVACY_POLICY.md');

        // Affirmative Limited Use statement (Chrome Web Store User Data Policy)
        expect(policy).toContain('adheres to the Chrome Web Store User Data Policy, including the Limited Use requirements');
        // Claims that were once made and are false
        expect(policy).not.toMatch(/is encrypted|built-in encryption|no vulnerabilities/i);
        // The dashboard answer must not regress to "none"
        expect(read('STORE_SUBMISSION.md')).toContain('Tick **Web history**');
    });

    test('documents state the Chrome version the manifest requires', () => {
        const minimum = manifest.minimum_chrome_version;

        expect(read('PRIVACY_POLICY.md')).toContain(`Chrome ${minimum} or later`);
        expect(read('CHROME_STORE_DESCRIPTION.md')).toContain(`Chrome ${minimum} or later`);
    });

    test('package metadata names the license in LICENSE', () => {
        const licenseText = read('LICENSE');
        const declared = JSON.parse(read('package.json')).license;

        expect(licenseText).toContain('Apache License');
        expect(declared).toBe('Apache-2.0');
    });
});
