export interface DatabaseClient {
  query(sql: string, params: any[]): Promise<any>;
}

export type ReferralStatus = 'ok' | 'invalid_code' | 'already_processed';

export interface ProcessReferralResult {
  status: ReferralStatus;
  credits_awarded?: number;
  owner_id?: string;
}

/**
 * Processes a referral conversion.
 * When user B signs up via user A's code and makes a paid call, this is invoked.
 * It calls the `process_referral` Postgres function, which handles idempotency,
 * credit attribution, and event logging atomically.
 */
export async function processReferralConversion(
  referralCode: string,
  newUserId: string,
  db: DatabaseClient
): Promise<ProcessReferralResult> {
  const result = await db.query(
    'SELECT process_referral($1, $2) as result',
    [referralCode, newUserId]
  );
  
  if (!result || result.length === 0) {
    throw new Error('Database returned empty result from process_referral');
  }

  // Postgres function returns JSONB, which the driver parses into an object
  return result[0].result as ProcessReferralResult;
}
