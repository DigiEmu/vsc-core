# PASS / FAIL / ERROR Explained for Non-Technical Readers

Project: DigiEmu VSC / VSC Core  
Release context: v2.14

## Main message

VSC proves state integrity, not truth.

A VSC result tells you whether an evidence bundle could be checked according to VSC verification rules.

It does not tell you whether an AI decision was morally right, legally correct, fair, or true.

## Why these result classes matter

VSC uses result classes to make verification outcomes easier to understand.

The three basic result classes are:

```text
PASS
FAIL
ERROR
```

These words have specific meanings inside VSC.

They should not be stretched beyond those meanings.

## PASS

`PASS` means the evidence bundle passed the verifier checks.

In simple terms, the verifier was able to inspect the bundle and did not find an integrity problem in the checked evidence structure.

A PASS can indicate that:

- required files were present
- checksums matched
- token chains were consistent
- expected delta tokens were found
- the manifest could be read
- the evidence structure was internally consistent according to the verifier

### What PASS does not mean

PASS does not mean:

- the AI was correct
- the AI output was true
- the decision was fair
- the decision was lawful
- the original data source was truthful
- a person or organization is responsible
- a legal or moral question has been answered

In short:

```text
PASS means integrity checks passed.
PASS does not mean truth was proven.
```

## FAIL

`FAIL` means the verifier found an integrity problem.

In simple terms, something in the evidence bundle did not match what the verifier expected.

A FAIL can indicate that:

- a checksum did not match
- a required token was missing
- a token chain was inconsistent
- a file was changed after the bundle was created
- the evidence structure did not match the expected verification rules

### What FAIL does not mean

FAIL does not automatically mean:

- someone intentionally manipulated the bundle
- the original AI decision was false
- the AI system acted illegally
- a person is guilty
- responsibility attribution has been proven
- the whole case is resolved

A FAIL means the bundle should not be treated as clean verified evidence without further review.

In short:

```text
FAIL means an integrity problem was detected.
FAIL does not by itself prove wrongdoing.
```

## ERROR

`ERROR` means the verifier could not complete verification normally.

In simple terms, the bundle could not be processed properly.

An ERROR can happen when:

- a required file is unreadable
- a manifest is malformed
- the input path is invalid
- the bundle structure prevents normal verification
- the verifier cannot safely decide PASS or FAIL

### What ERROR does not mean

ERROR does not necessarily mean:

- the bundle failed integrity checks
- the AI decision was wrong
- someone manipulated evidence
- the case is proven one way or another

ERROR means the verification process could not complete normally.

In short:

```text
ERROR means verification could not be completed.
ERROR is not the same as FAIL.
```

## Simple comparison table

| Result | Plain meaning | What it does not prove |
|---|---|---|
| PASS | The checked evidence structure is internally consistent. | Truth, fairness, legality, identity, responsibility |
| FAIL | The verifier found an integrity problem. | Intent, guilt, attribution, falsehood |
| ERROR | The verifier could not complete verification normally. | That the bundle passed or failed |

## How to read a VSC result safely

When reading a VSC result, ask:

1. Did verification complete?
2. Did the bundle pass integrity checks?
3. If it failed, which integrity check failed?
4. If it errored, what prevented verification?
5. What questions remain outside VSC?

The last question is important.

VSC does not answer every trust question.

It answers a specific evidence-integrity question.

## Relationship to the three-layer trust model

VSC is one layer in a broader trust architecture.

```text
TBN     = identity / trust verification
VSC     = decision-state verification
CLARIXO = responsibility / attribution context
```

In simple terms:

```text
TBN helps answer: Who or what is trusted?
VSC helps answer: Is the decision-state evidence internally consistent?
CLARIXO helps answer: What is the responsibility or attribution context?
```

These layers should not be confused.

## Final summary

PASS is good, but it is not a truth certificate.

FAIL is serious, but it is not automatic proof of wrongdoing.

ERROR means the verifier could not complete its work.

The safest short version is:

```text
PASS  = checked and internally consistent
FAIL  = checked and integrity problem found
ERROR = not fully checkable
```
