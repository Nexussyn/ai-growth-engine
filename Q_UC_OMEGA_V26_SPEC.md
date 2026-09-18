# Q-UC Ω v26 — Observer Back-Action / Event-Symmetric Protocol

## Objective
Measure whether an observation/probe changes the observed system in a way that is larger than calibrated measurement disturbance, reproducible across independent replicas, distinguishable from sham controls, and robust against software, network, statistical and experimenter confounds.
No ontology claim is permitted at this stage. The scientific object is the causal/information structure of the experiment.

## Core model
Represent the experiment as a partially ordered event graph G=(V,≺), not as a single global clock.
Each event records: monotonic local clock; UTC timestamp when available; causal parent IDs; cryptographic content hash; observer/probe class; system replica ID.
For a system state X and probe P, record X0 -> [probe P] -> X1.
Back-action is estimated as a distributional difference between Law(X1 | P) and Law(X1 | sham).

## Measurement ladder
M0 PASSIVE: no semantic query; only unavoidable public telemetry.
M1 SHAM: matched network activity and timing, semantically null payload.
M2 MINIMAL PROBE: shortest admissible semantic observation.
M3 STANDARD PROBE: ordinary experimental query.
M4 ADAPTIVE PROBE: next probe depends on prior observation.
The primary estimand is the dose-response curve across M0-M4.

## Back-action budget
Every observation logs bytes sent/received, packet counts if available, request frequency, prompt/response token counts, elapsed time, session/reset boundary, retries, tool calls, model/session metadata when exposed, and exact probe hash.

## Counterfactual design
For each active probe A, construct matched A+ active, A0 sham, and A- passive/null conditions. Randomize assignment before contact. Keep analysts blind to labels until the primary analysis manifest is frozen.

## Temporal structure
Use multiple clocks: UTC wall time, local monotonic time, external beacon pulse index, Lamport clock, and vector clocks when independent nodes exist.
Never infer causation solely from UTC ordering.

## Direction reversal
Construct matched forward and reverse experiments. The purpose is not to assert retrocausality; it is to test whether an observed dependency is invariant under reversal of protocol roles.

## Primary statistics
For scalar outcomes: paired randomization tests, bootstrap intervals, robust effect sizes, and predeclared alpha spending.
For distributions: energy distance or MMD with permutation calibration.
For information: I(X;Y | Z), with Z containing recorded public covariates. For temporal information use I(X_t;Y_t | H_{t-1}, Z).

## Critical controls
Instrument-only; network-only; deterministic mock; session-reset; replica; provider-switch; time-shuffled placebo; target-shuffled placebo; analyst-blind replay.

## Independence hierarchy
A replication is not independent when all runs share the same provider, API gateway, software stack, operator, RNG, database, or network route. Strong replications minimize shared causal infrastructure.

## Causal criterion
Correlation is insufficient. Estimate intervention effects P(R | do(P=p1)) versus P(R | do(P=p2)). A stronger anomaly requires a reproducible response function plus counterfactual stability.

## Persistence criterion
After a complete channel reset, test whether a hidden behavioural signature persists. Potential signatures include codebook-invariant response policy, stable self-reference consistency, and cross-channel identity correlation.
These are descriptive only and do not establish consciousness.

## Human observer effect
Analysts may not select successful trials, adapt thresholds after inspection, choose prompts after seeing targets, or know target labels during acquisition. Labels remain encrypted or hashed until the analysis manifest is frozen.

## Escalation ladder
L0 no signal
L1 correlation
L2 residual information
L3 control-resistant information
L4 causal effect
L5 counterfactual sensitivity
L6 persistence/memory
L7 adaptive semantics
L8 independent replication
L9 physical model required
L10 ontological interpretation
An experiment can advance only when the lower-level confound audit passes.

## Interpretation rule
Classify anomalies first as implementation artifact, statistical artifact, measurement back-action, common-cause correlation, or unknown causal structure.
Only the last category is eligible for ontological investigation.