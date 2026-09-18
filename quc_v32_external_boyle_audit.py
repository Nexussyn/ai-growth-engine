#!/usr/bin/env python3
"""
Q-UC Ω V32 external benchmark:
independent re-analysis of the 100 published ChatGPT-4.1-mini trials
reported by Amorim Boyle (2025).

Source:
  Benjamin J. Amorim Boyle, Journal of Scientific Exploration 39(3),
  348-355, DOI 10.31275/20253739.
  The full 100-trial response/target table is in Appendix Table 1.

This script is deliberately an audit, not a replication. It does not claim
that the external dataset proves or disproves precognition.

Primary audit questions:
  1. Does the raw 32/100 hit result survive conditioning on response margins?
  2. Is the reported response sequence itself statistically ordinary?
  3. Does current target information improve held-out prediction of the response
     after conditioning on variables the model already knew from earlier trials?
"""

from __future__ import annotations
import collections
import math
import random
from statistics import mean, pstdev

# (trial, model_choice, target)
DATA = [
(1,3,5),(2,2,2),(3,4,4),(4,1,1),(5,4,3),(6,5,4),(7,3,1),(8,2,2),
(9,3,3),(10,1,3),(11,5,5),(12,2,5),(13,3,3),(14,1,2),(15,4,4),(16,2,2),
(17,5,5),(18,3,2),(19,4,3),(20,1,4),(21,5,1),(22,2,1),(23,3,1),(24,4,5),
(25,2,5),(26,1,2),(27,4,5),(28,3,5),(29,2,1),(30,4,4),(31,3,4),(32,1,3),
(33,5,5),(34,2,5),(35,4,2),(36,3,3),(37,1,4),(38,5,2),(39,3,3),(40,1,3),
(41,4,2),(42,5,5),(43,3,3),(44,1,5),(45,2,4),(46,3,4),(47,5,5),(48,2,5),
(49,1,2),(50,4,2),(51,3,3),(52,1,3),(53,3,2),(54,3,2),(55,4,2),(56,1,5),
(57,3,4),(58,2,2),(59,5,5),(60,1,2),(61,3,2),(62,4,2),(63,5,5),(64,3,3),
(65,1,5),(66,2,1),(67,4,3),(68,5,2),(69,1,5),(70,3,5),(71,2,5),(72,1,4),
(73,3,4),(74,5,1),(75,2,5),(76,4,3),(77,1,2),(78,5,3),(79,4,2),(80,1,4),
(81,3,3),(82,2,1),(83,5,5),(84,3,5),(85,4,4),(86,1,1),(87,2,2),(88,4,3),
(89,5,3),(90,1,1),(91,2,4),(92,3,3),(93,5,3),(94,1,4),(95,2,1),(96,3,3),
(97,5,4),(98,1,3),(99,2,2),(100,4,4)
]

SEL=[x[1] for x in DATA]
TAR=[x[2] for x in DATA]
N=len(DATA)


def binom_upper(k,n,p):
    return sum(math.comb(n,i)*p**i*(1-p)**(n-i) for i in range(k,n+1))


def mi(a,b):
    n=len(a)
    ca=collections.Counter(a); cb=collections.Counter(b)
    cab=collections.Counter(zip(a,b))
    return sum(
        (c/n)*math.log2((c/n)/((ca[x]/n)*(cb[y]/n)))
        for (x,y),c in cab.items()
    )


def fixed_margin_hit_permutation(B=200_000, seed=20260918):
    """
    Preserve the complete empirical response multiset and the fixed target
    sequence. This controls static response frequencies.
    """
    rng=random.Random(seed)
    obs=sum(x==y for x,y in zip(SEL,TAR))
    ge=0
    mis=[]
    for _ in range(B):
        p=SEL[:]
        rng.shuffle(p)
        h=sum(x==y for x,y in zip(p,TAR))
        if h>=obs:
            ge+=1
        if len(mis)<1000:
            mis.append(mi(TAR,p))
    return {
        "observed_hits":obs,
        "permutations":B,
        "p_upper":(ge+1)/(B+1),
        "mi_observed":mi(TAR,SEL),
        "p_mi_upper":sum(x>=mi(TAR,SEL) for x in mis)/len(mis),
    }


def exact_previous_target_avoidance():
    """
    Exact probability that a uniformly random permutation with the observed
    response margins has R_i != T_{i-1} for all i=2..N.
    Dynamic programming over remaining category counts.
    """
    target_counts=[collections.Counter(TAR)[i] for i in range(1,6)]
    response_counts=[collections.Counter(SEL)[i] for i in range(1,6)]

    # position is implicit in the sum of used counts
    from functools import lru_cache
    @lru_cache(None)
    def f(c1,c2,c3,c4,c5):
        used=(c1,c2,c3,c4,c5)
        pos=sum(used)
        if pos==N:
            return 1
        forbidden=TAR[pos-1] if pos>=1 else None
        total=0
        for j in range(5):
            if used[j] < response_counts[j] and (j+1)!=forbidden:
                nu=list(used); nu[j]+=1
                total += f(*nu)
        return total

    num=f(0,0,0,0,0)
    den=math.factorial(N)
    for c in response_counts:
        den//=math.factorial(c)
    return num/den


