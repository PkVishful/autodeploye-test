-- Fix Nandana: Remove from lifecycle, set KYC status to 'new'
-- 1. Mark her allotment as Exited
UPDATE public.tenant_allotments SET staying_status = 'Exited', actual_exit_date = CURRENT_DATE
WHERE id = 'a307b088-c549-4564-8b9c-bcc798960ac7';

-- 2. Set bed B24-B2 back to vacant
UPDATE public.beds SET bed_lifecycle_status = 'vacant'
WHERE id = '4878b203-a8a4-ae51-ee40-ab6717cd55b6';

-- 3. Set Nandana's tenant record to 'new' with kyc_completed = true
UPDATE public.tenants SET staying_status = 'new', kyc_completed = true
WHERE id = 'd8860bc6-5e31-286d-c4aa-7f9582e000fd';