"""
Auto‑content generation for bounty completions.

Features
--------
* Generates a 280‑char tweet, a 5‑tweet thread and a ~300‑word blog post
  from a bounty's title, scope and outcome.
* Persists the generated artefacts in a SQLite `outreach_sent` table.
* (Optional) Publishes the tweet/thread to X/Twitter when credentials are
  provided via environment variables.

Dependencies
------------
pip install openai==1.30.0 tweepy==4.14.0

Configuration
-------------
* `OPENAI_API_KEY` – OpenAI key for content generation.
* `TWITTER_API_KEY`, `TWITTER_API_SECRET_KEY`,
  `TWITTER_ACCESS_TOKEN`, `TWITTER_ACCESS_TOKEN_SECRET` – optional
  credentials for posting to X/Twitter.
"""

import os
import json
import sqlite3
import datetime
from typing import List, Tuple, Optional

import openai
import tweepy

# --------------------------------------------------------------------------- #
#                               CONFIGURATION                               #
# --------------------------------------------------------------------------- #

# OpenAI
openai.api_key = os.getenv("OPENAI_API_KEY")
if not openai.api_key:
    raise RuntimeError("OPENAI_API_KEY environment variable not set")

# SQLite DB (in the same directory as this script)
DB_PATH = os.getenv("OUTREACH_DB_PATH", "outreach.db")

# --------------------------------------------------------------------------- #
#                               DATABASE HELPERS                              #
# --------------------------------------------------------------------------- #

