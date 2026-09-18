#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import math
import sys
from pathlib import Path
from datetime import datetime

PROTOCOL = "Q-UC-OMEGA-V30"


def canonical(obj):
    return json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()


def sha256_bytes(x):
    return hashlib.sha256(x).hexdigest()


def sha256_obj(obj):
    return sha256_bytes(canonical(obj))


def unbiased_index(seed: bytes, k: int) -> int:
    limit = (1 << 256) - ((1 << 256) % k)
    counter = 0
    while True:
        x = int.from_bytes(
            hashlib.sha256(seed + counter.to_bytes(4, "big")).digest(), "big"
        )
        if x < limit:
            return x % k
        counter += 1


def derive_future_index(nist_hex, drand_hex, episode_id, k):
    material = (
        f"{PROTOCOL}|FUTURE|{episode_id}|{nist_hex}|{drand_hex}|"
        "representation-invariant-v1"
    ).encode()
    return unbiased_index(hashlib.sha256(material).digest(), k)


def verify_pre_manifest(pre):
    core = {k: v for k, v in pre.items()
            if k not in ("manifest_sha256", "written_before_B0_at", "write_pid")}
    return sha256_obj(core) == pre.get("manifest_sha256")


def verify_source_timing(pre, reveal):
    b0 = datetime.fromisoformat(
        next(r["b0"] for r in reveal["trials"] if r.get("b0"))
    )
    nist_ms = int(pre["future_source_schedule"]["nist_pulse_ms"])
    nist_future = datetime.fromtimestamp(nist_ms / 1000.0, tz=b0.tzinfo)
    source_retrieval = reveal.get("source_values", {})
    times = []
    for key in ("nist", "drand"):
        t = source_retrieval.get(key, {}).get("retrieved_at")
        if t:
            times.append((key, datetime.fromisoformat(t)))
    return {
        "nist_schedule_after_b0": nist_future > b0,
        "source_retrievals_after_b0": all(t > b0 for _, t in times),
        "retrieval_times": {k: t.isoformat() for k, t in times},
        "b0": b0.isoformat(),
        "nist_scheduled": nist_future.isoformat(),
    }


def main():
    pre_path = sys.argv[1] if len(sys.argv) > 1 else "quc_v30_pre_b0.json"
    reveal_path = sys.argv[2] if len(sys.argv) > 2 else "quc_v30_reveal.json"
    pre = json.loads(Path(pre_path).read_text(encoding="utf-8"))
    reveal = json.loads(Path(reveal_path).read_text(encoding="utf-8"))

    failures = []

    if pre.get("protocol") != PROTOCOL or reveal.get("protocol") != PROTOCOL:
        failures.append("protocol_mismatch")

    manifest_ok = verify_pre_manifest(pre)
    if not manifest_ok:
        failures.append("pre_manifest_hash_mismatch")

    trial_manifest = {
        x["trial_id"]: x for x in pre["trial_commitments"]
    }

    nist = reveal.get("source_values", {}).get("nist", {}).get("randomness")
    drand = reveal.get("source_values", {}).get("drand", {}).get("randomness")
    if not nist or not drand:
        failures.append("missing_future_source_value")

    checked = 0
    for r in reveal["trials"]:
        checked += 1
        p = trial_manifest.get(r["trial_id"])
        if not p:
            failures.append(f"unknown_trial:{r['trial_id']}")
            continue

        labels_sha = sha256_obj(r["labels"])
        if labels_sha != p["codebook_sha256"]:
            failures.append(f"codebook_hash:{r['trial_id']}")

        payload = {
            "protocol": PROTOCOL,
            "trial_id": r["trial_id"],
            "episode_id": r["episode_id"],
            "arm": r["arm"],
            "k": int(r["K"]),
            "codebook_sha256": labels_sha,
            "token_order": r["labels"],
            "replicate": int(r["replicate"]),
            "pre_target_seed_sha256": r.get("pre_target_seed_sha256"),
        }
        payload_hash = sha256_obj(payload)
        if payload_hash != p["commitment_payload_sha256"]:
            failures.append(f"payload_hash:{r['trial_id']}")

        expected_commit = sha256_bytes(
            canonical(payload) + b"|" + r["salt"].encode()
        )
        if expected_commit != r["commitment"] or expected_commit != p["commitment"]:
            failures.append(f"commitment:{r['trial_id']}")

        if r["arm"] == "PREINSTANTIATED":
            seed_hash = r.get("pre_target_seed_sha256")
            if not seed_hash:
                failures.append(f"missing_pre_seed:{r['trial_id']}")
            else:
                expected = unbiased_index(bytes.fromhex(seed_hash), int(r["K"]))
                if expected != int(r["target_index"]):
                    failures.append(f"pre_target_mismatch:{r['trial_id']}")

        if r["arm"] == "FUTURE" and nist and drand:
            expected = derive_future_index(
                nist, drand, r["episode_id"], int(r["K"])
            )
            if expected != int(r["target_index"]):
                failures.append(f"future_target_mismatch:{r['trial_id']}")

        if r["response_index"] is not None:
            if not (0 <= int(r["response_index"]) < int(r["K"])):
                failures.append(f"response_index_range:{r['trial_id']}")
        if len(r["labels"]) != int(r["K"]) or len(set(r["labels"])) != int(r["K"]):
            failures.append(f"codebook_cardinality:{r['trial_id']}")

    timing = verify_source_timing(pre, reveal)

    report = {
        "protocol": PROTOCOL,
        "pre_manifest_ok": manifest_ok,
        "trials_checked": checked,
        "timing": timing,
        "failure_count": len(failures),
        "failures": failures,
        "technical_gate_pass": len(failures) == 0 and manifest_ok,
    }

    Path("quc_v30_verification.json").write_text(
        json.dumps(report, indent=2, sort_keys=True), encoding="utf-8"
    )
    print(json.dumps(report, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
