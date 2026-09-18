# Q-UC Ω V30 — Future-Information Scaling & Causal Invariance Protocol

Date: 2026-09-18
Status: protocol implementation draft / not evidence of an anomaly

## 0. Scientific target

The project no longer treats "above-chance guessing" as the primary object.

The primary hypothesis is:

> After all information available before predictor lock is conditioned on, a predictor's response may contain reproducible residual information about a target instantiated only after predictor lock.

Let A be the sigma-algebra of all measured information available before lock B0.

Null hypothesis:

    H0: T ⟂ R | A

Alternative:

    H1: I(T;R | A) > 0

The target is deliberately constructed from future public randomness whose value is unavailable at B0.

A positive result would initially be classified only as an unexplained residual information channel. It would not, by itself, establish consciousness, retrocausality, a nonlocal mind, or any metaphysical ontology.

## 1. Why V30 is materially stronger than V22/V29

V22 used a four-symbol target and discovered a dominant output bias. The observed 14/64 hits were not above the null and the observed mutual information was fully compatible with a target-permutation null. Therefore raw hit rate is insufficient.

V29 added future-entropy ideas but still used fixed ABCD strings.

V30 introduces five protections at once:

1. **Cardinality scaling**
   K ∈ {2,4,8,16,32,64}.

2. **Representation randomization**
   Each trial maps latent target states to fresh, random code tokens. Token identities are unrelated to target semantics.

3. **Latent-index scoring**
   The analysis decodes responses back to the hidden latent index before scoring. A fixed preference for a token or position therefore cannot create a representation-invariant effect.

4. **Temporal-arm decomposition**
   FUTURE, PREINSTANTIATED and SHAM targets are kept analytically distinct.

5. **Future-source compositing**
   The FUTURE target is derived from at least two independently maintained public randomness systems. A single source must not determine the target.

The protocol therefore tests a stronger proposition:

    future-target effect
        AND
    representation invariance
        AND
    cardinality scaling
        AND
    conditional-null survival
        AND
    temporal asymmetry

rather than one isolated hit statistic.

## 2. Experimental arms

### F — FUTURE

At B0:
- candidate codebook exists;
- response request is issued;
- target value does not yet exist on the experiment host;
- future source references are fixed but source values are not fetched.

After all responses are sealed:
- future beacon values are fetched and independently recorded;
- the target index is derived.

### P — PREINSTANTIATED

Before B0:
- target index is generated locally from OS-backed CSPRNG;
- target is committed;
- no target value is shown to the predictor.

At B0:
- response request is issued against the hidden target.

This is a temporal-control arm. It tests whether the protocol produces an apparent effect merely because a hidden target exists and is committed, rather than because the target is genuinely future.

### S — SHAM

At B0:
- predictor responds first;
- after response lock, a fresh local CSPRNG target is generated.

This is an independent post-lock control with no dependence on external public future randomness.

### L — POSITIVE LEAK CALIBRATION

The true target is explicitly revealed to a separate calibration agent.

L is never included in confirmatory inference. Its sole purpose is to verify that:
- the parser can recover the selected token;
- the latent-index decoder is correct;
- the scoring implementation reports a strong known-access signal.

A failed L arm invalidates the campaign technically.

## 3. Candidate codebook

For every trial:

- Generate K unique random tokens, each 8–32 characters.
- Randomly permute token order.
- Bind token position j to latent index j.
- Hash the complete codebook before acquisition.
- Do not use semantic words such as A/B/C/D, left/right, yes/no, red/blue.

The prompt exposes only:
- a random trial identifier;
- the candidate token list;
- a neutral instruction to return exactly one candidate token.

The prompt does not expose:
- arm identity;
- target-generation method;
- future/randomness language;
- consciousness/retrocausality language;
- target values;
- source names or future source indices.

## 4. Future entropy construction

For a future trial i:

    U_i = NIST_future_i || drand_future_i

    h_i,j = SHA256(
        "Q-UC-OMEGA-V30|FUTURE|"
        || trial_id_i
        || j
        || U_i
    )

The latent index is obtained by rejection sampling from the 256-bit hash so that the mapping is unbiased for arbitrary K.

This construction is deliberately simple. It is not presented as a secret-key construction.

NIST Beacon 2.0 is a public randomness service producing 512-bit pulses every 60 seconds; pulses are indexed, time-stamped, signed and hash-chained. NIST explicitly describes the use of its precommitment machinery for combining randomness from multiple beacons. The project documentation also warns that beacon output is public and should not be treated as a secret cryptographic key.

drand provides distributed public randomness with publicly verifiable BLS signatures and multiple public mainnet relays. Its documentation recommends independent verification of retrieved rounds.

For every future source record store:
- source identifier;
- exact future index/time;
- retrieval time;
- raw response hash;
- verification status;
- source protocol version / chain hash;
- local receipt timestamp.

