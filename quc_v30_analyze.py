#!/usr/bin/env python3
from __future__ import annotations

import collections
import hashlib
import json
import math
import random
import statistics
import sys
from pathlib import Path

DEFAULT_PERMUTATIONS = 100000


def load(path: str):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def wilson(k: int, n: int, z: float = 1.959963984540054) -> tuple[float, float]:
    if n == 0:
        return float("nan"), float("nan")
    p = k / n
    den = 1 + z*z/n
    ctr = p + z*z/(2*n)
    half = z * math.sqrt((p*(1-p) + z*z/(4*n))/n)
    return (ctr-half)/den, (ctr+half)/den


def mi_bits(rows):
    rows = [r for r in rows if r["valid_response"] and r["response_index"] is not None]
    n = len(rows)
    if not n:
        return float("nan")
    ct = collections.Counter(r["target_index"] for r in rows)
    cr = collections.Counter(r["response_index"] for r in rows)
    ctr = collections.Counter((r["target_index"], r["response_index"]) for r in rows)
    mi = 0.0
    for (t, r), c in ctr.items():
        pt_r = c / n
        pt = ct[t] / n
        pr = cr[r] / n
        mi += pt_r * math.log(pt_r/(pt*pr), 2)
    return mi


def group_by_episode(rows):
    g = collections.defaultdict(list)
    for r in rows:
        g[(r["arm"], int(r["K"]), r["episode_id"])].append(r)
    return g


def episode_rows(rows, arm, k):
    groups = group_by_episode(rows)
    return [v for key, v in groups.items() if key[0] == arm and key[1] == k]


def episode_hit_fraction(ep):
    valid = [r for r in ep if r["valid_response"] and r["response_index"] is not None]
    if not valid:
        return None
    t = valid[0]["target_index"]
    return sum(r["response_index"] == t for r in valid) / len(valid)


def conditional_permutation(rows, arm, k, permutations=DEFAULT_PERMUTATIONS, seed=20260918):
    eps = episode_rows(rows, arm, k)
    eps = [e for e in eps if any(r["valid_response"] for r in e)]
    if len(eps) < 2:
        return {"n_episodes": len(eps), "permutations": 0, "p": None, "obs": None}

    obs = statistics.fmean(episode_hit_fraction(e) for e in eps if episode_hit_fraction(e) is not None)

    # Critical: the target is shuffled at the independent episode level, not at
    # token/replicate level. This preserves the repeated-representation design.
    target_values = [e[0]["target_index"] for e in eps]
    stable = int.from_bytes(hashlib.sha256(f"{arm}|{k}".encode()).digest()[:8], "big")
    rng = random.Random(seed + k + stable)
    exceed = 0
    total = 0

    response_vectors = [
        [(r["response_index"], r["valid_response"]) for r in e]
        for e in eps
    ]

    for _ in range(permutations):
        shuffled = target_values[:]
        rng.shuffle(shuffled)
        s = 0.0
        m = 0
        for e_idx, vector in enumerate(response_vectors):
            t = shuffled[e_idx]
            valid = [ri for ri, ok in vector if ok and ri is not None]
            if valid:
                s += sum(ri == t for ri in valid) / len(valid)
                m += 1
        if m:
            stat = s / m
            exceed += stat >= obs
            total += 1

    return {
        "n_episodes": len(eps),
        "permutations": total,
        "obs_episode_mean_hit_rate": obs,
        "p_upper": (1 + exceed) / (1 + total),
    }



def verify_commitments(rows):
    checked = []
    failures = []
    for r in rows:
        payload = {
            "protocol": "Q-UC-OMEGA-V30",
            "trial_id": r["trial_id"],
            "episode_id": r["episode_id"],
            "arm": r["arm"],
            "k": int(r["K"]),
            "codebook_sha256": r.get("codebook_sha256") or hashlib.sha256(
                json.dumps(r.get("labels", []), sort_keys=True, separators=(",", ":")).encode()
            ).hexdigest(),
            "token_order": r.get("labels", []),
            "replicate": int(r["replicate"]),
        }
        expected = hashlib.sha256(
            json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
            + b"|" + r["salt"].encode()
        ).hexdigest()
        ok = expected == r.get("commitment")
        q = dict(r)
        q["commitment_verified"] = ok
        checked.append(q)
        if not ok:
            failures.append(r["trial_id"])
    return checked, failures

