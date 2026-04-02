
-- Add gender_allowed to apartments
ALTER TABLE public.apartments ADD COLUMN IF NOT EXISTS gender_allowed text DEFAULT 'both' CHECK (gender_allowed IN ('male', 'female', 'both'));

-- Create team_members table
CREATE TABLE IF NOT EXISTS public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  user_id uuid REFERENCES auth.users(id),
  first_name text NOT NULL,
  last_name text NOT NULL,
  gender text,
  phone text NOT NULL,
  email text NOT NULL,
  date_of_birth date,
  designation text,
  department text,
  joining_date date,
  id_proof_type text,
  id_proof_number text,
  id_proof_url text,
  photo_url text,
  pan_number text,
  aadhar_number text,
  address text,
  city text,
  state text,
  pincode text,
  bank_name text,
  bank_account_number text,
  bank_ifsc text,
  emergency_contact_name text,
  emergency_contact_phone text,
  salary_amount numeric DEFAULT 0,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members access team_members" ON public.team_members FOR ALL USING (organization_id = get_user_org_id(auth.uid()));

-- Team attendance
CREATE TABLE IF NOT EXISTS public.team_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  team_member_id uuid NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  date date NOT NULL,
  status text NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'half_day', 'leave')),
  check_in time,
  check_out time,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.team_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members access team_attendance" ON public.team_attendance FOR ALL USING (organization_id = get_user_org_id(auth.uid()));

-- Team salary payments
CREATE TABLE IF NOT EXISTS public.team_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  team_member_id uuid NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  payment_type text NOT NULL DEFAULT 'salary' CHECK (payment_type IN ('salary', 'advance', 'bonus', 'deduction')),
  amount numeric NOT NULL,
  payment_date date DEFAULT CURRENT_DATE,
  payment_month text,
  payment_mode text,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.team_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members access team_payments" ON public.team_payments FOR ALL USING (organization_id = get_user_org_id(auth.uid()));

-- Storage bucket for documents
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', true) ON CONFLICT (id) DO NOTHING;

-- Storage RLS
CREATE POLICY "Authenticated users can upload documents" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'documents');
CREATE POLICY "Authenticated users can view documents" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'documents');
CREATE POLICY "Authenticated users can delete own documents" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'documents');
