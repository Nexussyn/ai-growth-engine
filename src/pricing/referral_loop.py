#!/usr/bin/env python3
"""
⚡ Referral Reward Loop Engine (#2)
Calculates referral bonus credits, tracks referral codes, and applies +20% conversion reward discounts.
"""

import time
import hashlib

class ReferralRewardLoop:
    def __init__(self, reward_pct=20.0, bonus_credits=10):
        self.reward_pct = reward_pct
        self.bonus_credits = bonus_credits
        self.referrals = {}

    def generate_referral_code(self, user_id):
        raw = f"{user_id}:{time.time()}"
        code = f"REF-{hashlib.md5(raw.encode()).hexdigest()[:8].upper()}"
        self.referrals[code] = {
            "referrer_id": user_id,
            "referred_users": [],
            "total_bonus_credits": 0,
            "created_at": time.time()
        }
        return code

    def apply_referral(self, referral_code, new_user_id, base_price=100.0):
        if referral_code not in self.referrals:
            return {
                "success": False,
                "error": "Invalid referral code",
                "final_price": base_price
            }

        ref_data = self.referrals[referral_code]
        if new_user_id in ref_data["referred_users"]:
            return {
                "success": False,
                "error": "User already redeemed this referral code",
                "final_price": base_price
            }

        discount = round((base_price * self.reward_pct) / 100.0, 2)
        final_price = round(base_price - discount, 2)

        ref_data["referred_users"].append(new_user_id)
        ref_data["total_bonus_credits"] += self.bonus_credits

        return {
            "success": True,
            "referrer_id": ref_data["referrer_id"],
            "new_user_id": new_user_id,
            "discount_applied_usd": discount,
            "final_price_usd": final_price,
            "referrer_bonus_credits": ref_data["total_bonus_credits"]
        }
