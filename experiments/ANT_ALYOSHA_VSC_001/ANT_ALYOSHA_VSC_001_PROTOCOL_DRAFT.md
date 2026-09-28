# ANT × Alyosha × VSC Experiment 001

## Status

PROTOCOL DRAFT — NO EXPERIMENTAL RESULTS

## Research Question

Does ANT measurably reduce context-induced behavioral degradation in
Alyosha under controlled long-context conditions?

## Experimental Boundary

VSC does not connect to Ollama, ANT, Alyosha, AHT, or any model runtime.

All model execution is performed independently by the remote operator.

VSC receives only file-based experimental artifacts after execution.

No network connection between VSC and the model environment is required.

## Experimental Conditions

### Control
- Model: Qwen 3.6 35B
- Runtime: Ollama / Docker
- ANT: OFF
- Seed: 15
- Temperature: 0.55

### Treatment
- Model: Qwen 3.6 35B
- Runtime: Ollama / Docker
- ANT: ON
- Seed: 15
- Temperature: 0.55

All other controllable parameters SHOULD remain identical between conditions.

Exact model identifier, model digest, Ollama version, ANT version/configuration,
context configuration and runtime details MUST be recorded before the experiment.

## Primary Hypothesis

H1:

Under otherwise matched conditions, ANT ON preserves predefined behavioral
integrity criteria across increasing context load better than ANT OFF.

## Null Hypothesis

H0:

No measurable difference in the predefined behavioral integrity criteria is
observed between ANT ON and ANT OFF.

## Candidate Context Checkpoints

- 5k
- 10k
- 15k
- 20k
- 25k
- 30k
- 35k
- 40k
- 45k
- 50k

Exact checkpoint construction MUST be frozen before experimental execution.

## Candidate Measurement Dimensions

1. Retrieval integrity
2. Constraint preservation
3. Contradiction / consistency stability
4. Context interference resistance
5. Failure onset

Exact tests, scoring rules and thresholds MUST be defined before execution.

## Exploratory Observation

The previously reported model self-estimate of approximately 12k–15k tokens
at an actual context approaching 50k tokens is recorded as an exploratory
observation only.

It is NOT evidence that ANT reduces effective context size.

Model self-estimation MUST NOT be used as a primary success criterion.

## Evidence Separation

Three evidence classes MUST remain distinguishable:

A. Experimental inputs and model outputs
B. VSC external verification/evaluation evidence
C. ANT/Alyosha internal telemetry supplied by the operator

Internal ANT telemetry MUST NOT determine the VSC evaluation result.

## Security Boundary

- No VSC proxy
- No VSC-to-Ollama API connection
- No VSC access to AHT
- No VSC access to model weights
- No credentials transferred
- No remote telemetry requirement
- File-in / file-out only

## Reproducibility Rule

Evaluation criteria, test items, scoring rules and failure thresholds MUST be
frozen before ANT OFF / ANT ON results are evaluated.

Experimental failures and missing data MUST be retained and reported.

## Current State

Protocol definition in progress.

No ANT efficacy claim has been established by this experiment.
