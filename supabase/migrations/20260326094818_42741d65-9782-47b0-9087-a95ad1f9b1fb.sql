
-- Drop payment_allocations table
DROP TABLE IF EXISTS public.payment_allocations;

-- Drop FIFO-related columns from invoices
ALTER TABLE public.invoices DROP COLUMN IF EXISTS amount_paid;
ALTER TABLE public.invoices DROP COLUMN IF EXISTS balance;

-- Drop invoice_id from receipts (decouple receipts from invoices)
ALTER TABLE public.receipts DROP COLUMN IF EXISTS invoice_id;
