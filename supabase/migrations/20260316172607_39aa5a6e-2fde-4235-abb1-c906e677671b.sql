
-- Enable extensions
create extension if not exists "pgcrypto";

-- App roles enum
create type public.app_role as enum ('super_admin', 'org_admin', 'property_manager', 'technician', 'tenant');

-- Entity status enum
create type public.entity_status as enum ('live', 'in_progress', 'inactive', 'exited', 'signed');

-- Bed type enum
create type public.bed_type as enum ('single', 'double', 'triple', 'quad');

-- Toilet type enum
create type public.toilet_type as enum ('attached', 'common');

-- Staying status enum
create type public.staying_status as enum ('booked', 'on_notice', 'staying', 'exited');

-- Organizations (multi-tenant root)
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  organization_name text not null,
  subscription_plan text default 'free',
  created_at timestamptz default now()
);

-- User roles table (separate from profiles per security rules)
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text,
  full_name text,
  email text,
  avatar_url text,
  organization_id uuid references public.organizations(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Properties
create table public.properties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) not null,
  property_name text not null,
  address text,
  city text,
  state text,
  pincode text,
  status entity_status default 'in_progress',
  created_at timestamptz default now()
);

-- Apartments
create table public.apartments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) not null,
  property_id uuid references public.properties(id) on delete cascade not null,
  apartment_code text not null,
  floor_number int,
  status entity_status default 'in_progress',
  created_at timestamptz default now()
);

-- Beds
create table public.beds (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) not null,
  apartment_id uuid references public.apartments(id) on delete cascade not null,
  bed_code text not null,
  bed_type bed_type not null default 'single',
  toilet_type toilet_type not null default 'common',
  status entity_status default 'in_progress',
  created_at timestamptz default now()
);

-- Bed rates
create table public.bed_rates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) not null,
  property_id uuid references public.properties(id),
  bed_type bed_type not null,
  toilet_type toilet_type not null,
  monthly_rate numeric(10,2) not null,
  from_date date not null,
  to_date date,
  created_at timestamptz default now()
);

-- Tenants
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) not null,
  user_id uuid references auth.users(id),
  full_name text not null,
  phone text not null,
  email text,
  date_of_birth date,
  gender text,
  id_proof_type text,
  id_proof_number text,
  id_proof_url text,
  permanent_address text,
  company_name text,
  company_address text,
  designation text,
  emergency_contact_name text,
  emergency_contact_phone text,
  photo_url text,
  kyc_completed boolean default false,
  created_at timestamptz default now()
);

-- Tenant allotments
create table public.tenant_allotments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) not null,
  tenant_id uuid references public.tenants(id) on delete cascade not null,
  property_id uuid references public.properties(id) not null,
  apartment_id uuid references public.apartments(id) not null,
  bed_id uuid references public.beds(id) not null,
  booking_date date,
  onboarding_date date,
  estimated_exit_date date,
  actual_exit_date date,
  monthly_rental numeric(10,2),
  deposit_paid numeric(10,2) default 0,
  discount numeric(10,2) default 0,
  staying_status staying_status default 'booked',
  created_at timestamptz default now()
);

-- Asset categories
create table public.asset_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) not null,
  name text not null,
  created_at timestamptz default now()
);

-- Asset types
create table public.asset_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) not null,
  category_id uuid references public.asset_categories(id) on delete cascade not null,
  name text not null,
  expected_life_months int,
  depreciation_method text default 'straight_line',
  depreciation_years numeric(5,2),
  maintenance_cycle_months int,
  replacement_cost_estimate numeric(10,2),
  created_at timestamptz default now()
);

-- Vendors
create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) not null,
  vendor_name text not null,
  contact_person text,
  phone text,
  email text,
  address text,
  created_at timestamptz default now()
);

-- Assets
create table public.assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) not null,
  asset_type_id uuid references public.asset_types(id) not null,
  asset_code text unique not null,
  qr_code text,
  serial_number text,
  brand text,
  model text,
  purchase_date date,
  purchase_price numeric(10,2),
  supplier_id uuid references public.vendors(id),
  warranty_months int,
  warranty_expiry date,
  condition text default 'good',
  status text default 'inventory',
  notes text,
  created_at timestamptz default now()
);

