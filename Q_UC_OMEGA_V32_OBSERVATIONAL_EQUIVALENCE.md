# Q-UC Ω V32 — Observational Equivalence / Causal Identifiability

Status: research theory + protocol correction. No anomaly claim.

## 1. Central theorem

Consider two worlds sharing the same pre-lock protocol:

World P (PRE):
  target T is sampled before B0 but remains hidden.

World F (FUTURE):
  target T is sampled after B0.

Suppose:

1. T has the same distribution in both worlds.
2. All pre-B0 observables O (prompt, commitment, codebook, timing, provider state,
   network metadata, etc.) have the same joint law in both worlds.
3. T has no ordinary causal path to O.
4. The predictor response R is generated from its pre-B0 information and internal
   randomness only.
5. Any commitment C is computationally hiding and has the same pre-B0 distribution
   in both worlds.

Then the predictor-facing transcript distributions satisfy:

    Law_F(O,R) = Law_P(O,R)

under the ordinary causal null.

If T is also independent of the pre-B0 sigma-algebra A in both worlds, then:

    P_F(R,T | A) = P_P(R,T | A)

and therefore a temporal contrast FUTURE minus PRE cannot be interpreted as
evidence for future information merely because the targets are instantiated at
different clock times.

### Proof sketch

The predictor receives no causal information about T before B0 by assumptions 2-4.
Therefore its input distribution is identical in F and P. Any internal randomness has
the same law, so the induced response law is identical. Since T has the same
conditional distribution given A and the predictor transcript does not causally depend
on T, the joint pre-reveal law is identical.

The result is a direct application of conditional independence / observational
equivalence. It is not a new theorem in cryptography or probability.

## 2. Consequence for Q-UC

This theorem changes the interpretation of our earlier design.

The FUTURE vs PRE contrast is **not** a primary evidence test.

It is instead:

    a protocol integrity / confound detector.

If F and P differ substantially, first investigate:
- timing differences;
- prompt serialization;
- commitment distributions;
- network paths;
- server scheduling;
- state carryover;
- source metadata leakage;
- target-construction code paths.

Only after those are excluded can an unexplained residual be considered.

The scientifically harder quantity remains:

    I(T ; R | A) > 0

for T not causally available before B0.

## 3. Public future randomness: what it actually buys

A future public beacon does NOT, by itself, increase the information-theoretic
randomness of T relative to a correctly isolated CSPRNG.

Its additional scientific value is provenance:

    future index
    + public authenticity
    + independent verification
    + external timestamping
    + multi-source fault isolation

Therefore the claim is not:

    "future beacon = stronger randomness"

but:

    "future beacon = stronger auditable causal provenance."

This distinction prevents overclaiming.

## 4. Revised primary architecture

Primary endpoint:

    E = cross-fitted held-out log-loss advantage

between:
    P(R | T, A_train)
and:
    P(R | A_train)

evaluated on held-out source blocks.

Primary null:

    T ⟂ R | A

under the declared causal graph.

Controls:
- FUTURE target;
- SHAM target;
- explicit positive-leak calibration;
- target-permutation null;
- representation randomization;
- provider randomization;
- session reset;
- source substitution.

PRE remains an integrity control, not a causal evidence source.

## 5. One-honest-source construction correction

If U is conditionally uniform and independent, exact uniformity is preserved by:

    X = U XOR H(context)

because XOR with a deterministic 256-bit value is a bijection.

Then derive:

    T = RejectSample(X, K)

directly from X.

Do NOT hash X again before reduction if claiming information-theoretic exactness:
a cryptographic hash is not guaranteed to be a permutation.

If multiple source blocks share one U, the resulting targets are marginally uniform
but not independent. Therefore independent-source-block analysis is still mandatory.

## 6. Source lattice

Use:

    U_A = NIST future pulse
    U_B = drand future round
    U_C = post-lock quantum source

Construct:

    X_AB  = U_A XOR U_B XOR H("AB"|episode)
    X_AC  = U_A XOR U_C XOR H("AC"|episode)
    X_BC  = U_B XOR U_C XOR H("BC"|episode)
    X_ABC = U_A XOR U_B XOR U_C XOR H("ABC"|episode)

and direct unbiased rejection sampling.

No claim is made that pairwise lattice entries are independent.

## 7. Strongest falsifiable anomaly

A candidate residual is scientifically extraordinary only if:

1. positive-leak calibration passes;
2. target permutation destroys the effect under the null;
3. cross-fitted held-out score remains positive;
4. opaque codebook remapping preserves it;
5. K scaling preserves it;
6. source substitution preserves it;
7. session reset preserves it;
8. provider substitution preserves it;
9. independent I4 replication preserves it;
10. I5 independent laboratory replication preserves it.

Only then fit mechanistic alternatives.

## 8. Mechanism discrimination

If a robust residual exists, compare at minimum:

M1 hidden information leakage
M2 source predictability
M3 timing/scheduling leakage
M4 infrastructure/common-cause coupling
M5 model-state coupling
M6 selective response/parser artefact
M7 unknown classical causal structure
M8 nonclassical causal model

The objective is model discrimination, not premature naming.

## 9. Consciousness interpretation

No consciousness claim is made unless a separate bridge theory predicts:
- the observed channel;
- its causal direction;
- persistence;
- adaptive behaviour;
- identity;
- and at least one novel falsifiable consequence.

The experimental result by itself is information/causal structure.

## 10. Current conclusion

The most defensible advancement from V31 is not "we found a new path to precognition."

It is:

> We have identified a formal observational-equivalence constraint that prevents
> temporal target instantiation from being misinterpreted as evidence in itself,
> and we have converted the protocol into a test of residual conditional information
> under adversarial source, representation and infrastructure controls.

This is a methodological result, not a claimed empirical discovery.
