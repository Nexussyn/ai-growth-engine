-- outreach_sent: content-agent outputs for completed bounties (Issue #5)
-- Safe to re-run.

create table if not exists outreach_sent (
  id uuid primary key default gen_random_uuid(),
  bounty_id text not null,
  channel text not null default 'content_agent',
  content jsonb not null,
  sent_at timestamptz not null default now()
);

create index if not exists outreach_sent_bounty_id_idx
  on outreach_sent (bounty_id);

create index if not exists outreach_sent_channel_idx
  on outreach_sent (channel);

comment on table outreach_sent is
  'Generated social/blog outreach from content-agent; unique per bounty completion';
