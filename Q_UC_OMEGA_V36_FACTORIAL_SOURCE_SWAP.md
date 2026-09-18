# Q-UC Ω V36 — Factorial Source-Swap Causal Information Experiment

Status: protocol design; NO empirical claim.

## Central question

Can changing only the causal identity of a post-lock entropy source change a
predictor's held-out response distribution?

The experiment is explicitly designed to distinguish:
- ordinary prediction/leakage,
- temporal/sequence artifacts,
- source-specific artifacts,
- infrastructure coupling,
- an unexplained source-target coupling.

## Factorial design

For episode e define two independently generated post-lock sources U and V.
Exactly one source determines the target.

Four randomized conditions:

A: target=f(U), predictor receives U
B: target=f(U), predictor receives V
C: target=f(V), predictor receives U
D: target=f(V), predictor receives V

The predictor does not receive the target and does not know which source is
causally connected to the target.

A and D are matched-source controls.
B and C are crossed-source controls.

The decisive contrast is:

  Delta = mean(score | matched) - mean(score | crossed)

with all observable transcript properties distribution-matched.

Under an ordinary information model with no leakage:
  Delta = 0.

A genuine source-target coupling hypothesis predicts:
  Delta != 0,
provided the coupling is defined as sensitivity to causal source identity.

## Critical safeguard

The source bytes must never be transformed into a value that is itself
predictable from public metadata. Target construction uses a domain-separated
extractor and direct rejection sampling. The source identifier, commitment,
hashes, timestamps and transport metadata are excluded from the target except
where explicitly randomized as part of the preregistered construction.

## Positive control

Before any scientific episodes, run a blinded positive-control block where the
predictor receives a deliberately leaked target bit through an independently
specified channel. The full analysis must recover this signal.

Failure invalidates the laboratory run.

## Negative controls

1. Wrong-source control: predictor receives an independent source.
2. Target permutation control: preserve response and all covariates, permute
   target labels within predeclared blocks.
3. Provider control: identical protocol across independent model/provider
   sessions.
4. Infrastructure control: replay from a separate host.

## Information-dose ladder

Repeat the factorial contrast at:
L=0,1,2,4,8,16,32,64 target bits.

For each L, publish:
- cross-fitted log-loss difference;
- Brier-score difference;
- bounded e-value;
- conditional-randomization p/e-value;
- response entropy;
- source entropy;
- latency distributions.

No single metric may be selected after observing results.

## Causal estimand

For score s bounded in [0,1]:

  tau_L = E[s(R,T)|matched,L] - E[s(R,T)|crossed,L]

The primary metric is held-out log-loss advantage, not raw hit rate.

## Regime model

Every episode has a predeclared regime vector:

R_e = (model, provider, source-class, session, infrastructure,
       calendar-block, codebook-family)

All primary inference is stratified or cross-fitted by R_e.

The protocol does not pool regimes blindly.

## Mechanism discrimination

If Delta appears, test sequentially:

M1 target leakage
M2 source metadata leakage
M3 response autocorrelation
M4 codebook asymmetry
M5 source predictability
M6 timing/infrastructure leakage
M7 provider/model artifact
M8 operator-state coupling
M9 unknown classical channel
M10 nonclassical source-target coupling

The conclusion cannot jump from an anomaly directly to M10.

## Replication ladder

I0 same process
I1 same host, fresh process
I2 independent host
I3 independent provider + host
I4 independent providers + network/storage separation
I5 independent laboratory

A discovery claim requires survival through I4 and a preregistered I5 attempt.

## Discovery criterion

A candidate anomaly is eligible for a major scientific claim only if:

1. positive control succeeds;
2. negative controls are null;
3. matched-vs-crossed contrast is positive;
4. target permutation is rejected;
5. effect survives codebook randomization;
6. effect scales predictably with information dose;
7. source identity is the manipulated variable;
8. provider/model substitution preserves the effect;
9. infrastructure separation preserves the effect;
10. an independent laboratory reproduces the preregistered effect size
   within a predeclared interval.

Even then, the conclusion is "reproducible anomalous source-target coupling";
consciousness or retrocausality requires additional independent evidence.

## Null result

A null result is scientifically valuable. It constrains the hypothesis and
prevents post-hoc reinterpretation.

## Status

No data have been collected under V36. Therefore this document makes no
claim that the phenomenon exists.
