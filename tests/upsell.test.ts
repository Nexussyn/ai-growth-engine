import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { applyUpsell, type UpsellRpc } from '../src/monetization/upsell.ts';

Deno.test('only the fifth free call checks the persistent trigger', async () => {
  const calls: unknown[] = [];
  const rpc: UpsellRpc = (name, args) => {
    calls.push([name, args]);
    return Promise.resolve({ data: { upsell: true }, error: null });
  };
  for (const callCount of [4, 6]) {
    const response = new Response('ok');
    assertEquals(await applyUpsell(response, { userId: 'alice', callCount }, rpc), response);
  }
  const result = await applyUpsell(new Response('ok'), { userId: 'alice', callCount: 5 }, rpc);
  assertEquals(result.headers.get('X-Upsell-Prompt'), 'true');
  assertEquals(calls, [['check_upsell_trigger', { p_user_id: 'alice', p_call_count: 5 }]]);
});

Deno.test('preserves the API response while attaching usage-based A/B prompts', async () => {
  const rpc: UpsellRpc = () => Promise.resolve({ data: { upsell: true }, error: null });
  for (const variant of ['A', 'B'] as const) {
    const response = new Response('{"ok":true}', {
      status: 201,
      statusText: 'Created',
      headers: { 'Content-Type': 'application/json', 'X-Request-Id': 'request-1' },
    });
    const result = await applyUpsell(response, {
      userId: 'alice', callCount: 5, usagePattern: 'frequent', variant,
    }, rpc);
    assertEquals(result.status, 201);
    assertEquals(result.statusText, 'Created');
    assertEquals(result.headers.get('Content-Type'), 'application/json');
    assertEquals(result.headers.get('X-Request-Id'), 'request-1');
    assertEquals(result.headers.get('X-Upsell-Variant'), variant);
    assertEquals(result.headers.get('X-Upsell-Message'), variant === 'A'
      ? 'You have used 5 of 10 free calls. Upgrade to keep your frequent workflows running.'
      : 'Keep your frequent workflows running: explore an upgrade with 5 free calls remaining.');
    assertEquals(response.headers.has('X-Upsell-Prompt'), false);
    assertEquals(await result.text(), '{"ok":true}');
  }
  const result = await applyUpsell(new Response(), { userId: 'bob', callCount: 5 }, rpc);
  assertEquals(result.headers.get('X-Upsell-Message'),
    'You have used 5 of 10 free calls. Upgrade when you need more room to explore.');
});

Deno.test('only the RPC winner receives a prompt across concurrent and repeated calls', async () => {
  const claimed = new Set<string>();
  const rpc: UpsellRpc = async (_name, args) => {
    await Promise.resolve();
    const upsell = !claimed.has(args.p_user_id);
    claimed.add(args.p_user_id);
    return { data: { upsell }, error: null };
  };
  const request = () => applyUpsell(new Response('ok'), { userId: 'alice', callCount: 5 }, rpc);
  const results = await Promise.all([request(), request()]);
  assertEquals(results.filter((result) => result.headers.has('X-Upsell-Prompt')).length, 1);
  assertEquals((await request()).headers.has('X-Upsell-Prompt'), false);
  const otherUser = await applyUpsell(new Response(), { userId: 'bob', callCount: 5 }, rpc);
  assertEquals(otherUser.headers.get('X-Upsell-Prompt'), 'true');
});

Deno.test('preserves a streaming response without reading or buffering it', async () => {
  let controller: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({
    start(value) { controller = value; },
  });
  const rpc: UpsellRpc = () => Promise.resolve({ data: { upsell: true }, error: null });
  const result = await applyUpsell(new Response(body), { userId: 'alice', callCount: 5 }, rpc);
  assertEquals(result.body, body);
  assertEquals(result.bodyUsed, false);
  controller!.enqueue(new TextEncoder().encode('first '));
  controller!.enqueue(new TextEncoder().encode('second'));
  controller!.close();
  assertEquals(await result.text(), 'first second');
});

Deno.test('RPC failures and missing results leave the response untouched', async () => {
  const rpcs: UpsellRpc[] = [
    () => Promise.resolve({ data: { upsell: true }, error: new Error('unavailable') }),
    () => Promise.resolve({ data: null, error: null }),
    () => Promise.reject(new Error('connection failed')),
  ];
  for (const rpc of rpcs) {
    const response = new Response('ok', { status: 202 });
    assertEquals(await applyUpsell(response, { userId: 'alice', callCount: 5 }, rpc), response);
    assertEquals(response.headers.has('X-Upsell-Prompt'), false);
    assertEquals(await response.text(), 'ok');
  }
});
