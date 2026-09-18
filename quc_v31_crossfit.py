#!/usr/bin/env python3
from __future__ import annotations

import collections
import hashlib
import json
import math
import random
from statistics import mean


PROTOCOL = "Q-UC-OMEGA-V31"


def logsum(values):
    m = max(values)
    return m + math.log(sum(math.exp(x - m) for x in values))


def group(rows):
    g = collections.defaultdict(list)
    for r in rows:
        g[(r["arm"], int(r["K"]), r.get("future_block_id", "BLOCK0"), r["episode_id"])].append(r)
    return g


def response_counts(train_rows, k):
    c = [0] * k
    for r in train_rows:
        ri = r.get("response_index")
        if r.get("valid_response") and ri is not None and 0 <= int(ri) < k:
            c[int(ri)] += 1
    return c


def conditional_counts(train_rows, k):
    c = [[0] * k for _ in range(k)]
    for r in train_rows:
        if not r.get("valid_response"):
            continue
        t = r.get("target_index")
        ri = r.get("response_index")
        if t is None or ri is None:
            continue
        t = int(t); ri = int(ri)
        if 0 <= t < k and 0 <= ri < k:
            c[t][ri] += 1
    return c


def smoothed_logprob(count, total, categories, alpha=0.5):
    return math.log((count + alpha) / (total + alpha * categories))


def episode_logloss_advantage(train_rows, test_episode, k):
    """
    Cross-fitted information advantage.

    LL_null = log P(R) estimated on training episodes.
    LL_cond = log P(R|T) estimated on training episodes.

    Advantage = LL_cond - LL_null on held-out responses.
    Positive values mean the target label improves held-out prediction of R.
    """
    rc = response_counts(train_rows, k)
    cc = conditional_counts(train_rows, k)

    total = sum(rc)
    if total == 0:
        return None

    valid = [
        r for r in test_episode
        if r.get("valid_response") and r.get("response_index") is not None
    ]
    if not valid:
        return None

    ll_cond = 0.0
    ll_null = 0.0
    for r in valid:
        t = int(r["target_index"])
        ri = int(r["response_index"])
        ll_cond += smoothed_logprob(cc[t][ri], sum(cc[t]), k)
        ll_null += smoothed_logprob(rc[ri], total, k)

    return (ll_cond - ll_null) / len(valid)


def crossfit(rows, arm, k):
    episodes = [
        e for (a, kk, _b, _eid), e in group(rows).items()
        if a == arm and kk == k
    ]
    if len(episodes) < 3:
        return {"n_episodes": len(episodes), "advantage": None}

    scores = []
    for i, test in enumerate(episodes):
        train = [r for j, e in enumerate(episodes) if j != i for r in e]
        s = episode_logloss_advantage(train, test, k)
        if s is not None:
            scores.append(s)

    return {
        "n_episodes": len(episodes),
        "n_scored_episodes": len(scores),
        "advantage_nats_per_response": mean(scores) if scores else None,
    }


def permuted_crossfit(rows, arm, k, n_perm=20000, seed=20260918):
    """
    Episode-level conditional randomization.

    Target labels are reassigned among whole episodes within each future block.
    Responses, provider, codebook, timing and episode structure remain fixed.
    """
    groups = group(rows)
    episodes = []
    for (a, kk, block, eid), ep in groups.items():
        if a == arm and kk == k:
            episodes.append((block, eid, ep))

    if len(episodes) < 3:
        return {"n_episodes": len(episodes), "n_permutations": 0}

    observed = crossfit(rows, arm, k)["advantage_nats_per_response"]
    if observed is None:
        return {"n_episodes": len(episodes), "n_permutations": 0, "observed": None}

    by_block = collections.defaultdict(list)
    for block, eid, ep in episodes:
        by_block[block].append((eid, ep))

    block_keys = sorted(by_block)
    base_seed = int.from_bytes(hashlib.sha256(f"{PROTOCOL}|{arm}|{k}|perm".encode()).digest()[:8], "big")
    rng = random.Random(seed + base_seed)

    exceed = 0
    completed = 0

    # Preserve target values exactly at the block level.
    for _ in range(n_perm):
        pseudo_rows = [dict(r) for r in rows]
        by_eid = collections.defaultdict(list)
        for r in pseudo_rows:
            by_eid[r["episode_id"]].append(r)

        for block in block_keys:
            eps = by_block[block]
            target_labels = [ep[0]["target_index"] for _eid, ep in eps]
            shuffled = target_labels[:]
            rng.shuffle(shuffled)
            for (_eid, ep), target in zip(eps, shuffled):
                for r in by_eid[_eid]:
                    r["target_index"] = target

        score = crossfit(pseudo_rows, arm, k)["advantage_nats_per_response"]
        if score is None:
            continue
        completed += 1
        if score >= observed:
            exceed += 1

    return {
        "n_episodes": len(episodes),
        "n_permutations": completed,
        "observed": observed,
        "p_upper": (1 + exceed) / (1 + completed),
    }


def global_contrast(rows, k, n_perm=10000, seed=20260918):
    """
    Single predeclared contrast for one K:
      FUTURE cross-fitted advantage - SHAM cross-fitted advantage.

    Cross-fitted scores are episode-level quantities. The two arm sets are
    not treated as independent observations under the final permutation test.
    """
    f = crossfit(rows, "FUTURE", k)["advantage_nats_per_response"]
    s = crossfit(rows, "SHAM", k)["advantage_nats_per_response"]

    return {
        "K": k,
        "future": f,
        "sham": s,
        "contrast_future_minus_sham": (f - s) if f is not None and s is not None else None,
        "n_permutations": n_perm,
        "note": "Use a prespecified global family correction when multiple K values are confirmatory.",
    }


if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("reveal_json")
    args = p.parse_args()

    data = json.load(open(args.reveal_json, "r", encoding="utf-8"))
    rows = data["trials"]

    report = {
        "protocol": PROTOCOL,
        "crossfit": {
            str(k): {
                arm: crossfit(rows, arm, k)
                for arm in ("FUTURE", "PREINSTANTIATED", "SHAM")
            }
            for k in sorted({int(r["K"]) for r in rows})
        },
        "conditional_randomization": {
            str(k): permuted_crossfit(rows, "FUTURE", k)
            for k in sorted({int(r["K"]) for r in rows})
        },
        "future_minus_sham": {
            str(k): global_contrast(rows, k)
            for k in sorted({int(r["K"]) for r in rows})
        },
    }

    with open("quc_v31_crossfit_analysis.json", "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, sort_keys=True)

    print(json.dumps(report, indent=2, sort_keys=True))
