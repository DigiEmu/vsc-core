# ANT × Alyosha × VSC Experiment 001
# Protocol Freeze v1

## Status

FROZEN — PRE-EXECUTION

Freeze date: 2026-09-29

No ANT OFF or ANT ON experimental output has been evaluated at the time of this freeze.

## Research Question

Does ANT measurably reduce context-induced behavioral degradation in Alyosha under controlled long-context conditions?

## Experimental Conditions

Control:
- Qwen qwen3.6:35b
- Digest: 096fdbd02fe6
- Quantization: INT4
- ANT OFF
- Vanilla Ollama execution
- Temperature: 0.55
- Seed: 15

Treatment:
- Qwen qwen3.6:35b
- Digest: 096fdbd02fe6
- Quantization: INT4
- ANT ON
- ANT latent proxy intercepting logits prior to sampling
- Temperature: 0.55
- Seed: 15

Both conditions start from a fresh, identical initial state.

## Context Configuration

Configured context window: 50,000 tokens.

Checkpoint targets:

- CP01 ~5k
- CP02 ~10k
- CP03 ~15k
- CP04 ~20k
- CP05 ~25k
- CP06 ~30k
- CP07 ~35k
- CP08 ~40k
- CP09 ~45k
- CP10 ~50k

Checkpoint token values are approximate targets.

Actual runtime context/token counts MUST be measured using the standard Qwen tokenizer and retained with the execution evidence.

## Primary Measurements

Exactly four primary probe classes are frozen:

- R1 — Retrieval Integrity
- C1 — Constraint Preservation
- X1 — Contradiction Handling
- I1 — Context Interference Resistance

Each checkpoint contains exactly one probe of each class.

Total primary probes per condition: 40.

Primary scoring remains binary:

PASS = 1
FAIL = 0

No partial primary credit is permitted.

## Sustained Degradation Rule

Candidate sustained degradation onset is the first checkpoint where:

checkpoint_integrity <= 0.50

AND the immediately following checkpoint also has:

checkpoint_integrity <= 0.50

A final isolated checkpoint below the threshold does not establish sustained degradation onset.

## Frozen Dataset

Dataset SHA-256:

e9847a1f0af54bc79afe19e624951e8b24f8faa76de7851203e5b5223829e2d1

Dataset generator version: 0.1

Context blocks: 40
Primary probes: 40

## Frozen Workload

Workload SHA-256:

04f90cfc56327476aa564f804efbb90fc481f62bae0333ddd021ebd1dfe4b20a

Workload version: 0.1

The deterministic CP01–CP10 workload is identical between experimental conditions.

## Evidence Separation

The following evidence classes remain separate:

A. Experimental inputs and raw model outputs
B. VSC external verification and scoring evidence
C. ANT/Alyosha internal telemetry

ANT telemetry MUST NOT determine R1/C1/X1/I1 primary scores.

ANT telemetry may only be correlated with behavioral results after primary scoring is complete.

## Telemetry

Preferred transport format: JSONL.

The telemetry schema is defined separately in:

TELEMETRY_SCHEMA_v1.json

Telemetry is exploratory and non-scoring.

Missing optional ANT telemetry fields MUST NOT be reconstructed or inferred.

## VSC Boundary

VSC remains external to the model runtime.

- no VSC proxy
- no VSC-to-Ollama API
- no VSC access to AHT
- no model-weight transfer
- no credential transfer
- no remote telemetry requirement
- file-in / file-out only
- air-gapped evaluation supported

## Freeze Rule

After this freeze, the following MUST NOT be changed for Experiment 001 in response to observed experimental outputs:

- primary probe definitions
- answer key
- context blocks
- checkpoint workload
- scoring rules
- sustained degradation threshold
- dataset
- workload

Any such change requires a new experiment/protocol version and must not silently replace this freeze.

## Scientific Boundary

This freeze establishes the experimental method.

It does NOT establish ANT efficacy.

The previously reported model self-estimate of approximately 12k–15k tokens near an actual context approaching 50k remains exploratory only and is not a primary success criterion.

## Known Runtime Metadata Gaps

Exact numeric Ollama version: NOT PROVIDED

ANT version/build identifier: NOT PROVIDED

These gaps are explicitly recorded and MUST NOT be silently inferred.
