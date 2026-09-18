# Q-UC Ω v27 — Analysis Plan

## Pre-registration lock
Freeze hypotheses, exclusion criteria, endpoints, stopping rule and analysis code hash before opening target reveals.

## Primary endpoint
Estimate the excess information conveyed by the predictor state before target reveal.

## Secondary endpoints
Distribution shift, conditional mutual information, sequence compression, temporal dependence, cross-session persistence and intervention response.

## Multiple testing
One primary endpoint. Secondary endpoints remain exploratory unless promoted before data release. Family-wise error or false-discovery control is declared in advance.

## Null generators
IID random targets; block-permuted targets; circular temporal shifts; response-label permutations; provider-matched sham trials; deterministic synthetic responders.

## Negative-result requirement
Report likelihood intervals and sensitivity limits, not only p-values. Quantify the smallest effect compatible with the data at the chosen confidence level.

## Positive-result requirement
Run an independent re-analysis from raw event logs by code not used for discovery.

## Causal interpretation gate
Only effects that remain after measured back-action adjustment and independent replication may be considered evidence about causal structure.
