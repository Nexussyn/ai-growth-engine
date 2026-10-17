/**
 * Auto-Upsell Trigger — Issue #3
 * Middleware that checks call count and sets X-Upsell-Prompt header
 * when user reaches 50% of free limit (5th call out of 10).
 */

export interface UpsellConfig {
  freeCallLimit: number;
  thresholdPercent: number;
}

export interface UpsellResult {
  trigger: boolean;
  prompt: string;
  variant: string;
}

export interface MiddlewareContext {
  userId: string;
  callCount: number;
  headers: Record<string, string>;
  onTrigger?: (result: UpsellResult) => void;
}

const DEFAULT_CONFIG: UpsellConfig = {
  freeCallLimit: 10,
  thresholdPercent: 50,
};

const PROMPT_VARIANTS: Record<string, string> = {
  A: 'You have used 50% of your free calls. Upgrade now for unlimited access and priority support.',
  B: 'Halfway there! You have 5 free calls remaining. Unlock unlimited calls with our Pro plan.',
};

/**
 * Deterministically assigns A/B variant based on user ID hash.
 */
export function assignVariant(userId: string): 'A' | 'B' {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash + userId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 2 === 0 ? 'A' : 'B';
}

/**
 * Checks if the upsell threshold has been crossed.
 */
export function shouldTriggerUpsell(
  callCount: number,
  config: UpsellConfig = DEFAULT_CONFIG
): boolean {
  const threshold = Math.floor(config.freeCallLimit * config.thresholdPercent / 100);
  return callCount === threshold;
}

/**
 * Generates upsell prompt text based on variant and usage.
 */
export function generateUpsellPrompt(
  callCount: number,
  config: UpsellConfig = DEFAULT_CONFIG,
  variant?: 'A' | 'B'
): UpsellResult {
  const v = variant || 'A';
  const remaining = config.freeCallLimit - callCount;
  const prompt = PROMPT_VARIANTS[v];

  return {
    trigger: true,
    prompt,
    variant: v,
  };
}

/**
 * Middleware function that checks call count and sets trigger flag.
 * Idempotent: only fires once per threshold crossing (5th call).
 *
 * @returns MiddlewareContext with updated headers and upsell result
 */
export function upsellMiddleware(
  ctx: MiddlewareContext,
  config: UpsellConfig = DEFAULT_CONFIG
): MiddlewareContext {
  const { userId, callCount } = ctx;
  const newHeaders = { ...ctx.headers };

  if (shouldTriggerUpsell(callCount, config)) {
    const variant = assignVariant(userId);
    const result = generateUpsellPrompt(callCount, config, variant);

    newHeaders['X-Upsell-Prompt'] = 'true';
    newHeaders['X-Upsell-Variant'] = variant;

    if (ctx.onTrigger) {
      ctx.onTrigger(result);
    }

    return { ...ctx, headers: newHeaders, onTrigger: ctx.onTrigger };
  }

  return ctx;
}

/**
 * Creates a Deno/oak-style middleware for HTTP frameworks.
 * Compatible with Hono, Oak, or custom fetch handlers.
 */
export function createUpsellMiddleware(config: UpsellConfig = DEFAULT_CONFIG) {
  return async (ctx: any, next: () => Promise<void>) => {
    const userId = ctx.headers?.['X-User-Id'] || ctx.state?.user?.id || 'anonymous';
    const callCount = parseInt(ctx.headers?.['X-Call-Count'] || '0', 10);

    if (shouldTriggerUpsell(callCount, config)) {
      const variant = assignVariant(userId);
      const result = generateUpsellPrompt(callCount, config, variant);

      ctx.headers['X-Upsell-Prompt'] = 'true';
      ctx.headers['X-Upsell-Variant'] = variant;
    }

    await next();
  };
}