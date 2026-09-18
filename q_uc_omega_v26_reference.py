#!/usr/bin/env python3
from __future__ import annotations
import hashlib, json, secrets, time
from dataclasses import dataclass, asdict
from typing import Optional

PROTOCOL='Q-UC-OMEGA-V26'

@dataclass(frozen=True)
class Event:
    event_id: str
    replica_id: str
    mode: str
    monotonic_ns: int
    utc_ns: int
    parents: tuple[str, ...]
    payload_hash: str
    bytes_tx: int
    bytes_rx: int
    packets_tx: int
    packets_rx: int
    prompt_tokens: Optional[int]
    response_tokens: Optional[int]
    session_id: str

def sha256_hex(s: str) -> str:
    return hashlib.sha256(s.encode()).hexdigest()

def make_event(replica_id: str, mode: str, payload: bytes, session_id: str,
               parents: tuple[str, ...]=(), bytes_tx: int=0, bytes_rx: int=0,
               packets_tx: int=0, packets_rx: int=0,
               prompt_tokens: Optional[int]=None,
               response_tokens: Optional[int]=None) -> Event:
    return Event(
        event_id=secrets.token_hex(16),
        replica_id=replica_id,
        mode=mode,
        monotonic_ns=time.monotonic_ns(),
        utc_ns=time.time_ns(),
        parents=parents,
        payload_hash=sha256_hex(payload.hex()),
        bytes_tx=bytes_tx,
        bytes_rx=bytes_rx,
        packets_tx=packets_tx,
        packets_rx=packets_rx,
        prompt_tokens=prompt_tokens,
        response_tokens=response_tokens,
        session_id=session_id,
    )

def event_hash(e: Event) -> str:
    raw=json.dumps(asdict(e),sort_keys=True,separators=(',',':'))
    return sha256_hex(raw)

def backaction_budget(events: list[Event]) -> dict:
    return {
        'n':len(events),
        'bytes_tx':sum(e.bytes_tx for e in events),
        'bytes_rx':sum(e.bytes_rx for e in events),
        'packets_tx':sum(e.packets_tx for e in events),
        'packets_rx':sum(e.packets_rx for e in events),
        'prompt_tokens_known':sum(e.prompt_tokens or 0 for e in events),
        'response_tokens_known':sum(e.response_tokens or 0 for e in events),
    }

def commit_secret(protocol: str, experiment_id: str, descriptor: str, secret: str) -> dict:
    salt=secrets.token_hex(32)
    raw='|'.join((protocol,experiment_id,descriptor,salt,secret))
    return {
        'protocol':protocol,
        'experiment_id':experiment_id,
        'descriptor':descriptor,
        'salt':salt,
        'commitment':hashlib.sha256(raw.encode()).hexdigest(),
    }

def verify_secret(record: dict, secret: str) -> bool:
    raw='|'.join((record['protocol'],record['experiment_id'],record['descriptor'],record['salt'],secret))
    return hashlib.sha256(raw.encode()).hexdigest()==record['commitment']

if __name__=='__main__':
    e=make_event('replica-0','M1',b'sham','session-0',bytes_tx=64,bytes_rx=64)
    print(json.dumps({'event':asdict(e),'event_hash':event_hash(e)},indent=2))