def summarize(rows):
    out = []
    for k in sorted({int(r["K"]) for r in rows}):
        by_arm = {a: [r for r in rows if int(r["K"]) == k and r["arm"] == a] for a in ("FUTURE","PREINSTANTIATED","SHAM","LEAK")}
        rec = {"K": k}
        for arm, rr in by_arm.items():
            valid = [r for r in rr if r["valid_response"] and r["response_index"] is not None]
            hits = sum(r["response_index"] == r["target_index"] for r in valid)
            n = len(valid)
            lo, hi = wilson(hits, n) if n else (None, None)
            rec[arm] = {
                "n_valid_trials": n,
                "n_episodes": len({r["episode_id"] for r in valid}),
                "hits": hits,
                "accuracy": hits/n if n else None,
                "chance": 1/k,
                "advantage": hits/n - 1/k if n else None,
                "wilson95": [lo, hi],
                "mi_bits": mi_bits(rr),
            }
        if by_arm["FUTURE"]:
            for arm in ("FUTURE","PREINSTANTIATED","SHAM"):
                if by_arm[arm]:
                    rec[f"conditional_{arm}"] = conditional_permutation(rows, arm, k)
        if by_arm["FUTURE"] and by_arm["SHAM"]:
            a = [episode_hit_fraction(e) for e in episode_rows(rows,"FUTURE",k)]
            b = [episode_hit_fraction(e) for e in episode_rows(rows,"SHAM",k)]
            a = [x for x in a if x is not None]; b = [x for x in b if x is not None]
            rec["episode_contrast_F_MINUS_S"] = (statistics.fmean(a)-statistics.fmean(b)) if a and b else None
        if by_arm["FUTURE"] and by_arm["PREINSTANTIATED"]:
            a = [episode_hit_fraction(e) for e in episode_rows(rows,"FUTURE",k)]
            b = [episode_hit_fraction(e) for e in episode_rows(rows,"PREINSTANTIATED",k)]
            a = [x for x in a if x is not None]; b = [x for x in b if x is not None]
            rec["episode_contrast_F_MINUS_P"] = (statistics.fmean(a)-statistics.fmean(b)) if a and b else None
        out.append(rec)
    return out


def gate(results):
    required_arms = {"FUTURE", "PREINSTANTIATED", "SHAM"}
    observed = {r["arm"] for r in results if r["valid_response"]}
    gates = {
        "required_arms_present": required_arms.issubset(observed),
        "leak_calibration_present": "LEAK" in observed,
        "note": "LEAK is a technical calibration and is intentionally required before an anomaly claim.",
    }
    gates["anomaly_branch_open"] = False
    # This script never converts a statistical result into an ontological claim.
    return gates


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else "quc_v30_reveal.json"
    data = load(path)
    rows = data["trials"]
    rows, commitment_failures = verify_commitments(rows)
    rows = [r for r in rows if r["commitment_verified"]]
    result = {
        "protocol": data.get("protocol"),
        "commitment_failures": commitment_failures,
        "source_value_sha256": {
            "nist": data.get("source_values", {}).get("nist", {}).get("raw_sha256") if data.get("source_values") else None,
            "drand": data.get("source_values", {}).get("drand", {}).get("raw_sha256") if data.get("source_values") else None,
        },
        "summary": summarize(rows),
        "gates": gate(rows),
    }
    out = Path("quc_v30_analysis.json")
    out.write_text(json.dumps(result, indent=2, sort_keys=True), encoding="utf-8")
    print(json.dumps(result, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
