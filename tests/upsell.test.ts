import { UpsellEngine } from '../src/monetization/upsell';

class MockDB {
  public data: any = { upsell_triggers: [] };
  
  async query(sql: string, params: any[] = []): Promise<any> {
    if (sql.includes('INSERT INTO upsell_triggers')) {
      const exists = this.data.upsell_triggers.find((t: any) => t.user_id === params[0] && t.trigger_type === params[1]);
      if (exists) throw new Error('Duplicate PK');
      this.data.upsell_triggers.push({ user_id: params[0], trigger_type: params[1] });
    }
    return [];
  }
}

async function runTests() {
  const db = new MockDB();
  const engine = new UpsellEngine(db as any);

  console.log('Testing threshold below trigger...');
  let prompt = await engine.check_and_trigger_upsell('user-1', 4);
  if (prompt !== null) throw new Error('Triggered too early');

  console.log('Testing exact threshold trigger...');
  prompt = await engine.check_and_trigger_upsell('user-1', 5);
  if (prompt === null) throw new Error('Failed to trigger at threshold');
  if (!prompt.includes('Upgrade')) throw new Error('Prompt missing keywords');

  console.log('Testing idempotency...');
  let prompt2 = await engine.check_and_trigger_upsell('user-1', 5);
  if (prompt2 !== null) throw new Error('Double triggered');

  console.log('Testing above threshold...');
  let prompt3 = await engine.check_and_trigger_upsell('user-1', 6);
  if (prompt3 !== null) throw new Error('Triggered above threshold');

  console.log('All upsell tests passed!');
}

runTests().catch(console.error);
