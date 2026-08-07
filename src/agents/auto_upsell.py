#!/usr/bin/env python3
"""
⚡ Auto-Upsell Trigger Engine (#3)
Tracks free API calls per user and triggers automated upsell prompts after the 5th call to drive +25% revenue conversion.
"""

class AutoUpsellTrigger:
    def __init__(self, free_limit=5, upsell_discount_pct=15):
        self.free_limit = free_limit
        self.upsell_discount_pct = upsell_discount_pct
        self.user_call_counts = {}

    def log_api_call(self, user_id):
        count = self.user_call_counts.get(user_id, 0) + 1
        self.user_call_counts[user_id] = count

        if count > self.free_limit:
            return {
                "triggered": True,
                "call_count": count,
                "tier": "PAID_PROMPTED",
                "message": f"🎉 You have completed {self.free_limit} free calls! Upgrade to Pro now for {self.upsell_discount_pct}% OFF.",
                "upsell_discount_pct": self.upsell_discount_pct
            }

        return {
            "triggered": False,
            "call_count": count,
            "calls_remaining": self.free_limit - count,
            "tier": "FREE"
        }