def _init_db() -> None:
    """Create the outreach_sent table if it does not exist."""
    with sqlite3.connect(DB_PATH) as conn:
        cur = conn.cursor()
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS outreach_sent (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                bounty_id     TEXT NOT NULL,
                tweet         TEXT NOT NULL,
                thread_json   TEXT NOT NULL,   -- JSON array of tweets
                blog_post     TEXT NOT NULL,
                created_at    TEXT NOT NULL
            )
            """
        )
        conn.commit()


def store_outreach(
    bounty_id: str,
    tweet: str,
    thread: List[str],
    blog_post: str,
) -> None:
    """Insert a generated outreach record into the DB."""
    created_at = datetime.datetime.utcnow().isoformat()
    thread_json = json.dumps(thread, ensure_ascii=False)

    with sqlite3.connect(DB_PATH) as conn:
        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO outreach_sent (bounty_id, tweet, thread_json, blog_post, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (bounty_id, tweet, thread_json, blog_post, created_at),
        )
        conn.commit()


# --------------------------------------------------------------------------- #
#                               CONTENT GENERATION                             #
# --------------------------------------------------------------------------- #

_SYSTEM_PROMPT = (
    "You are a concise, witty, and technically accurate content writer. "
    "Given a bounty title, its scope and the outcome of the work, you will "
    "produce three artefacts:\n"
    "1. A single tweet (max 280 characters) that teases the result.\n"
    "2. A 5‑tweet thread, each tweet ≤ 280 characters, that expands on the "
    "result, keeping a logical flow.\n"
    "3. A short blog post (~300 words) that explains the problem, the approach, "
    "and the outcome in a friendly tone.\n"
    "All outputs must be in plain English, no markdown, no bullet points unless "
    "they are part of the tweet thread, and must not contain any placeholders."
)

def _call_openai(messages: List[dict]) -> str:
    """Wrap OpenAI ChatCompletion call with basic error handling."""
    response = openai.ChatCompletion.create(
        model="gpt-4o-mini",
        messages=messages,
        temperature=0.7,
        max_tokens=1000,
    )
    return response.choices[0].message.content.strip()


def generate_content(
    title: str,
    scope: str,
    outcome: str,
) -> Tuple[str, List[str], str]:
    """
    Generate tweet, thread and blog post using OpenAI.

    Returns
    -------
    tweet : str
        280‑character teaser.
    thread : List[str]
        List of 5 tweets.
    blog_post : str
        ~300‑word article.
    """
    user_prompt = (
        f"Bounty Title: {title}\n"
        f"Scope: {scope}\n"
        f"Outcome: {outcome}\n\n"
        "Provide the three artefacts in the following JSON format:\n"
        '{\n  "tweet": "...",\n  "thread": ["...", "...", "...", "...", "..."],\n'
        '  "blog_post": "..." \n}'
    )
    messages = [
        {"role": "system", "content": _SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt},
    ]

    raw = _call_openai(messages)

    # The model is instructed to output JSON – parse it safely.
    try:
        data = json.loads(raw)
        tweet = data["tweet"]
        thread = data["thread"]
        blog_post = data["blog_post"]
    except (json.JSONDecodeError, KeyError) as exc:
        raise RuntimeError(f"Failed to parse OpenAI output: {exc}\nRaw output:\n{raw}")

    # Basic sanity checks
    if len(tweet) > 280:
        tweet = tweet[:277] + "..."
    if len(thread) != 5:
        raise RuntimeError("Thread does not contain exactly 5 tweets")
    thread = [t[:280] + ("..." if len(t) > 280 else "") for t in thread]
    # Approximate word count for blog post (1 word ≈ 5 chars)
    if len(blog_post.split()) > 350:  # give a small buffer
        # truncate to first 300 words
        blog_post = " ".join(blog_post.split()[:300]) + "..."

    return tweet, thread, blog_post


# --------------------------------------------------------------------------- #
#                               TWITTER POSTING                               #
# --------------------------------------------------------------------------- #

def _get_twitter_client() -> Optional[tweepy.Client]:
    """Create a Tweepy client if all credentials are present, else None."""
    keys = {
        "api_key": os.getenv("TWITTER_API_KEY"),
        "api_secret": os.getenv("TWITTER_API_SECRET_KEY"),
        "access_token": os.getenv("TWITTER_ACCESS_TOKEN"),
        "access_secret": os.getenv("TWITTER_ACCESS_TOKEN_SECRET"),
    }
    if all(keys.values()):
        return tweepy.Client(
            consumer_key=keys["api_key"],
            consumer_secret=keys["api_secret"],
            access_token=keys["access_token"],
            access_token_secret=keys["access_secret"],
        )
    return None


def post_to_twitter(tweet: str, thread: List[str]) -> None:
    """
    Publish the tweet and its thread to X/Twitter.

    Parameters
    ----------
    tweet : str
        The first tweet (will be posted as the root of the thread).
    thread : List[str]
        Subsequent tweets in order.
    """
    client = _get_twitter_client()
    if client is None:
        print("Twitter credentials not found – skipping posting.")
        return

    # Post the root tweet
    response = client.create_tweet(text=tweet)
    if not response.data or "id" not in response.data:
        raise RuntimeError("Failed to post root tweet")
    parent_id = response.data["id"]

    # Post each reply in order
    for reply in thread:
        resp = client.create_tweet(text=reply, in_reply_to_tweet_id=parent_id)
        if not resp.data or "id" not in resp.data:
            raise RuntimeError("Failed to post thread tweet")
        parent_id = resp.data["id"]


# --------------------------------------------------------------------------- #
#                               MAIN PROCESSOR                                #
# --------------------------------------------------------------------------- #

def process_bounty_completion(
    bounty_id: str,
    title: str,
    scope: str,
    outcome: str,
    post_to_x: bool = False,
) -> None:
    """
    End‑to‑end handler for a completed bounty.

    Steps
    -----
    1. Generate tweet, thread and blog post.
    2. Store them in the `outreach_sent` table.
    3. Optionally publish to X/Twitter.

    Parameters
    ----------
    bounty_id : str
        Unique identifier of the bounty (e.g., PR SHA or DB key).
    title, scope, outcome : str
        Textual description of the bounty.
    post_to_x : bool, optional
        If True, attempt to post to Twitter using available credentials.
    """
    # Ensure DB schema exists
    _init_db()

    # 1️⃣ Generation
    tweet, thread, blog_post = generate_content(title, scope, outcome)

    # 2️⃣ Persistence
    store_outreach(bounty_id, tweet, thread, blog_post)

    # 3️⃣ Optional publishing
    if post_to_x:
        try:
            post_to_twitter(tweet, thread)
        except Exception as e:
            # Publishing failures should not crash the pipeline
            print(f"Error posting to Twitter: {e}")


# --------------------------------------------------------------------------- #
#                               USAGE EXAMPLE                                 #
# --------------------------------------------------------------------------- #

if __name__ == "__main__":
    # Example payload – in a real system this would come from the bounty system.
    example = {
        "bounty_id": "pr-1234",
        "title": "Add CSV export to the analytics dashboard",
        "scope": "Implement a backend endpoint that returns the current analytics data as CSV, add a download button to the UI, and write tests.",
        "outcome": "Implemented `/api/analytics/export` returning UTF‑8 CSV, added a 'Download CSV' button, and achieved 95% test coverage. The feature is now live on production.",
    }

    process_bounty_completion(
        bounty_id=example["bounty_id"],
        title=example["title"],
        scope=example["scope"],
        outcome=example["outcome"],
        post_to_x=False,  # set True when credentials are configured
    )