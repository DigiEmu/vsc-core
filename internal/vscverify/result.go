package vscverify

import "encoding/json"

// ResultClass represents the four VSC verification outcome classes
// as defined in the v2.0 formal specification (§12).
type ResultClass string

const (
	ResultPASS      ResultClass = "PASS"
	ResultFAIL      ResultClass = "FAIL"
	ResultERROR     ResultClass = "ERROR"
	ResultPROOFONLY ResultClass = "PROOF-ONLY"
)

// ExitCode returns the process exit code for a given result class.
// PASS exits 0; FAIL exits 1; ERROR exits 2; PROOF-ONLY exits 3.
// Fail-closed: unknown result class exits 1.
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
}

// Diagnostics carries optional numeric metadata emitted alongside the result.
type Diagnostics struct {
	ChecksumsVerified int
	DeltaTokensFound  int
}

// JSONOutput is the machine-readable form emitted with --json.
type JSONOutput struct {
	Result  ResultClass        `json:"result"`
	Profile string             `json:"profile"`
	Checks  map[string]string  `json:"checks"`
	Diag    map[string]int     `json:"diagnostics"`
}

// ToJSON converts a BundleResult to its machine-readable JSON form.
func (r *BundleResult) ToJSON() ([]byte, error) {
	checks := make(map[string]string, len(r.Checks))
	for _, c := range r.Checks {
		status := "PASS"
		if !c.Passed {
			status = "FAIL"
		}
		checks[c.Name] = status
	}
	out := JSONOutput{
		Result:  r.Result,
		Profile: r.Profile,
		Checks:  checks,
		Diag: map[string]int{
			"checksums_verified": r.Diag.ChecksumsVerified,
			"delta_tokens_found": r.Diag.DeltaTokensFound,
		},
	}
	return json.MarshalIndent(out, "", "  ")
}
