import unittest
from src.agents.content_agent import ContentAgent

class TestContentAgent(unittest.TestCase):
    def test_generate_content(self):
        agent = ContentAgent()
        bounty = {
            "id": "bounty-1",
            "title": "Build Content Agent",
            "scope": "Auto generate marketing post",
            "outcome": "Content generated"
        }
        res = agent.generate_content(bounty)
        self.assertIn("tweet", res)
        self.assertIn("thread", res)
        self.assertIn("blog_post", res)

if __name__ == "__main__":
    unittest.main()
