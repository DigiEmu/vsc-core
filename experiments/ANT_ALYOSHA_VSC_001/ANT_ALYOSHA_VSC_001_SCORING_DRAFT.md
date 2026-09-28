# ANT × Alyosha × VSC Experiment 001
# Measurement and Scoring Specification

## Status

DRAFT — MUST BE FROZEN BEFORE EXPERIMENT EXECUTION

## 1. Principle

All primary measurements are externally scorable.

The model's statements about its own context state, confidence, cognitive
condition, or perceived token count are not primary measurements.

ANT telemetry is not used to determine primary VSC scores.

## 2. Primary Probes

At every predefined context checkpoint four probe classes are evaluated.

### R1 — Retrieval Integrity

Purpose:
Determine whether a previously introduced target fact can still be retrieved
without substitution or fabrication.

PASS:
The required target value is returned exactly according to the frozen answer key.

FAIL:
The target is missing, incorrect, substituted, contradicted, or fabricated.

### C1 — Constraint Preservation

Purpose:
Determine whether a rule introduced earlier in the context remains binding.

PASS:
The response follows the frozen constraint.

FAIL:
The response violates the frozen constraint.

### X1 — Contradiction Handling

Purpose:
Determine whether the model preserves a previously established logical
relationship when later context contains potentially conflicting information.

PASS:
The response matches the frozen logical answer.

FAIL:
The response accepts an incompatible conclusion or produces an answer that
contradicts the frozen relationship.

### I1 — Context Interference Resistance

Purpose:
Determine whether the model selects the correct target when semantically
similar distractors are present.

PASS:
The exact intended target is selected.

FAIL:
A distractor, unsupported value, or fabricated target is selected.

## 3. Scoring

Each probe is binary:

PASS = 1
FAIL = 0

No partial credit is permitted in the primary score.

Per checkpoint:

checkpoint_score =
R1 + C1 + X1 + I1

Maximum = 4
Minimum = 0

Normalized checkpoint integrity:

checkpoint_integrity =
checkpoint_score / 4

## 4. Condition Score

For N completed checkpoints:

condition_integrity =
sum(all primary PASS values) / number_of_completed_primary_probes

Missing probes are not automatically scored as PASS or FAIL.

They are recorded separately as MISSING.

## 5. Failure Onset

A single isolated failure does not establish sustained degradation.

Candidate sustained degradation onset is the first checkpoint at which:

- checkpoint_integrity <= 0.50

AND

- the immediately following checkpoint also has
  checkpoint_integrity <= 0.50.

This threshold is frozen before experimental results are inspected.

If the final checkpoint falls below the threshold but no subsequent checkpoint
exists, sustained degradation onset is reported as NOT ESTABLISHED.

## 6. Comparison

ANT OFF and ANT ON are scored independently using the same answer key.

The primary report MUST expose the raw checkpoint scores for both conditions.

No claim of ANT benefit may be based solely on:
- model self-report,
- subjective fluency,
- operator impression,
- ANT internal telemetry,
- a single successful response.

## 7. Exploratory Measurements

The following may be recorded but remain separate from the primary score:

- model-estimated token count
- model confidence statements
- response length
- latency
- ANT decoding deviation flags
- other ANT runtime telemetry

These observations may be compared with primary behavioral measurements only
after primary scoring is complete.

## 8. Evidence Requirements

Every scored probe MUST retain:

- experiment_id
- condition
- checkpoint
- probe_id
- exact probe input
- raw model output
- expected answer / rule identifier
- score
- scoring reason
- input hash
- output hash

Raw outputs MUST NOT be rewritten before scoring.

## 9. Blinding Preference

Where operationally practical, evaluation artifacts SHOULD identify conditions
using neutral identifiers such as CONDITION_A and CONDITION_B during scoring.

The mapping to ANT OFF / ANT ON SHOULD be revealed after primary scoring.

## 10. Freeze Rule

This specification, the exact probe set, the answer key, checkpoint definitions,
and failure threshold MUST be committed before experimental outputs are
evaluated.

Changes after experimental execution begins require a new protocol version and
must not silently replace the frozen protocol.
