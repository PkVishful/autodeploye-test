
-- Phase 1A: Make receipts.invoice_id nullable and add tenant_id
ALTER TABLE receipts ALTER COLUMN invoice_id DROP NOT NULL;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id);

-- Backfill tenant_id from existing invoice joins
UPDATE receipts r SET tenant_id = i.tenant_id
FROM invoices i WHERE r.invoice_id = i.id AND r.tenant_id IS NULL;

-- Phase 1B: Create tenant_adjustments table
CREATE TABLE IF NOT EXISTS tenant_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  allotment_id uuid REFERENCES tenant_allotments(id),
  adjustment_type text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  reason text,
  reference_number text,
  adjustment_date date NOT NULL DEFAULT CURRENT_DATE,
  billing_month text,
  property_id uuid REFERENCES properties(id),
  apartment_id uuid REFERENCES apartments(id),
  bed_id uuid REFERENCES beds(id),
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE tenant_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members access tenant_adjustments"
  ON tenant_adjustments FOR ALL TO public
  USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Enable read tenant_adjustments"
  ON tenant_adjustments FOR SELECT TO public
  USING (true);
