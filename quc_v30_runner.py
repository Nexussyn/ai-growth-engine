#!/usr/bin/env python3
from __future__ import annotations

"""
Q-UC Ω V30 runner.

Purpose:
  Execute a protocol in which the predictor is locked before the FUTURE target
  exists on the experiment host. The implementation deliberately separates:
    public manifest / prompt evidence
    reveal-only target evidence

This file does not claim secure secret storage. For a production I4 study,
reveal storage must be moved to an independently controlled vault/store.
"""

import hashlib
import json
import math
import os
import re
import secrets
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

PROTOCOL = "Q-UC-OMEGA-V30"
K_LEVELS = tuple(int(x) for x in os.getenv("QUC30_K_LEVELS", "2,4,8,16,32,64").split(","))
EPISODES_PER_K = int(os.getenv("QUC30_EPISODES_PER_K", "8"))
REPLICATES = int(os.getenv("QUC30_REPLICATES", "4"))
TIMEOUT = int(os.getenv("QUC30_TIMEOUT", "20"))
MAX_WORKERS = int(os.getenv("QUC30_WORKERS", "8"))
POLL_SECONDS = float(os.getenv("QUC30_POLL_SECONDS", "2"))
POLL_MAX_SECONDS = int(os.getenv("QUC30_POLL_MAX_SECONDS", "900"))
MIN_FUTURE_LEAD_SECONDS = int(os.getenv("QUC30_MIN_FUTURE_LEAD_SECONDS", "120"))
MIN_DRAND_FUTURE_GAP = int(os.getenv("QUC30_MIN_DRAND_FUTURE_GAP", "10"))
PRE_B0_PATH = os.getenv("QUC30_PRE_B0_PATH", "quc_v30_pre_b0.json")

AGENTS = {
    "vda_openai": "https://llm-orchestration-agent-openai.getvda.ai/a2a/",
    "vda_langchain_openai": "https://llm-orchestration-agent-langchain-openai.getvda.ai/a2a/",
    "vda_langchain_anthropic": "https://llm-orchestration-agent-langchain-anthropic.getvda.ai/a2a/",
    "berrergate": "https://api.berrergate.com/a2a/v1",
}

# Future source references are intentionally explicit. The process must not
# fetch these values before B0.
NIST_PULSE_MS = int(os.getenv("QUC30_NIST_PULSE_MS", "0"))
DRAND_ROUND = int(os.getenv("QUC30_DRAND_ROUND", "0"))
DRAND_URL = os.getenv("QUC30_DRAND_URL", "https://api.drand.sh/public")
NIST_BASE = os.getenv("QUC30_NIST_BASE", "https://beacon.nist.gov/beacon/2.0/pulse/time")

PUBLIC_PATH = os.getenv("QUC30_PUBLIC_PATH", "quc_v30_public.json")
REVEAL_PATH = os.getenv("QUC30_REVEAL_PATH", "quc_v30_reveal.json")

TOKEN_RE = re.compile(r"^[a-z2-7]{8,32}$")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def sha256_bytes(x: bytes) -> str:
    return hashlib.sha256(x).hexdigest()


def canonical(obj) -> bytes:
    return json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()


def sha256_obj(obj) -> str:
    return sha256_bytes(canonical(obj))


def random_token() -> str:
    # Lowercase base32-like alphabet, intentionally non-semantic.
    alphabet = "abcdefghijklmnopqrstuvwxyz234567"
    return "".join(secrets.choice(alphabet) for _ in range(12))


def make_codebook(k: int):
    labels = []
    while len(labels) < k:
        t = random_token()
        if t not in labels:
            labels.append(t)
    secrets.SystemRandom().shuffle(labels)
    return labels


def unbiased_index(seed: bytes, k: int) -> int:
    """Uniform mapping from 256-bit digest to [0,k), using rejection sampling."""
    if not 2 <= k <= 256:
        raise ValueError("k must be in [2,256]")
    limit = (1 << 256) - ((1 << 256) % k)
    counter = 0
    while True:
        h = hashlib.sha256(seed + counter.to_bytes(4, "big")).digest()
        x = int.from_bytes(h, "big")
        if x < limit:
            return x % k
        counter += 1


