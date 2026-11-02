package main

import (
	"archive/zip"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

const name = "publishers/pub/items/ext"

// fakeStore answers the three API calls and records what it was asked.
type fakeStore struct {
	t           *testing.T
	status      status
	uploadState string   // returned by upload
	laterStates []string // returned by successive fetchStatus calls after the upload
	uploadErr   int      // HTTP status for upload, 0 for success
	publishErr  int      // HTTP status for publish, 0 for success
	calls       []string
	uploaded    []byte
}

func (f *fakeStore) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Header.Get("Authorization") != "Bearer token" {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	switch r.Method + " " + r.URL.Path {
	case "GET /v2/" + name + ":fetchStatus":
		f.calls = append(f.calls, "status")
		s := f.status
		if len(f.uploaded) > 0 && len(f.laterStates) > 0 {
			s.LastAsyncUploadState, f.laterStates = f.laterStates[0], f.laterStates[1:]
		}
		json.NewEncoder(w).Encode(s)
	case "POST /upload/v2/" + name + ":upload":
		f.calls = append(f.calls, "upload")
		f.uploaded, _ = io.ReadAll(r.Body)
		if f.uploadErr != 0 {
			w.WriteHeader(f.uploadErr)
			w.Write([]byte(`{"error":{"message":"version must be higher","status":"INVALID_ARGUMENT"}}`))
			return
		}
		res := uploadResult{UploadState: f.uploadState}
		if f.uploadState == "SUCCEEDED" {
			res.CrxVersion = "1.2.0"
		}
		json.NewEncoder(w).Encode(res)
	case "POST /v2/" + name + ":publish":
		f.calls = append(f.calls, "publish")
		if f.publishErr != 0 {
			w.WriteHeader(f.publishErr)
			w.Write([]byte(`{"error":{"message":"listing incomplete","status":"FAILED_PRECONDITION"}}`))
			return
		}
		w.Write([]byte(`{"state":"PENDING_REVIEW","warningInfo":{"warnings":[{"reason":"R","description":"D"}]}}`))
	default:
		f.t.Errorf("unexpected request %s %s", r.Method, r.URL.Path)
		w.WriteHeader(http.StatusNotFound)
	}
}

func setup(t *testing.T, f *fakeStore) (*client, string) {
	t.Helper()
	f.t = t
	srv := httptest.NewServer(f)
	t.Cleanup(srv.Close)

	path := filepath.Join(t.TempDir(), "tabularasa-1.2.0.zip")
	out, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	zw := zip.NewWriter(out)
	w, _ := zw.Create("manifest.json")
	w.Write([]byte(`{"manifest_version": 3, "version": "1.2.0"}`))
	zw.Close()
	out.Close()

	return &client{base: srv.URL, name: name, token: "token", http: srv.Client()}, path
}

func published(version, state string) *revision {
	return &revision{State: state, DistributionChannels: []channel{{CrxVersion: version}}}
}

func TestUploadsAndSubmits(t *testing.T) {
	f := &fakeStore{status: status{Published: published("1.1.0", "PUBLISHED")}, uploadState: "SUCCEEDED"}
	c, zipPath := setup(t, f)
	if err := c.release(zipPath, time.Millisecond, time.Second); err != nil {
		t.Fatal(err)
	}
	if got := strings.Join(f.calls, ","); got != "status,upload,publish" {
		t.Errorf("calls = %s", got)
	}
	want, _ := os.ReadFile(zipPath)
	if string(f.uploaded) != string(want) {
		t.Error("the uploaded bytes are not the zip")
	}
}

func TestWaitsForProcessing(t *testing.T) {
	f := &fakeStore{uploadState: "UPLOAD_IN_PROGRESS", laterStates: []string{"IN_PROGRESS", "SUCCEEDED"}}
	c, zipPath := setup(t, f)
	if err := c.release(zipPath, time.Millisecond, time.Second); err != nil {
		t.Fatal(err)
	}
	if got := strings.Join(f.calls, ","); got != "status,upload,status,status,publish" {
		t.Errorf("calls = %s", got)
	}
}

func TestStopsWhenProcessingFails(t *testing.T) {
	f := &fakeStore{uploadState: "IN_PROGRESS", laterStates: []string{"FAILED"}}
	c, zipPath := setup(t, f)
	if err := c.release(zipPath, time.Millisecond, time.Second); err == nil || !strings.Contains(err.Error(), "failed") {
		t.Fatalf("err = %v, want an upload failure", err)
	}
	if strings.Contains(strings.Join(f.calls, ","), "publish") {
		t.Error("submitted a failed upload")
	}
}

func TestGivesUpWaiting(t *testing.T) {
	f := &fakeStore{uploadState: "IN_PROGRESS", laterStates: []string{"IN_PROGRESS", "IN_PROGRESS", "IN_PROGRESS", "IN_PROGRESS"}}
	c, zipPath := setup(t, f)
	if err := c.release(zipPath, 10*time.Millisecond, 15*time.Millisecond); err == nil || !strings.Contains(err.Error(), "still processing") {
		t.Fatalf("err = %v, want a timeout", err)
	}
}

func TestReportsAPIErrors(t *testing.T) {
	f := &fakeStore{uploadErr: http.StatusBadRequest}
	c, zipPath := setup(t, f)
	if err := c.release(zipPath, time.Millisecond, time.Second); err == nil || !strings.Contains(err.Error(), "version must be higher") {
		t.Fatalf("err = %v, want the API's message", err)
	}

	f = &fakeStore{uploadState: "SUCCEEDED", publishErr: http.StatusPreconditionFailed}
	c, zipPath = setup(t, f)
	if err := c.release(zipPath, time.Millisecond, time.Second); err == nil || !strings.Contains(err.Error(), "listing incomplete") {
		t.Fatalf("err = %v, want the API's message", err)
	}
}

func TestReRunIsANoOp(t *testing.T) {
	for _, s := range []status{
		{Submitted: published("1.2.0", "PENDING_REVIEW")},
		{Published: published("1.2.0", "PUBLISHED")},
	} {
		f := &fakeStore{status: s}
		c, zipPath := setup(t, f)
		if err := c.release(zipPath, time.Millisecond, time.Second); err != nil {
			t.Fatal(err)
		}
		if got := strings.Join(f.calls, ","); got != "status" {
			t.Errorf("calls = %s, want only a status check", got)
		}
	}
}

func TestRejectedVersionIsSubmittedAgain(t *testing.T) {
	f := &fakeStore{status: status{Submitted: published("1.2.0", "REJECTED")}, uploadState: "SUCCEEDED"}
	c, zipPath := setup(t, f)
	if err := c.release(zipPath, time.Millisecond, time.Second); err != nil {
		t.Fatal(err)
	}
	if got := strings.Join(f.calls, ","); got != "status,upload,publish" {
		t.Errorf("calls = %s", got)
	}
}

func TestRefusesTakenDownItem(t *testing.T) {
	f := &fakeStore{status: status{TakenDown: true}}
	c, zipPath := setup(t, f)
	if err := c.release(zipPath, time.Millisecond, time.Second); err == nil {
		t.Fatal("released a taken-down item")
	}
}

func TestCheckAndBadToken(t *testing.T) {
	f := &fakeStore{status: status{Published: published("1.1.0", "PUBLISHED")}}
	c, _ := setup(t, f)
	if err := c.check(); err != nil {
		t.Fatal(err)
	}
	c.token = "wrong"
	if err := c.check(); err == nil || !strings.Contains(err.Error(), "HTTP 401") {
		t.Fatalf("err = %v, want HTTP 401", err)
	}
}
