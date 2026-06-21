package vscverify

import (
	"bufio"
	"crypto/sha256"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

// checksumEntry holds one line from checksums.sha256.
type checksumEntry struct {
	hash     string
	filePath string
}

// parseChecksumFile reads checksums.sha256 and returns its entries.
// Accepts both single-space and double-space separators (shasum compatibility).
// Empty lines and malformed lines are silently skipped.
func parseChecksumFile(path string) ([]checksumEntry, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("cannot open checksums.sha256: %w", err)
	}
	defer f.Close()

	var entries []checksumEntry
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimRight(scanner.Text(), "\r\n")
		if line == "" {
			continue
		}
		// Format: <64-hex-chars>  <relative/path>  (one or two spaces)
		if len(line) < 66 {
			continue
		}
		hash := line[:64]
		rest := strings.TrimLeft(line[64:], " ")
		if rest == "" {
			continue
		}
		entries = append(entries, checksumEntry{hash: strings.ToLower(hash), filePath: rest})
	}
	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("error reading checksums.sha256: %w", err)
	}
	return entries, nil
}

// sha256File computes the SHA-256 hex digest of a file via streaming read.
// Read-only: opens the file with os.Open (O_RDONLY).
func sha256File(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()

	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", err
	}
	return fmt.Sprintf("%x", h.Sum(nil)), nil
}

// VerifyChecksums re-computes SHA-256 for every file listed in checksums.sha256
// and compares against the recorded digest.
//
// Checksum binding must be verified before any token-level semantic check —
// the token files themselves are covered by the checksum binding, so their
// contents cannot be trusted until this step passes.
//
// Returns (verified count, total count, error slice).
// Returns a non-nil error if the checksum file itself cannot be read.
func VerifyChecksums(bundleDir string) (verified, total int, errs []string, err error) {
	csPath := filepath.Join(bundleDir, "checksums.sha256")
	entries, err := parseChecksumFile(csPath)
	if err != nil {
		return 0, 0, nil, err
	}
	if len(entries) == 0 {
		return 0, 0, []string{"checksums.sha256 contains no valid entries"}, nil
	}

	total = len(entries)
	for _, e := range entries {
		fullPath := filepath.Join(bundleDir, filepath.FromSlash(e.filePath))
		if _, statErr := os.Stat(fullPath); os.IsNotExist(statErr) {
			errs = append(errs, fmt.Sprintf("missing file: %s", e.filePath))
			continue
		}
		actual, hashErr := sha256File(fullPath)
		if hashErr != nil {
			errs = append(errs, fmt.Sprintf("cannot hash %s: %v", e.filePath, hashErr))
			continue
		}
		if actual != e.hash {
			errs = append(errs, fmt.Sprintf("checksum mismatch: %s", e.filePath))
		} else {
			verified++
		}
	}
	return verified, total, errs, nil
}
