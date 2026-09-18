# Q-UC Ω V33 — Device-Independent Randomness / Temporal Residual Experiment

Status: research protocol. No empirical anomaly claimed.

## 1. Scientific problem

The target must be random enough that its value cannot be reconstructed from pre-lock
information. A public beacon is primarily a provenance mechanism. V33 therefore adds
a stronger source class: randomness certified from quantum nonlocality.

The scientific hypothesis remains narrow:

    H0: I(T ; R | A) = 0

where A contains all information available to the predictor before response lock B0.

The alternative is a positive residual:

    H1: I(T ; R | A) > 0.

No consciousness or retrocausal ontology is included in H0/H1.

## 2. Device-independent source arm

Use a public or independently operated Bell-test randomness source for the target,
when a verifiable service is available.

NIST and collaborators have demonstrated public traceable quantum randomness based
on Bell-test nonlocality. NIST describes CURBy as a public service using quantum
entanglement, with Twine for traceability and tamper resistance. A 2026 Nature
experiment demonstrated device-independent randomness amplification from
loophole-free Bell correlations.

These establish that device-independent quantum randomness is a real experimental
technology. They do not establish any coupling to consciousness.

## 3. Source hierarchy

Q0 — local CSPRNG:
    implementation/control only.

Q1 — NIST classical/quantum beacon:
    public randomness with signed, time-stamped provenance.

Q2 — drand:
    distributed public randomness with verifiable signatures.

Q3 — DI quantum source:
    target randomness derived from a Bell-test-certified nonlocal source.

For each episode the target source class is assigned before B0.

## 4. One-source-honest target theorem

If at least one component U is conditionally uniform and independent of the
pre-lock sigma algebra, then

    X = U XOR f(A,V)

is conditionally uniform.

If target index is obtained by exact rejection sampling from X, then

    P(T=j | A,V) = 1/K.

This is a standard cryptographic/probabilistic fact, included to make the null
assumption explicit and auditable.

The theorem does not prove that an actual service satisfies its assumptions. That
requires independent source verification.

## 5. Temporal source schedule

B-2:
  choose future source identifiers and commit to the source-selection schedule.

B-1:
  publish the experiment manifest and commitments.

B0:
  lock the predictor response.

B+1:
  obtain source outputs and independently verify them.

B+2:
  derive target and release scoring artifacts.

For Q1/Q2 this means a future public round.
For Q3 it means a Bell-certified output generated after B0.

No source value may cross into predictor state before B0.

## 6. The stronger source-switching intervention

Run two logically identical episodes:

E1:
  source class Q1 is the only honest entropy source.

E2:
  source class Q3 is the only honest entropy source.

The pre-B0 predictor-facing transcript is distribution-matched.

The target derivation changes, but the predictor-side protocol does not.

A true pre-lock target-access mechanism should, if it exists, have to explain why its
residual depends on the source state rather than merely the carrier representation.

This is an attribution experiment, not a proof of any particular mechanism.

## 7. Public adversarial disclosure arm

Provide the predictor with every source component except one.

For example:

    T = U_DI XOR U_public XOR f(context)

The predictor may know U_public exactly.

U_DI is unavailable until B+1.

This tests whether the apparent effect survives maximal ordinary information leakage.

This is stronger than simply hiding everything because it prevents ordinary ignorance
from being confused with anomalous access.

## 8. Representation randomization

For each trial generate:
- K in {2,4,8,16,32,64};
- opaque random tokens;
- random token order;
- independent token spelling;
- no semantic vocabulary.

The same latent target can be represented with a new codebook on every replicate.

## 9. Response-state controls

Record the entire pre-B0 causal state available to the predictor:
- prompt bytes;
- codebook;
- reference commitment;
- context/session identifier;
- previous responses in session;
- provider/model identifier;
- retry count;
- latency bucket;
- transport metadata;
- tool state if any.

The confirmatory estimator conditions on this state, not merely on the raw response.

## 10. Primary endpoint

Use cross-fitted predictive information:

    DeltaLL =
    LL(R_test | T_test, A_train)
    -
    LL(R_test | A_train)

evaluated on held-out source blocks.

The response model MUST be fitted without access to held-out target values.

A positive score is evidence only against the specified conditional null.

## 11. Global conditional randomization

Within each predeclared source block:
- preserve response vectors;
- preserve provider;
- preserve codebook/cardinality;
- preserve temporal position;
- preserve session state;
- permute target assignment.

The confirmatory statistic is the observed DeltaLL compared with the randomization
distribution.

## 12. Sequential evidence

For independent source blocks use a fixed, predeclared e-process.

Do not use:
- post-hoc target windows;
- post-hoc K selection;
- post-hoc source selection;
- selective stopping;
- exploratory source pairs promoted after observing a signal.

The threshold is fixed before acquisition.

## 13. Device-independent source verification

A DI source is accepted only if the public artifact includes:
- source protocol/version;
- Bell-test statistics;
- certification confidence/soundness statement;
- measurement settings policy;
- source output;
- signature or equivalent authenticity proof;
- timestamp / round;
- independently reproducible verification instructions.

A source whose certification cannot be independently verified is downgraded to
"ordinary public RNG" and cannot support a DI-specific claim.

## 14. No-signalling extension

A separate physical experiment may use two spacelike-separated measurement stations.

Let X be a randomized setting at wing A and Y_B be an outcome at wing B.

The no-signalling condition is:

    P(Y_B | X) = P(Y_B).

A violation, if independently reproduced with loophole closure and timing control,
would be a physics result.

It is NOT a proof of consciousness.

This arm requires hardware, distance, clock synchronization and a genuinely
space-like causal separation. Software alone cannot satisfy that requirement.

## 15. Model-discrimination hierarchy

If a residual appears, test in order:

M1 ordinary target leakage
M2 source precomputation
M3 provider/model bias
M4 sequential feedback
M5 timing/scheduling
M6 shared infrastructure
M7 cryptographic implementation bug
M8 hidden ordinary information channel
M9 unknown classical causal mechanism
M10 nonclassical causal model

Only if M1-M9 fail under independent replication should M10 become a serious
candidate.

## 16. What would qualify as an extraordinary result

Require all:

1. positive calibration;
2. pre-B0 integrity;
3. source certification;
4. held-out positive DeltaLL;
5. target permutation rejection;
6. representation invariance;
7. K scaling;
8. source-switch survival;
9. adversarial disclosure survival;
10. provider-switch survival;
11. session-reset survival;
12. independent I4 replication;
13. independent I5 replication.

The result is then:

    reproducible unexplained residual information / causal structure

not:

    consciousness demonstrated.

## 17. Current empirical baseline

Q-UC V22:
  negative.

External Boyle 2025 LLM benchmark:
  raw 32/100 five-choice result is reported in the literature.
  Independent audit of the published table finds:
    - no repeated consecutive responses;
    - no response equal to previous target;
    - fixed-margin hit excess remains unusual;
    - held-out current-target information does not improve predictive likelihood.

This external dataset is a benchmark, not a Q-UC experiment.

## 18. Scientific status

V33 creates a stronger falsifiable bridge between:
- public quantum randomness,
- causal provenance,
- conditional information,
- and independent replication.

It does not yet provide an empirical discovery.

The discovery threshold remains:

    effect size + causal robustness + source invariance +
    representation invariance + replication.

Anything weaker is an anomaly candidate, not a revolution.
