export interface UpsellTrigger {
  userId: string;
  freeCallCount: number;
  triggeredAt: string;
  promptText: string;
  promptShown: boolean;
  upsellConverted: boolean;
}

const TRIGGER_AT_CALL = 5;
const FREE_CREDIT_LIMIT = 10;

export function shouldTriggerUpsell(callCount: number): boolean {
  return callCount >= TRIGGER_AT_CALL && callCount % TRIGGER_AT_CALL === 0;
}

export function getUpsellPrompt(callCount: number): string | null {
  if (!shouldTriggerUpsell(callCount)) return null;
  const pctUsed = Math.round((callCount / FREE_CREDIT_LIMIT) * 100);
  return `You've used ${pctUsed}% of your free credits (${callCount}/${FREE_CREDIT_LIMIT}). Upgrade to Standard for unlimited API access, priority support, and advanced features.`;
}

export function estimateUpsellRevenue(params: {
  totalUsers: number;
  dailyFreeCallUsers: number;
  upsellConversionRate: number;
  standardPrice: number;
}): { dailyTriggers: number; dailyConversions: number; dailyRevenue: number; monthlyRevenue: number } {
  const dailyTriggers = Math.round(params.dailyFreeCallUsers * (params.totalUsers > 0 ? params.totalUsers / 100 : 1));
  const dailyConversions = Math.round(dailyTriggers * params.upsellConversionRate);
  const dailyRevenue = dailyConversions * params.standardPrice;
  return {
    dailyTriggers,
    dailyConversions,
    dailyRevenue,
    monthlyRevenue: dailyRevenue * 30,
  };
}
