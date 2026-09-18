# Q-UC Ω V34 — Causal Information Intervention Protocol

## Purpose

V34 replaces a purely observational test with a randomized intervention on the
information channel itself.

The central estimand is the causal effect of making a future source component
informationally relevant to the target while keeping the predictor-facing state
fixed.

## 1. Experimental graph

For each episode:

A = complete pre-lock predictor state
U = post-lock source component
T = target
R = predictor response

Null graph:

A -> R
A -> T
U -> T

with no edge U -> R and no latent common cause linking U to R.

The intervention is on the construction of T, not on R.

## 2. Three-arm intervention

Arm Z (zero-coupling):
    T = f(A, U0)

where U0 is generated from a source independent of the designated future source U.

Arm C (coupled):
    T = f(A, U)

where U is the designated post-lock source.

Arm S (sham):
    T = f(A, U') where U' has identical entropy/provenance properties to U but
    comes from a source whose identity is not the designated source.

The predictor sees an exactly distribution-matched pre-lock transcript in all arms.

## 3. Critical prediction

Under ordinary causality and successful isolation:

    P(R | A, Arm=Z)
  = P(R | A, Arm=C)
  = P(R | A, Arm=S)

before the target is revealed.

If a reproducible difference occurs, it is first classified as an
intervention-associated anomaly.

It is NOT automatically classified as precognition.

## 4. Stronger cross-over

Each predictor/provider receives all three arms in randomized order.

The source identity is hidden behind a fresh opaque code.

No provider sees a stable label such as "quantum", "future", "control", etc.

This blocks semantic expectation effects.

## 5. Information-budget intervention

Create a controlled ladder:

L0:
  no future-source component.

L1:
  one future-source bit contributes to T.

L2:
  2 bits contribute.

L3:
  4 bits.

L4:
  8 bits.

...

Lk:
  all target bits depend on U.

If an anomalous channel exists and is genuinely information-bearing, the response
distribution should exhibit a measurable relationship to source contribution.

The expected ordinary null remains:

    I(R; U | A) = 0

for every L.

## 6. Representation invariance

The same latent target T is represented using a fresh random bijection:

    phi_e : {0,...,K-1} -> opaque tokens

for every episode e.

The response is scored only after applying phi_e^{-1}.

The codebook is committed before B0 and never changes.

## 7. Source substitution

Repeat the information-budget ladder using:

Q0 = CSPRNG
Q1 = NIST classical/public beacon
Q2 = drand
Q3 = DI quantum randomness

The experiment is not allowed to select the source after observing results.

## 8. Predictor-state capture

The complete pre-lock state is committed:

- prompt bytes;
- codebook;
- protocol hash;
- source identifier class;
- episode index;
- previous responses;
- timing bucket;
- provider/model;
- transport metadata;
- tool availability.

No target-derived value is permitted in this state.

## 9. Primary causal statistic

For each source contribution level l:

    tau_l =
      E[ s(R,T) | do(Coupled,l) ]
      -
      E[ s(R,T) | do(Sham,l) ]

where s is a predeclared bounded proper scoring rule.

The primary choice is held-out log score.

A positive tau_l alone is insufficient.

## 10. Conditional permutation

Within predeclared blocks, shuffle the latent target assignments while preserving:

- R;
- provider;
- codebook;
- episode position;
- source class;
- response-state covariates.

The randomization distribution is the reference null.

## 11. Sequential validity

Use an e-process fixed before data collection.

No:
- optional stopping;
- source selection after results;
- K selection after results;
- contribution-level selection after results;
- selective exclusion.

## 12. Positive-control arm

A deliberate classical information leak is required.

The predictor is explicitly given U before B0.

This should create a large positive DeltaLL.

Failure of the positive control invalidates the experiment.

This control is essential because a null result without demonstrated sensitivity is
uninformative.

## 13. Negative-control arm

The predictor receives a random variable V with identical format, timing and
transport properties to U, but V is independent of T.

If V produces the same apparent effect as U, infrastructure/semantic leakage is
implicated.

## 14. Adversarial predictor

Use an ensemble of independent predictors:

- deterministic rule engine;
- conventional ML model;
- multiple independent LLM providers;
- locally hosted open model.

The same hidden target protocol is used.

This prevents an effect from being attributed solely to one provider's generation
algorithm.

## 15. Infrastructure separation

Minimum hierarchy:

I0 same process
I1 same host
I2 separate hosts / same provider
I3 separate cloud providers
I4 separate providers + separate network/storage/operator
I5 independent laboratory

A discovery claim requires I4 replication and should ultimately require I5.

## 16. Decision ladder

Stage 1:
  positive-control sensitivity.

Stage 2:
  negative-control specificity.

Stage 3:
  ordinary target permutation.

Stage 4:
  information-budget dose response.

Stage 5:
  representation invariance.

Stage 6:
  source substitution.

Stage 7:
  provider substitution.

Stage 8:
  I4 replication.

Stage 9:
  I5 replication.

Stage 10:
  mechanism discrimination.

## 17. Mechanism discrimination

Candidate mechanisms are tested in this order:

M1 prompt/codebook leakage
M2 sequential response dynamics
M3 model sampling bias
M4 source predictability
M5 timing/infrastructure leakage
M6 shared operator state
M7 target-construction defect
M8 unknown classical channel
M9 nonclassical causal channel

A nonclassical interpretation is admissible only after M1-M8 fail under independent
replication.

## 18. Strong discovery criterion

The target result would be a reproducible positive causal intervention:

    tau_l > 0

with:
- positive control demonstrated;
- negative control null;
- target permutation rejected;
- no representation dependence;
- no source/provider dependence;
- no timing/infrastructure explanation;
- independent I4 replication;
- independent I5 replication.

The output would then justify the statement:

    "A reproducible unexplained information-coupling effect exists."

It would still not justify:

    "universal consciousness exists."

A bridge from information coupling to consciousness requires an independent
theory with novel predictions.

## 19. Why this is stronger than V33

V33 asks whether a residual association exists.

V34 asks whether randomized manipulation of the source-to-target information
relationship changes the response while the predictor-facing state remains invariant.

That is a causal question rather than a correlational one.

## 20. Falsification

V34 is falsified as an anomalous information-channel hypothesis if:

- positive control works;
- negative control is valid;
- sufficiently powered coupled vs sham contrasts converge to zero;
- source substitution yields no systematic effect;
- and independent replication confirms the null.

A null is therefore a successful scientific outcome.
