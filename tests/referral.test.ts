import { processReferral } from '../src/growth/referral';
import { db } from '../src/db';

describe('Referral System', () => {
  beforeEach(async () => {
    await db.none('TRUNCATE TABLE referral_codes, users, system_events RESTART IDENTITY CASCADE');
    await db.none('INSERT INTO users (id, credits) VALUES ($1, $2)', ['user-a', 0]);
    await db.none('INSERT INTO users (id, credits) VALUES ($1, $2)', ['user-b', 0]);
    await db.none('INSERT INTO referral_codes (code, owner_id) VALUES ($1, $2)', ['REFERRAL123', 'user-a']);
  });

  it('should process a valid referral', async () => {
    await processReferral('REFERRAL123', 'user-b');

    const referrerCredits = await db.one('SELECT credits FROM users WHERE id = $1', ['user-a']);
    expect(referrerCredits.credits).toBe(5);

    const event = await db.one('SELECT * FROM system_events WHERE type = $1', ['referral_conversion']);
    expect(event.type).toBe('referral_conversion');
  });

  it('should prevent duplicate use of the same referral code', async () => {
    await processReferral('REFERRAL123', 'user-b');
    await expect(processReferral('REFERRAL123', 'user-b')).rejects.toThrow('Invalid or already used referral code');
  });
})