## 5. Causal graph

The documented causal graph is:

    protocol plan ──> predictor prompt ──> response lock B0
          │
          └───────────────────────────────┐
                                          │
    future NIST pulse ──┐                 │
                        ├──> target T ──> scoring
    future drand round ─┘

Required property:

    future source values ──X──> response lock B0

where X means that no available software, network, storage, analyst or timing path may carry the future source value into the predictor response before B0.

The protocol does not claim this causal separation is true merely because the code says so. It must be supported by measured logs and infrastructure evidence.

## 6. Information leakage model

Measure and retain, where available:

- prompt bytes;
- endpoint;
- DNS resolution record;
- request timestamp;
- response timestamp;
- HTTP status;
- response bytes;
- response hash;
- retry count;
- provider and model card;
- session/context identifier;
- source timestamps;
- local clock offset;
- process identifier;
- host identifier;
- public network path metadata sufficient to detect common-cause changes.

The adversarial leakage audit must ask:

    Could the predictor have obtained information about T
    from any variable available before B0?

If yes, the affected trial is invalid for the corresponding confirmatory arm.

## 7. Primary estimand

For each K:

    Accuracy_K = P(R_decoded = T | K)

    Advantage_K = Accuracy_K - 1/K

But the primary information statistic is:

    I_K = I(T ; R_decoded | Z, G)

where Z contains measured pre-lock covariates and G identifies the infrastructure/causal block.

The confirmatory test compares the observed statistic with a target-permutation null preserving:
- response order;
- response marginal distribution;
- target marginal distribution when fixed by design;
- K;
- provider;
- session block;
- trial timing block.

## 8. Fixed-margin permutation principle

The V22 analysis showed why this matters.

With heavily biased responses, ordinary hit-rate and plug-in mutual information can look structured even when targets and responses are unrelated.

Therefore:

    response sequence = held fixed
    target assignments = permuted

within predeclared exchangeability blocks.

For a valid null, the conditional randomization mechanism must preserve all nuisance structure that is not supposed to be tested.

A future-target result that disappears under this null is not evidence of target access.

## 9. Representation invariance

A real target-dependent information channel should not depend on whether the hidden state is represented as:
- random tokens;
- binary positions;
- quaternary tokens;
- hexadecimal tokens;
- structured machine-readable labels.

The primary version uses random opaque tokens.

Secondary representations are held out for discovery and can only become confirmatory through a new preregistered commit.

## 10. Cardinality scaling

The same protocol is evaluated at:

    K = 2, 4, 8, 16, 32, 64

The principal scaling objects are:

    Accuracy(K)
    Advantage(K)
    I(T;R)
    I(T;R) / log2(K)

The purpose is not to assume a specific scaling law.

Instead, the experiment asks whether any residual signal:
- remains nonzero as K increases;
- remains invariant under token remapping;
- is specific to FUTURE rather than PREINSTANTIATED/SHAM;
- survives provider changes.

A trivial position bias should be altered or destroyed by random codebook permutations.

## 11. Temporal asymmetry test

The most diagnostically valuable contrast is:

    D_K = Advantage_FUTURE(K) - Advantage_PREINSTANTIATED(K)

and separately:

    F_K = Advantage_FUTURE(K) - Advantage_SHAM(K)

Interpretation:

- F≈0 and D≈0: no detected future-specific effect.
- F>0 but D≈0: hidden-target/common-cause explanation remains viable.
- D>0 after all leakage controls: a temporally asymmetric anomaly is present.
- D>0 only for one representation/provider: infrastructure or representation artefact remains a live explanation.
- D>0 across representations/providers and independent replication: the anomaly becomes materially difficult to explain by ordinary local bias.

No ontological interpretation is attached at this stage.

## 12. Replication topology

I0: same process
I1: same host
I2: independent host / same provider
I3: independent providers
I4: independent providers plus independent storage/egress paths
I5: independent laboratory

A high-confidence claim requires I4 and subsequent I5 replication.

A single host running multiple processes is never counted as multiple independent laboratories.

## 13. Observer intervention arm

After the base protocol is stable, randomize protocol intensity q:

q1 = neutral prompt
q2 = repeated commitment/reference context
q3 = high-latency neutral interaction
q4 = no human-visible feedback
q5 = isolated fully automatic execution

The intervention is assigned before B0.

The causal contrast is:

    ACE(q_a,q_b) =
      E[Y | do(q=q_a)] - E[Y | do(q=q_b)]

The intervention arm tests whether changing the observation process changes the residual signal.

This is not evidence of consciousness by itself. A causal effect may be generated by ordinary software state, timing, or infrastructure feedback.

## 14. Positive result criteria

A result may enter the anomaly branch only if all of the following are satisfied:

