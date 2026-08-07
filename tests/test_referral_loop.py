import unittest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

from src.pricing.referral_loop import ReferralRewardLoop

class TestReferralRewardLoop(unittest.TestCase):
    def test_referral_generation_and_discount(self):
        engine = ReferralRewardLoop(reward_pct=20.0, bonus_credits=10)
        ref_code = engine.generate_referral_code("referrer_123")
        self.assertTrue(ref_code.startswith("REF-"))

        res = engine.apply_referral(ref_code, "new_user_456", base_price=100.0)
        self.assertTrue(res["success"])
        self.assertEqual(res["discount_applied_usd"], 20.0)
        self.assertEqual(res["final_price_usd"], 80.0)
        self.assertEqual(res["referrer_bonus_credits"], 10)
        print("✓ test_referral_generation_and_discount passed")

    def test_invalid_referral_code(self):
        engine = ReferralRewardLoop()
        res = engine.apply_referral("REF-INVALID", "new_user_456", base_price=100.0)
        self.assertFalse(res["success"])
        self.assertEqual(res["error"], "Invalid referral code")
        print("✓ test_invalid_referral_code passed")

if __name__ == "__main__":
    unittest.main()