def derive_future_index(source_a_hex: str, source_b_hex: str, episode_id: str, k: int) -> int:
    material = (
        f"{PROTOCOL}|FUTURE|{episode_id}|{source_a_hex}|{source_b_hex}|"
        "representation-invariant-v1"
    ).encode()
    return unbiased_index(hashlib.sha256(material).digest(), k)


def discover(url: str):
    from urllib.parse import urlsplit

    u = urlsplit(url)
    card_url = f"{u.scheme}://{u.netloc}/.well-known/agent-card.json"
    req = Request(card_url, headers={"Accept": "application/json", "User-Agent": PROTOCOL})
    try:
        with urlopen(req, timeout=TIMEOUT) as r:
            raw = r.read()
            card = json.loads(raw.decode("utf-8"))
        return {
            "ok": True,
            "status": getattr(r, "status", 200),
            "card_url": card_url,
            "card_sha256": sha256_bytes(raw),
            "name": card.get("name"),
            "provider": card.get("provider"),
            "protocol_version": card.get("protocolVersion"),
            "skills": card.get("skills"),
        }
    except Exception as e:
        return {"ok": False, "card_url": card_url, "error": f"{type(e).__name__}:{e}"}


def post_agent(endpoint: str, prompt: str, context_id: str):
    body = {
        "jsonrpc": "2.0",
        "id": secrets.randbelow(2**31),
        "method": "message/send",
        "params": {
            "message": {
                "messageId": "quc30-" + secrets.token_hex(12),
                "contextId": context_id,
                "role": "user",
                "parts": [{"text": prompt}],
            }
        },
    }
    raw_body = canonical(body)
    req = Request(
        endpoint,
        data=raw_body,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": PROTOCOL,
        },
    )
    t0 = time.monotonic_ns()
    status = None
    raw = b""
    error = None
    try:
        with urlopen(req, timeout=TIMEOUT) as r:
            raw = r.read()
            status = getattr(r, "status", 200)
    except HTTPError as e:
        raw = e.read()
        status = e.code
        error = f"HTTPError:{e}"
    except (URLError, TimeoutError, OSError) as e:
        error = f"{type(e).__name__}:{e}"
    elapsed = time.monotonic_ns() - t0
    text = raw.decode("utf-8", "replace").strip()

    # Only accept a complete exact token. No substring extraction.
    response_token = text if TOKEN_RE.fullmatch(text) else None
    return {
        "http_status": status,
        "transport_error": error,
        "elapsed_ns": elapsed,
        "response_bytes": len(raw),
        "response_sha256": sha256_bytes(raw),
        "response_text_exact": response_token,
        "request_sha256": sha256_bytes(raw_body),
        "request_bytes": len(raw_body),
    }


def fetch_json(url: str):
    req = Request(url, headers={"Accept": "application/json", "User-Agent": PROTOCOL})
    with urlopen(req, timeout=TIMEOUT) as r:
        raw = r.read()
        return getattr(r, "status", 200), raw, json.loads(raw.decode("utf-8"))


def fetch_future_sources(nist_ms: int, drand_round: int):
    nist_url = f"{NIST_BASE}/{nist_ms}"
    drand_url = f"{DRAND_URL}/{drand_round}"

    s1, raw1, nist = fetch_json(nist_url)
    s2, raw2, drand = fetch_json(drand_url)

    # We record the raw source documents and presence of source authenticity
    # fields. Cryptographic signature verification belongs to the source-specific
    # verification layer and must be marked explicitly rather than assumed.
    nist_rand = nist.get("pulse", {}).get("outputValue")
    if not nist_rand:
        nist_rand = nist.get("outputValue") or nist.get("randomness")
    drand_rand = drand.get("randomness")

    if not nist_rand or not drand_rand:
        raise RuntimeError("future source response missing usable randomness")

    return {
        "nist": {
            "url": nist_url,
            "http_status": s1,
            "raw_sha256": sha256_bytes(raw1),
            "randomness": nist_rand,
            "signature_present": bool(nist.get("signature") or nist.get("pulse", {}).get("signature")),
            "retrieved_at": now_iso(),
        },
        "drand": {
            "url": drand_url,
            "http_status": s2,
            "raw_sha256": sha256_bytes(raw2),
            "randomness": drand_rand,
            "signature_present": bool(drand.get("signature")),
            "retrieved_at": now_iso(),
        },
    }


