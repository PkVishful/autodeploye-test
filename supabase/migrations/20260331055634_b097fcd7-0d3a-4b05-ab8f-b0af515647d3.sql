
ALTER TABLE public.tab_permissions
  ADD COLUMN IF NOT EXISTS can_create boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_read boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_update boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_delete boolean NOT NULL DEFAULT false;

-- Backfill: visible tabs get read access
UPDATE public.tab_permissions SET can_read = is_visible;
