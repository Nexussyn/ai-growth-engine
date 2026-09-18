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


def normalize_hex_256(value: str) -> bytes:
    """
    Normalize an external source value to exactly 256 bits.

    For the one-honest-source argument, no compression hash is applied here:
    the first 256 source bits are XORed directly. If any one source is
    conditionally uniform and independent, XOR with arbitrary other values
    remains uniform.
    """
    v = "".join(str(value).split()).lower()
    if v.startswith("0x"):
        v = v[2:]
    if len(v) < 64:
        raise ValueError("source value must contain at least 256 bits")
    try:
        return bytes.fromhex(v[:64])
    except ValueError as exc:
        raise ValueError("source value is not hexadecimal") from exc


def context_shift(label: str, episode_id: str) -> bytes:
    return hashlib.sha256(
        f"{PROTOCOL}|{label}|{episode_id}".encode()
    ).digest()


def extract_index(parts: dict[str, str], episode_id: str, k: int, label: str) -> int:
    """
    Exact information-theoretic construction under the one-honest-source model.

    XOR is a bijection, so if at least one participating source is conditionally
    uniform and independent, the resulting 256-bit X is conditionally uniform.
    Rejection sampling is then applied directly to X. A second cryptographic hash
    must NOT be inserted before reduction when making an exact-uniformity claim.
    """
    x = 0
    for key in sorted(parts):
        x ^= int.from_bytes(normalize_hex_256(parts[key]), "big")
    x ^= int.from_bytes(context_shift(label, episode_id), "big")
    return unbiased_index(x.to_bytes(32, "big"), k)


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