def wait_and_fetch_future(nist_ms: int, drand_round: int):
    deadline = time.monotonic() + POLL_MAX_SECONDS
    last_error = None
    while time.monotonic() < deadline:
        try:
            return fetch_future_sources(nist_ms, drand_round)
        except Exception as e:
            last_error = f"{type(e).__name__}:{e}"
            time.sleep(POLL_SECONDS)
    raise RuntimeError(f"future sources unavailable before timeout: {last_error}")


def probe_drand_latest():
    status, raw, obj = fetch_json(f"{DRAND_URL}/latest")
    round_id = int(obj["round"])
    return {
        "url": f"{DRAND_URL}/latest",
        "http_status": status,
        "raw_sha256": sha256_bytes(raw),
        "round": round_id,
        "retrieved_at": now_iso(),
    }


def build_prompt(trial_id: str, labels: list[str], commitment: str) -> str:
    options = " ".join(labels)
    return (
        f"reference={commitment}\n"
        f"id={trial_id}\n"
        f"Choose exactly one item from this candidate set and return only that item:\n"
        f"{options}\n"
        "Do not return explanations, punctuation, quotes, numbering, markdown, or additional text."
    )


def validate_future_schedule():
    if NIST_PULSE_MS <= 0 or DRAND_ROUND <= 0:
        raise RuntimeError("FUTURE arm requires QUC30_NIST_PULSE_MS and QUC30_DRAND_ROUND")
    now_ms = int(time.time() * 1000)
    lead_ms = NIST_PULSE_MS - now_ms
    if lead_ms < MIN_FUTURE_LEAD_SECONDS * 1000:
        raise RuntimeError(
            f"NIST future pulse must be at least {MIN_FUTURE_LEAD_SECONDS}s ahead; "
            f"only {lead_ms/1000:.1f}s remain"
        )
    # drand round ordering is checked against a current round only after B0.
    return {
        "nist_pulse_ms": NIST_PULSE_MS,
        "drand_round": DRAND_ROUND,
        "checked_at": now_iso(),
    }


