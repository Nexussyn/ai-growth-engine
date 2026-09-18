from __future__ import annotations
import hashlib, json, math, re, secrets, threading, time
from concurrent.futures import ThreadPoolExecutor, as_completed
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlparse
from urllib.request import Request, urlopen

PROTOCOL = "Q-UC-OMEGA-V29"
N = 64
ALPHABET = "ABCD"
MAX_WORKERS = 8
TIMEOUT = 12

AGENTS = {
    "vda_openai": "https://llm-orchestration-agent-openai.getvda.ai/a2a/",
    "vda_langchain_openai": "https://llm-orchestration-agent-langchain-openai.getvda.ai/a2a/",
    "vda_langchain_anthropic": "https://llm-orchestration-agent-langchain-anthropic.getvda.ai/a2a/",
    "berrergate": "https://api.berrergate.com/a2a/v1",
}

JOBS = {}
LOCK = threading.Lock()

def sha256(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()

def p_binom_upper(k: int, n: int, p: float = 0.25) -> float:
    if k <= 0:
        return 1.0
    s = 0.0
    for i in range(k, n + 1):
        s += math.comb(n, i) * (p ** i) * ((1-p) ** (n-i))
    return min(1.0, s)

def discover(url: str):
    from urllib.parse import urlsplit
    u = urlsplit(url)
    card_url = f"{u.scheme}://{u.netloc}/.well-known/agent-card.json"
    req = Request(card_url, headers={"Accept":"application/json","User-Agent":PROTOCOL})
    try:
        with urlopen(req, timeout=TIMEOUT) as r:
            raw = r.read()
            card = json.loads(raw.decode("utf-8"))
        return {"ok": True, "status": 200, "card_url": card_url,
                "card_sha256": sha256(raw), "name": card.get("name"),
                "protocol_version": card.get("protocolVersion"),
                "provider": card.get("provider"), "capabilities": card.get("capabilities"),
                "skills": card.get("skills")}
    except Exception as e:
        return {"ok": False, "card_url": card_url,
                "error": f"{type(e).__name__}:{e}"}

def call_agent(endpoint: str, trial_id: str, commitment: str):
    body = {
        "jsonrpc":"2.0", "id":1, "method":"message/send",
        "params":{"message":{
            "messageId":"quc29-"+secrets.token_hex(12),
            "contextId":trial_id,
            "role":"user",
            "parts":[{"text":
                f"{PROTOCOL} neutral distribution task. reference={commitment}; "
                f"trial={trial_id}. Return exactly {N} characters from A,B,C,D. "
                "No prose, punctuation, spaces, numbering, markdown, or code fences."
            }]
        }}
    }
    raw_body=json.dumps(body,separators=(",",":")).encode()
    req=Request(endpoint,data=raw_body,method="POST",headers={
        "Content-Type":"application/json","Accept":"application/json","User-Agent":PROTOCOL
    })
    t0=time.monotonic_ns()
    try:
        with urlopen(req,timeout=TIMEOUT) as r:
            raw=r.read(); status=r.status
        err=None
    except HTTPError as e:
        raw=e.read(); status=e.code; err="HTTPError:"+str(e)
    except (URLError,TimeoutError,OSError) as e:
        raw=b""; status=None; err=type(e).__name__+":"+str(e)
    elapsed=time.monotonic_ns()-t0
    text=raw.decode("utf-8","replace")
    compact="".join(text.split())
    m=re.findall(r"[ABCD]{%d}" % N, compact)
    seq=m[0] if m else None
    return {
        "status":status, "error":err, "elapsed_ns":elapsed,
        "request_bytes":len(raw_body), "response_bytes":len(raw),
        "response_sha256":sha256(raw), "sequence":seq,
    }

def execute(job_id: str, trials_per_agent: int):
    discovery={k:discover(v) for k,v in AGENTS.items()}
    plan=[]
    for agent, endpoint in AGENTS.items():
        for i in range(trials_per_agent):
            trial_id=f"{PROTOCOL}-{job_id}-{agent}-{i}-{secrets.token_hex(6)}"
            target="".join(ALPHABET[b & 3] for b in secrets.token_bytes(N))
            decoy="".join(ALPHABET[b & 3] for b in secrets.token_bytes(N))
            salt=secrets.token_hex(32)
            commitment=sha256(f"{PROTOCOL}|{trial_id}|TARGET|{salt}|{target}".encode())
            condition="ACTIVE" if secrets.randbelow(2)==0 else "SHAM"
            committed = target if condition=="ACTIVE" else decoy
            plan.append({
                "trial_id":trial_id,"agent":agent,"endpoint":endpoint,
                "condition":condition,"target":target,"decoy":decoy,
                "salt":salt,"commitment":sha256(f"{PROTOCOL}|{trial_id}|TARGET|{salt}|{committed}".encode())
            })
    secrets.SystemRandom().shuffle(plan)
    results=[]
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
        futs={ex.submit(call_agent,p["endpoint"],p["trial_id"],p["commitment"]):p for p in plan}
        for fut in as_completed(futs):
            p=futs[fut]
            try: rr=fut.result()
            except Exception as e: rr={"status":None,"error":f"{type(e).__name__}:{e}",
                                      "elapsed_ns":0,"request_bytes":0,"response_bytes":0,
                                      "response_sha256":sha256(b""),"sequence":None}
            results.append({**p,**rr})
    with LOCK:
        JOBS[job_id]["state"]="COMPLETE"
        JOBS[job_id]["discovery"]=discovery
        JOBS[job_id]["results"]=results
        JOBS[job_id]["completed_ns"]=time.time_ns()

def public_view(job):
    out=[]
    for r in job.get("results",[]):
        out.append({
            k:r.get(k) for k in (
                "trial_id","agent","condition","endpoint","commitment",
                "status","error","elapsed_ns","request_bytes","response_bytes",
                "response_sha256","sequence"
            )
        })
    return {
        "protocol":PROTOCOL,"job_id":job["job_id"],"state":job["state"],
        "n_results":len(out),"discovery":job.get("discovery",{}),
        "results":out,
        "started_ns":job.get("started_ns"),
        "completed_ns":job.get("completed_ns")
    }

def reveal_view(job):
    rows=[]
    for r in job.get("results",[]):
        committed=r["target"] if r["condition"]=="ACTIVE" else r["decoy"]
        verified=sha256(f"{PROTOCOL}|{r['trial_id']}|TARGET|{r['salt']}|{committed}".encode())==r["commitment"]
        seq=r["sequence"]
        valid=seq is not None and len(seq)==N and set(seq)<=set(ALPHABET)
        matches=sum(a==b for a,b in zip(committed,seq)) if valid else None
        rows.append({
            "trial_id":r["trial_id"],"agent":r["agent"],"condition":r["condition"],
            "target":r["target"],"decoy":r["decoy"],"salt":r["salt"],
            "commitment":r["commitment"],"commitment_verified":verified,
            "sequence":seq,"valid":valid,"matches":matches,
            "match_rate":matches/N if valid else None,
        })
    return {"protocol":PROTOCOL,"job_id":job["job_id"],"rows":rows}

class Handler(BaseHTTPRequestHandler):
    def _send(self, obj, code=200):
        raw=json.dumps(obj,sort_keys=True).encode()
        self.send_response(code)
        self.send_header("Content-Type","application/json")
        self.send_header("Content-Length",str(len(raw)))
        self.end_headers(); self.wfile.write(raw)
    def log_message(self,*args): pass
    def do_GET(self):
        p=urlparse(self.path)
        if p.path=="/health":
            return self._send({"ok":True,"protocol":PROTOCOL,"time_ns":time.time_ns()})
        if p.path=="/discover":
            return self._send({k:discover(v) for k,v in AGENTS.items()})
        if p.path=="/start":
            q=parse_qs(p.query); tpa=int(q.get("trials_per_agent",[2])[0])
            if not 1 <= tpa <= 32: return self._send({"error":"trials_per_agent must be 1..32"},400)
            jid=secrets.token_hex(10)
            with LOCK:
                JOBS[jid]={"job_id":jid,"state":"RUNNING","started_ns":time.time_ns()}
            threading.Thread(target=execute,args=(jid,tpa),daemon=True).start()
            return self._send({"protocol":PROTOCOL,"job_id":jid,"state":"RUNNING","trials_planned":tpa*len(AGENTS)})
        if p.path=="/status":
            jid=parse_qs(p.query).get("job",[None])[0]
            with LOCK: job=JOBS.get(jid)
            if not job: return self._send({"error":"unknown job"},404)
            return self._send(public_view(job))
        if p.path=="/reveal":
            jid=parse_qs(p.query).get("job",[None])[0]
            with LOCK: job=JOBS.get(jid)
            if not job: return self._send({"error":"unknown job"},404)
            if job["state"]!="COMPLETE": return self._send({"error":"job not complete","state":job["state"]},409)
            return self._send(reveal_view(job))
        return self._send({"error":"not found"},404)

if __name__=="__main__":
    ThreadingHTTPServer(("0.0.0.0",8080),Handler).serve_forever()
