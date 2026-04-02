
-- Add missing columns to ticket_logs
ALTER TABLE public.ticket_logs ADD COLUMN IF NOT EXISTS details text;
ALTER TABLE public.ticket_logs ADD COLUMN IF NOT EXISTS performed_by uuid;
ALTER TABLE public.ticket_logs ADD COLUMN IF NOT EXISTS photo_urls text[];
ALTER TABLE public.ticket_logs ADD COLUMN IF NOT EXISTS cost_item text;
ALTER TABLE public.ticket_logs ADD COLUMN IF NOT EXISTS cost_quantity integer;
ALTER TABLE public.ticket_logs ADD COLUMN IF NOT EXISTS cost_unit_price numeric;
ALTER TABLE public.ticket_logs ADD COLUMN IF NOT EXISTS cost_total numeric;

-- Add missing columns to ticket_assignment_rules
ALTER TABLE public.ticket_assignment_rules ADD COLUMN IF NOT EXISTS rule_type text NOT NULL DEFAULT 'issue_type';
ALTER TABLE public.ticket_assignment_rules ADD COLUMN IF NOT EXISTS apartment_code text;
-- Make issue_type_id nullable (apartment rules don't need it)
ALTER TABLE public.ticket_assignment_rules ALTER COLUMN issue_type_id DROP NOT NULL;