-- Asset allocations
create table public.asset_allocations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) not null,
  asset_id uuid references public.assets(id) on delete cascade not null,
  allocation_type text not null,
  property_id uuid references public.properties(id),
  apartment_id uuid references public.apartments(id),
  bed_id uuid references public.beds(id),
  allocated_date date default current_date,
  allocated_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- Asset movements
create table public.asset_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) not null,
  asset_id uuid references public.assets(id) on delete cascade not null,
  from_location text,
  to_location text,
  moved_by uuid references auth.users(id),
  move_date date default current_date,
  reason text,
  created_at timestamptz default now()
);

-- Purchase orders
create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) not null,
  vendor_id uuid references public.vendors(id) not null,
  order_date date default current_date,
  total_cost numeric(10,2),
  invoice_number text,
  status text default 'pending',
  created_at timestamptz default now()
);

-- Purchase items
create table public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid references public.purchase_orders(id) on delete cascade not null,
  asset_type_id uuid references public.asset_types(id) not null,
  quantity int not null,
  unit_price numeric(10,2) not null,
  created_at timestamptz default now()
);

-- Asset maintenance logs
create table public.asset_maintenance_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) not null,
  asset_id uuid references public.assets(id) on delete cascade not null,
  maintenance_type text not null,
  issue text,
  repair_cost numeric(10,2),
  vendor text,
  maintenance_date date default current_date,
  next_service_due date,
  created_at timestamptz default now()
);

-- Asset depreciation
create table public.asset_depreciation (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid references public.assets(id) on delete cascade not null,
  purchase_price numeric(10,2),
  residual_value numeric(10,2) default 0,
  useful_life_years numeric(5,2),
  current_book_value numeric(10,2),
  yearly_depreciation numeric(10,2),
  last_calculated timestamptz default now()
);

-- Replacement forecasts
create table public.replacement_forecasts (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid references public.assets(id) on delete cascade not null,
  expected_replacement_date date,
  replacement_cost numeric(10,2),
  urgency_level text default 'normal',
  created_at timestamptz default now()
);

-- Issue types for maintenance tickets
create table public.issue_types (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) not null,
  name text not null,
  icon text default 'wrench',
  priority text default 'medium',
  sla_hours int default 24,
  created_at timestamptz default now()
);

-- Maintenance tickets
create table public.maintenance_tickets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) not null,
  ticket_number text unique not null,
  tenant_id uuid references public.tenants(id) not null,
  property_id uuid references public.properties(id) not null,
  apartment_id uuid references public.apartments(id) not null,
  bed_id uuid references public.beds(id),
  issue_type_id uuid references public.issue_types(id) not null,
  description text,
  photo_urls text[],
  priority text default 'medium',
  status text default 'open',
  assigned_to uuid references auth.users(id),
  sla_deadline timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  tenant_approved boolean,
  diagnostic_data jsonb,
  created_at timestamptz default now()
);

-- Ticket logs
create table public.ticket_logs (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references public.maintenance_tickets(id) on delete cascade not null,
  action text not null,
  details text,
  performed_by uuid references auth.users(id),
  photo_urls text[],
  cost_item text,
  cost_quantity int,
  cost_unit_price numeric(10,2),
  cost_total numeric(10,2),
  created_at timestamptz default now()
);

-- Ticket assignment rules
create table public.ticket_assignment_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) not null,
  rule_type text not null,
  issue_type_id uuid references public.issue_types(id),
  apartment_code text,
  assigned_employee_id uuid references auth.users(id) not null,
  priority int default 0,
  created_at timestamptz default now()
);

-- Employee specialties
create table public.employee_specialties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  specialty text not null,
  created_at timestamptz default now()
);

-- Invoices
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) not null,
  tenant_id uuid references public.tenants(id) not null,
  property_id uuid references public.properties(id) not null,
  apartment_id uuid references public.apartments(id),
  bed_id uuid references public.beds(id),
  invoice_number text,
  invoice_date date default current_date,
  due_date date,
  rent_amount numeric(10,2) default 0,
  electricity_amount numeric(10,2) default 0,
  other_charges numeric(10,2) default 0,
  total_amount numeric(10,2) default 0,
  status text default 'pending',
  created_at timestamptz default now()
);

