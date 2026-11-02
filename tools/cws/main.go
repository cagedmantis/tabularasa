// Command cws uploads a package to the Chrome Web Store and submits it for
// review, through the Chrome Web Store API v2.
//
// It is safe to run again after a partial failure: when the store already
// has the package's version submitted or published, it does nothing.
//
//	CWS_ACCESS_TOKEN=... cws -zip out/tabularasa-1.2.0.zip -publisher P -item I
//	CWS_ACCESS_TOKEN=... cws -check -publisher P -item I   # status only
package main

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

type client struct {
	base  string // https://chromewebstore.googleapis.com, or a test server
	name  string // publishers/<publisher>/items/<item>
	token string
	http  *http.Client
}

type channel struct {
	CrxVersion string `json:"crxVersion"`
}

type revision struct {
	State                string    `json:"state"`
	DistributionChannels []channel `json:"distributionChannels"`
}

type status struct {
	Published            *revision `json:"publishedItemRevisionStatus"`
	Submitted            *revision `json:"submittedItemRevisionStatus"`
	LastAsyncUploadState string    `json:"lastAsyncUploadState"`
	TakenDown            bool      `json:"takenDown"`
}

type uploadResult struct {
	CrxVersion  string `json:"crxVersion"`
	UploadState string `json:"uploadState"`
}

type publishResult struct {
	State       string `json:"state"`
	WarningInfo struct {
		Warnings []struct {
			Reason      string `json:"reason"`
			Description string `json:"description"`
		} `json:"warnings"`
	} `json:"warningInfo"`
}

func main() {
	zipPath := flag.String("zip", "", "package to upload")
	publisher := flag.String("publisher", os.Getenv("CWS_PUBLISHER_ID"), "publisher ID (default $CWS_PUBLISHER_ID)")
	item := flag.String("item", os.Getenv("CWS_EXTENSION_ID"), "extension ID (default $CWS_EXTENSION_ID)")
	check := flag.Bool("check", false, "only verify access and print the item's status")
	base := flag.String("base-url", "https://chromewebstore.googleapis.com", "API base URL")
	poll := flag.Duration("poll", 5*time.Second, "interval between upload status checks")
	timeout := flag.Duration("timeout", 10*time.Minute, "how long to wait for the upload to be processed")
	flag.Parse()

	token := os.Getenv("CWS_ACCESS_TOKEN")
	if token == "" || *publisher == "" || *item == "" || (!*check && *zipPath == "") {
		fmt.Fprintln(os.Stderr, "cws: needs CWS_ACCESS_TOKEN, -publisher, -item, and -zip unless -check is given")
		os.Exit(2)
	}
	c := &client{
		base:  strings.TrimSuffix(*base, "/"),
		name:  fmt.Sprintf("publishers/%s/items/%s", *publisher, *item),
		token: token,
		http:  &http.Client{Timeout: 5 * time.Minute},
	}

	var err error
	if *check {
		err = c.check()
	} else {
		err = c.release(*zipPath, *poll, *timeout)
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, "cws:", err)
		os.Exit(1)
	}
}

// check proves the token, the service account's access and the IDs.
func (c *client) check() error {
	s, err := c.status()
	if err != nil {
		return err
	}
	fmt.Printf("Access OK. Published: %s. Submitted: %s.\n", describe(s.Published), describe(s.Submitted))
	return nil
}

