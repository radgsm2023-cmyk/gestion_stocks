/*
# Add handling fee (frais de manutention) to purchases

1. Modified Tables
- `purchases`: adds `handling_fee` numeric column (default 0) to store the handling/storage fee for each purchase.
2. Notes
- The handling fee is an additional cost per purchase for putting products into the depot/warehouse.
- It defaults to 0 so existing purchases are unaffected.
- No RLS changes needed — existing policies already cover the new column.
*/

ALTER TABLE purchases
ADD COLUMN IF NOT EXISTS handling_fee numeric NOT NULL DEFAULT 0;