-- Receipts
create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) not null,
  invoice_id uuid references public.invoices(id) on delete cascade not null,
  payment_date date default current_date,
  payment_mode text,
  amount_paid numeric(10,2) not null,
  created_at timestamptz default now()
);

-- Electricity readings
create table public.electricity_readings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) not null,
  property_id uuid references public.properties(id) not null,
  apartment_id uuid references public.apartments(id) not null,
  reading_start numeric(10,2) not null,
  reading_end numeric(10,2) not null,
  units_consumed numeric(10,2),
  unit_cost numeric(10,2) not null,
  billing_month text not null,
  created_at timestamptz default now()
);

-- Electricity shares
create table public.electricity_shares (
  id uuid primary key default gen_random_uuid(),
  electricity_reading_id uuid references public.electricity_readings(id) on delete cascade not null,
  tenant_id uuid references public.tenants(id) not null,
  units_allocated numeric(10,2),
  cost_share numeric(10,2),
  created_at timestamptz default now()
);

-- Enable RLS on all tables
alter table public.organizations enable row level security;
alter table public.user_roles enable row level security;
alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.apartments enable row level security;
alter table public.beds enable row level security;
alter table public.bed_rates enable row level security;
alter table public.tenants enable row level security;
alter table public.tenant_allotments enable row level security;
alter table public.asset_categories enable row level security;
alter table public.asset_types enable row level security;
alter table public.assets enable row level security;
alter table public.asset_allocations enable row level security;
alter table public.asset_movements enable row level security;
alter table public.vendors enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_items enable row level security;
alter table public.asset_maintenance_logs enable row level security;
alter table public.asset_depreciation enable row level security;
alter table public.replacement_forecasts enable row level security;
alter table public.issue_types enable row level security;
alter table public.maintenance_tickets enable row level security;
alter table public.ticket_logs enable row level security;
alter table public.ticket_assignment_rules enable row level security;
alter table public.employee_specialties enable row level security;
alter table public.invoices enable row level security;
alter table public.receipts enable row level security;
alter table public.electricity_readings enable row level security;
alter table public.electricity_shares enable row level security;

-- Security definer function for role checking
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  )
$$;

-- Get user organization_id
create or replace function public.get_user_org_id(_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organization_id from public.profiles where id = _user_id limit 1
$$;

-- RLS Policies
-- Profiles
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Admins can view org profiles" on public.profiles for select using (
  organization_id = public.get_user_org_id(auth.uid()) and auth.uid() != id
);
create policy "Allow insert profile" on public.profiles for insert with check (auth.uid() = id);

-- User roles
create policy "Users can view own roles" on public.user_roles for select using (user_id = auth.uid());
create policy "Admins can manage roles" on public.user_roles for all using (
  public.has_role(auth.uid(), 'super_admin') or public.has_role(auth.uid(), 'org_admin')
);

-- Organizations
create policy "Users can view own org" on public.organizations for select using (
  id = public.get_user_org_id(auth.uid())
);
create policy "Admins can manage orgs" on public.organizations for all using (
  public.has_role(auth.uid(), 'super_admin')
);