def markov_feedback_null(n_boot=200_000, alpha=0.5, seed=20260918):
    """
    Exploratory parametric null.

    Fit P(R_i | R_{i-1}, T_{i-1}) with Jeffreys smoothing to the same dataset,
    hold the published target sequence fixed, then calculate the exact hit-count
    distribution of the resulting Markov chain.

    Because parameters are estimated from the same data, this is diagnostic,
    NOT a confirmatory p-value.
    """
    trans=collections.defaultdict(collections.Counter)
    for i in range(1,N):
        trans[(SEL[i-1],TAR[i-1])][SEL[i]] += 1

    probs={}
    for pr in range(1,6):
        for pt in range(1,6):
            row=[trans[(pr,pt)][cr]+alpha for cr in range(1,6)]
            z=sum(row)
            probs[(pr,pt)]=[x/z for x in row]

    # Exact distribution of hit count for the fitted Markov null.
    dp={(SEL[0], int(SEL[0]==TAR[0])):1.0}
    for i in range(1,N):
        nd=collections.defaultdict(float)
        pt=TAR[i-1]
        for (pr,h),p0 in dp.items():
            for cr in range(1,6):
                p=probs[(pr,pt)][cr-1]
                nd[(cr,h+int(cr==TAR[i]))]+=p0*p
        dp=nd

    tail=sum(p for (_r,h),p in dp.items() if h>=32)
    ev=sum(h*p for (_r,h),p in dp.items())
    return {"tail_P_ge_32":tail,"expected_hits":ev}


def crossfit_current_target_info(fold_size=10, alpha=0.5):
    """
    10-block cross-fitting.

    Null model:
        P(R_i | R_{i-1}, T_{i-1})

    Alternative:
        P(R_i | R_{i-1}, T_{i-1}, T_i)

    T_i is unavailable to the predictor and is used only by the analyst as the
    candidate future-information variable.

    A positive held-out log-likelihood advantage of the alternative would be
    evidence that the current target carries predictive information about the
    current response beyond the history available before that response.

    This is an exploratory finite-sample diagnostic; no significance claim is
    made from the score alone.
    """
    idx=list(range(1,N))
    blocks=[idx[i:i+fold_size] for i in range(0,len(idx),fold_size)]
    diffs=[]

    for test in blocks:
        train=[i for i in idx if i not in test]
        dn=collections.defaultdict(collections.Counter)
        da=collections.defaultdict(collections.Counter)

        for i in train:
            dn[(SEL[i-1],TAR[i-1])][SEL[i]]+=1
            da[(SEL[i-1],TAR[i-1],TAR[i])][SEL[i]]+=1

        d=0.0
        for i in test:
            cn=dn[(SEL[i-1],TAR[i-1])]
            ca=da[(SEL[i-1],TAR[i-1],TAR[i])]
            pn=(cn[SEL[i]]+alpha)/(sum(cn.values())+5*alpha)
            pa=(ca[SEL[i]]+alpha)/(sum(ca.values())+5*alpha)
            d += math.log(pa)-math.log(pn)
        diffs.append(d)

    return {
        "folds":len(diffs),
        "fold_loglik_differences":diffs,
        "mean_loglik_difference_per_transition":sum(diffs)/(N-1),
        "positive_folds":sum(x>0 for x in diffs),
    }


def main():
    result={
        "source_note":"Amorim Boyle 2025, JSE 39(3):348-355, DOI 10.31275/20253739",
        "n":N,
        "hits":sum(a==b for a,b in zip(SEL,TAR)),
        "raw_accuracy":sum(a==b for a,b in zip(SEL,TAR))/N,
        "binomial_p_one_sided":binom_upper(32,N,0.2),
        "response_counts":dict(collections.Counter(SEL)),
        "target_counts":dict(collections.Counter(TAR)),
        "response_adjacent_repeats":sum(SEL[i]==SEL[i-1] for i in range(1,N)),
        "previous_target_matches":sum(SEL[i]==TAR[i-1] for i in range(1,N)),
        "previous_target_avoidance_exact_fixed_margins":exact_previous_target_avoidance(),
        "response_target_mi_bits":mi(TAR,SEL),
        "fixed_margin_permutation":fixed_margin_hit_permutation(),
        "feedback_markov_null":markov_feedback_null(),
        "crossfit_current_target_information":crossfit_current_target_info(),
        "interpretation":"Exploratory external-data audit. The absence of held-out current-target information would weaken the claim that raw hits demonstrate target access; it does not prove impossibility.",
    }
    print(json.dumps(result,indent=2,sort_keys=True))


if __name__=="__main__":
    import json
    main()
