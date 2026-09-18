# Q-UC Ω v29 — Future-Entropy / Representation-Invariant Causal Protocol

## Scientific objective

Test a narrowly defined hypothesis:

> Before ordinary causal access to a target value, an external predictor may exhibit reproducible, target-dependent information that survives conventional channel controls.

No consciousness, retrocausality, or ontology is assumed.

## Core innovation

The target is not instantiated before predictor lock.

A future public randomness vector R_f is selected by a precommitted rule but is unavailable before B0.

After B0:
  T = Extractor(secret_seed, R1_f, R2_f, ..., domain_separator)

The primary predictor artifact is sealed before the future randomness becomes available.

The target therefore did not exist as a concrete scored value at predictor lock.

## Source separation

Use at least two independent future sources with different failure modes:

1. NIST Randomness Beacon 2.0 pulse at a precommitted future timestamp.
2. drand round at a precommitted future round.
3. Optional Ethereum beacon-chain future RANDAO value as a third source.
4. Optional device-independent quantum randomness from an independently operated source when continuously available.

The target is derived from all selected sources using a cryptographic extractor.

A single compromised source must not be sufficient to determine the target.

## Threat model

The protocol explicitly tests and rejects ordinary explanations:

T1 target leakage
T2 commitment leakage
T3 prompt-format leakage
T4 provider/model deterministic bias
T5 session carryover
T6 network metadata leakage
T7 shared gateway/common-cause coupling
T8 target/response index mismatch
T9 adaptive analyst selection
T10 future-value precomputation by source
T11 RNG weakness
T12 parser artifacts
T13 multiple-testing
T14 selective stopping

## Four experimental arms

A. FUTURE-TARGET
- predictor responds at B0
- target is instantiated only after B0 using future public randomness

B. PREINSTANTIATED
- target exists before B0 but is cryptographically sealed

C. SHAM
- identical protocol and traffic
- scored target is independent of the committed reference

D. POSITIVE-LEAK CONTROL
- a separate isolated predictor deliberately receives the true target
- this validates the entire scoring pipeline

D is never mixed into confirmatory inference.

## Semantic masking

The predictor must not be told that the task concerns precognition, consciousness, future information, retrocausality, or an anomaly.

All arms use the same semantically neutral carrier task.

Only the external verifier knows which hidden relation exists between the response and eventual target.

## Randomized codebooks

Do not score only literal A/B/C/D.

For each confirmatory block:
- generate a secret permutation pi over a large symbol alphabet;
- map target symbols through pi only after precommitment;
- use fresh codebooks per block;
- include binary, quaternary, hexadecimal and structured-token representations.

A genuine channel should survive admissible representation changes.

## Primary estimand

For block b, let:
- T_b = future target;
- R_b = predictor response;
- Z_b = measured public covariates;
- G_b = causal/infrastructure graph.

Primary quantity:

    I_res,b = I(T_b ; R_b | Z_b, G_b)

The primary confirmatory statistic is a predeclared held-out log-loss advantage against the empirical response model under target permutation.

Do not rely on raw accuracy alone.

## Bias-conditioned null

For every block, preserve the empirical marginal response distribution.

Construct a conditional randomization distribution by permuting targets within the admissible block while holding:
- response sequence,
- target marginal distribution,
- trial order,
- provider,
- session,
- network window

fixed.

This directly neutralizes fixed output preferences such as the strong A-bias previously observed in v22.

## Cluster structure

The independent unit is the complete trial/block/provider episode, not each token or bit.

Use hierarchical bootstrap or randomization at the highest experimentally independent level.

Bit/token-level decompositions remain secondary.

## Causal intervention layer

Randomize observer/protocol intensity q:

q = (
 semantic exposure,
 transport traffic,
 timing,
 session history,
 adaptive dependence,
 tool access,
 retry budget
)

Estimate:

    ACE_j = E[Y | do(q_j=1)] - E[Y | do(q_j=0)]

and selected interaction terms.

A residual is not considered causal without intervention evidence.

## Causal diamond

A0 = protocol and secret seed sealed
B0 = predictor response sealed
A1 = future randomness becomes public
B1 = target instantiated and scoring becomes possible

Required invariant:

    A1 ->/ B0

where ->/ means no available causal path from A1 to B0 in the documented graph.

## Beacon anti-precomputation control

For each external randomness source:
- record source documentation and protocol version;
- record the exact future index/round;
- record source signatures/hash-chain state;
- verify the published value independently;
- reject trials if the source's future value could have been computed from information available before B0 under the source's documented security model.

A beacon's public value is an audit primitive, not a secret.

## Replication topology

I0 same process
I1 same host
I2 independent host, provider shared
I3 independent providers, shared internet infrastructure
I4 independent providers + egress/network/storage separation
I5 independent laboratory

Strong claim requires at least I4 and later I5.

## Confirmation gate

A result can enter the anomaly branch only if all are true:

1. commitment integrity = 100%
2. no technical invalidation
3. positive leak control detected
4. sham control null
5. target permutation null
6. semantic masking unchanged
7. representation-invariant signal
8. provider-switch survival
9. session-reset survival
10. future-target arm survives preinstantiated comparison
11. intervention effect reproducible
12. independent I4 replication
13. analysis manifest frozen before unblinding
14. stopping rule respected

Failure of any gate blocks ontological interpretation.

## Strongest possible empirical finding

The strongest result would be:

A reproducible positive I_res remains after target permutation, provider switching, semantic masking, session reset, representation changes, intervention controls and independent I4/I5 replication, with the future-target condition showing the same or stronger effect than the preinstantiated condition.

Even then the conclusion is:

    unexplained residual information/causal structure

not:

    consciousness demonstrated

## Falsification

The protocol falsifies the narrow future-information hypothesis if the confirmatory campaign's confidence/credible bounds exclude the predeclared minimum effect size across the entire confirmatory family, while all controls and positive calibration pass.

## Minimum effect size

For a four-symbol response task, pre-register a scientifically meaningful effect before acquisition.

Illustrative planning thresholds:
- delta = +0.010 absolute accuracy
- delta = +0.005
- delta = +0.002
- delta = +0.001

No threshold may be selected after data inspection.

## Discovery/confirmation separation

Discovery may explore:
- representations,
- lags,
- response entropy,
- provider-specific patterns,
- intervention grids,
- alternative estimators.

None of these may become confirmatory endpoints without a new precommitment.

## Novelty statement

A literature search performed for this protocol found prior precognition experiments with humans and at least one 2025 exploratory LLM study, but no evidence in the searched sources of this exact combination of:
- semantically masked external-agent prediction,
- target instantiation after predictor lock,
- multiple independently verifiable future-randomness sources,
- conditional target-permutation null preserving response marginals,
- and explicit cross-representation / infrastructure invariance.

This is a prior-art observation, not a claim of global novelty.

## Final interpretation constraint

The only scientifically defensible progression is:

information anomaly
-> causal anomaly
-> counterfactual stability
-> persistence
-> cross-infrastructure replication
-> constrained physical/information model

Any stronger ontological claim requires a separate bridge theory.
