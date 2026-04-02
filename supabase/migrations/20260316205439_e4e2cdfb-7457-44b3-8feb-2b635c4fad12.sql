-- Add actual_due_date column for cash flow / accounting integration
ALTER TABLE public.owner_payments ADD COLUMN actual_due_date date NULL;

-- Delete all existing payment records to start fresh
DELETE FROM public.owner_payments;