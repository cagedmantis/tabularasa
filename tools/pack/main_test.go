package main

import (
	"archive/zip"
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

const goodManifest = `{
  "manifest_version": 3,
  "name": "Tabularasa",
  "version": "1.2.0",
  "description": "Test",
  "icons": {"16": "icons/icon-16.png"},
  "action": {"default_icon": {"32": "icons/icon-32.png"}},
  "background": {"service_worker": "dist/background.js"}
}`

const goodPage = `<link rel="stylesheet" href="manager.css"><script src="dist/manager.js"></script><a href="#top">`

// tree writes a built tree with every shipped file, overriding some contents.
func tree(t *testing.T, overrides map[string]string) string {
	t.Helper()
	root := t.TempDir()
	for _, f := range shipped {
		content := "content of " + f
		switch f {
		case "manifest.json":
			content = goodManifest
		case "manager.html":
			content = goodPage
		}
		if c, ok := overrides[f]; ok {
			content = c
		}
		dest := filepath.Join(root, filepath.FromSlash(f))
		if err := os.MkdirAll(filepath.Dir(dest), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(dest, []byte(content), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	return root
}

func build(t *testing.T, root string) []byte {
	t.Helper()
	m, err := validate(root)
	if err != nil {
		t.Fatal(err)
	}
	out := t.TempDir()
	if err := write(root, out, m.Version); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(filepath.Join(out, "tabularasa-1.2.0.zip"))
	if err != nil {
		t.Fatal(err)
	}
	return data
}

func TestZipIsReproducible(t *testing.T) {
	root := tree(t, nil)
	first := build(t, root)

	// Different file times on disk must not reach the zip.
	if err := os.Chtimes(filepath.Join(root, "manifest.json"), epoch.AddDate(40, 0, 0), epoch.AddDate(40, 0, 0)); err != nil {
		t.Fatal(err)
	}
	if second := build(t, root); !bytes.Equal(first, second) {
		t.Fatal("two builds of the same tree produced different zips")
	}
}

func TestZipHoldsExactlyTheShippedFiles(t *testing.T) {
	data := build(t, tree(t, nil))
	zr, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		t.Fatal(err)
	}
	var names []string
	for _, f := range zr.File {
		names = append(names, f.Name)
		if !f.Modified.Equal(epoch) || f.Mode() != 0o644 {
			t.Errorf("%s: modified %v mode %v, want the fixed epoch and 0644", f.Name, f.Modified, f.Mode())
		}
	}
	if got, want := strings.Join(names, ","), strings.Join(shipped, ","); got != want {
		t.Errorf("zip entries\n got %s\nwant %s", got, want)
	}
}

func TestWritesChecksumAndUnpackedExtension(t *testing.T) {
	root := tree(t, nil)
	out := t.TempDir()
	if err := write(root, out, "1.2.0"); err != nil {
		t.Fatal(err)
	}
	sums, err := os.ReadFile(filepath.Join(out, "SHA256SUMS"))
	if err != nil || !strings.HasSuffix(string(sums), "  tabularasa-1.2.0.zip\n") {
		t.Errorf("SHA256SUMS = %q, %v", sums, err)
	}
	if _, err := os.Stat(filepath.Join(out, "extension", "dist", "manager.js")); err != nil {
		t.Errorf("unpacked extension missing: %v", err)
	}
}

func TestRejectsInvalidTrees(t *testing.T) {
	cases := map[string]map[string]string{
		"invalid JSON":         {"manifest.json": `{`},
		"manifest version 2":   {"manifest.json": strings.Replace(goodManifest, `"manifest_version": 3`, `"manifest_version": 2`, 1)},
		"bad version":          {"manifest.json": strings.Replace(goodManifest, `"1.2.0"`, `"1.02.0"`, 1)},
		"unshipped worker":     {"manifest.json": strings.Replace(goodManifest, "dist/background.js", "dist/content.js", 1)},
		"unshipped icon":       {"manifest.json": strings.Replace(goodManifest, "icons/icon-32.png", "icons/icon-64.png", 1)},
		"page loads unshipped": {"manager.html": goodPage + `<script src="dist/extra.js"></script>`},
		"no description":       {"manifest.json": strings.Replace(goodManifest, `"description": "Test",`, "", 1)},
	}
	for name, overrides := range cases {
		t.Run(name, func(t *testing.T) {
			if _, err := validate(tree(t, overrides)); err == nil {
				t.Error("validate accepted an invalid tree")
			}
		})
	}

	t.Run("missing shipped file", func(t *testing.T) {
		root := tree(t, nil)
		if err := os.Remove(filepath.Join(root, "LICENSE")); err != nil {
			t.Fatal(err)
		}
		if _, err := validate(root); err == nil {
			t.Error("validate accepted a tree without LICENSE")
		}
	})
}

func TestValidVersion(t *testing.T) {
	for v, want := range map[string]bool{
		"1": true, "1.1.0": true, "1.2.3.4": true, "0.65535": true,
		"": false, "1.2.3.4.5": false, "1.65536": false, "01.0": false, "1.x": false, "-1": false,
	} {
		if got := validVersion(v); got != want {
			t.Errorf("validVersion(%q) = %v, want %v", v, got, want)
		}
	}
}
