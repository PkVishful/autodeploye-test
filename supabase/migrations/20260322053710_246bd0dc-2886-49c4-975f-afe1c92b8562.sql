
-- FIX DATA ANOMALIES FROM BULK IMPORT

-- 1. A23-C1: Sowbarnigaa should be Exited (later tenants already occupied and left)
UPDATE public.tenant_allotments SET staying_status = 'Exited', actual_exit_date = '2024-07-12'
WHERE id = '6b2b7555-7c67-496d-8623-7074259f69de';

-- 2. C44-C1: All Ramkumar allotments → Exited; duplicate Ganesh → Exited
UPDATE public.tenant_allotments SET staying_status = 'Exited', actual_exit_date = '2025-08-17'
WHERE id IN ('acdd3979-dcac-4d20-bd2f-16dd31305565','c63d067e-61af-42da-85c4-a0fc6ee8f5cf',
             '72745d0e-18c0-4c52-ae84-bfbf8492e9ba','1f30a0ee-ae6f-49d6-aad0-d2e8e6cfecb4',
             '6fcb6989-2017-4c18-a59b-abbdd24b8022');

-- 3. B24-B2: Orphaned Staying allotment (no dates) → Exited
UPDATE public.tenant_allotments SET staying_status = 'Exited', actual_exit_date = '2026-03-21'
WHERE id = '586ef8dc-ec86-41b8-857d-edae93e712f3';

-- 4. D12-C1: Mayuri → Exited per user
UPDATE public.tenant_allotments SET staying_status = 'Exited', actual_exit_date = '2026-03-01'
WHERE id = '353d267f-c7d4-4eea-9fe2-707f7c9a70f4';

-- 5. Deduplicate: mark older duplicate allotments as Exited
UPDATE public.tenant_allotments a SET staying_status = 'Exited', actual_exit_date = COALESCE(a.actual_exit_date, CURRENT_DATE)
FROM public.tenant_allotments b
WHERE a.tenant_id = b.tenant_id 
  AND a.bed_id = b.bed_id 
  AND a.staying_status = b.staying_status
  AND a.staying_status != 'Exited'
  AND a.booking_date IS NOT DISTINCT FROM b.booking_date
  AND a.id < b.id;

-- 6. Sync ALL bed_lifecycle_status from actual allotment data
UPDATE public.beds SET bed_lifecycle_status = 'vacant';

UPDATE public.beds b SET bed_lifecycle_status = 
  CASE 
    WHEN EXISTS (SELECT 1 FROM public.tenant_allotments ta WHERE ta.bed_id = b.id AND ta.staying_status = 'On-Notice') THEN
      CASE 
        WHEN EXISTS (SELECT 1 FROM public.tenant_allotments ta WHERE ta.bed_id = b.id AND ta.staying_status = 'Booked') THEN 'notice-booked'
        ELSE 'notice'
      END
    WHEN EXISTS (SELECT 1 FROM public.tenant_allotments ta WHERE ta.bed_id = b.id AND ta.staying_status = 'Staying') THEN 'occupied'
    WHEN EXISTS (SELECT 1 FROM public.tenant_allotments ta WHERE ta.bed_id = b.id AND ta.staying_status = 'Booked') THEN 'booked'
    ELSE 'vacant'
  END;

-- 7. Sync tenant staying_status
UPDATE public.tenants t SET staying_status = 
  CASE
    WHEN EXISTS (SELECT 1 FROM public.tenant_allotments ta WHERE ta.tenant_id = t.id AND ta.staying_status = 'On-Notice') THEN 'on-notice'
    WHEN EXISTS (SELECT 1 FROM public.tenant_allotments ta WHERE ta.tenant_id = t.id AND ta.staying_status = 'Staying') THEN 'staying'
    WHEN EXISTS (SELECT 1 FROM public.tenant_allotments ta WHERE ta.tenant_id = t.id AND ta.staying_status = 'Booked') THEN 'booked'
    ELSE 'exited'
  END;
