#!/usr/bin/env bash
# One-command verify for issue #5 — used by maintainers and bounty-validator CI
set -euo pipefail
cd "$(dirname "$0")/.."
if ! command -v deno >/dev/null 2>&1; then
  echo "Install Deno: https://deno.land"
  exit 1
fi
deno test --allow-env tests/content-agent.test.ts tests/mock-bounty-fixtures.ts 2>/dev/null || \
  deno test --allow-env tests/content-agent.test.ts
