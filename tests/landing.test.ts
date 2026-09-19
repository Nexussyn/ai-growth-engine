import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { createLandingEventHandler } from '../src/landing/events.ts';

Deno.test('records mobile and desktop CTA events in system_events', async () => {
  const rows: unknown[] = [];
  const handler = createLandingEventHandler((table, row) => {
    rows.push({ table, row });
    return Promise.resolve();
  });
  for (const [device, wallet] of [['mobile', 'metamask'], ['desktop', 'browser']]) {
    const response = await handler(new Request('http://localhost/api/landing-events', {
      method: 'POST',
      body: JSON.stringify({ device, wallet }),
    }));
    assertEquals(response.status, 204);
  }
  assertEquals(rows.length, 2);
  for (const [index, device] of ['mobile', 'desktop'].entries()) {
    const entry = rows[index] as { table: string; row: { event_type: string; payload: { device: string }; created_at: string } };
    assertEquals(entry.table, 'system_events');
    assertEquals(entry.row.event_type, 'mobile_landing_cta_click');
    assertEquals(entry.row.payload.device, device);
    assertEquals(Number.isNaN(Date.parse(entry.row.created_at)), false);
  }
});

Deno.test('rejects invalid payloads without persisting and exposes store failures', async () => {
  let writes = 0;
  const handler = createLandingEventHandler(() => { writes++; return Promise.reject(new Error('offline')); });
  assertEquals((await handler(new Request('http://localhost/api/landing-events'))).status, 405);
  for (const body of ['bad json', 'null', '{}', '{"device":"mobile","wallet":"unknown"}']) {
    assertEquals((await handler(new Request('http://localhost/api/landing-events', { method: 'POST', body }))).status, 400);
  }
  assertEquals(writes, 0);
  const response = await handler(new Request('http://localhost/api/landing-events', {
    method: 'POST', body: '{"device":"mobile","wallet":"rainbow"}',
  }));
  assertEquals(response.status, 503);
  assertEquals(writes, 1);
});
