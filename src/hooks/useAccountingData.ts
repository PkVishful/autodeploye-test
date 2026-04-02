import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { fetchAllRows } from '@/lib/supabase-utils';

/**
 * Slim accounting data hook — only loads small lookup/reference data.
 * High-volume data (invoices, receipts, expenses, settlements, adjustments,
 * ownerPayments, lifecyclePayments) is now loaded inside each tab component
 * using useServerPagination for server-side pagination.
 */
export function useAccountingData() {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;

  const properties = useQuery({
    queryKey: ['acc-properties'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('properties').select('id, property_name').order('property_name').range(from, to)),
    enabled: !!orgId,
  });

  const apartments = useQuery({
    queryKey: ['acc-apartments'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('apartments').select('id, apartment_code, property_id, start_date').order('apartment_code').range(from, to)),
    enabled: !!orgId,
  });

  const beds = useQuery({
    queryKey: ['acc-beds'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('beds').select('id, bed_code, apartment_id, bed_type, toilet_type, status').order('bed_code').range(from, to)),
    enabled: !!orgId,
  });

  const tenants = useQuery({
    queryKey: ['acc-tenants'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('tenants').select('id, full_name, phone, email').order('full_name').range(from, to)),
    enabled: !!orgId,
  });

  const allotments = useQuery({
    queryKey: ['acc-allotments'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('tenant_allotments').select('*').order('created_at', { ascending: false }).range(from, to)),
    enabled: !!orgId,
  });

  const bedRates = useQuery({
    queryKey: ['acc-bed-rates'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('bed_rates').select('*').order('from_date', { ascending: false }).range(from, to)),
    enabled: !!orgId,
  });

  const vendors = useQuery({
    queryKey: ['acc-vendors'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('vendors').select('*').order('vendor_name').range(from, to)),
    enabled: !!orgId,
  });

  const bankAccounts = useQuery({
    queryKey: ['acc-bank-accounts'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('organization_bank_accounts').select('*').order('is_primary', { ascending: false }).range(from, to)),
    enabled: !!orgId,
  });

  const organization = useQuery({
    queryKey: ['acc-organization', orgId],
    queryFn: async () => {
      if (!orgId) return null;
      const { data } = await supabase.from('organizations').select('*').eq('id', orgId).single();
      return data;
    },
    enabled: !!orgId,
  });

  // High-volume data kept for tabs that still need full datasets
  // (Billing, Profitability, Reports, Ledger)
  const electricityReadings = useQuery({
    queryKey: ['acc-elec-readings'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('electricity_readings').select('*').order('billing_month', { ascending: false }).range(from, to)),
    enabled: !!orgId,
  });

  const invoices = useQuery({
    queryKey: ['acc-invoices'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('invoices').select('*, tenants(full_name), properties(property_name), apartments(apartment_code), beds(bed_code), tenant_allotments(staying_status, onboarding_date, notice_date, estimated_exit_date, actual_exit_date)').order('created_at', { ascending: false }).order('id', { ascending: false }).range(from, to)),
    enabled: !!orgId,
  });

  const receipts = useQuery({
    queryKey: ['acc-receipts'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('receipts').select('*, tenants(full_name), tenant_allotments(property_id, apartment_id, bed_id)').order('created_at', { ascending: false }).order('id', { ascending: false }).range(from, to)),
    enabled: !!orgId,
  });

  const expenses = useQuery({
    queryKey: ['acc-expenses'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('expenses' as any).select('*, properties(property_name), apartments(apartment_code), beds(bed_code)').order('expense_date', { ascending: false }).order('id', { ascending: false }).range(from, to)),
    enabled: !!orgId,
  });

  const settlements = useQuery({
    queryKey: ['acc-settlements'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('deposit_settlements' as any).select('*, tenants(full_name), tenant_allotments(property_id, apartment_id, bed_id)').order('created_at', { ascending: false }).order('id', { ascending: false }).range(from, to)),
    enabled: !!orgId,
  });

  const ownerPayments = useQuery({
    queryKey: ['acc-owner-payments'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('owner_payments').select('*, owners(full_name), apartments(apartment_code)').order('due_date', { ascending: false }).range(from, to)),
    enabled: !!orgId,
  });

  const adjustments = useQuery({
    queryKey: ['acc-adjustments'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('tenant_adjustments' as any).select('*, tenants(full_name), properties(property_name), apartments(apartment_code), beds(bed_code)').order('adjustment_date', { ascending: false }).range(from, to)),
    enabled: !!orgId,
  });

  const ownerContracts = useQuery({
    queryKey: ['acc-owner-contracts'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('owner_contracts').select('apartment_id, start_date, status').range(from, to)),
    enabled: !!orgId,
  });

  // lifecycle_payments table removed — all payments now in receipts

  return {
    properties: properties.data || [],
    apartments: apartments.data || [],
    beds: beds.data || [],
    tenants: tenants.data || [],
    allotments: allotments.data || [],
    bedRates: bedRates.data || [],
    electricityReadings: electricityReadings.data || [],
    invoices: invoices.data || [],
    receipts: receipts.data || [],
    expenses: expenses.data || [],
    settlements: settlements.data || [],
    ownerPayments: ownerPayments.data || [],
    vendors: vendors.data || [],
    bankAccounts: bankAccounts.data || [],
    adjustments: adjustments.data || [],
    ownerContracts: ownerContracts.data || [],
    lifecyclePayments: [],
    organization: organization.data || null,
    orgId,
    isLoading: properties.isLoading || invoices.isLoading,
  };
}
