# Q-UC Ω v27 — Causal Diamond

## Purpose
Test information transfer between two independently instantiated systems while minimizing shared causal infrastructure and observer back-action.

## Geometry
A0 = source state sealed before exposure.
B0 = predictor state sealed before source release.
A1 = source reveal.
B1 = predictor reveal/response.

The experiment forbids any communication edge A1 -> B0 by construction.

Use separate providers, separate accounts, independent RNG sources where possible, separate network routes, and delayed reveal.

## Causal exclusion window
Define a conservative exclusion interval around B0 during which A1 is not publicly released. Choose it from a documented upper bound on signal-travel time between source and predictor locations plus a safety margin.

UTC is a coordination label, not the causal primitive. The primitive is the event graph plus the documented exclusion relation.

## Conditions
FORWARD: source commits, predictor predicts, source reveals.
REVERSE: predictor commits, source-side system predicts, roles exchanged.
SHAM: identical traffic/timing without semantic target relation.
PLACEBO: same protocol with permuted release indices.

## Primary estimand
I_res = I(A1 ; B0 | Z, G)
where Z contains measured public covariates and G is the causal graph.

## Strong anomaly criteria
Survive exact randomization, target/response permutations, provider swap, session reset, sham traffic, temporal index shift, analyst blinding, and replication with a different infrastructure path.

## Back-action
Measure the predictor's perturbation budget separately from target generation. Remote prediction is not automatically non-invasive.

## Interpretation
A surviving result is evidence about an information/causal anomaly first. It is not, by itself, evidence of consciousness, retrocausality, or a new physical law.
