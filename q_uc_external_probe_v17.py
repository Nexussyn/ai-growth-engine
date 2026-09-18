#!/usr/bin/env python3
import hashlib, json, math, os, re, secrets, time
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

N = 512
ALPHABET = "ABCD"
TRIAL_ID = f"Q-UC-v17-{time.time_ns()}-{secrets.token_hex(8)}"
target = "".join(ALPHABET[b & 3] for b in secrets.token_bytes(N))
salt = secrets.token_hex(32)
commitment = hashlib.sha256(f"Q-UC-v17|{TRIAL_ID}|{salt}|{target}".encode()).hexdigest()

AGENTS = {
    "openai_orchestrator": "https://llm-orchestration-agent-openai.getvda.ai/a2a/",
    "langchain_openai": "https://llm-orchestration-agent-langchain-openai.getvda.ai/a2a/",
    "langchain_anthropic": "https://llm-orchestration-agent-langchain-anthropic.getvda.ai/a2a/",
}

def exact_binom_upper(k, n, p=0.25):
    return sum(math.comb(n,i)*(p**i)*((1-p)**(n-i)) for i in range(k,n+1))

def flatten_strings(x):
    out=[]
    if isinstance(x,str): out.append(x)
    elif isinstance(x,dict):
        for v in x.values(): out.extend(flatten_strings(v))
    elif isinstance(x,list):
        for v in x: out.extend(flatten_strings(v))
    return out

def extract_sequence(payload):
    texts = flatten_strings(payload)
    if not texts:
        return None
    candidates=[]
    for t in texts:
        t2="".join(t.split())
        candidates += re.findall(r"[ABCD]{512}", t2)
    return candidates[0] if candidates else None

def call_agent(name,url):
    prompt = (
        "Q-UC blinded test. A secret target sequence of exactly 512 symbols from "
        "A/B/C/D was generated locally before this request. It is committed by "
        "SHA-256 as: "+commitment+". You do not know the target and cannot access "
        "the runner. Return exactly 512 characters using only A, B, C, D. "
        "No spaces, punctuation, numbering, explanation, code fences, or additional text."
    )
    payload={
        "jsonrpc":"2.0",
        "id":1,
        "method":"message/send",
        "params":{
            "message":{
                "messageId":"q-uc-"+TRIAL_ID+"-"+name,
                "role":"user",
                "parts":[{"text":prompt}]
            }
        }
    }
    req=Request(url,data=json.dumps(payload).encode(),method="POST",
                headers={"Content-Type":"application/json","User-Agent":"Q-UC-v17/1.0"})
    raw=b""; status=None; err=None
    try:
        with urlopen(req,timeout=45) as r:
            status=r.status; raw=r.read()
    except HTTPError as e:
        status=e.code; raw=e.read()
    except (URLError,TimeoutError,OSError) as e:
        err=type(e).__name__+":"+str(e)

    parsed=None
    try: parsed=json.loads(raw.decode("utf-8","replace"))
    except Exception: pass

    seq=extract_sequence(parsed) if parsed is not None else None
    if seq is None:
        seq=extract_sequence(raw.decode("utf-8","replace"))

    valid=seq is not None
    score=sum(a==b for a,b in zip(target,seq)) if valid else None
    p=exact_binom_upper(score,N) if valid else None
    llr=None
    if valid:
        phat=score/N
        if 0<phat<1:
            llr=score*math.log2(phat/0.25)+(N-score)*math.log2((1-phat)/0.75)

    return {
        "agent":name,
        "endpoint":url,
        "http_status":status,
        "transport_error":err,
        "valid_reply":valid,
        "score":score,
        "n":N,
        "match_rate":score/N if valid else None,
        "exact_one_sided_p":p,
        "llr_bits":llr,
        "response_sha256":hashlib.sha256(raw).hexdigest(),
        "response_length_bytes":len(raw),
    }

print(json.dumps({
    "phase":"PRECONTACT_COMMIT",
    "protocol":"Q-UC-v17",
    "trial_id":TRIAL_ID,
    "n":N,
    "commitment":commitment,
    "target_sha256":hashlib.sha256(target.encode()).hexdigest(),
    "timestamp_ns":time.time_ns(),
    "agents":AGENTS
},separators=(",",":")),flush=True)

results=[]
for name,url in AGENTS.items():
    r=call_agent(name,url)
    results.append(r)
    print(json.dumps({"phase":"AGENT_RESULT",**r},separators=(",",":")),flush=True)

valid=[r for r in results if r["valid_reply"]]
summary={
    "protocol":"Q-UC-v17",
    "trial_id":TRIAL_ID,
    "commitment":commitment,
    "target_sha256":hashlib.sha256(target.encode()).hexdigest(),
    "results":results,
    "n_valid":len(valid),
    "ontological_conclusion":"NONE"
}
with open("q_uc_v17_public.json","w",encoding="utf-8") as f:
    json.dump(summary,f,sort_keys=True,indent=2)

with open("q_uc_v17_reveal.json","w",encoding="utf-8") as f:
    json.dump({
        "trial_id":TRIAL_ID,
        "salt":salt,
        "target":target,
        "commitment":commitment
    },f,sort_keys=True,indent=2)

print(json.dumps({
    "phase":"POSTCONTACT_REVEAL",
    "trial_id":TRIAL_ID,
    "commitment":commitment,
    "target_revealed_after_scoring":True,
    "valid_agents":len(valid)
},separators=(",",":")),flush=True)