def create_plan():
    validate_future_schedule()

    drand_anchor = probe_drand_latest()
    if DRAND_ROUND <= drand_anchor["round"] + MIN_DRAND_FUTURE_GAP:
        raise RuntimeError(
            f"drand round {DRAND_ROUND} is not sufficiently ahead of pre-B0 round "
            f"{drand_anchor['round']}"
        )

    agents = list(AGENTS.items())
    plan = {
        "protocol": PROTOCOL,
        "created_at": now_iso(),
        "K_levels": list(K_LEVELS),
        "episodes_per_K": EPISODES_PER_K,
        "replicates": REPLICATES,
        "future_source_schedule": {
            "nist_pulse_ms": NIST_PULSE_MS,
            "drand_round": DRAND_ROUND,
            "nist_base": NIST_BASE,
            "drand_url": DRAND_URL,
            "drand_pre_b0_anchor": drand_anchor,
        },
        "trials": [],
    }
    reveal = {"protocol": PROTOCOL, "source_values": None, "trials": []}

    for k in K_LEVELS:
        for e in range(EPISODES_PER_K):
            episode_id = f"ep-{secrets.token_hex(10)}"
            arm = secrets.choice(["FUTURE", "PREINSTANTIATED", "SHAM"])
            if arm == "PREINSTANTIATED":
                # Deliberately created before B0.
                local_seed = secrets.token_bytes(32)
                target_seed = hashlib.sha256(
                    f"{PROTOCOL}|PRE|{episode_id}|".encode() + local_seed
                ).digest()
            elif arm == "SHAM":
                target_seed = None  # created after B0
            else:
                target_seed = None  # created after B0 from future sources

            for rep in range(REPLICATES):
                trial_id = "t-" + secrets.token_hex(12)
                labels = make_codebook(k)
                codebook_sha = sha256_obj(labels)
                commitment_payload = {
                    "protocol": PROTOCOL,
                    "trial_id": trial_id,
                    "episode_id": episode_id,
                    "arm": arm,
                    "k": k,
                    "codebook_sha256": codebook_sha,
                    "token_order": labels,
                    "replicate": rep,
                    "pre_target_seed_sha256": (
                        sha256_bytes(target_seed) if target_seed is not None else None
                    ),
                }
                salt = secrets.token_hex(32)
                commitment = sha256_bytes(
                    canonical(commitment_payload) + b"|" + salt.encode()
                )
                agent_name, endpoint = agents[(len(plan["trials"]) % len(agents))]
                plan["trials"].append({
                    "trial_id": trial_id,
                    "episode_id": episode_id,
                    "replicate": rep,
                    "arm": arm,
                    "K": k,
                    "labels": labels,
                    "codebook_sha256": codebook_sha,
                    "commitment": commitment,
                    "salt": salt,
                    "agent": agent_name,
                    "endpoint": endpoint,
                    "target_seed_prelock_sha256": sha256_bytes(target_seed) if target_seed else None,
                    "commitment_payload_sha256": sha256_obj(commitment_payload),
                    "prompt": None,
                })
    return plan, reveal


def run_predictor_phase(plan, reveal):
    # B0: from this point onward, no FUTURE target is instantiated/fetched.
    b0 = now_iso()
    plan["B0"] = b0
    plan["B0_wall_ns"] = time.time_ns()
    plan["B0_plan_sha256"] = sha256_obj({
        "protocol": plan["protocol"],
        "K_levels": plan["K_levels"],
        "episodes_per_K": plan["episodes_per_K"],
        "replicates": plan["replicates"],
        "future_source_schedule": plan["future_source_schedule"],
        "trial_commitments": [x["commitment"] for x in plan["trials"]],
    })

    # Public prompt phase.
    def task(tr):
        prompt = build_prompt(tr["trial_id"], tr["labels"], tr["commitment"])
        result = post_agent(tr["endpoint"], prompt, tr["trial_id"])
        return tr, prompt, result

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
        futures = [ex.submit(task, tr) for tr in plan["trials"]]
        for fut in as_completed(futures):
            tr, prompt, result = fut.result()
            tr["prompt"] = prompt
            tr["prompt_sha256"] = sha256_bytes(prompt.encode())
            tr["response"] = result

    # Only now may post-lock targets be instantiated/fetched.
    postlock_local = {}
    for tr in plan["trials"]:
        episode = tr["episode_id"]
        if tr["arm"] == "SHAM" and episode not in postlock_local:
            postlock_local[episode] = secrets.token_bytes(32)

    future_sources = wait_and_fetch_future(NIST_PULSE_MS, DRAND_ROUND)
    reveal["source_values"] = future_sources

    for tr in plan["trials"]:
        response_token = tr["response"]["response_text_exact"]
        labels = tr["labels"]
        response_index = labels.index(response_token) if response_token in labels else None

        if tr["arm"] == "FUTURE":
            target_index = derive_future_index(
                future_sources["nist"]["randomness"],
                future_sources["drand"]["randomness"],
                tr["episode_id"],
                tr["K"],
            )
        elif tr["arm"] == "PREINSTANTIATED":
            seed_hash = tr["target_seed_prelock_sha256"]
            target_index = unbiased_index(bytes.fromhex(seed_hash), tr["K"])
        else:
            seed = hashlib.sha256(
                f"{PROTOCOL}|SHAM|{tr['episode_id']}|".encode()
                + postlock_local[tr["episode_id"]]
            ).digest()
            target_index = unbiased_index(seed, tr["K"])

        reveal["trials"].append({
            "trial_id": tr["trial_id"],
            "episode_id": tr["episode_id"],
            "replicate": tr["replicate"],
            "arm": tr["arm"],
            "K": tr["K"],
            "agent": tr["agent"],
            "labels": tr["labels"],
            "target_index": target_index,
            "response_token": response_token,
            "response_index": response_index,
            "commitment": tr["commitment"],
            "salt": tr["salt"],
            "pre_target_seed_sha256": tr["target_seed_prelock_sha256"],
            "prompt_sha256": tr["prompt_sha256"],
            "response_sha256": tr["response"]["response_sha256"],
            "valid_response": response_index is not None,
            "b0": b0,
        })

    return plan, reveal


