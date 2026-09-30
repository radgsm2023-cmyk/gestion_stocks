-- Add RC, NIF, AI fields to suppliers (customers already have them)
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS rc text DEFAULT '';
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS nif text DEFAULT '';
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS ai text DEFAULT '';
