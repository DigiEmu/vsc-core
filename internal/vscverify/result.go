package vscverify

import "encoding/json"

const (
	SchemaProfile = "vsc-verification-result-v2.6-draft"
	SchemaVersion = "2.6-draft"
)

// ResultClass represents the four VSC verification outcome classes
// as defined in the v2.0 formal specification (§12).
//
// Boundary note:
//
//	PASS  = the evidence bundle is internally consistent (state integrity).
//	        It does not mean the underlying AI decision is true, fair, legal,
//	        or correct. VSC proves state integrity, not truth.
//	FAIL  = an integrity or verification mismatch was detected.
//	        It must not be interpreted as proof of wrongdoing.
//	ERROR = verification could not complete. Intentionally distinct from FAIL.
//	PROOF-ONLY = informational; evidence exists but no full verification ran.
type ResultClass string

const (
	ResultPASS      ResultClass = "PASS"
	ResultFAIL      ResultClass = "FAIL"
	ResultERROR     ResultClass = "ERROR"
	ResultPROOFONLY ResultClass = "PROOF-ONLY"
)

// ExitCode returns the process exit code for a given result class.
// PASS exits 0; FAIL exits 1; ERROR exits 2; PROOF-ONLY exits 3.
// Fail-closed: unknown result class exits 1 rather than 0 to prevent
// silent success from an unrecognised state.
func (r ResultClass) ExitCode() int {
	switch r {
	case ResultPASS:
		return 0
	case ResultFAIL:
		return 1
	case ResultERROR:
		return 2
	case ResultPROOFONLY:
		return 3
	default:
		return 1
	}
}

// CheckResult holds the outcome of one verification step.
type CheckResult struct {
	Name    string
	Passed  bool
	Message string
}

// BundleResult is the aggregate verification result for an Evidence Bundle.
type BundleResult struct {
	Result  ResultClass
	Checks  []CheckResult
	Profile string
	Diag    Diagnostics
	// Bundle metadata extracted during verification.
	BundleMeta BundleInfo
}

// Diagnostics carries optional numeric metadata emitted alongside the result.
type Diagnostics struct {
	ChecksumsVerified   int
	ChecksumsExpected   int
	DeltaTokensFound    int
	DeltaTokensExpected int
}

// ── v2.6 JSON schema structs ────────────────────────────────────────────────
// These types map directly to the v2.6 Machine-readable Verification Result
// Schema defined in docs/vsc-v2-6-machine-readable-verification-result-schema-draft.md.

// VerifierInfo identifies the verifier that produced this result.
type VerifierInfo struct {
	Name           string `json:"name"`
	Version        string `json:"version"`
	Implementation string `json:"implementation"`
	Language       string `json:"language"`
}

// InputInfo describes the artifact being verified.
type InputInfo struct {
	InputType    string `json:"input_type"`
	Path         string `json:"path"`
	ResolvedPath string `json:"resolved_path"`
	ReadOnly     bool   `json:"read_only"`
}

// BundleInfo holds metadata extracted from the bundle during verification.
type BundleInfo struct {
	BundleType    string `json:"bundle_type,omitempty"`
	BaseTokenID   string `json:"base_token_id,omitempty"`
	LatestTokenID string `json:"latest_token_id,omitempty"`
	ChainTokenID  string `json:"chain_token_id,omitempty"`
	SessionID     string `json:"session_id,omitempty"`
	DeltaCount    int    `json:"delta_count,omitempty"`
	ChecksumCount int    `json:"checksum_count,omitempty"`
}

// CheckEntry is the per-check result object in the JSON output.
type CheckEntry struct {
	Status   string `json:"status"`
	Message  string `json:"message,omitempty"`
	Expected *int   `json:"expected,omitempty"`
	Actual   *int   `json:"actual,omitempty"`
}

// DiagnosticsJSON is the diagnostics block in the JSON output.
type DiagnosticsJSON struct {
	HashAlgorithm       string `json:"hash_algorithm"`
	ChecksumsVerified   int    `json:"checksums_verified"`
	ChecksumsExpected   int    `json:"checksums_expected"`
	DeltaTokensFound    int    `json:"delta_tokens_found"`
	DeltaTokensExpected int    `json:"delta_tokens_expected"`
}

