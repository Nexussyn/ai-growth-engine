\set ON_ERROR_STOP on

BEGIN;
CREATE SCHEMA upsell_test;
SET LOCAL search_path = upsell_test, public;
SET LOCAL plpgsql.check_asserts = on;
\ir ../migrations/add_upsell_triggers.sql

DO $$
BEGIN
  ASSERT check_upsell_trigger('alice', 4) = '{"upsell": false}'::jsonb,
    'The fourth call must not trigger an upsell';
  ASSERT (SELECT count(*) FROM upsell_triggers) = 0,
    'Calls below the threshold must not insert a trigger';
  ASSERT check_upsell_trigger('alice', 5)->>'upsell' = 'true',
    'The fifth call must trigger an upsell';
  ASSERT check_upsell_trigger('alice', 5) = '{"upsell": false}'::jsonb,
    'Repeating the fifth call must not trigger another upsell';
  ASSERT check_upsell_trigger('alice', 6) = '{"upsell": false}'::jsonb,
    'The sixth call must not trigger an upsell';
  ASSERT (SELECT count(*) FROM upsell_triggers WHERE user_id = 'alice') = 1,
    'Exactly one trigger must be stored per user';
  ASSERT (SELECT trigger_type = 'free_limit_50pct' AND shown_at IS NOT NULL AND converted = false
    FROM upsell_triggers WHERE user_id = 'alice'),
    'Trigger metadata must be populated';
  ASSERT check_upsell_trigger('bob', 5)->>'upsell' = 'true',
    'A different user must receive their own trigger';
END;
$$;

ROLLBACK;
