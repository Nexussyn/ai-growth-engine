# Q-UC Ω V31 — Source Lattice / Post-Lock Quantum Entropy

Status: research design; no anomaly claim.

## 1. New question

V30 asks whether a predictor response contains residual information about a target
whose construction uses future public randomness.

V31 asks the stronger question:

> Does any residual response-target dependence persist when the target is constructed
> from multiple sources whose information becomes available at different causal times,
> including a fresh quantum-random draw requested only after predictor lock?

This is a causal-design problem, not a metaphysical test.

## 2. Source classes

S0 — PRE:
A conventional pre-instantiated local CSPRNG target. Used as temporal control.

S1 — NIST-FUTURE:
A precommitted future NIST beacon pulse. NIST's reference format uses 512-bit
time-stamped, signed, hash-chained pulses and is designed to permit combination of
independent beacons.

S2 — DRAND-FUTURE:
A precommitted future drand round, verified against the appropriate drand chain
configuration. drand provides public, distributed randomness with independently
verifiable beacon signatures.

S3 — AQN-POSTLOCK:
A quantum-random draw requested only after B0 from the Australian National
University Quantum Numbers service, when available. The service documentation states
that numbers are generated in real time by measuring quantum fluctuations and exposed
through an API. This source is an auxiliary causal arm, not a cryptographic root of
trust.

References:
- NIST beacon reference: https://csrc.nist.gov/projects/interoperable-randomness-beacons/beacon-20
- NIST interoperability / combination design: NIST IR 8213.
- drand public API and specification: https://docs.drand.love/developer/http-api/ and
  https://docs.drand.love/docs/specification/
- ANU Quantum Numbers: https://quantumnumbers.anu.edu.au/

## 3. Target lattice

For each episode e, after B0 construct up to four targets:

T_AB  = Ext(S1, S2, e)
T_AC  = Ext(S1, S3, e)
T_BC  = Ext(S2, S3, e)
T_ABC = Ext(S1, S2, S3, e)

where Ext is SHA-256 followed by unbiased rejection sampling into K states.

The primary confirmatory target is T_ABC.

The pairwise targets are diagnostic counterfactuals.

Important:
T_AB, T_AC, T_BC are statistically dependent because they share sources.
They must never be treated as independent experimental replications.

## 4. Why the lattice is useful

Suppose an apparent effect exists.

If it appears only in T_AB, then the effect could be source-specific.

If it appears in T_AB and T_AC but not T_BC, S1 becomes a suspect.

If it appears in all pairwise constructions and T_ABC, source-specific explanations
become progressively less adequate.

If it appears only when S3 is included, the post-lock quantum-source arm becomes
the relevant target for a separate causal experiment.

This is source-attribution analysis, not proof of retrocausality.

## 5. Causal timing

B-1:
- source schedules fixed;
- future indices fixed;
- no future values fetched;
- no AQN entropy requested.

B0:
- complete trial manifest frozen;
- prompts generated;
- predictor responses obtained and sealed.

B+1:
- retrieve NIST future pulse;
- retrieve drand future round;
- request AQN random data;
- verify/reconcile source timing;
- construct target lattice.

Hard rule:

    no S1/S2/S3 value may enter the predictor prompt or any process state used
    by the predictor before response lock.

If any source value is observed before B0, the episode is invalid for the
corresponding confirmatory arm.

## 6. Stronger-than-V30 null

The primary null is still

    H0: T independent of R conditional on pre-B0 information.

But V31 adds source-label randomization.

Within predeclared exchangeability blocks, jointly permute:
- target episodes;
- source-lattice labels;
- response vectors;

while preserving the observed nuisance structure.

A global statistic should be defined before data lock. One option is the maximum
standardized advantage across predeclared K values for T_ABC versus SHAM.

No selecting the most favorable source pair after observation.

## 7. Source integrity

NIST:
- verify pulse timestamp;
- verify signature/certificate;
- verify chain linkage;
- record raw response hash.

drand:
- verify chain identifier;
- verify public key / chain info from an independently trusted copy;
- verify BLS signature;
- record round and timing.

AQN:
- record request timestamp;
- record returned payload and hash;
- retain service response metadata;
- use only as an auxiliary source unless a stronger provenance mechanism is
  available.

The protocol must fail closed when authenticity cannot be checked.

## 8. The crucial falsification experiment

For each episode, use two identical response opportunities:

R1 before source exposure;
R2 after source exposure is deliberately impossible by another independent timing
route.

Do not interpret R1/R2 as consciousness measures.

The decisive question is whether the pre-exposure response contains information about
T that survives the same target construction used after exposure.

## 9. Infrastructure topology

I0: local process.

I1: two isolated containers on one host.

I2: separate hosts.

I3: different cloud providers.

I4:
- provider A for predictor;
- provider B for target construction;
- provider C for source retrieval if available;
- independent object stores;
- separate egress.

I5:
- independent laboratory.

The source-retrieval machine must not share credentials, filesystem, process space,
or secret state with the predictor machine.

## 10. Analyst blindness

The predictor operator and source operator should not see:
- arm identity,
- source values,
- target values,
- intermediate scores.

The scoring operator receives immutable artifacts only after the acquisition lock.

