// Command pack assembles the Chrome Web Store package from a built tree.
//
// It validates the manifest, copies exactly the files that ship into an
// unpacked extension directory, and writes a zip that is byte-for-byte the
// same on every machine: entries in a fixed order, fixed timestamps and
// modes, and no host metadata. Two builds of the same commit can then be
// compared by checksum.
//
//	pack -root /src -out /out    # writes extension/, the zip and SHA256SUMS
//	pack -root /src -check       # validates only
package main

import (
	"archive/zip"
	"bytes"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"time"
)

// name prefixes the zip file, followed by the manifest version.
const name = "tabularasa"

// shipped is every file in the package, and nothing else: no source maps,
// sources or tooling. Kept sorted, which is also the order in the zip.
var shipped = []string{
	"LICENSE",
	"dist/background.js",
	"dist/manager.js",
	"icons/icon-128.png",
	"icons/icon-16.png",
	"icons/icon-32.png",
	"icons/icon-48.png",
	"manager.css",
	"manager.html",
	"manifest.json",
}

// pages are the shipped HTML files whose local references must also ship.
var pages = []string{"manager.html"}

// epoch is the timestamp of every zip entry. Chrome ignores it; a constant
// keeps the zip independent of when and where it was built.
var epoch = time.Date(1980, 1, 1, 0, 0, 0, 0, time.UTC)

type manifest struct {
	ManifestVersion int               `json:"manifest_version"`
	Name            string            `json:"name"`
	Version         string            `json:"version"`
	Description     string            `json:"description"`
	Icons           map[string]string `json:"icons"`
	Action          struct {
		DefaultIcon map[string]string `json:"default_icon"`
	} `json:"action"`
	Background struct {
		ServiceWorker string `json:"service_worker"`
	} `json:"background"`
}

func main() {
	root := flag.String("root", ".", "built source tree")
	out := flag.String("out", "", "output directory (omit to validate only)")
	check := flag.Bool("check", false, "validate without writing anything")
	flag.Parse()

	if !*check && *out == "" {
		fmt.Fprintln(os.Stderr, "pack: -out is required unless -check is given")
		os.Exit(2)
	}
	m, err := validate(*root)
	if err == nil && !*check {
		err = write(*root, *out, m.Version)
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, "pack:", err)
		os.Exit(1)
	}
}

// validate checks the manifest and that everything it and the pages refer to
// is in the shipped list and present on disk.
func validate(root string) (*manifest, error) {
	for _, f := range shipped {
		if _, err := os.Stat(filepath.Join(root, f)); err != nil {
			return nil, fmt.Errorf("shipped file missing: %s", f)
		}
	}

	data, err := os.ReadFile(filepath.Join(root, "manifest.json"))
	if err != nil {
		return nil, err
	}
	var m manifest
	if err := json.Unmarshal(data, &m); err != nil {
		return nil, fmt.Errorf("manifest.json is not valid JSON: %w", err)
	}
	if m.ManifestVersion != 3 {
		return nil, fmt.Errorf("manifest_version must be 3, got %d", m.ManifestVersion)
	}
	if m.Name == "" || m.Description == "" {
		return nil, errors.New("manifest.json needs a name and a description")
	}
	if !validVersion(m.Version) {
		return nil, fmt.Errorf("manifest version %q is not 1 to 4 dot-separated integers (0-65535)", m.Version)
	}
	if len(m.Icons) == 0 {
		return nil, errors.New("manifest.json declares no icons")
	}

	refs := []string{m.Background.ServiceWorker}
	for _, icons := range []map[string]string{m.Icons, m.Action.DefaultIcon} {
		for _, icon := range icons {
			refs = append(refs, icon)
		}
	}
	for _, page := range pages {
		pageRefs, err := localRefs(filepath.Join(root, page))
		if err != nil {
			return nil, err
		}
		refs = append(refs, pageRefs...)
	}
	for _, ref := range refs {
		if ref != "" && !isShipped(ref) {
			return nil, fmt.Errorf("%s is referenced but not shipped", ref)
		}
	}
	return &m, nil
}

// validVersion follows Chrome's rule for the manifest version field.
func validVersion(v string) bool {
	parts := strings.Split(v, ".")
	if len(parts) > 4 {
		return false
	}
	for _, p := range parts {
		n, err := strconv.Atoi(p)
		if err != nil || n < 0 || n > 65535 || p != strconv.Itoa(n) {
			return false
		}
	}
	return true
}

var refPattern = regexp.MustCompile(`(?:src|href)="([^"]+)"`)

// localRefs returns the relative URLs an HTML file loads.
func localRefs(file string) ([]string, error) {
	data, err := os.ReadFile(file)
	if err != nil {
		return nil, err
	}
	var refs []string
	for _, match := range refPattern.FindAllSubmatch(data, -1) {
		ref := string(match[1])
		if strings.Contains(ref, ":") || strings.HasPrefix(ref, "#") {
			continue
		}
		refs = append(refs, ref)
	}
	return refs, nil
}

func isShipped(ref string) bool {
	return slices.Contains(shipped, path.Clean(strings.TrimPrefix(ref, "/")))
}

func write(root, out, version string) error {
	extension := filepath.Join(out, "extension")
	if err := os.RemoveAll(extension); err != nil {
		return err
	}

	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	for _, f := range shipped {
		data, err := os.ReadFile(filepath.Join(root, f))
		if err != nil {
			return err
		}

		dest := filepath.Join(extension, filepath.FromSlash(f))
		if err := os.MkdirAll(filepath.Dir(dest), 0o755); err != nil {
			return err
		}
		if err := os.WriteFile(dest, data, 0o644); err != nil {
			return err
		}

		header := &zip.FileHeader{Name: f, Method: zip.Deflate, Modified: epoch}
		header.SetMode(0o644)
		w, err := zw.CreateHeader(header)
		if err != nil {
			return err
		}
		if _, err := w.Write(data); err != nil {
			return err
		}
	}
	if err := zw.Close(); err != nil {
		return err
	}

	zipName := fmt.Sprintf("%s-%s.zip", name, version)
	if err := os.WriteFile(filepath.Join(out, zipName), buf.Bytes(), 0o644); err != nil {
		return err
	}
	sums := fmt.Sprintf("%x  %s\n", sha256.Sum256(buf.Bytes()), zipName)
	return os.WriteFile(filepath.Join(out, "SHA256SUMS"), []byte(sums), 0o644)
}
