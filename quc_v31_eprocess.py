#!/usr/bin/env python3
from __future__ import annotations

import json
import math
import argparse


DEFAULT_LIFTS = (1.05, 1.10, 1.25, 1.50, 2.00, 4.00)
EPS = 1e-15


def one_trial_evalue(k: int, hit: int, lifts=DEFAULT_LIFTS, weights=None) -> float:
    """
    Mixture likelihood ratio for H0: p=1/k versus fixed alternatives
    p_m = min(lift*p0, 1-EPS).

    Validity is conditional on the hit indicator having null probability p0 given
    the past at each independent source block.
    """
    if k < 2:
        raise ValueError("k must be >= 2")
    if hit not in (0, 1):
        raise ValueError("hit must be 0 or 1")
    p0 = 1.0 / k

    if weights is None:
        weights = [1.0 / len(lifts)] * len(lifts)
    if len(weights) != len(lifts):
        raise ValueError("weights/lifts length mismatch")
    if abs(sum(weights) - 1.0) > 1e-12:
        raise ValueError("weights must sum to 1")

    ev = 0.0
    for w, lift in zip(weights, lifts):
        if lift <= 1.0:
            raise ValueError("all alternatives must exceed the null")
        p1 = min(p0 * lift, 1.0 - EPS)
        lr = (p1 / p0) if hit else ((1.0 - p1) / (1.0 - p0))
        ev += w * lr
    return ev


def run(rows):
    e = 1.0
    history = []
    for i, row in enumerate(rows, start=1):
        k = int(row["K"])
        hit = int(
            row.get("valid_response")
            and row.get("response_index") is not None
            and row.get("response_index") == row.get("target_index")
        )
        ei = one_trial_evalue(k, hit)
        e *= ei
        history.append({"i": i, "K": k, "hit": hit, "e_i": ei, "E_i": e})
    return history


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("reveal_json")
    args = ap.parse_args()

    data = json.load(open(args.reveal_json, "r", encoding="utf-8"))
    # Only use FUTURE rows. The caller must ensure that each row corresponds to
    # an independent source block before interpreting the sequential threshold.
    rows = [
        r for r in data["trials"]
        if r["arm"] == "FUTURE" and r.get("future_block_id") is not None
    ]

    hist = run(rows)
    final_e = hist[-1]["E_i"] if hist else 1.0

    report = {
        "protocol": "Q-UC-OMEGA-V31",
        "n_future_rows": len(rows),
        "final_e_value": final_e,
        "anytime_threshold_alpha_1e-3": 1000.0,
        "crossed_alpha_1e-3": any(x["E_i"] >= 1000.0 for x in hist),
        "note": (
            "Do not interpret this threshold unless future_block_id denotes "
            "experimentally independent source blocks and the conditional null "
            "assumptions are documented."
        ),
        "history": hist,
    }

    with open("quc_v31_eprocess.json", "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, sort_keys=True)

    print(json.dumps(report, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
