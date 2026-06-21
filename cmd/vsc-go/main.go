package main

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/DigiEmu/vsc-core/internal/vscverify"
)

const version = "v2.6.1"

func main() {
	args := os.Args[1:]

	if len(args) == 0 || args[0] == "help" || args[0] == "--help" || args[0] == "-h" {
		printHelp()
		os.Exit(0)
	}

	command := args[0]
	switch command {
	case "verify-bundle":
		runVerifyBundle(args[1:])
	default:
		fmt.Fprintf(os.Stderr, "\nvsc-go: unknown command %q\n", command)
		printHelp()
		os.Exit(1)
	}
}

func runVerifyBundle(args []string) {
	jsonMode := false
	var bundlePath string

	for _, a := range args {
		if a == "--json" {
			jsonMode = true
		} else {
			bundlePath = a
		}
	}

	if bundlePath == "" {
		fmt.Fprintln(os.Stderr, "\nvsc-go error: verify-bundle requires a bundle folder path")
		fmt.Fprintln(os.Stderr, "  Usage: go run ./cmd/vsc-go verify-bundle <bundle-folder>")
		os.Exit(1)
	}

	resolved, err := filepath.Abs(bundlePath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "\nvsc-go error: cannot resolve path: %v\n", err)
		os.Exit(2)
	}

	info, err := os.Stat(resolved)
	if os.IsNotExist(err) {
		fmt.Fprintf(os.Stderr, "\nvsc-go error: bundle not found: %s\n", bundlePath)
		os.Exit(2)
	}
	if !info.IsDir() {
		fmt.Fprintf(os.Stderr, "\nvsc-go error: bundle path is not a directory: %s\n", bundlePath)
		os.Exit(2)
	}

	result := vscverify.VerifyBundle(resolved)

	if jsonMode {
		input := vscverify.InputInfo{
			InputType:    "evidence_bundle_folder",
			Path:         filepath.ToSlash(bundlePath),
			ResolvedPath: resolved,
			ReadOnly:     true,
		}
		data, err := result.ToV26JSON(version, input)
		if err != nil {
			fmt.Fprintf(os.Stderr, "vsc-go error: cannot serialize result: %v\n", err)
			os.Exit(2)
		}
		fmt.Println(string(data))
		os.Exit(result.Result.ExitCode())
	}

	// Human-readable output
	fmt.Printf("\nVSC Go Verifier Prototype %s\n", version+" (v2.6 schema)")
	fmt.Printf("Bundle path: %s\n", resolved)
	fmt.Println()

	checkLabels := map[string]string{
		"required_files": "Required files",
		"checksums":      "Checksums",
		"chain_token":    "Chain token",
		"base_token":     "Base token",
		"delta_tokens":   "Delta tokens",
		"manifest":       "Manifest",
	}
	order := []string{"required_files", "checksums", "chain_token", "base_token", "delta_tokens", "manifest"}

	checkMap := make(map[string]vscverify.CheckResult, len(result.Checks))
	for _, c := range result.Checks {
		checkMap[c.Name] = c
	}

	for i, name := range order {
		c, ok := checkMap[name]
		if !ok {
			continue
		}
		label := checkLabels[name]
		status := "PASS"
		if !c.Passed {
			if result.Result == vscverify.ResultERROR {
				status = "ERROR"
			} else {
				status = "FAIL"
			}
		}
		line := fmt.Sprintf("[%02d] %s: %s", i+1, label, status)
		if c.Message != "" {
			line += fmt.Sprintf(" (%s)", c.Message)
		}
		fmt.Println(line)
	}

	fmt.Println()
	fmt.Printf("Result: %s\n", result.Result)
	fmt.Println()

	os.Exit(result.Result.ExitCode())
}

func printHelp() {
	fmt.Printf(`
VSC Go Verifier Prototype %s
─────────────────────────────────────
Usage:  go run ./cmd/vsc-go <command> [args]

Commands:
  verify-bundle <bundle-folder>
      Verify an existing VSC Evidence Bundle directory.
      Checks required files, checksum binding, chain token,
      base token, delta token presence, and manifest.

  verify-bundle --json <bundle-folder>
      Same as verify-bundle but emits v2.6 machine-readable JSON only.
      --json may appear before or after the bundle path.

  help
      Print this help text.

Examples:
  go run ./cmd/vsc-go verify-bundle output\json-event-bundles\vsc-json-event-bundle-408C8C13C4D4-to-ED9566562A13
  go run ./cmd/vsc-go verify-bundle --json output\json-event-bundles\vsc-json-event-bundle-408C8C13C4D4-to-ED9566562A13

Notes:
  - Read-only: this verifier never writes to the source bundle.
  - Exit code 0 = PASS; 1 = FAIL; 2 = ERROR; 3 = PROOF-ONLY.
  - JSON schema: vsc-verification-result-v2.6-draft.
  - Node.js reference implementation: npm run vsc -- verify-bundle <bundle-folder>
`, version)
}
