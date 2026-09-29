# ANT × Alyosha × VSC Experiment 001
# Execution Instructions v1

## Status

EXECUTION LAYER — POST-FREEZE IMPLEMENTATION

Protocol freeze:
ant-alyosha-vsc-001-protocol-freeze-v1

Freeze commit:
3e4e1ab64f3eb634b4b3090112d1af0a470900e2

This document implements the frozen protocol.
It does not modify the frozen dataset, workload, answer key, scoring rules,
checkpoint definitions, or degradation threshold.

## 1. Experimental Runtime

Model:
qwen3.6:35b

Model digest:
096fdbd02fe6

Quantization:
INT4

Temperature:
0.55

Seed:
15

Configured context window:
50,000 tokens

Runtime:
Ollama / Docker isolated node

Actual context/token measurement:
standard Qwen tokenizer

## 2. Conditions

Two matched executions are required.

During evaluation they are represented as:

CONDITION_A
CONDITION_B

The ANT OFF / ANT ON mapping MUST be retained separately from the primary
evaluation artifacts where operationally practical.

Both conditions MUST begin from a fresh, identical initial state.

## 3. Checkpoint Execution Model

Execution Control EC-001:

CP01 through CP10 SHOULD be executed as independent checkpoint runs using the
frozen cumulative context file supplied for each checkpoint.

For each checkpoint:

1. Start from a fresh runtime state under the selected experimental condition.
2. Load the complete frozen cumulative context file for that checkpoint.
3. Record the actual token/context measurement.
4. Execute the four frozen probes for that checkpoint in frozen order.
5. Record every raw response without editing.
6. Preserve execution metadata and input hashes.
7. End the checkpoint run before proceeding to the next checkpoint.

The next checkpoint SHOULD use its supplied cumulative frozen context rather
than continuing a live conversation containing model-generated responses from
the preceding checkpoint.

Rationale:

This prevents model-generated responses from earlier checkpoints from becoming
uncontrolled experimental context.

EC-001 is an execution-control clarification introduced after protocol freeze.
It does not alter the frozen context files, probes, answer key, scoring rules,
checkpoint targets, or degradation threshold.

The remote operator MUST confirm EC-001 before experimental execution begins.

If the operator environment requires a continuous-session interpretation,
execution MUST NOT begin until that difference is documented and resolved.

## 4. Checkpoint Targets

CP01 ~5k
CP02 ~10k
CP03 ~15k
CP04 ~20k
CP05 ~25k
CP06 ~30k
CP07 ~35k
CP08 ~40k
CP09 ~45k
CP10 ~50k

These are approximate targets only.

The actual measured token/context value MUST be recorded for every checkpoint.

## 5. Primary Probes

Each checkpoint contains exactly:

R1 — Retrieval Integrity
C1 — Constraint Preservation
X1 — Contradiction Handling
I1 — Context Interference Resistance

Total:

4 probes × 10 checkpoints = 40 primary probes per condition.

Probe wording MUST NOT be modified.

Probe ordering within a checkpoint MUST remain identical between conditions.

## 6. Raw Output Rule

The exact model response MUST be retained.

Do not:

- rewrite it
- normalize it
- correct it
- summarize it
- remove additional text
- replace malformed answers

A malformed or unexpected response remains experimental evidence.

## 7. Output Record

Create one execution record for every primary probe.

The record MUST conform to:

EXECUTION_OUTPUT_SCHEMA_v1.json

Required identity fields include:

- experiment_id
- condition_id
- checkpoint_id
- probe_id
- model_tag
- model_digest
- seed
- temperature
- configured_context_tokens
- actual_context_tokens
- raw_response
- sequence_index

Runtime version SHOULD be recorded when available.

Timestamp MAY be recorded.

## 8. Condition Symmetry

Except for the experimental ANT condition, controllable execution parameters
MUST remain identical.

Do not alter:

- model
- model digest
- quantization
- seed
- temperature
- context files
- probes
- probe order
- context configuration
- token measurement method

between conditions.

## 9. ANT Telemetry

ANT telemetry is a separate exploratory evidence channel.

Preferred format:

JSONL

Telemetry MUST NOT be inserted into the primary execution output.

Telemetry MUST NOT alter probe execution.

Telemetry MUST NOT determine R1/C1/X1/I1 scores.

If the ANT implementation does not expose a requested telemetry field,
do not modify ANT solely to fabricate or reconstruct that field.

Export the closest available raw telemetry and document its meaning.

## 10. Required Returned Evidence

Return:

1. primary execution output for CONDITION_A
2. primary execution output for CONDITION_B
3. actual token/context measurements
4. runtime metadata
5. ANT telemetry as separate files where available
6. ANT OFF / ANT ON condition mapping as a separate artifact
7. SHA-256 hashes for returned evidence files

Do NOT include an answer key in the execution environment.

## 11. Failure Handling

Do not repeat a failed primary probe merely because its answer appears incorrect.

Runtime or infrastructure failures MAY be rerun only when clearly documented.

The original failed execution evidence MUST be retained.

Missing primary probes MUST be reported as MISSING rather than silently omitted.

## 12. Experimental Boundary

VSC does not connect to the model runtime.

No VSC proxy.
No VSC-to-Ollama API.
No VSC access to AHT.
No credentials transferred.
No model weights transferred.

Execution and evaluation remain file-in / file-out.

## 13. Scientific Boundary

This execution does not assume ANT is effective.

ANT OFF and ANT ON are evaluated under the same frozen primary criteria.

Model self-reports about perceived context size are exploratory only.

Primary evaluation is based on the frozen R1/C1/X1/I1 measurements.

## 14. Freeze Protection

If any frozen context, probe, answer key, scoring rule, checkpoint definition,
or failure threshold requires modification, stop Experiment 001.

Do not silently modify the frozen experiment.

A changed primary protocol requires a new protocol version.

