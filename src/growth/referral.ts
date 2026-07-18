import { db } from '../db'; // Assuming db is your database connection

export async function processReferral(referralCode: string, newUserId: string) {
  const referral = await db.oneOrNone('SELECT * FROM referral_codes WHERE code = $1 AND uses = 0 AND credits_awarded = FALSE', [referralCode]);

  if (!referral) {
    throw new Error('Invalid or already used referral code');
  }

  const ownerId = referral.owner_id;

  // Increment uses and mark as awarded
  await db.none('UPDATE referral_codes SET uses = uses + 1, credits_awarded = TRUE WHERE code = $1', [referralCode]);

  // Add 5 credits to referrer's balance
  await db.none('UPDATE users SET credits = credits + 5 WHERE id = $1', [ownerId]);

  // Log event
  await db.none('INSERT INTO system_events (type, user_id, event_data) VALUES ($1, $2, $3)', [
    'referral_conversion',
    ownerId,
    JSON.stringify({ referralCode, newUserId })
  ]);

  // Notify both users (implementation depends on your notification system)
  // notifyUser(ownerId, 'You earned 5 credits from a referral!');
  // notifyUser(newUserId, 'Thanks for joining! Your referrer earned 5 credits.');
}