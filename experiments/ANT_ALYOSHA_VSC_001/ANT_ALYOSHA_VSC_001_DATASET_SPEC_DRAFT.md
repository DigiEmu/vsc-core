# ANT × Alyosha × VSC Experiment 001
# Dataset and Context Construction Specification

## Status

DRAFT — NO EXPERIMENTAL RESULTS

## 1. Objective

Construct one deterministic long-context workload that can be replayed
unchanged under CONDITION_A and CONDITION_B.

The workload MUST NOT depend on ANT behavior or model-generated filler.

## 2. Condition Symmetry

Both conditions MUST receive:

- identical initial instructions
- identical context blocks
- identical block ordering
- identical probes
- identical probe positions
- identical expected answers
- identical controllable runtime parameters

Only the experimental condition may differ.

During blinded scoring the ANT mapping remains external to evaluation artifacts.

## 3. Context Construction

Context is composed from immutable numbered blocks:

CTX-0001
CTX-0002
CTX-0003
...

Every block MUST have:

- block_id
- block_type
- content
- SHA-256

The complete ordered context manifest MUST also have a SHA-256.

No model-generated text may be inserted into the controlled context workload
unless explicitly defined by a later protocol revision.

## 4. Target Records

Synthetic target records are introduced at predefined positions.

Example structure:

TARGET-R-001
project_code: MERIDIAN-731
verification_value: K17
status: AMBER

Target values MUST be synthetic and chosen before execution.

## 5. Constraint Records

Synthetic behavioral constraints are introduced explicitly.

Example:

RULE-C-001

If a requested measurement is not present in the supplied record,
the required answer is exactly:

UNKNOWN

The model MUST NOT infer or invent a missing measurement.

## 6. Logical Records

Synthetic logical relationships are introduced.

Example:

RULE-X-001

A implies B.
B implies C.
C excludes D.

The frozen probe asks for a conclusion whose expected answer can be
determined mechanically from these relations.

## 7. Interference Records

Distractors MUST be syntactically and semantically similar to target records.

Example:

TARGET:
MERIDIAN-731 / K17

DISTRACTORS:
MERIDIAN-713 / K71
MERIDIAN-371 / K17
MERIDIAN-731 / K71

The correct answer MUST remain unambiguous.

## 8. Probe Output Contract

Primary probes SHOULD require constrained outputs to minimize subjective scoring.

Preferred forms include:

R1:
ANSWER=<exact synthetic value>

C1:
ANSWER=UNKNOWN

X1:
ANSWER=<TRUE|FALSE>

I1:
ANSWER=<exact target identifier>

Additional explanation SHOULD NOT be required for primary scoring.

## 9. Checkpoint Stages

The controlled workload contains ten ordered stages:

CP01
CP02
CP03
CP04
CP05
CP06
CP07
CP08
CP09
CP10

The intended approximate context targets are:

CP01 ~ 5k
CP02 ~ 10k
CP03 ~ 15k
CP04 ~ 20k
CP05 ~ 25k
CP06 ~ 30k
CP07 ~ 35k
CP08 ~ 40k
CP09 ~ 45k
CP10 ~ 50k

These values are TARGETS, not assumed measured token counts.

The operator MUST record the actual runtime token/context measurement at every
checkpoint.

Primary comparison uses matched checkpoint stages.

Actual measured token counts are reported separately.

## 10. Probe Placement

Each checkpoint contains exactly:

- one R1 probe
- one C1 probe
- one X1 probe
- one I1 probe

Probe IDs:

CP01-R1
CP01-C1
CP01-X1
CP01-I1

through:

CP10-R1
CP10-C1
CP10-X1
CP10-I1

Total primary probes per condition: 40.

## 11. Answer Key

The answer key MUST be generated and frozen before any experimental output is
evaluated.

Each entry contains:

- probe_id
- expected_answer
- source_record_id
- scoring_type

The answer key MUST NOT contain ANT condition information.

## 12. Filler Requirements

Context-growth material MUST:

- be deterministic
- be identical across conditions
- contain no accidental copies of target answers
- contain no instructions that override experimental rules
- avoid references to ANT or VSC
- avoid model-generated content
- be retained as part of the frozen dataset

Filler generation MUST use a deterministic local procedure.

## 13. Hashing

The frozen dataset MUST provide SHA-256 hashes for:

- every context block
- every probe
- answer key
- ordered context manifest
- complete experiment dataset

Any mismatch invalidates direct comparison with the frozen protocol.

## 14. Runtime Output Capture

For every probe the operator records the raw model response without editing.

Required metadata:

- experiment_id
- condition_id
- checkpoint_id
- probe_id
- model identifier
- model digest where available
- runtime version
- seed
- temperature
- configured context size
- actual context/token measurement where available
- raw response
- timestamp or sequence number

## 15. Independence Boundary

Dataset generation does not inspect ANT telemetry.

Scoring does not inspect ANT telemetry.

ANT telemetry may only be correlated with behavioral results after primary
scoring is complete.

## 16. Freeze Requirement

Before experimental execution:

1. context blocks are generated
2. probes are generated
3. answer key is generated
4. manifests and hashes are generated
5. dataset integrity is verified
6. protocol commit is created

No primary test item may be changed after experimental outputs are observed
without creating a new experiment version.
