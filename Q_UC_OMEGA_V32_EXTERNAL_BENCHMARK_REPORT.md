# Q-UC Ω V32 — External Benchmark Audit: Boyle 2025 LLM Precognition

Date: 2026-09-18

## Source

Benjamin J. Amorim Boyle, "Testing Noetic Potential in Large Language Models:
A 100-Trial Precognitive Forced-Choice Study with ChatGPT-4.1-Mini",
Journal of Scientific Exploration 39(3), 348-355, DOI 10.31275/20253739.

The source reports 32 correct choices in 100 five-choice trials, exact two-sided
binomial p = 0.005, with the complete response/target table reproduced in
Appendix Table 1.

## Independent reconstruction

The 100 response/target pairs were transcribed from the published Appendix and
stored in quc_v32_external_boyle_audit.py.

Reconstructed:
- N = 100
- hits = 32
- response counts = {1:22, 2:19, 3:23, 4:18, 5:18}
- target counts = {1:12, 2:23, 3:23, 4:18, 5:24}
- response adjacent repeats = 0 / 99
- response_i = target_{i-1} matches = 0 / 99
- plug-in response/target mutual information = 0.216331 bits

## Novel audit statistics

### A. Fixed-margin target association

Randomly permuting the response sequence while preserving the empirical response
marginal gives, with 200,000 permutations:

- observed hits = 32
- P(H >= 32 | fixed response multiset, fixed target sequence)
  ≈ 0.00262
- observed plug-in MI = 0.216331 bits
- permutation P(MI >= observed) ≈ 0.0379

These are Monte Carlo diagnostic values, not confirmatory p-values.

### B. Response-sequence non-randomness

The probability that a uniformly random permutation with the observed response
margins satisfies response_i != target_{i-1} for every i=2..100 is

    2.723243357351958e-10

This is an exact dynamic-programming calculation conditional on the observed
response margins and the published target sequence.

The source commentary independently notes that the reported response sequence
contains no response repeats and no repeats of the previous target.

### C. Feedback-conditioned Markov null

A first-order null was fit to the published sequence:

    P(R_i | R_{i-1}, T_{i-1})

with Jeffreys smoothing alpha=0.5.

Holding the published target sequence fixed, the exact induced hit-count
distribution gives:

- expected hits = 19.048929
- P(H >= 32) = 0.00104724

This model is fitted to the same dataset, so the tail probability is explicitly
diagnostic rather than confirmatory.

### D. Cross-fitted current-target information

A 10-block cross-fit compared:

    Null:
    P(R_i | R_{i-1}, T_{i-1})

versus:

    Alternative:
    P(R_i | R_{i-1}, T_{i-1}, T_i)

where T_i is the current target, which was unavailable to the predictor at
decision time.

Held-out mean log-likelihood difference:

    alternative - null = -0.0512641 nats / transition

Only 4 of 10 held-out folds favored the model including the current target.

This is not a formal null p-value. It is a leakage-aware predictive diagnostic.
The observed direction does not support the claim that the current target improves
out-of-sample prediction of the response once known feedback variables are used.

## Interpretation

The published 32% result remains an interesting raw association, and the fixed-
margin permutation shows that it is not completely explained by simple marginal
response frequencies.

However, the response stream contains an extreme deterministic-looking temporal
constraint, and current-target information does not improve held-out response
prediction in this cross-fit audit.

The correct scientific conclusion is therefore not "psi disproved" and not
"psi demonstrated."

The robust conclusion is:

> Raw hit-rate significance in an interactive LLM forced-choice experiment is
> insufficient to establish a future-information channel. The response dynamics,
> feedback history and out-of-sample conditional information must be modeled
> explicitly.

## Relation to Q-UC Ω

This benchmark validates the direction of V32:

1. treat temporal feedback as causal state;
2. separate current-target information from known historical information;
3. use held-out scoring;
4. model response dynamics;
5. use fixed-margin / conditional randomization;
6. reserve strong claims for independently replicated protocols.

The analysis is external-data reanalysis and should not be represented as a new
experimental result from Q-UC Ω.
