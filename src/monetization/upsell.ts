/**
 * Auto-Upsell Trigger — Issue #3
 * Middleware that checks call count and injects upsell prompts.
 */

export type UpsellType = 'free_limit_50pct' | 'free_limit_90pct' | 'free_exhausted';

export interface UpsellResult {
  upsell: boolean;
  type?: UpsellType;
  prompt?: string;
  variant?: 'a' | 'b';
}

const FREE_CALL_LIMIT = 10;

/**
 * The upsell prompt variants for A/B testing.
 */
const PROMPTS: Record<UpsellType, { a: string; b: string }> = {
  free_limit_50pct: {
    a: 'You have used 50% of your free calls. Upgrade for unlimited access.',
    b: 'You are halfway through your free tier. Unlock premium features now.',
  },
  free_limit_90pct: {
    a: 'You have 1 free call remaining. Upgrade to avoid interruptions.',
    b: 'Almost out of free calls — switch to Standard or Premium to keep going.',
  },
  free_exhausted: {
    a: 'All free calls used. Upgrade now to continue using the API.',
    b: 'Your free tier has ended. Choose a plan to keep building.',
  },
};

/**
 * Check if a user should be shown an upsell prompt based on call count.
 * Returns the upsell trigger result with prompt text.
 * Idempotent — triggers fire once per threshold crossing.
 */
export function checkUpsellTrigger(callCount: number): UpsellResult {
  // At 5th call (50% of 10 free calls)
  if (callCount === Math.floor(FREE_CALL_LIMIT * 0.5)) {
    return {
      upsell: true,
      type: 'free_limit_50pct',
      prompt: PROMPTS.free_limit_50pct.a,
      variant: 'a',
    };
  }

  // At 9th call (90% of free calls used)
  if (callCount === Math.floor(FREE_CALL_LIMIT * 0.9)) {
    return {
      upsell: true,
      type: 'free_limit_90pct',
      prompt: PROMPTS.free_limit_90pct.b,
      variant: 'b',
    };
  }

  // When free calls are exhausted
  if (callCount === FREE_CALL_LIMIT) {
    return {
      upsell: true,
      type: 'free_exhausted',
      prompt: PROMPTS.free_exhausted.a,
      variant: 'a',
    };
  }

  return { upsell: false };
}

/**
 * Build the HTTP response headers for upsell prompts.
 * Adds X-Upsell-Prompt header when applicable.
 */
export function buildUpsellHeaders(result: UpsellResult): Record<string, string> {
  const headers: Record<string, string> = {};

  if (result.upsell) {
    headers['X-Upsell-Prompt'] = 'true';
    headers['X-Upsell-Type'] = result.type!;
    headers['X-Upsell-Variant'] = result.variant!;
    headers['X-Upsell-Message'] = result.prompt!;
  } else {
    headers['X-Upsell-Prompt'] = 'false';
  }

  return headers;
}

/**
 * Express/Deno style middleware that integrates upsell check into request/response cycle.
 * In a real app, this would be called after each API call to inject upsell headers.
 */
export function upsellMiddleware(
  userId: string,
  callCount: number
): { upsellResult: UpsellResult; headers: Record<string, string> } {
  const result = checkUpsellTrigger(callCount);
  const headers = buildUpsellHeaders(result);

  // Log the trigger for analytics
  if (result.upsell) {
    console.log(`[UPSELL] userId=${userId} type=${result.type} variant=${result.variant}`);
  }

  return { upsellResult: result, headers };
}