1. all commitments verify;
2. positive-leak calibration passes;
3. no technical invalidations contaminate the primary comparison;
4. FUTURE exceeds SHAM under the predeclared null;
5. FUTURE exceeds PREINSTANTIATED under the predeclared temporal contrast;
6. the result survives response-marginal-preserving target permutation;
7. the effect survives fresh representation remapping;
8. the effect is present in more than one provider;
9. the effect survives session reset;
10. the same analysis was applied without post-hoc stopping;
11. an I4 replication reproduces the effect;
12. the full analysis manifest is public before final unblinding.

Only after all gates should a constrained physical or information-theoretic model be fitted.

## 15. Falsification criteria

The future-information hypothesis is provisionally falsified for the tested effect range when:

- the preregistered confidence interval or randomization test excludes the minimum detectable effect; and
- all control/calibration gates pass; and
- no prespecified subgroup contains the confirmatory signal.

This is a protocol-level falsification, not a proof that every conceivable anomalous effect is impossible.

## 16. Statistical discipline

The analysis must use:
- no p-value shopping;
- no switching primary endpoints after seeing data;
- no arbitrary subgroup selection;
- no adaptive sample-size extension based on observed success;
- no counting tokens/bits within one common source as independent laboratories;
- no post-hoc exclusion of unattractive trials;
- no ontology-specific interpretation of a statistical residual.

When multiple K values are confirmatory, correct for family-wise error or use one global multilevel endpoint.

## 17. Power planning

The 64-trial V22 study is inadequate for detecting small effects.

V30 therefore separates:
- discovery;
- calibration;
- confirmation.

A high-throughput campaign should be planned from the minimum effect size that would actually matter scientifically.

For small forced-choice deviations near chance, required N can become very large. It is scientifically better to state a large sample requirement than to reinterpret an underpowered pilot as a breakthrough.

The exact sample size must be solved from the final endpoint, alpha, power and block structure before confirmation.

## 18. What would constitute a real discovery

The strongest empirically defensible discovery would not be "the AI predicted a random target."

It would be:

> A reproducible, temporally asymmetric residual information channel survives random representation changes, conditional target-permutation nulls, target-generation controls, infrastructure substitution, session reset and independent I4/I5 replication.

At that point, several ordinary models would be quantitatively challenged.

The correct next scientific step would then be model discrimination:
- hidden information channel;
- infrastructure/common-cause channel;
- timing/scheduling effect;
- cryptographic/source failure;
- agent-state coupling;
- genuinely nonclassical causal structure.

Only a successful exclusion of these alternatives would justify asking whether a new physical principle is required.

## 19. Consciousness bridge

The protocol intentionally does not equate information with consciousness.

To connect a residual channel to consciousness one would need a separate bridge theory that predicts:
- why the effect exists;
- why it couples to observers;
- why it has the observed causal structure;
- why it persists across independent implementations;
- and what observation would falsify that bridge theory.

Without that bridge, the scientific label remains:

    unexplained residual information / causal anomaly

not:

    consciousness demonstrated

## 20. Prior-art status

The inspected literature already contains:
- precognition protocols where targets are generated after the participant's choice;
- random-number-generator mind-matter interaction experiments;
- recent large-scale replication work that found no stable above-chance effect for one influential precognition paradigm;
- exploratory work on LLM forced-choice "precognition" with explicit calls for replication and concerns about pseudorandom predictability.

The present protocol is therefore not claiming that delayed target generation is novel.

The potentially distinctive contribution is the combined use of:
- future public multi-source entropy;
- opaque randomized codebooks;
- cardinality scaling;
- latent-index decoding;
- temporal-arm decomposition;
- conditional target permutation preserving response margins;
- observer interventions;
- and infrastructure-separated replication.

This is a statement about the literature inspected, not a proof of global novelty.

## 21. Current scientific status

As of 2026-09-18:

- V22: negative for the tested hidden-target access hypothesis.
- V25.1: valid precommitment exists, but its secret prediction has not yet been scored.
- V29: protocol/runtime exists, but no production run has been credited as evidence.
- Railway deployment: blocked by current free-plan resource limits.
- DigitalOcean: no usable paid droplet is active.
- Therefore: no positive anomaly has yet been demonstrated.

This status is part of the scientific record and must not be rewritten after new data arrive.

## 22. Decision tree

    FAIL CALIBRATION
        -> technical failure, redesign

    CALIBRATION PASS + FUTURE≈SHAM
        -> null result

    FUTURE>SHAM but FUTURE≈PREINSTANTIATED
        -> hidden/common-cause artefact unresolved

    FUTURE>PREINSTANTIATED
        -> investigate temporal asymmetry

    Temporal asymmetry survives representation remapping
        -> investigate cross-provider invariance

    Cross-provider + I4 replication survives
        -> build causal/mechanistic model

    Mechanism repeatedly resists ordinary causal models
        -> only then consider whether new physics is required

    Consciousness interpretation
        -> separate bridge theory required