def sanitize_public(plan):
    out = json.loads(json.dumps(plan))
    for tr in out["trials"]:
        # Keep evidence needed for audit but remove all target material.
        tr.pop("labels", None)
        tr.pop("salt", None)
        tr.pop("target_seed_prelock_sha256", None)
        tr.pop("response", None)
        tr.pop("prompt", None)
    return out


def main():
    if not K_LEVELS:
        raise RuntimeError("empty K_LEVELS")
    plan, reveal = create_plan()

    # Discover agents before the predictor phase.
    plan["discovery"] = {name: discover(url) for name, url in AGENTS.items()}

    # Freeze and durably write the pre-B0 manifest before any predictor call.
    # This is still not an external timestamp proof; an I4 campaign must
    # additionally publish the hash to an independently controlled timestamp
    # or immutable public log before B0.
    public_pre_core = {
        "protocol": PROTOCOL,
        "created_at": plan["created_at"],
        "future_source_schedule": plan["future_source_schedule"],
        "K_levels": plan["K_levels"],
        "episodes_per_K": plan["episodes_per_K"],
        "replicates": plan["replicates"],
        "trial_commitments": [
            {
                "trial_id": x["trial_id"],
                "episode_id": x["episode_id"],
                "replicate": x["replicate"],
                "arm": x["arm"],
                "K": x["K"],
                "codebook_sha256": x["codebook_sha256"],
                "commitment_payload_sha256": x["commitment_payload_sha256"],
                "commitment": x["commitment"],
            }
            for x in plan["trials"]
        ],
        "discovery": plan["discovery"],
    }
    public_pre = dict(public_pre_core)
    public_pre["manifest_sha256"] = sha256_obj(public_pre_core)
    public_pre["written_before_B0_at"] = now_iso()
    public_pre["write_pid"] = os.getpid()

    with open(PRE_B0_PATH, "x", encoding="utf-8") as f:
        json.dump(public_pre, f, sort_keys=True, indent=2)
        f.flush()
        os.fsync(f.fileno())

    plan["public_pre_manifest_sha256"] = public_pre["manifest_sha256"]

    plan, reveal = run_predictor_phase(plan, reveal)

    public = sanitize_public(plan)
    public["public_pre_manifest"] = public_pre
    public["reveal_sha256"] = sha256_obj(reveal)
    public["completed_at"] = now_iso()

    with open(PUBLIC_PATH, "w", encoding="utf-8") as f:
        json.dump(public, f, sort_keys=True, indent=2)

    with open(REVEAL_PATH, "w", encoding="utf-8") as f:
        json.dump(reveal, f, sort_keys=True, indent=2)

    print(json.dumps({
        "protocol": PROTOCOL,
        "public_file": PUBLIC_PATH,
        "reveal_file": REVEAL_PATH,
        "trials": len(reveal["trials"]),
        "manifest_sha256": public_pre["manifest_sha256"],
        "reveal_sha256": sha256_obj(reveal),
    }, separators=(",", ":"))


if __name__ == "__main__":
    main()
