import json
from datetime import datetime

class ContentAgent:
    def __init__(self):
        pass

    def generate_content(self, bounty: dict) -> dict:
        title = bounty.get("title", "Bounty")
        scope = bounty.get("scope", "")
        outcome = bounty.get("outcome", "")

        tweet = f"🎉 Bounty Completed! We just finished \"{title}\". It's awesome to see the community grow. Great job! 🚀 #OpenSource #Bounty"
        thread = [
            f"1/ 🚀 We just merged a new completion for \"{title}\"!",
            f"2/ 🛠 The scope of the work was: {scope}",
            f"3/ ✅ Outcome achieved: {outcome}",
            "4/ We are constantly building and expanding. Join our community to claim bounties!",
            "5/ Check out the full details on our repository."
        ]
        blog_post = f"# Success Story: {title}\n\nWe are thrilled to announce the successful completion of another bounty. The objective was to handle: {scope}.\n\nThe outcome is incredible: {outcome}.\n\nThis adds immense value to our platform. We appreciate all the hard work put into this."

        return {
            "tweet": tweet,
            "thread": thread,
            "blog_post": blog_post
        }
