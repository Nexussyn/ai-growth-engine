import unittest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

from src.agents.auto_upsell import AutoUpsellTrigger

class TestAutoUpsellTrigger(unittest.TestCase):
    def test_free_call_tracking_and_upsell_trigger(self):
        engine = AutoUpsellTrigger(free_limit=5, upsell_discount_pct=15)
        user = "user_test_999"

        # Calls 1 to 5: No trigger
        for i in range(1, 6):
            res = engine.log_api_call(user)
            self.assertFalse(res["triggered"])
            self.assertEqual(res["calls_remaining"], 5 - i)
            print(f"✓ Call #{i} logged (remaining: {5 - i}) passed")

        # Call 6: Triggers upsell prompt!
        res_6 = engine.log_api_call(user)
        self.assertTrue(res_6["triggered"])
        self.assertEqual(res_6["tier"], "PAID_PROMPTED")
        self.assertIn("15% OFF", res_6["message"])
        print("✓ Call #6 triggered auto-upsell prompt passed")

if __name__ == "__main__":
    unittest.main()
