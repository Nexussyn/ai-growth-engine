import { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

export interface UpsellTriggerResult {
  upsell: boolean;
  prompt?: string;
}

/**
 * Checks call count and triggers upsell logic.
 * Fires exactly on the 5th call.
 */
export async function checkAndTriggerUpsell(
  db: SupabaseClient,
  userId: string,
  callCount: number,
  usagePattern = 'general'
): Promise<UpsellTriggerResult> {
  if (callCount === 5) {
    try {
      // Insert to DB (idempotent because of unique constraint on user_id, trigger_type)
      const { error } = await db
        .from('upsell_triggers')
        .insert({
          user_id: userId,
          trigger_type: 'free_limit_50pct',
          converted: false
        });

      if (error) {
        return { upsell: false };
      }

      // Generate prompt variants dynamically based on usage pattern
      let prompt = 'You have used 50% of your free calls. Upgrade for unlimited access.';
      if (usagePattern === 'speed') {
        prompt = 'Speed up your workflow! Upgrade to premium for 10x faster response times.';
      } else if (usagePattern === 'volume') {
        prompt = 'High volume detected. Unlock unlimited calls by upgrading to standard/premium tier.';
      }

      return { upsell: true, prompt };
    } catch (_e) {
      return { upsell: false };
    }
  }

  return { upsell: false };
}

/**
 * Middleware function that checks call count and sets trigger headers.
 */
export function upsellMiddleware(db: SupabaseClient) {
  return async (req: Request, next: (req: Request) => Promise<Response>): Promise<Response> => {
    const userId = req.headers.get('X-User-Id');
    const callCountStr = req.headers.get('X-Call-Count');

    if (!userId || !callCountStr) {
      return await next(req);
    }

    const callCount = parseInt(callCountStr, 10);
    const usagePattern = req.headers.get('X-Usage-Pattern') || 'general';

    const result = await checkAndTriggerUpsell(db, userId, callCount, usagePattern);
    const res = await next(req);

    if (result.upsell && result.prompt) {
      res.headers.set('X-Upsell-Prompt', 'true');
      res.headers.set('X-Upsell-Prompt-Text', result.prompt);
    }

    return res;
  };
}
