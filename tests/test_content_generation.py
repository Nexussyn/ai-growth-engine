import unittest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

from src.agents.content_generation import ContentGenerationAgent

class TestContentGenerationAgent(unittest.TestCase):
    def test_format_bounty_announcement(self):
        agent = ContentGenerationAgent(platform="twitter")
        post = agent.format_bounty_announcement(
            repo_name="bounty-plaza",
            issue_number=802,
            reward_str="$1,500 USD",
            pr_url="https://github.com/zhangjiayang6835-cyber/bounty-plaza/pull/804",
            wallet_address="0x19A58A880a6e76d78eB1A56fe5B15708E9F0073D"
        )
        self.assertEqual(post["status"], "READY_TO_POST")
        self.assertIn("bounty-plaza#802", post["title"])
        self.assertIn("$1,500 USD", post["formatted_post"])
        self.assertIn("0x19A5...073D", post["formatted_post"])
        print("✓ test_format_bounty_announcement passed")

if __name__ == "__main__":
    unittest.main()
