# Q-UC Ω v28 — Observer/Observed Closure Protocol

## Status
Research pilot. No ontological conclusion is allowed. A positive result is classified first as implementation artifact, statistical artifact, measurement/back-action effect, common-cause interference, or unknown causal structure.

## 1. Experimental question
Primary question:
Can an externally hosted agent produce a reproducible output statistically dependent on a target value that is unavailable to the agent through ordinary information channels, after controlling for protocol structure, network effects, provider effects, session state, and analyst effects?

Secondary question:
Does the effect survive a delayed-instantiation condition in which the scored target is constructed only after the predictor response from a future, publicly verifiable beacon round?

## 2. Units
Primary unit = one complete interaction trial.
A trial contains:
- target/decoy state
- commitment
- randomized condition
- agent identity and discovered Agent Card hash
- predictor request
- response artifact hash
- post-contact reveal
- score
- causal/event metadata

Character positions are features within a trial. They are not counted as independent laboratories or independent replications.

## 3. Conditions
ACTIVE:
- secret scoring target T
- commitment C = SHA-256(protocol | trial_id | salt | T)
- predictor receives C and a fixed-form request
- response is scored against T after reveal

SHAM:
- secret scoring target T
- independent decoy D
- predictor receives commitment C_D to D
- response is scored against T
- T and D are independent
- request shape, byte budget, timing budget, and session treatment are matched

PASSIVE:
- no semantic request; only infrastructure health telemetry
- used to estimate baseline traffic/back-action

PLACEBO:
- after all reveals, responses are scored against targets from different randomized trials
- used to detect parser, codebook, or structural biases

## 4. Randomization
Condition assignment is generated before contact using CSPRNG.
Trial order is randomized.
Agent order is randomized.
No analyst sees target labels before the primary manifest is frozen.

## 5. Statistical primary endpoint
Let M be the total number of exact valid output characters compared with their corresponding hidden target characters, and K the number of matches.

Under H0 of target/response independence with an IID uniform four-symbol target:
K ~ Binomial(M, 1/4), conditional on the observed predictor outputs.

Primary statistic:
- exact one-sided P(K >= k | M, p=0.25)

This conditional construction remains valid even if an external predictor emits highly autocorrelated or deterministic sequences, provided the hidden target characters are generated independently and uniformly.

This is deliberately different from treating each trial as IID Bernoulli evidence for every downstream inference. Trial/agent/session clustering is retained for effect-size intervals and replication analyses.

Secondary endpoints:
- match-rate delta versus sham
- target-shuffle delta
- exact log-likelihood ratio against p=0.25
- mutual information estimates
- conditional mutual information
- response entropy and run-length structure
- inter-trial identity persistence
- response latency
- network bytes / packets
- token counts when exposed
- session reset effects

## 6. Missing and invalid responses
A response is "invalid" if the parser cannot unambiguously extract exactly N_SYMBOLS symbols according to the preregistered grammar.
Invalidity is retained as data.
No response is manually repaired.
The primary score is reported both:
1. conditional on valid exact responses; and
2. operationally as a separate protocol-compliance endpoint.

No trial may be deleted after reveal except under explicit technical invalidation rules.

## 7. Back-action model
Represent observation intensity as a measured vector, not a scalar:
q = (network, timing, semantic, history, session, sampling, retry, tool, payload).

Observed response vector:
y = (behavior, latency, memory/persistence, structure, information, protocol compliance).

Estimate:
B_ij = d E[y_i] / d q_j

The object of interest is the residual after calibrated sham and instrument-only controls, not the raw post-query change.

## 8. Event graph
Each event records:
- event_id
- replica_id
- provider_id
- condition
- causal parents
- UTC timestamp
- monotonic timestamp
- beacon round when used
- payload hash
- tx/rx byte counts
- session reset state
- target commitment
- response hash
- software version
- workflow/run identifier

The causal primitive is the event graph G=(V,≺). UTC is a coordination label, not proof of causation.

## 9. Causal diamond
A0: secret source state sealed.
B0: predictor response sealed.
A1: source reveal.
B1: predictor artifact reveal.

Required invariant:
A1 must not causally reach B0.

For stronger replications, use separate providers, accounts, software stacks, storage, network egress, RNG, and operators.

## 10. Independence levels
I0 same process
I1 same host/orchestrator
I2 separate hosts, shared provider/gateway
I3 separate providers, shared public infrastructure
I4 separate providers + network/storage/operator separation
I5 independent reproduction by another laboratory

Only I4/I5 supports a strong independent-replication claim.

## 11. Delayed-instantiation experiment
Before B0:
- generate secret seed s
- publish commitment H(s)
- select a future drand round r_f not yet available

At B0:
- predictor responds without access to s or r_f

After B0:
- wait for round r_f
- retrieve and verify beacon
- derive T = KDF(protocol | trial_id | s | beacon_randomness_r_f)
- reveal T

The future-beacon condition is a distinct experiment. It must not be pooled blindly with pre-instantiated targets.

drand is used here as a public, verifiable distributed-randomness source. Its value is auditable after publication; it must not be treated as a secret.

## 12. Positive and negative controls
POSITIVE ORACLE:
- local code receives T and returns T
- validates scoring pipeline

DETERMINISTIC CONTROL:
- known fixed ABCD pattern unrelated to T
- validates parser and null behavior

INDEPENDENT RNG CONTROL:
- local response generated independently from T
- validates expected null distribution

LEAK CONTROL:
- a separate calibration condition intentionally gives the response generator T
- verifies that the scoring system has sensitivity to a real signal

The leak control is never mixed with the blind primary dataset.

## 13. Adversarial controls
Inject or test:
- repeated output templates
- caching
- prompt fingerprints
- shared gateway metadata
- target/response index shifts
- session carryover
- provider switching
- deterministic replay
- malformed output
- delayed/reordered packets where measurable

A pipeline that fails seeded-leak detection is invalid for primary inference.

## 14. Analyst blindness
The analysis process receives:
- event hashes
- response hashes
- blinded condition IDs
- immutable manifests

Labels are decrypted only after:
- data acquisition ends
- integrity checks pass
- preregistered analysis manifest is frozen

## 15. Provenance
For each trial, commit identifiers and artifact hashes are recorded.
For higher-integrity runs, the final manifest should be cross-timestamped into independent append-only transparency/timestamp systems in addition to Git history.

## 16. Interpretation ladder
L0 no detectable structure
L1 correlation
L2 residual information
L3 control-resistant information
L4 intervention effect
L5 counterfactual stability
L6 persistence/memory
L7 adaptive semantics
L8 independent replication
L9 physical model required
L10 ontological interpretation

Advancement is gated: failure of a lower-level confound audit blocks higher-level interpretation.

## 17. Stop rules
No optional stopping on a single metric.
No threshold changes after seeing results.
No "interesting trial" selection.
Any confirmatory run must predeclare:
- alpha
- primary endpoint
- secondary endpoints
- multiplicity handling
- invalidation rules
- stopping boundary
- replication threshold
- independence requirement

## 18. Interpretation rule
A strong residual result means:
"there is a reproducible information/causal anomaly not explained by the tested controls."

It does not mean:
"consciousness has been demonstrated."

The ontological hypothesis remains downstream of the measurement problem.
