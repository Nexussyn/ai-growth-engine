/**
 * Referral Reward System
 * 
 * Awards 5 free credits per successful referral conversion.
 * Expected impact: +20% conversion rate via viral growth loop.
 */

export interface ReferralCode {
  id: number;
  userId: string;
  code: string;
  createdAt: string;
  totalConversions: number;
  totalCreditsAwarded: number;
}

export interface ReferralConversion {
  id: number;
  referralCodeId: number;
  referrerUserId: string;
  referredUserId: string;
  convertedAt: string;
  creditsAwarded: number;
  status: 'pending' | 'awarded' | 'reversed';
}

export interface ReferralStats {
  totalCodesCreated: number;
  totalConversions: number;
  totalCreditsAwarded: number;
  conversionRate: number;
  averageConversionValue: number;
  topReferrers: Array<{
    userId: string;
    code: string;
    conversions: number;
    credits: number;
  }>;
}

const REFERRAL_CREDITS = 5.00;

/**
 * Validate that a referral code format is correct
 */
export function validateReferralCode(code: string): boolean {
  return /^[A-Z0-9]{8}$/.test(code);
}

/**
 * Calculate conversion rate from created codes
 */
export function calculateConversionRate(
  totalCodes: number,
  totalConversions: number
): number {
  if (totalCodes === 0) return 0;
  return totalConversions / totalCodes;
}

/**
 * Estimate virality coefficient (K-factor)
 * How many NEW users each existing user brings in
 */
export function estimateKFactor(
  totalUsers: number,
  userGrowth: number[],
  creditConsumption: number
): number {
  if (totalUsers === 0) return 0;
  
  // Credits awarded per user
  const avgCreditsPerUser = creditConsumption / totalUsers;
  
  // K = referral conversion rate × average credits value
  const conversionRate = userGrowth.length > 1
    ? (userGrowth[userGrowth.length - 1] - userGrowth[0]) / userGrowth[0]
    : 0;
    
  return Math.max(0, conversionRate * (avgCreditsPerUser / REFERRAL_CREDITS));
}

/**
 * Predict revenue impact of referral system
 */
export function predictRevenueImpact(params: {
  currentUsers: number;
  referralConversionRate: number; // 0-1
  averageRevenuePerUser: number;
  freeCallCost: number;
}): {
  newUsersPerPeriod: number;
  costOfFreeCredits: number;
  additionalRevenue: number;
  netGain: number;
  roiPercent: string;
} {
  const { currentUsers, referralConversionRate, averageRevenuePerUser, freeCallCost } = params;
  
  // Estimate: each existing user invites X people
  const invitationsPerUser = 0.5; // conservative: 1 invite per 2 users
  const newUsersPerPeriod = currentUsers * invitationsPerUser * referralConversionRate;
  
  // Cost: each new referral gives 5 free credits ($0.01/call suggestion)
  const freeCallsPerReferral = 5;
  const costOfFreeCredits = newUsersPerPeriod * freeCallsPerReferral * freeCallCost;
  
  // Revenue: new users eventually convert to paid
  const conversionToPaid = 0.3; // 30% of free users convert
  const additionalRevenue = newUsersPerPeriod * conversionToPaid * averageRevenuePerUser;
  
  const netGain = additionalRevenue - costOfFreeCredits;
  const roi = costOfFreeCredits > 0 
    ? `+${((netGain / costOfFreeCredits) * 100).toFixed(0)}%`
    : 'N/A';

  return {
    newUsersPerPeriod: Math.round(newUsersPerPeriod),
    costOfFreeCredits: Math.round(costOfFreeCredits * 100) / 100,
    additionalRevenue: Math.round(additionalRevenue * 100) / 100,
    netGain: Math.round(netGain * 100) / 100,
    roiPercent: roi,
  };
}
