\set ON_ERROR_STOP on
BEGIN;
CREATE SCHEMA pricing_regression;
SET LOCAL search_path TO pricing_regression, pg_catalog;
CREATE TABLE x402_calls (id INTEGER PRIMARY KEY, existing_data TEXT);
INSERT INTO x402_calls VALUES (1, 'preserve me');
\ir ../migrations/add_tiered_pricing.sql

CREATE TEMP TABLE original_tiers AS SELECT id, tier, created_at FROM pricing_tiers;
UPDATE x402_calls SET tier = 'priority', price_per_call = 0.10, priority_flag = TRUE WHERE id = 1;
\ir ../migrations/add_tiered_pricing.sql

DO $$
DECLARE
  ordinal BIGINT;
  expected NUMERIC;
BEGIN
  IF (SELECT count(*) FROM pricing_tiers) <> 4 THEN
    RAISE EXCEPTION 'migration must retain exactly four tiers';
  END IF;
  IF EXISTS (
    SELECT * FROM original_tiers EXCEPT SELECT id, tier, created_at FROM pricing_tiers
  ) THEN
    RAISE EXCEPTION 'rerunning migration changed existing tier identities';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM x402_calls WHERE id = 1 AND existing_data = 'preserve me'
      AND tier = 'priority' AND price_per_call = 0.10 AND priority_flag
  ) THEN
    RAISE EXCEPTION 'migration overwrote existing payment data';
  END IF;
  FOR ordinal, expected IN
    SELECT * FROM (VALUES (1::BIGINT, 0.00), (50, 0.00), (51, 0.01), (500, 0.01), (501, 0.03)) AS cases(n, price)
  LOOP
    IF get_tier_price(ordinal, FALSE) <> expected OR get_tier_price(ordinal, TRUE) <> 0.10 THEN
      RAISE EXCEPTION 'incorrect price at call %', ordinal;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pricing_tiers WHERE tier <> 'priority' AND ordinal >= call_min
        AND (call_max IS NULL OR ordinal <= call_max) AND price_per_call = expected
    ) THEN
      RAISE EXCEPTION 'metadata and function disagree at call %', ordinal;
    END IF;
  END LOOP;
  FOREACH ordinal IN ARRAY ARRAY[NULL, 0, -1, 9007199254740992]::BIGINT[] LOOP
    BEGIN
      PERFORM get_tier_price(ordinal, TRUE);
      RAISE EXCEPTION 'invalid ordinal accepted: %', ordinal;
    EXCEPTION WHEN invalid_parameter_value THEN
      NULL;
    END;
  END LOOP;
  BEGIN
    PERFORM get_tier_price(5, NULL);
    RAISE EXCEPTION 'null priority accepted';
  EXCEPTION WHEN invalid_parameter_value THEN
    NULL;
  END;
  BEGIN
    UPDATE x402_calls SET tier = 'invalid' WHERE id = 1;
    RAISE EXCEPTION 'invalid tier accepted';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
END;
$$;
ROLLBACK;
