#!/usr/bin/env python3
"""
Q-UC Ω V33 executable invariant tests.

These tests do not simulate a scientific effect. They verify mathematical and
implementation invariants on a reduced finite domain and fail closed on protocol
mistakes.
"""

from __future__ import annotations

import hashlib
from collections import Counter


def test_exact_uniform_rejection():
    for k in range(2, 17):
        limit = 256 - (256 % k)
        counts = Counter(
            x % k for x in range(limit)
        )
        expected = limit // k
        assert sum(counts.values()) == limit
        for j in range(k):
            assert counts[j] == expected


def test_xor_bijection():
    fixed = 0x5A
    vals = [(u ^ fixed) for u in range(256)]
    assert len(set(vals)) == 256
    assert sorted(vals) == list(range(256))


def test_xor_plus_context_bijection():
    for fixed in range(256):
        for context in range(256):
            vals = [u ^ fixed ^ context for u in range(256)]
            assert len(set(vals)) == 256


def test_sha256_domain_separation():
    a = hashlib.sha256(b"Q-UC|A|episode").hexdigest()
    b = hashlib.sha256(b"Q-UC|B|episode").hexdigest()
    assert a != b


def main():
    test_exact_uniform_rejection()
    test_xor_bijection()
    test_xor_plus_context_bijection()
    test_sha256_domain_separation()
    print("Q-UC V33 invariant tests: PASS")
    print("These tests establish only finite-domain implementation invariants;")
    print("they do not establish any empirical anomaly or consciousness claim.")


if __name__ == "__main__":
    main()
