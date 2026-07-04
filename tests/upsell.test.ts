import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { checkAndTriggerUpsell, upsellMiddleware } from '../src/monetization/upsell.ts';

const mockDb = {
  from: (_table: string) => {
    return {
      insert: (data: any) => {
        if (data.user_id === 'double_user') {
          return { error: new Error('duplicate key value violates unique constraint') };
        }
        return { error: null };
      }
    };
  }
} as any;

Deno.test('Upsell: triggers on 5th call', async () => {
  const result = await checkAndTriggerUpsell(mockDb, 'user_123', 5);
  assertEquals(result.upsell, true);
  assertEquals(result.prompt, 'You have used 50% of your free calls. Upgrade for unlimited access.');
});

Deno.test('Upsell: does not trigger on 4th call', async () => {
  const result = await checkAndTriggerUpsell(mockDb, 'user_123', 4);
  assertEquals(result.upsell, false);
});

Deno.test('Upsell: does not trigger on 6th call', async () => {
  const result = await checkAndTriggerUpsell(mockDb, 'user_123', 6);
  assertEquals(result.upsell, false);
});

Deno.test('Upsell: A/B variants based on usage pattern', async () => {
  const speedResult = await checkAndTriggerUpsell(mockDb, 'user_123', 5, 'speed');
  assertEquals(speedResult.upsell, true);
  assertEquals(speedResult.prompt, 'Speed up your workflow! Upgrade to premium for 10x faster response times.');

  const volumeResult = await checkAndTriggerUpsell(mockDb, 'user_123', 5, 'volume');
  assertEquals(volumeResult.upsell, true);
  assertEquals(volumeResult.prompt, 'High volume detected. Unlock unlimited calls by upgrading to standard/premium tier.');
});

Deno.test('Upsell: idempotent - no double trigger', async () => {
  const result = await checkAndTriggerUpsell(mockDb, 'double_user', 5);
  assertEquals(result.upsell, false);
});

Deno.test('Upsell Middleware: sets response headers correctly', async () => {
  const middleware = upsellMiddleware(mockDb);

  const req = new Request('https://api.example.com/call', {
    headers: {
      'X-User-Id': 'user_123',
      'X-Call-Count': '5',
      'X-Usage-Pattern': 'speed'
    }
  });

  const next = async (_req: Request) => {
    return new Response('ok', { headers: new Headers() });
  };

  const res = await middleware(req, next);
  assertEquals(res.headers.get('X-Upsell-Prompt'), 'true');
  assertEquals(res.headers.get('X-Upsell-Prompt-Text'), 'Speed up your workflow! Upgrade to premium for 10x faster response times.');
});
