#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
from pathlib import Path


PROTOCOL = "Q-UC-OMEGA-V31"


def canonical(obj) -> bytes:
    return json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()


def sha256_bytes(x: bytes) -> str:
    return hashlib.sha256(x).hexdigest()


def unbiased_index(seed: bytes, k: int) -> int:
    if not 2 <= k <= 256:
        raise ValueError("k must be in [2,256]")
    limit = (1 << 256) - ((1 << 256) % k)
    counter = 0
    while True:
        x = int.from_bytes(hashlib.sha256(seed + counter.to_bytes(4, "big")).digest(), "big")
        if x < limit:
            return x % k
        counter += 1


def extract_index(parts: dict[str, str], episode_id: str, k: int, label: str) -> int:
    """
    Deterministically derives a target state from selected external source values.

    No source value is generated here. This function is pure and auditable.
    """
    encoded = [parts[key] for key in sorted(parts)]
    material = (
        f"{PROTOCOL}|{label}|{episode_id}|{k}|"
        + "|".join(encoded)
    ).encode()
    return unbiased_index(hashlib.sha256(material).digest(), k)


def derive_lattice(nist_hex: str, drand_hex: str, aqn_hex: str,
                   episode_id: str, k: int) -> dict[str, int]:
    sources = {
        "NIST": nist_hex,
        "DRAND": drand_hex,
        "AQN": aqn_hex,
    }
    return {
        "AB": extract_index(
            {"NIST": sources["NIST"], "DRAND": sources["DRAND"]},
            episode_id, k, "PAIR-AB"
        ),
        "AC": extract_index(
            {"NIST": sources["NIST"], "AQN": sources["AQN"]},
            episode_id, k, "PAIR-AC"
        ),
        "BC": extract_index(
            {"DRAND": sources["DRAND"], "AQN": sources["AQN"]},
            episode_id, k, "PAIR-BC"
        ),
        "ABC": extract_index(
            sources,
            episode_id, k, "TRIPLE-ABC"
        ),
    }


def source_substitution_matrix(lattice_rows: list[dict]) -> dict:
    """
    Returns a descriptive agreement matrix. The four derived targets are
    correlated by construction, so these are not treated as independent tests.
    """
    keys = ("AB", "AC", "BC", "ABC")
    out = {}
    for a in keys:
        out[a] = {}
        for b in keys:
            xs = [r[a] == r[b] for r in lattice_rows if a in r and b in r]
            out[a][b] = {
                "n": len(xs),
                "agreement": (sum(xs) / len(xs)) if xs else None,
            }
    return out


if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--nist", required=True)
    p.add_argument("--drand", required=True)
    p.add_argument("--aqn", required=True)
    p.add_argument("--episode", required=True)
    p.add_argument("--k", type=int, required=True)
    args = p.parse_args()

    lattice = derive_lattice(args.nist, args.drand, args.aqn, args.episode, args.k)
    print(json.dumps(lattice, sort_keys=True, indent=2))
