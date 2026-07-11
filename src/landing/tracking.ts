/**
 * Conversion Tracking — Issue #4
 * Local tracking for mobile vs desktop conversions
 */

export interface ConversionEvent {
  wallet: string;
  mobile: boolean;
  timestamp: number;
  converted: boolean;
}

/**
 * Logs a conversion event locally
 */
export function logConversion(wallet: string, mobile: boolean): ConversionEvent {
  const event: ConversionEvent = {
    wallet,
    mobile,
    timestamp: Date.now(),
    converted: true,
  };

  // Persist to localStorage
  try {
    const existing = JSON.parse(localStorage.getItem('conversion_events') || '[]');
    existing.push(event);
    localStorage.setItem('conversion_events', JSON.stringify(existing));
  } catch {
    // localStorage not available (SSR)
  }

  return event;
}

/**
 * Returns conversion stats
 */
export function getConversionStats(): { mobile: number; desktop: number; total: number } {
  try {
    const events: ConversionEvent[] = JSON.parse(localStorage.getItem('conversion_events') || '[]');
    const mobile = events.filter(e => e.mobile).length;
    const desktop = events.filter(e => !e.mobile).length;
    return { mobile, desktop, total: events.length };
  } catch {
    return { mobile: 0, desktop: 0, total: 0 };
  }
}
