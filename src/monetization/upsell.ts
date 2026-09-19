/**
 * Upsell Trigger Engine
 */

interface DBClient {
  query(sql: string, params?: any[]): Promise<any>;
}

export class UpsellEngine {
  private db: DBClient;

  constructor(db: DBClient) {
    this.db = db;
  }

  /**
   * Checks the user's call count and fires the upsell trigger if exactly 5.
   * Returns prompt text if triggered, otherwise null.
   */
  async check_and_trigger_upsell(user_id: string, call_count: number): Promise<string | null> {
    if (call_count === 5) {
      try {
        // Idempotency: PRIMARY KEY (user_id, trigger_type) prevents double inserts
        await this.db.query(
          'INSERT INTO upsell_triggers (user_id, trigger_type, converted) VALUES ($1, $2, FALSE)',
          [user_id, 'half_free_limit']
        );
        
        // Return variant A/B based on some logic, or a default
        // Simple hash of user_id to decide A/B
        const isVariantB = parseInt(user_id.replace(/\D/g, '') || '0', 10) % 2 === 0;
        
        if (isVariantB) {
          return "You're flying through your free calls! Upgrade now to keep the momentum going.";
        } else {
          return "You've used 50% of your free tier limit. Upgrade today for unlimited access.";
        }
      } catch (error: any) {
        // Likely a duplicate key constraint, meaning already triggered
        return null;
      }
    }
    return null;
  }
}
