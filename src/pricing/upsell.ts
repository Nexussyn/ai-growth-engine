/**
 * Upsell Middleware — Issue #3
 * Checks call count and determines if upsell trigger should fire
 */

import { formatUpsellResponse } from './prompts.ts';

export interface UpsellConfig {
  /** Total free calls before upsell triggers */
  freeLimit: number;
  /** Fraction of free limit that triggers upsell (0-1) */
  threshold: number;
}

const DEFAULT_CONFIG: UpsellConfig = {
  freeLimit: 10,
  threshold: 0.5,
};

/**
 * Determines whether an upsell prompt should be shown.
 * - Triggers exactly once per user when callCount == threshold * freeLimit
 * - Idempotent: same user won't get prompted twice
 */
export function shouldUpsell(
  callCount: number,
  alreadyTriggered: boolean,
  config: UpsellConfig = DEFAULT_CONFIG,
): boolean {
  if (alreadyTriggered) return false;
  const triggerAt = Math.round(config.freeLimit * config.threshold);
  return callCount === triggerAt;
}

/**
 * Creates the upsell response payload
 */
export function createUpsellResponse(
  callCount: number,
  userId: string,
  alreadyTriggered: boolean,
  config?: UpsellConfig,
): Record<string, unknown> {
  const triggered = shouldUpsell(callCount, alreadyTriggered, config);
  return formatUpsellResponse(triggered, userId);
}

export { DEFAULT_CONFIG };
