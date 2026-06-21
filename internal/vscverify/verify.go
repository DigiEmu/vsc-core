package vscverify

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
)

const Profile = "vsc-go-v2.5-prototype"

// requiredFiles lists the files every VSC Evidence Bundle must contain.
// JSON Event Evidence Bundle additions (event-schema.json, event-summary.json)
// are included because the current canonical bundle always carries them.
var requiredFiles = []string{
	"manifest.json",
	"checksums.sha256",
	"chain-token.json",
	"base-token.json",
	"verification-summary.json",
	"event-summary.json",
	"event-schema.json",
}

// chainToken holds the fields we extract from chain-token.json.
type chainToken struct {
	Mode          string           `json:"mode"`
	BaseTokenID   string           `json:"baseTokenId"`
	LatestTokenID string           `json:"latestTokenId"`
	Steps         []map[string]any `json:"steps"`
}

// readJSON parses a JSON file into dst. Returns error on read or parse failure.
func readJSON(path string, dst any) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("cannot read %s: %w", filepath.Base(path), err)
	}
	if err := json.Unmarshal(data, dst); err != nil {
		return fmt.Errorf("malformed JSON in %s: %w", filepath.Base(path), err)
	}
	return nil
}

// VerifyBundle performs a read-only integrity check of an Evidence Bundle.
//
// Verification order (mirrors verifyEvidenceBundle.js):
//   01 Required files
//   02 Checksum binding  ← must precede token parsing
//   03 Chain token
//   04 Base token
//   05 Delta tokens
//   06 Manifest
//
// Returns a BundleResult with per-check outcomes and a final result class.
func VerifyBundle(bundleDir string) BundleResult {
	res := BundleResult{Profile: Profile}
	add := func(name string, passed bool, msg string) {
		res.Checks = append(res.Checks, CheckResult{Name: name, Passed: passed, Message: msg})
	}
	fail := func(name, msg string) {
		add(name, false, msg)
		res.Result = ResultFAIL
	}
	errOut := func(name, msg string) {
		add(name, false, msg)
		res.Result = ResultERROR
	}

	// ── 01 Required files ───────────────────────────────────────────────────────
	var missingFiles []string
	for _, f := range requiredFiles {
		if _, err := os.Stat(filepath.Join(bundleDir, f)); os.IsNotExist(err) {
			missingFiles = append(missingFiles, f)
		}
	}
	if len(missingFiles) > 0 {
		fail("required_files", "missing: "+strings.Join(missingFiles, ", "))
	} else {
		add("required_files", true, "")
	}

	// Stop early if critical files are absent — subsequent checks would panic.
	criticalMissing := false
	for _, f := range []string{"checksums.sha256", "chain-token.json", "base-token.json", "manifest.json"} {
		if _, err := os.Stat(filepath.Join(bundleDir, f)); os.IsNotExist(err) {
			criticalMissing = true
			break
		}
	}
	if criticalMissing {
		if res.Result == "" {
			res.Result = ResultFAIL
		}
		return res
	}

	// ── 02 Checksum binding ─────────────────────────────────────────────────────
	// Checksums must be verified before token files are trusted (v2.2 §8).
	verified, total, csErrs, csErr := VerifyChecksums(bundleDir)
	res.Diag.ChecksumsVerified = verified
	if csErr != nil {
		errOut("checksums", csErr.Error())
	} else if len(csErrs) > 0 {
		msg := csErrs[0]
		if len(csErrs) > 1 {
			msg += fmt.Sprintf(" (+%d more)", len(csErrs)-1)
		}
		fail("checksums", msg)
	} else {
		add("checksums", true, fmt.Sprintf("%d/%d files verified", verified, total))
	}

	// ── 03 Chain token ──────────────────────────────────────────────────────────
	var ct chainToken
	if err := readJSON(filepath.Join(bundleDir, "chain-token.json"), &ct); err != nil {
		errOut("chain_token", err.Error())
		return res // cannot proceed without chain token
	}
	if ct.BaseTokenID == "" || ct.LatestTokenID == "" {
		fail("chain_token", "missing baseTokenId or latestTokenId")
	} else {
		add("chain_token", true, fmt.Sprintf("%s → %s", ct.BaseTokenID, ct.LatestTokenID))
	}

	// ── 04 Base token ───────────────────────────────────────────────────────────
	var baseToken map[string]any
	if err := readJSON(filepath.Join(bundleDir, "base-token.json"), &baseToken); err != nil {
		errOut("base_token", err.Error())
	} else {
		add("base_token", true, "")
	}

	// ── 05 Delta tokens ─────────────────────────────────────────────────────────
	deltaDir := filepath.Join(bundleDir, "delta-tokens")
	expected := len(ct.Steps)
	found := checkDeltaTokens(deltaDir, expected)
	res.Diag.DeltaTokensFound = found
	if found < expected {
		fail("delta_tokens", fmt.Sprintf("%d/%d found", found, expected))
	} else {
		add("delta_tokens", true, fmt.Sprintf("%d/%d found", found, expected))
	}

	// ── 06 Manifest ─────────────────────────────────────────────────────────────
	var manifest map[string]any
	if err := readJSON(filepath.Join(bundleDir, "manifest.json"), &manifest); err != nil {
		errOut("manifest", err.Error())
	} else {
		add("manifest", true, "")
	}

	// ── Final result ────────────────────────────────────────────────────────────
	if res.Result == "" {
		res.Result = ResultPASS
	}
	return res
}

// checkDeltaTokens counts how many of the expected delta token files exist.
// Files are expected as delta-001.json through delta-<N>.json (zero-padded).
// Falls back to unpadded names for backwards compatibility.
func checkDeltaTokens(deltaDir string, expected int) int {
	if expected == 0 {
		// Fallback: list directory and count .json files
		entries, err := os.ReadDir(deltaDir)
		if err != nil {
			return 0
		}
		var names []string
		for _, e := range entries {
			if !e.IsDir() && strings.HasSuffix(e.Name(), ".json") {
				names = append(names, e.Name())
			}
		}
		sort.Strings(names)
		return len(names)
	}

	found := 0
	for i := 1; i <= expected; i++ {
		padded := filepath.Join(deltaDir, fmt.Sprintf("delta-%s.json", zeroPad(i, 3)))
		unpadded := filepath.Join(deltaDir, fmt.Sprintf("delta-%d.json", i))
		if fileExists(padded) || fileExists(unpadded) {
			found++
		}
	}
	return found
}

func zeroPad(n, width int) string {
	s := strconv.Itoa(n)
	for len(s) < width {
		s = "0" + s
	}
	return s
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}