-- Org-scoped tables
create policy "Org members access properties" on public.properties for all using (
  organization_id = public.get_user_org_id(auth.uid())
);
create policy "Org members access apartments" on public.apartments for all using (
  organization_id = public.get_user_org_id(auth.uid())
);
create policy "Org members access beds" on public.beds for all using (
  organization_id = public.get_user_org_id(auth.uid())
);
create policy "Org members access bed_rates" on public.bed_rates for all using (
  organization_id = public.get_user_org_id(auth.uid())
);
create policy "Org members access tenants" on public.tenants for all using (
  organization_id = public.get_user_org_id(auth.uid())
);
create policy "Org members access allotments" on public.tenant_allotments for all using (
  organization_id = public.get_user_org_id(auth.uid())
);
create policy "Org members access asset_categories" on public.asset_categories for all using (
  organization_id = public.get_user_org_id(auth.uid())
);
create policy "Org members access asset_types" on public.asset_types for all using (
  organization_id = public.get_user_org_id(auth.uid())
);
create policy "Org members access assets" on public.assets for all using (
  organization_id = public.get_user_org_id(auth.uid())
);
create policy "Org members access asset_allocations" on public.asset_allocations for all using (
  organization_id = public.get_user_org_id(auth.uid())
);
create policy "Org members access asset_movements" on public.asset_movements for all using (
  organization_id = public.get_user_org_id(auth.uid())
);
create policy "Org members access vendors" on public.vendors for all using (
  organization_id = public.get_user_org_id(auth.uid())
);
create policy "Org members access purchase_orders" on public.purchase_orders for all using (
  organization_id = public.get_user_org_id(auth.uid())
);
create policy "Org members access asset_maintenance_logs" on public.asset_maintenance_logs for all using (
  organization_id = public.get_user_org_id(auth.uid())
);
create policy "Org members access issue_types" on public.issue_types for all using (
  organization_id = public.get_user_org_id(auth.uid())
);
create policy "Org members access tickets" on public.maintenance_tickets for all using (
  organization_id = public.get_user_org_id(auth.uid())
);
create policy "Org members access assignment_rules" on public.ticket_assignment_rules for all using (
  organization_id = public.get_user_org_id(auth.uid())
);
create policy "Org members access invoices" on public.invoices for all using (
  organization_id = public.get_user_org_id(auth.uid())
);
create policy "Org members access receipts" on public.receipts for all using (
  organization_id = public.get_user_org_id(auth.uid())
);
create policy "Org members access electricity_readings" on public.electricity_readings for all using (
  organization_id = public.get_user_org_id(auth.uid())
);

-- Join-based policies
create policy "Purchase items via order" on public.purchase_items for all using (
  exists (select 1 from public.purchase_orders po where po.id = purchase_order_id and po.organization_id = public.get_user_org_id(auth.uid()))
);
create policy "Ticket logs via ticket" on public.ticket_logs for all using (
  exists (select 1 from public.maintenance_tickets t where t.id = ticket_id and t.organization_id = public.get_user_org_id(auth.uid()))
);
create policy "Elec shares via reading" on public.electricity_shares for all using (
  exists (select 1 from public.electricity_readings er where er.id = electricity_reading_id and er.organization_id = public.get_user_org_id(auth.uid()))
);
create policy "Depreciation via asset" on public.asset_depreciation for all using (
  exists (select 1 from public.assets a where a.id = asset_id and a.organization_id = public.get_user_org_id(auth.uid()))
);
create policy "Forecast via asset" on public.replacement_forecasts for all using (
  exists (select 1 from public.assets a where a.id = asset_id and a.organization_id = public.get_user_org_id(auth.uid()))
);

-- Employee specialties
create policy "Anyone can view specialties" on public.employee_specialties for select using (true);
create policy "Users manage own specialties" on public.employee_specialties for all using (user_id = auth.uid());
create policy "Admins manage specialties" on public.employee_specialties for all using (
  public.has_role(auth.uid(), 'super_admin') or public.has_role(auth.uid(), 'org_admin')
);

-- Trigger for auto-creating profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, phone, full_name)
  values (
    new.id,
    coalesce(new.phone, new.raw_user_meta_data->>'phone', ''),
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Performance indexes
create index idx_properties_org on public.properties(organization_id);
create index idx_apartments_property on public.apartments(property_id);
create index idx_beds_apartment on public.beds(apartment_id);
create index idx_tenants_org on public.tenants(organization_id);
create index idx_allotments_tenant on public.tenant_allotments(tenant_id);
create index idx_allotments_bed on public.tenant_allotments(bed_id);
create index idx_assets_org on public.assets(organization_id);
create index idx_assets_type on public.assets(asset_type_id);
create index idx_tickets_org on public.maintenance_tickets(organization_id);
create index idx_tickets_tenant on public.maintenance_tickets(tenant_id);
create index idx_tickets_assigned on public.maintenance_tickets(assigned_to);
create index idx_invoices_tenant on public.invoices(tenant_id);
create index idx_ticket_logs_ticket on public.ticket_logs(ticket_id);
