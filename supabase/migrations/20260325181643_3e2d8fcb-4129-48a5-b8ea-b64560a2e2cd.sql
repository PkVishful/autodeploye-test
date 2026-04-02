ALTER TABLE public.receipts
ADD COLUMN bank_account_id uuid REFERENCES public.organization_bank_accounts(id) ON DELETE SET NULL;