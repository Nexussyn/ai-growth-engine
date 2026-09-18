# Q-UC Ω V35 — Replication Instability Audit

Date: 2026-09-18

## Source

Kulikov et al., PLOS ONE 2025/2026 metascientific replication of Bem Experiment 1.
The paper reports:
- Study 1: 49.48%, N=37,836
- Study 2: 49.65%, N=127,000
- Study 3: 50.07%, N=217,800

The authors report Study 2 as a confirmatory replication of an exploratory
Study-1 anomaly, but Study 3 did not reproduce Study 2.

## Independent aggregate reanalysis

Using only the published aggregate proportions and N, the approximate
two-sample normal comparisons are:

S1 vs S2:
  difference = -0.17 percentage points
  z ≈ -0.59

S2 vs S3:
  difference = -0.42 percentage points
  z ≈ -2.38

S1 vs S3:
  difference = -0.59 percentage points
  z ≈ -2.58

These are descriptive secondary calculations, not preregistered tests of the
original hypothesis and not evidence of psi.

## Scientific interpretation

The important feature is not the sign of any one study. It is the instability
of the estimated effect across independent study regimes.

The sequence is:

    S1  49.48%
    S2  49.65%
    S3  50.07%

with very large N in S2 and S3.

This means that simply pooling all trials and asking whether the aggregate is
different from 50% is not sufficient to establish a stable phenomenon. A
candidate effect must include a model of between-study heterogeneity and must
predict its behavior prospectively.

## Q-UC consequence

V35 therefore introduces a mandatory regime variable R:

    R ∈ {study, provider, source, session, infrastructure, calendar block}

The primary future experiments must report:

    effect = f(R)

rather than only:

    effect = mean(all trials).

A putative anomaly that changes sign or disappears under independent regime
replication is classified as unstable until a causal mechanism predicts the
regime dependence.

## Stronger future criterion

A discovery candidate must have:

1. a preregistered estimand;
2. a preregistered regime model;
3. positive-control sensitivity;
4. negative-control specificity;
5. source switching;
6. held-out evaluation;
7. independent infrastructure;
8. independent replication;
9. prospective prediction of any regime dependence.

This is a stronger criterion than conventional pooled hit-rate significance.