// ErrorEntry records an unreadable or unprocessable condition.
type ErrorEntry struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	File    string `json:"file,omitempty"`
}

// V26Result is the top-level v2.6 machine-readable verification result.
type V26Result struct {
	Profile       string                `json:"profile"`
	SchemaVersion string                `json:"schema_version"`
	Verifier      VerifierInfo          `json:"verifier"`
	Input         InputInfo             `json:"input"`
	Bundle        BundleInfo            `json:"bundle"`
	Result        ResultClass           `json:"result"`
	Checks        map[string]CheckEntry `json:"checks"`
	Diagnostics   DiagnosticsJSON       `json:"diagnostics"`
	Warnings      []string              `json:"warnings"`
	Errors        []ErrorEntry          `json:"errors"`
}

// intPtr is a helper to take the address of an int literal.
func intPtr(n int) *int { return &n }

// ToV26JSON serialises a BundleResult as a v2.6-conformant JSON document.
// verifierVersion is the CLI version string (e.g. "v2.6.1").
// input is the InputInfo built by the caller from CLI arguments.
//
// The JSON result is the stable machine-readable output intended for CI,
// partner review, and cross-implementation comparison. The "result" field
// is the semantic source of truth; raw process exit codes may vary across
// shells and platforms and should be derived from this field.
func (r *BundleResult) ToV26JSON(verifierVersion string, input InputInfo) ([]byte, error) {
	checks := make(map[string]CheckEntry, len(r.Checks))
	var errs []ErrorEntry

	for _, c := range r.Checks {
		var status string
		switch {
		case c.Passed:
			status = "PASS"
		case r.Result == ResultERROR:
			status = "ERROR"
		default:
			status = "FAIL"
		}

		entry := CheckEntry{Status: status, Message: c.Message}

		// Attach expected/actual counts for numeric checks.
		switch c.Name {
		case "checksums":
			if r.Diag.ChecksumsExpected > 0 {
				entry.Expected = intPtr(r.Diag.ChecksumsExpected)
				entry.Actual = intPtr(r.Diag.ChecksumsVerified)
				entry.Message = ""
			}
		case "delta_tokens":
			if r.Diag.DeltaTokensExpected > 0 {
				entry.Expected = intPtr(r.Diag.DeltaTokensExpected)
				entry.Actual = intPtr(r.Diag.DeltaTokensFound)
				entry.Message = ""
			}
		}

		if !c.Passed && c.Message != "" {
			code := "VERIFICATION_FAILED"
			if r.Result == ResultERROR {
				code = "PROCESSING_ERROR"
			}
			errs = append(errs, ErrorEntry{Code: code, Message: c.Message, File: errorFile(c.Name)})
		}

		checks[c.Name] = entry
	}

	if errs == nil {
		errs = []ErrorEntry{}
	}

	out := V26Result{
		Profile:       SchemaProfile,
		SchemaVersion: SchemaVersion,
		Verifier: VerifierInfo{
			Name:           "vsc-go",
			Version:        verifierVersion,
			Implementation: "minimal-go-verifier",
			Language:       "go",
		},
		Input:  input,
		Bundle: r.BundleMeta,
		Result: r.Result,
		Checks: checks,
		Diagnostics: DiagnosticsJSON{
			HashAlgorithm:       "sha256",
			ChecksumsVerified:   r.Diag.ChecksumsVerified,
			ChecksumsExpected:   r.Diag.ChecksumsExpected,
			DeltaTokensFound:    r.Diag.DeltaTokensFound,
			DeltaTokensExpected: r.Diag.DeltaTokensExpected,
		},
		Warnings: []string{},
		Errors:   errs,
	}
	return json.MarshalIndent(out, "", "  ")
}

// errorFile maps a check name to the primary file it operates on.
func errorFile(checkName string) string {
	switch checkName {
	case "checksums":
		return "checksums.sha256"
	case "chain_token":
		return "chain-token.json"
	case "base_token":
		return "base-token.json"
	case "manifest":
		return "manifest.json"
	default:
		return ""
	}
}
