# VSC Trust Overview for Non-Technical Readers

Project: DigiEmu VSC / VSC Core  
Release context: v2.13

## One-sentence explanation

VSC turns AI decision states into portable, verifiable evidence.

## Simple metaphor

Core is the brain.  
VSC is the flight recorder.

DigiEmu Core describes the meaning and governance structure of a decision state.  
VSC records and verifies the evidence layer around that state.

## What problem does VSC solve?

AI systems can produce decisions, recommendations, tool calls, outputs, and internal state transitions.

Later, people may need to ask:

- What state was saved?
- Did the saved evidence change?
- Can the latest state be reconstructed from the original state and the recorded changes?
- Do the hashes and token chains still match?
- Can another verifier check the same bundle?

VSC is built to answer those integrity and reconstruction questions.

## The basic idea

VSC stores one full starting state.

This is called the base state.

After that, VSC does not need to store the whole state again every time.

Instead, it stores ordered changes.

These changes are called deltas.

Later, the latest state can be rebuilt from:

```text
base state + ordered deltas
```

Then VSC checks whether the rebuilt state matches the expected root hash.

In simple terms:

```text
If the reconstruction matches, the evidence chain is internally consistent.
If it does not match, something is missing, changed, broken, or inconsistent.
```

## What VSC proves

VSC can prove that an evidence bundle is internally consistent.

It can check:

- required files are present
- checksums match
- token chains are consistent
- delta tokens are present
- the manifest can be read
- the state can be reconstructed and verified in a reproducible way

In short:

```text
VSC proves state integrity.
```

## What VSC does not prove

VSC has strict boundaries.

VSC does not prove:

- that a statement is true
- that an AI decision was morally correct
- that an AI decision was legally correct
- who a person is
- who is legally responsible
- who is guilty
- whether the outcome was fair
- whether the original data source was truthful

In short:

```text
VSC proves state integrity, not truth.
```

## PASS / FAIL / ERROR in plain language

### PASS

`PASS` means the bundle passed the verifier checks.

The required files were found, the checksums matched, and the evidence structure was internally consistent according to the verifier.

It does not mean that the AI was right.

### FAIL

`FAIL` means the verifier found an integrity problem.

For example, a checksum may not match, a token chain may be inconsistent, or the saved evidence may not match what was expected.

It means the bundle should not be treated as clean evidence without further review.

### ERROR

`ERROR` means the verifier could not properly process the bundle.

For example, a required file may be malformed or unreadable.

It means the verification process could not complete normally.

## The three-layer trust model

VSC is designed to work as one layer in a broader trust architecture.

```text
TBN     = identity / trust verification
VSC     = decision-state verification
CLARIXO = responsibility / attribution context
```

In German:

```text
TBN beweist Identität.
VSC beweist Zustand.
CLARIXO beweist Verantwortungskontext.
```

These layers should not be confused.

TBN can help verify identity or trust status.  
VSC verifies the decision-state evidence layer.  
CLARIXO can provide responsibility or attribution context.

VSC does not replace TBN or CLARIXO.

## Why this matters

Many AI systems produce outputs that are difficult to inspect later.

VSC makes the evidence layer more portable, checkable, and reproducible.

This can help:

- developers debug AI decision flows
- auditors inspect evidence bundles
- institutions preserve decision-state records
- governance systems compare verification results
- partners integrate state evidence into broader trust architectures

## Simple summary

VSC is not a truth machine.

VSC is not a court.

VSC is not an identity system.

VSC is a verifiable state evidence layer.

It helps answer one essential question:

```text
Can this saved AI decision state be reconstructed and verified as internally consistent?
```
