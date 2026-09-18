#!/usr/bin/env python3
from __future__ import annotations
import hashlib, json, math, os, re, secrets, time
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit

PROTOCOL = "Q-UC-OMEGA-V28"
N_SYMBOLS = 64
ALPHABET = "ABCD"
N_TRIALS = 4
TIMEOUT = 20

AGENTS = {
    "vda_openai": "https://llm-orchestration-agent-openai.getvda.ai/a2a/",
    "vda_langchain_openai": "https://llm-orchestration-agent-langchain-openai.getvda.ai/a2a/",
    "vda_langchain_anthropic": "https://llm-orchestration-agent-langchain-anthropic.getvda.ai/a2a/",
    "berrergate": "https://api.berrergate.com/a2a/v1",
}

def sha256_bytes(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()

def token_urlopen(req: Request):
    return urlopen(req, timeout=TIMEOUT)

def get_json(url: str):
    req = Request(url, headers={"Accept":"application/json","User-Agent":PROTOCOL+"/1.0"})
    with token_urlopen(req) as r:
        raw = r.read()
        return r.status, raw, json.loads(raw.decode("utf-8"))

def discover_agent(url: str):
    u = urlsplit(url)
    origin = f"{u.scheme}://{u.netloc}"
    card_url = origin + "/.well-known/agent-card.json"
    try:
        status, raw, card = get_json(card_url)
        return {
            "status": status,
            "card_url": card_url,
            "card_sha256": sha256_bytes(raw),
            "protocol_version": card.get("protocolVersion"),
            "name": card.get("name"),
            "provider": card.get("provider",{}),
            "url": card.get("url") or url,
            "capabilities": card.get("capabilities",{}),
            "skills": card.get("skills",[]),
        }
    except Exception as e:
        return {"status":None,"card_url":card_url,"error":type(e).__name__+":"+str(e),"url":url}

def commit(secret_value: str, trial_id: str, label: str):
    salt = secrets.token_hex(32)
    raw = f"{PROTOCOL}|{trial_id}|{label}|{salt}|{secret_value}".encode()
    return salt, sha256_bytes(raw)

def make_target():
    return "".join(ALPHABET[b & 3] for b in secrets.token_bytes(N_SYMBOLS))

def extract_exact_sequence(payload_text: str):
    compact = "".join(payload_text.split())
    matches = re.findall(r"[ABCD]{%d}" % N_SYMBOLS, compact)
    return matches[0] if matches else None

def post_a2a(endpoint: str, prompt: str):
    body = {
        "jsonrpc":"2.0",
        "id":1,
        "method":"message/send",
        "params":{
            "message":{
                "messageId": "quc-" + secrets.token_hex(12),
                "contextId": trial_id,
                "role":"user",
                "parts":[{"text":prompt}],
            }
        }
    }
    raw_body = json.dumps(body,separators=(",",":")).encode()
    req = Request(endpoint, data=raw_body, method="POST", headers={
        "Content-Type":"application/json",
        "Accept":"application/json",
        "User-Agent":PROTOCOL+"/1.0",
    })
    t0 = time.monotonic_ns()
    try:
        with token_urlopen(req) as r:
            raw = r.read()
            status = r.status
        err = None
    except HTTPError as e:
        status = e.code
        raw = e.read()
        err = "HTTPError:"+str(e)
    except (URLError, TimeoutError, OSError) as e:
        status = None
        raw = b""
        err = type(e).__name__+":"+str(e)
    elapsed = time.monotonic_ns() - t0
    return status, raw, err, elapsed, len(raw_body)

def trial(agent_name: str, endpoint: str, condition: str, trial_id: str):
    target = make_target()
    decoy = make_target()
    score_target = target if condition == "ACTIVE" else target
    commitment_target = target if condition == "ACTIVE" else decoy
    salt, commitment = commit(commitment_target, trial_id, "target")
    nonce = secrets.token_hex(16)
    prompt = (
        f"{PROTOCOL} blinded protocol. trial={trial_id}; nonce={nonce}; "
        f"commitment={commitment}. Return exactly {N_SYMBOLS} characters using only A,B,C,D. "
        "No spaces, punctuation, explanation, code fences, or additional text."
    )
    status, raw, err, elapsed_ns, tx_bytes = post_a2a(endpoint, prompt)
    raw_text = raw.decode("utf-8","replace")
    seq = extract_exact_sequence(raw_text)
    valid = seq is not None
    matches = sum(a == b for a,b in zip(score_target, seq)) if valid else None
    p = None
    if valid:
        tail = 0.0
        for k in range(matches, N_SYMBOLS+1):
            tail += math.comb(N_SYMBOLS,k) * (0.25**k) * (0.75**(N_SYMBOLS-k))
        p = min(1.0, tail)
    return {
        "trial_id":trial_id,
        "agent":agent_name,
        "condition":condition,
        "endpoint":endpoint,
        "commitment":commitment,
        "commitment_kind":"TARGET" if condition=="ACTIVE" else "DECOY",
        "n":N_SYMBOLS,
        "valid_reply":valid,
        "matches":matches,
        "match_rate":(matches/N_SYMBOLS) if valid else None,
        "exact_binomial_p":p,
        "response_sha256":sha256_bytes(raw),
        "response_bytes":len(raw),
        "request_bytes":tx_bytes,
        "http_status":status,
        "transport_error":err,
        "elapsed_ns":elapsed_ns,
        "response_sequence_for_audit":seq,
        "target_for_reveal":target,
        "decoy_for_reveal":decoy,
        "salt":salt,
    }

def main():
    started = time.time_ns()
    discovery = {k:discover_agent(v) for k,v in AGENTS.items()}
    results = []
    plan=[]
    for agent_name, endpoint in AGENTS.items():
        for i in range(N_TRIALS):
            condition = "ACTIVE" if secrets.randbelow(2) == 0 else "SHAM"
            plan.append((agent_name, endpoint, condition, f"{PROTOCOL}-{agent_name}-{i}-{secrets.token_hex(8)}"))
    secrets.SystemRandom().shuffle(plan)

    with ThreadPoolExecutor(max_workers=4) as ex:
        futs=[ex.submit(trial,*p) for p in plan]
        for f in as_completed(futs):
            results.append(f.result())

    # Public artifact intentionally omits target/decoy/salt values and response bodies.
    public=[]
    for r in results:
        q=dict(r)
        for k in ("target_for_reveal","decoy_for_reveal","salt","response_sequence_for_audit"):
            q.pop(k,None)
        public.append(q)

    valid=[r for r in results if r["valid_reply"]]
    total_m=sum(r["n"] for r in valid)
    total_k=sum(r["matches"] for r in valid)
    p_total=1.0
    if total_m:
        p_total=sum(math.comb(total_m,k)*(0.25**k)*(0.75**(total_m-k)) for k in range(total_k,total_m+1))
        p_total=min(1.0,p_total)

    with open("q_uc_v28_public.json","w",encoding="utf-8") as f:
        json.dump({
            "protocol":PROTOCOL,
            "n_symbols":N_SYMBOLS,
            "n_trials_planned":len(plan),
            "n_valid":len(valid),
            "total_matches":total_k,
            "total_positions_scored":total_m,
            "aggregate_exact_p":p_total,
            "discovery":discovery,
            "results":public,
            "started_ns":started,
            "completed_ns":time.time_ns(),
            "ontological_conclusion":"NONE",
        },f,sort_keys=True,indent=2)

    with open("q_uc_v28_reveal.json","w",encoding="utf-8") as f:
        json.dump({
            "protocol":PROTOCOL,
            "results":[{
                "trial_id":r["trial_id"],
                "agent":r["agent"],
                "condition":r["condition"],
                "target":r["target_for_reveal"],
                "decoy":r["decoy_for_reveal"],
                "salt":r["salt"],
                "commitment":r["commitment"],
                "response_sequence":r["response_sequence_for_audit"],
                "response_sha256":r["response_sha256"],
            } for r in results],
        },f,sort_keys=True,indent=2)

    # Full response bodies are hashed only; raw bodies are intentionally not exported.
    print(json.dumps({
        "protocol":PROTOCOL,
        "agents":len(AGENTS),
        "trials":len(plan),
        "valid":len(valid),
        "total_matches":total_k,
        "total_positions_scored":total_m,
        "aggregate_exact_p":p_total,
        "ontological_conclusion":"NONE",
    },separators=(",",":")))

if __name__ == "__main__":
    main()
