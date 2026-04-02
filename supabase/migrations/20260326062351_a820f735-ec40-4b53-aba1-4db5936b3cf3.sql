UPDATE public.invoices
SET
  invoice_date = CASE WHEN invoice_date IS NOT NULL THEN invoice_date + 1 ELSE NULL END,
  due_date = CASE WHEN due_date IS NOT NULL THEN due_date + 1 ELSE NULL END;

UPDATE public.receipts r
SET
  payment_date = CASE WHEN r.payment_date IS NOT NULL THEN r.payment_date + 1 ELSE NULL END,
  tenant_allotment_id = COALESCE(r.tenant_allotment_id, i.allotment_id)
FROM public.invoices i
WHERE r.invoice_id = i.id;