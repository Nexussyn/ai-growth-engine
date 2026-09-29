# Local content agent for issue #5

This Python alternative generates all three drafts in one local Ollama request,
validates them before persistence, and propagates database failures. It does not
publish to social networks, process payments, or claim an outcome was paid.

Requires Python 3.10+ and Ollama with `qwen2.5-coder:3b`. No Python dependencies.
The Ollama URL is configurable; its default matches MoneyMiner's local port.

```python
from content_agent import ContentAgent, Ollama, SupabaseStore

# Supply your own deployment configuration through your secret manager.
store = SupabaseStore(supabase_url, service_key)
agent = ContentAgent(store, Ollama(url='http://127.0.0.1:11434/api/chat'))
drafts = agent.generate_content(completed_bounty_id)
```

Invoke after a bounty's `execution_status` becomes `done`; incomplete records are
rejected. This module does not install a database trigger. The source table is
`bounty_tasks`, as documented in `system/schema-public.md`. The destination uses
the existing TypeScript implementation's `outreach_sent` columns. Maintainers must
verify those destination columns and permissions in their deployment.

All outputs are validated: tweet up to 280 characters, exactly five distinct thread
entries of up to 280 characters, and a blog of 270–330 words. Invalid model output
raises an error without saving. These limits count Unicode code points, not X's
weighted URL/CJK rules; automatic X publishing is deliberately absent.

From the repository root, run `python -m unittest discover -s tests -p test_content_agent.py -v`. Add `src/agents` to PYTHONPATH when importing the agent.
Tests use mock bounty data, an injected model, and mocked PostgREST transport.
They do not prove access to the maintainer's database or a paid contract.

Existing TypeScript deployment is unchanged. No automatic retries or idempotent
delivery guarantee: the caller should deduplicate completion events. Semantic
uniqueness and factual review remain necessary before publication.