func (c *client) release(zipPath string, poll, timeout time.Duration) error {
	version, err := zipVersion(zipPath)
	if err != nil {
		return err
	}

	s, err := c.status()
	if err != nil {
		return err
	}
	if s.TakenDown {
		return errors.New("the item is taken down in the Chrome Web Store; resolve that in the dashboard first")
	}
	for _, r := range []*revision{s.Submitted, s.Published} {
		if r.has(version) {
			fmt.Printf("Version %s is already %s; nothing to do.\n", version, r.State)
			return nil
		}
	}

	data, err := os.ReadFile(zipPath)
	if err != nil {
		return err
	}
	fmt.Printf("Uploading %s (version %s)...\n", zipPath, version)
	var up uploadResult
	if err := c.call(http.MethodPost, "/upload/v2/"+c.name+":upload", "application/zip", data, &up); err != nil {
		return fmt.Errorf("upload: %w", err)
	}

	state := up.UploadState
	deadline := time.Now().Add(timeout)
	for inProgress(state) {
		if time.Now().After(deadline) {
			return fmt.Errorf("upload still processing after %v; check the dashboard, then re-run", timeout)
		}
		time.Sleep(poll)
		if s, err = c.status(); err != nil {
			return err
		}
		state = s.LastAsyncUploadState
	}
	if state != "SUCCEEDED" {
		return fmt.Errorf("upload %s; the dashboard shows why (a version must be higher than the store's)", strings.ToLower(state))
	}
	if up.CrxVersion != "" && up.CrxVersion != version {
		return fmt.Errorf("the store read version %s from the upload, expected %s", up.CrxVersion, version)
	}

	fmt.Println("Submitting for review...")
	var pub publishResult
	if err := c.call(http.MethodPost, "/v2/"+c.name+":publish", "application/json", []byte("{}"), &pub); err != nil {
		return fmt.Errorf("publish: %w", err)
	}
	for _, w := range pub.WarningInfo.Warnings {
		fmt.Printf("Warning (%s): %s\n", w.Reason, w.Description)
	}
	fmt.Printf("Version %s submitted: %s.\n", version, pub.State)
	return nil
}

func (c *client) status() (*status, error) {
	var s status
	if err := c.call(http.MethodGet, "/v2/"+c.name+":fetchStatus", "", nil, &s); err != nil {
		return nil, fmt.Errorf("fetch status: %w", err)
	}
	return &s, nil
}

// call sends a request and decodes the JSON response, turning Google's error
// responses into their message.
func (c *client) call(method, path, contentType string, body []byte, out any) error {
	req, err := http.NewRequest(method, c.base+path, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+c.token)
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	if resp.StatusCode/100 != 2 {
		var apiErr struct {
			Error struct {
				Message string `json:"message"`
				Status  string `json:"status"`
			} `json:"error"`
		}
		if json.Unmarshal(data, &apiErr) == nil && apiErr.Error.Message != "" {
			return fmt.Errorf("%s (%s, HTTP %d)", apiErr.Error.Message, apiErr.Error.Status, resp.StatusCode)
		}
		return fmt.Errorf("HTTP %d", resp.StatusCode)
	}
	return json.Unmarshal(data, out)
}

// zipVersion reads the version from the package's own manifest, so what is
// compared with the store is what is uploaded.
func zipVersion(path string) (string, error) {
	zr, err := zip.OpenReader(path)
	if err != nil {
		return "", err
	}
	defer zr.Close()
	f, err := zr.Open("manifest.json")
	if err != nil {
		return "", fmt.Errorf("%s has no manifest.json", path)
	}
	defer f.Close()
	var m struct {
		Version string `json:"version"`
	}
	if err := json.NewDecoder(f).Decode(&m); err != nil || m.Version == "" {
		return "", fmt.Errorf("%s: unreadable manifest version", path)
	}
	return m.Version, nil
}

// inProgress accepts both spellings: the enum says IN_PROGRESS, the upload
// documentation UPLOAD_IN_PROGRESS.
func inProgress(state string) bool {
	return state == "IN_PROGRESS" || state == "UPLOAD_IN_PROGRESS"
}

func (r *revision) has(version string) bool {
	if r == nil || r.State == "REJECTED" || r.State == "CANCELLED" {
		return false
	}
	for _, ch := range r.DistributionChannels {
		if ch.CrxVersion == version {
			return true
		}
	}
	return false
}

func describe(r *revision) string {
	if r == nil || len(r.DistributionChannels) == 0 {
		return "none"
	}
	return fmt.Sprintf("%s (%s)", r.DistributionChannels[0].CrxVersion, r.State)
}
