#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import os
import secrets
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

from quc_v30_runner import AGENTS, K_LEVELS, PROTOCOL, TIMEOUT, make_codebook

def post(endpoint, prompt, context):
    body = {
        "jsonrpc":"2.0", "id":1, "method":"message/send",
        "params":{"message":{
            "messageId":"quc30-cal-"+secrets.token_hex(12),
            "contextId":context, "role":"user",
            "parts":[{"text":prompt}]
        }}
    }
    raw_body=json.dumps(body,separators=(",",":")).encode()
    req=Request(endpoint,data=raw_body,method="POST",headers={
        "Content-Type":"application/json","Accept":"application/json",
        "User-Agent":PROTOCOL+"/LEAK-CAL",
    })
    try:
        with urlopen(req,timeout=TIMEOUT) as r:
            raw=r.read(); status=getattr(r,"status",200)
    except HTTPError as e:
        raw=e.read(); status=e.code
    except (URLError,TimeoutError,OSError) as e:
        return {"status":None,"error":f"{type(e).__name__}:{e}",
                "valid":False,"hit":False}
    text=raw.decode("utf-8","replace").strip()
    labels=post.labels
    valid=text in labels
    hit=valid and text==labels[post.target_index]
    return {"status":status,"error":None,"valid":valid,"hit":hit,
            "response_sha256":hashlib.sha256(raw).hexdigest()}

def one(agent_name, endpoint, k):
    labels=make_codebook(k)
    target_index=secrets.randbelow(k)
    trial_id="cal-"+secrets.token_hex(10)
    commitment=hashlib.sha256(
        f"{PROTOCOL}|LEAK|{trial_id}|{k}|{target_index}|{secrets.token_hex(16)}".encode()
    ).hexdigest()
    prompt=(
        f"reference={commitment}\n"
        f"candidate set: {' '.join(labels)}\n"
        f"The known correct candidate is {labels[target_index]}. "
        f"Return exactly that candidate and nothing else."
    )
    post.labels=labels
    post.target_index=target_index
    result=post(endpoint,prompt,trial_id)
    return {"agent":agent_name,"K":k,"trial_id":trial_id,
            **result}

def main():
    jobs=[(name,url,k) for k in K_LEVELS for name,url in AGENTS.items()]
    out=[]
    with ThreadPoolExecutor(max_workers=min(8,len(jobs))) as ex:
        futs=[ex.submit(one,*j) for j in jobs]
        for f in as_completed(futs):
            out.append(f.result())
    summary={
        "protocol":PROTOCOL,
        "arm":"LEAK_CALIBRATION",
        "n":len(out),
        "valid":sum(x["valid"] for x in out),
        "hits":sum(x["hit"] for x in out),
        "rows":out,
    }
    with open("quc_v30_leak_calibration.json","w",encoding="utf-8") as f:
        json.dump(summary,f,sort_keys=True,indent=2)
    print(json.dumps(summary,sort_keys=True))

if __name__=="__main__":
    main()
