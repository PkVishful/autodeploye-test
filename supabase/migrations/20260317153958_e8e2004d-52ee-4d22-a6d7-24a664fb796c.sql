
-- Add status column to owners table (active/inactive)
ALTER TABLE public.owners ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

-- Add reference_number column to owner_payments table
ALTER TABLE public.owner_payments ADD COLUMN IF NOT EXISTS reference_number text;
