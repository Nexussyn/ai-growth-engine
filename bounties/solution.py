import os
import json
import datetime
from typing import List, Dict, Optional

import sqlalchemy as sa
from sqlalchemy.orm import sessionmaker, declarative_base, Mapped, mapped_column

# ---------- Configuration ----------
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
TWITTER_API_KEY = os.getenv("TWITTER_API_KEY")
TWITTER_API_SECRET = os.getenv("TWITTER_API_SECRET")
TWITTER_ACCESS_TOKEN = os.getenv("TWITTER_ACCESS_TOKEN")
TWITTER_ACCESS_SECRET = os.getenv("TWITTER_ACCESS_SECRET")

# ---------- Database Setup ----------
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///bounties.db")
engine = sa.create_engine(DATABASE_URL, echo=False, future=True)
Session = sessionmaker(bind=engine, future=True)

Base = declarative_base()


class Bounty(Base):
    __tablename__ = "bounty"
    id: Mapped[int] = mapped_column(sa.Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(sa.String, nullable=False)
    scope: Mapped[str] = mapped_column(sa.Text, nullable=False)
    outcome: Mapped[str] = mapped_column(sa.Text, nullable=False)
    execution_status: Mapped[str] = mapped_column(sa.String, nullable=False)  # e.g., "done"
    merged_pr_url: Mapped[Optional[str]] = mapped_column(sa.String, nullable=True)


class OutreachSent(Base):
    __tablename__ = "outreach_sent"
    id: Mapped[int] = mapped_column(sa.Integer, primary_key=True, autoincrement=True)
    bounty_id: Mapped[int] = mapped_column(sa.Integer, sa.ForeignKey("bounty.id"), nullable=False)
    tweet: Mapped[str] = mapped_column(sa.String(280), nullable=False)
    thread: Mapped[str] = mapped_column(sa.Text, nullable=False)  # JSON list of tweets
    blog_post: Mapped[str] = mapped_column(sa.Text, nullable=False)
    posted_to_twitter: Mapped[bool] = mapped_column(sa.Boolean, default=False)
    created_at: Mapped[datetime.datetime] = mapped_column(
        sa.DateTime, default=datetime.datetime.utcnow
    )


Base.metadata.create_all(engine)

# ---------- LLM Generation ----------
def _call_openai(prompt: str, max_tokens: int = 300) -> str:
    """Simple wrapper around OpenAI ChatCompletion."""
    import openai

    openai.api_key = OPENAI_API_KEY
    response = openai.ChatCompletion.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=max_tokens,
        temperature=0.7,
    )
    return response.choices[0].message.content.strip()


def generate_tweet(title: str, outcome: str) -> str:
    prompt = (
        f"Write a concise, engaging tweet (max 280 characters) announcing the completion of a bounty.\n"
        f"Bounty title: {title}\n"
        f"Outcome summary: {outcome}\n"
        f"Include a call‑to‑action and a relevant hashtag."
    )
    return _call_openai(prompt, max_tokens=80)


def generate_thread(title: str, scope: str, outcome: str) -> List[str]:
    prompt = (
        f"Create a 5‑tweet thread (each tweet ≤280 characters) that explains a completed bounty.\n"
        f"Tweet 1: hook with the title.\n"
        f"Tweet 2: brief description of the scope.\n"
        f"Tweet 3‑4: highlight key results/outcome.\n"
        f"Tweet 5: call‑to‑action, link placeholder, and hashtags.\n"
        f"Bounty title: {title}\n"
        f"Scope: {scope}\n"
        f"Outcome: {outcome}"
    )
    raw = _call_openai(prompt, max_tokens=500)
    # Expecting numbered list or JSON; fallback split by newline.
    lines = [ln.strip("- ").strip() for ln in raw.splitlines() if ln.strip()]
    # Keep only first 5 non‑empty lines
    return lines[:5]


def generate_blog_post(title: str, scope: str, outcome: str) -> str:
    prompt = (
        f"Write a ~300‑word blog post announcing the successful completion of a bounty.\n"
        f"Include:\n"
        f"- An engaging introduction mentioning the title.\n"
        f"- A brief overview of the scope.\n"
        f"- Detailed description of the outcome and its impact.\n"
        f"- A concluding paragraph with a call‑to‑action.\n"
        f"Bounty title: {title}\n"
        f"Scope: {scope}\n"
        f"Outcome: {outcome}"
    )
    return _call_openai(prompt, max_tokens=600)


# ---------- Twitter Posting ----------
def post_thread_to_twitter(thread: List[str]) -> bool:
    """Posts a thread to Twitter/X using Tweepy. Returns True on success."""
    if not all([TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET]):
        return False

    import tweepy

    auth = tweepy.OAuth1UserHandler(
        TWITTER_API_KEY,
        TWITTER_API_SECRET,
        TWITTER_ACCESS_TOKEN,
        TWITTER_ACCESS_SECRET,
    )
    api = tweepy.API(auth)

    try:
        # Post first tweet
        tweet = api.update_status(status=thread[0])
        reply_id = tweet.id
        # Post subsequent tweets as replies
        for tweet_text in thread[1:]:
            tweet = api.update_status(status=tweet_text, in_reply_to_status_id=reply_id, auto_populate_reply_metadata=True)
            reply_id = tweet.id
        return True
    except Exception as e:
        print(f"Twitter posting failed: {e}")
        return False


# ---------- Core Agent ----------
def process_completed_bounties(post_to_twitter: bool = True) -> None:
    """Main entry point – scans for completed bounties and generates outreach content."""
    with Session() as session:
        # Find bounties marked done that haven't been processed yet
        subq = sa.select(OutreachSent.bounty_id)
        pending = (
            session.execute(
                sa.select(Bounty)
                .where(Bounty.execution_status == "done")
                .where(~Bounty.id.in_(subq))
            )
            .scalars()
            .all()
        )

        for bounty in pending:
            tweet = generate_tweet(bounty.title, bounty.outcome)
            thread = generate_thread(bounty.title, bounty.scope, bounty.outcome)
            blog = generate_blog_post(bounty.title, bounty.scope, bounty.outcome)

            posted = False
            if post_to_twitter:
                posted = post_thread_to_twitter(thread)

            outreach = OutreachSent(
                bounty_id=bounty.id,
                tweet=tweet,
                thread=json.dumps(thread, ensure_ascii=False),
                blog_post=blog,
                posted_to_twitter=posted,
            )
            session.add(outreach)
        session.commit()


# ---------- CLI ----------
if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Bounty outreach content generator")
    parser.add_argument(
        "--no-twitter",
        action="store_true",
        help="Generate content but do NOT attempt to post to Twitter/X",
    )
    args = parser.parse_args()
    process_completed_bounties(post_to_twitter=not args.no_twitter)