## 11. Information-theoretic endpoint

Primary:

    I_res(K) = I(T_ABC ; R | Z, G)

Secondary:

    Delta_K = Accuracy_K - 1/K

    SourceInvariance = min(
        standardized_effect_AB,
        standardized_effect_AC,
        standardized_effect_BC
    )

The proposed source-invariance statistic is a protocol-specific construct, not an
established scientific statistic.

## 12. Temporal asymmetry endpoint

For each K:

    D_K = Advantage_FUTURE(K) - Advantage_PRE(K)

    Q_K = Advantage_TABC(K) - Advantage_SHAM(K)

The confirmatory claim requires the direction to be fixed before acquisition.

## 13. What would be genuinely difficult to explain

The strongest pattern would be:

1. T_ABC > SHAM;
2. T_ABC > PRE;
3. effect survives target permutation;
4. effect survives opaque-code remapping;
5. effect survives K scaling;
6. effect survives source-pair substitution;
7. effect survives provider substitution;
8. effect survives session reset;
9. effect survives I4 replication;
10. an independently operated laboratory obtains the same direction.

Only at that point would an extraordinary anomaly be warranted as a scientific
problem.

## 14. What would NOT establish a discovery

Not sufficient:
- one significant p-value;
- one provider;
- one target source;
- one K;
- one lucky run;
- post-hoc codebook choice;
- a language-model statement;
- a visually meaningful pattern;
- correlation with a timestamp;
- a result that disappears under permutation;
- a result that appears only in a single source pairing.

## 15. Important physical interpretation boundary

Even a verified violation of the null would first imply:

    unexplained residual information / causal structure

It would not immediately imply:
- consciousness;
- a universal mind;
- human-like agency;
- survival of consciousness;
- retrocausality;
- violation of relativity.

Each stronger claim requires its own bridge model and its own falsification test.

## 16. Relation to contemporary evidence

Recent metascientific replication of a prominent precognition paradigm found no stable
effect across its largest follow-up study despite an earlier anomalous result, which
is a strong reason to prioritize multi-stage replication and source controls.

At the same time, NIST and other groups have demonstrated practical public
quantum-randomness infrastructure, and drand provides distributed public randomness
with verifiable signatures. These technologies make stronger causal exclusion
experiments technically more accessible than older RNG-only paradigms.

## 17. Final scientific ambition

The ambition is not to manufacture a positive result.

The ambition is to construct an experiment for which:

    if H0 is true -> the null survives all confirmatory analyses

    if H0 is false -> a source-invariant, representation-invariant,
    temporally asymmetric residual should survive.

A positive result must be allowed to die in at least ten independent ways before
being promoted to a discovery candidate.


## 18. One-honest-source conditional-uniformity lemma

Let U be one 256-bit source value that is conditionally uniform and independent of
the pre-B0 sigma-algebra A and of all other source values V. Define

    X = U XOR f(V, A)

Then, conditional on A and V, X is uniform on {0,1}^256.

If the target index is produced from X by exact rejection sampling into K states,
then

    P(T=j | A,V) = 1/K

for every j.

Therefore, under the ordinary causal model and the one-honest-source assumption,
no pre-B0 response strategy can have conditional hit probability above 1/K merely
because it knows A, provider state, timing, prompts, or the other sources.

This is a standard cryptographic consequence of XOR with an independent uniform
source, not a new theorem.

Its scientific value here is that the null becomes explicit and auditable rather
than being an informal appeal to "randomness."

## 19. Sequential e-process

For independent source blocks, the future-target hit stream can be monitored
without a fixed stopping time.

For trial i let

    p0_i = 1 / K_i

and H_i = 1 when the decoded response equals the target.

For a finite predeclared family of alternatives p_{i,m} > p0_i, define

    e_i = sum_m w_m
          (p_{i,m}/p0_i)^{H_i}
          ((1-p_{i,m})/(1-p0_i))^{1-H_i}

with fixed weights w_m that sum to 1.

Under H0, E[e_i | F_{i-1}] <= 1.

The product

    E_n = product_{i=1}^n e_i

is therefore an e-process under the corresponding conditional null.

Ville's inequality gives an anytime-valid threshold:

    P_H0(sup_n E_n >= 1/alpha) <= alpha.

This permits continuous monitoring without the classical optional-stopping penalty,
provided the trial-level conditional independence assumptions actually hold.

The e-process must not be used when multiple trials share one source block in a way
that violates the conditional null. In that situation, use block-level e-values.

## 20. Why this matters

A conventional experiment may accumulate data, inspect the result, extend the sample,
change the endpoint and unintentionally manufacture significance.

An e-process separates:
- evidence accumulation;
- stopping;
- interpretation.

A predeclared threshold can be crossed at any time while preserving the stated type-I
error guarantee under the model assumptions.

This is especially useful for a long-running Q-UC campaign.

## 21. Scientific consequence

The strongest future result would therefore have two independent layers:

A. a structural result:
   representation-invariant and source-invariant residual information;

B. a sequential evidential result:
   the same signal crosses a predeclared anytime-valid e-value threshold.

The two layers should be reported separately.

An e-value crossing is evidence against the null. It is not evidence for consciousness
or retrocausality by itself.
