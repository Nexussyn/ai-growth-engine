-- Add `tier` column to relevant payment table
ALTER TABLE payments
ADD COLUMN tier TEXT;

-- Ensure migration is idempotent
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'payments' AND column_name = 'tier'
    ) THEN
        ALTER TABLE payments
        ADD COLUMN tier TEXT;
    END IF;
END $$;
