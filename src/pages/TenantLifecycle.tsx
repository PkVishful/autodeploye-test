import { useState, useMemo, useEffect } from 'react';
import {
  Users, BedDouble, LogIn, ArrowRightLeft, Bell, LogOut as LogOutIcon,
  CreditCard, RotateCcw, Plus, Search, AlertTriangle, Check, Clock,
  CalendarDays, IndianRupee, MoreHorizontal, Eye, Pencil, XCircle, Camera, Upload, X, FileSpreadsheet, Home, Trash2
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import BedOccupancyMap from '@/components/lifecycle/BedOccupancyMap';
import ExcelUpload from '@/components/lifecycle/ExcelUpload';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/supabase-utils';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { DatePickerField } from '@/components/shared/DatePickerField';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { DrawerForm } from '@/components/shared/DrawerForm';
import { TablePagination } from '@/components/shared/TablePagination';
import { SortableTableHead, useSort } from '@/components/shared/SortableTableHead';
import { format, differenceInDays, addDays, getDaysInMonth, parseISO } from 'date-fns';
import { useRef } from 'react';
import { useTicketRole } from '@/hooks/useTicketRole';
import { useTabPermissions } from '@/hooks/useTabPermissions';

const LIFECYCLE_PAGE_SIZE = 25;

/** Format number as Indian integer: ##,##,### with no decimals */
const fmtAmt = (v: number | null | undefined): string => {
  if (v == null) return '0';
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.ceil(v));
};

/** Searchable returning tenant list */
function ReturningTenantSearch({ tenants, onBook }: { tenants: any[]; onBook: (id: string) => void }) {
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    if (!q.trim()) return [];
    const lower = q.toLowerCase();
    return tenants.filter((t: any) =>
      t.full_name?.toLowerCase().includes(lower) || t.phone?.includes(q)
    );
  }, [tenants, q]);

  return (
    <div className="space-y-2">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or phone..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9 h-9"
        />
      </div>
      {q.trim() && (
        <Card className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Tenant</TableHead><TableHead>Phone</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-4 text-sm">No returning tenants found</TableCell></TableRow>
              ) : filtered.map((t: any) => (
                <TableRow key={t.id} className="bg-blue-50/50 dark:bg-blue-950/20">
                  <TableCell className="font-medium">{t.full_name}</TableCell>
                  <TableCell>{t.phone}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="default" className="gap-1" onClick={() => onBook(t.id)}>
                      <RotateCcw className="h-3 w-3" /> Re-Book
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      {!q.trim() && tenants.length > 0 && (
        <p className="text-xs text-muted-foreground">Search from {tenants.length} previously exited tenants</p>
      )}
    </div>
  );
}

export default function TenantLifecycle() {

  const { profile, roles } = useAuth();
  const qc = useQueryClient();
  const orgId = profile?.organization_id;
  const { isTenantRole, tenantRecord } = useTicketRole();
  const { isTabVisible } = useTabPermissions('tenant_lifecycle');

  // Determine if user is tenant-only
  const isTenantOnly = roles.includes('tenant') && !roles.some(r => ['super_admin', 'org_admin', 'property_manager', 'employee', 'technician'].includes(r));
  const [bookingOpen, setBookingOpen] = useState(false);
  const [onboardOpen, setOnboardOpen] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [editOccupiedOpen, setEditOccupiedOpen] = useState(false);
  const [editOccupiedForm, setEditOccupiedForm] = useState<any>({ allotment_id: '', onboarding_date: '', discount: '0', premium: '0', deposit_paid: '' });
  const [dashboardDetail, setDashboardDetail] = useState<string | null>(null);
  const [occupiedSearchQ, setOccupiedSearchQ] = useState('');
  // Pagination & search state for tabs
  const [switchSearch, setSwitchSearch] = useState('');
  const [switchPage, setSwitchPage] = useState(0);
  const [noticeSearch, setNoticeSearch] = useState('');
  const [noticePage, setNoticePage] = useState(0);
  const [exitSearch, setExitSearch] = useState('');
  const [exitPage, setExitPage] = useState(0);
  const [paymentSearch, setPaymentSearch] = useState('');
  const [paymentPage, setPaymentPage] = useState(0);
  const [refundSearch, setRefundSearch] = useState('');
  const [refundPage, setRefundPage] = useState(0);
  const [absenceSearch, setAbsenceSearch] = useState('');
  const [absencePage, setAbsencePage] = useState(0);
  const [absenceOpen, setAbsenceOpen] = useState(false);
  const [absenceEditId, setAbsenceEditId] = useState<string | null>(null);
  const [absenceForm, setAbsenceForm] = useState<any>({ allotment_id: '', tenant_id: '', from_date: '', to_date: '', reason: '' });

  // Sorting hooks for each tab
  const switchSort = useSort();
  const noticeSort = useSort();
  const exitSort = useSort();
  const paymentSort = useSort();
  const refundSort = useSort();
  const bookingSort = useSort();
  const onboardSort = useSort();
  const absenceSort = useSort();
  const [cancelForm, setCancelForm] = useState<any>({ allotment_id: '', reason: '' });
  const [editNoticeOpen, setEditNoticeOpen] = useState(false);
  const [editNoticeForm, setEditNoticeForm] = useState<any>({ id: '', notice_date: '', exit_date: '', notes: '', allotment_id: '' });
  const [addPaymentOpen, setAddPaymentOpen] = useState(false);
  const [addPaymentForm, setAddPaymentForm] = useState<any>({
    allotment_id: '', tenant_id: '', amount: '', payment_mode: '', reference_number: '',
  });

  // Forms
  const [bookingForm, setBookingForm] = useState<any>({
    tenant_id: '', property_id: '', apartment_id: '', bed_id: '',
    probable_onboarding_date: '', payment_mode: '', reference_number: '', amount: '',
    discount: '0', premium: '0',
  });
  const [onboardForm, setOnboardForm] = useState<any>({
    allotment_id: '', actual_onboarding_date: '', bed_id: '',
    payment_mode: '', reference_number: '', paid_amount: '',
    kyc_front_url: '', kyc_back_url: '', expected_stay_days: '',
  });
  const [switchForm, setSwitchForm] = useState<any>({
    allotment_id: '', tenant_id: '', old_bed_id: '', new_bed_id: '',
    switch_type: 'immediate', switch_date: '', effective_date: '', notes: '',
  });
  const [noticeForm, setNoticeForm] = useState<any>({
    allotment_id: '', tenant_id: '', bed_id: '', notice_date: '', notes: '',
  });
  const [exitForm, setExitForm] = useState<any>({
    allotment_id: '', tenant_id: '', bed_id: '', exit_date: '',
    has_notice: false, room_inspection: false, key_returned: true,
    damage_charges: '0', notes: '',
    inspect_furniture: false, inspect_bed: false, inspect_walls: false, inspect_bathroom: false,
  });

  // File upload refs
  const kycFrontRef = useRef<HTMLInputElement>(null);
  const kycBackRef = useRef<HTMLInputElement>(null);

  // Queries
  const { data: tenants = [], isLoading: tenantsLoading } = useQuery({
    queryKey: ['tenants'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('tenants').select('*').order('full_name').range(from, to)),
    enabled: !!orgId,
  });

  const getTenantGender = (tenantId: string) => {
    const t = tenants.find((t: any) => t.id === tenantId);
    return t?.gender || null;
  };

  const { data: allotments = [], isLoading: allotmentsLoading } = useQuery({
    queryKey: ['tenant_allotments'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('tenant_allotments').select('*, tenants(full_name, phone, kyc_completed, gender), properties(property_name), apartments(apartment_code), beds(bed_code, bed_type, toilet_type)').order('created_at', { ascending: false }).range(from, to)),
    enabled: !!orgId,
  });

  const { data: properties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('properties').select('*').eq('status', 'Live').range(from, to)),
    enabled: !!orgId,
  });

  const { data: apartments = [] } = useQuery({
    queryKey: ['apartments'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('apartments').select('*').range(from, to)),
    enabled: !!orgId,
  });

  const { data: beds = [] } = useQuery({
    queryKey: ['beds'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('beds').select('*').range(from, to)),
    enabled: !!orgId,
  });

  const { data: bedRates = [] } = useQuery({
    queryKey: ['bed_rates'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('bed_rates').select('*').order('from_date', { ascending: false }).range(from, to)),
    enabled: !!orgId,
  });

  const { data: lifecycleConfig = [] } = useQuery({
    queryKey: ['lifecycle_config'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('lifecycle_config').select('*').order('from_date', { ascending: false }).range(from, to)),
    enabled: !!orgId,
  });

  const { data: lifecycleReceipts = [], isLoading: lifecycleReceiptsLoading } = useQuery({
    queryKey: ['lifecycle_receipts'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('receipts').select('*, tenants(full_name, phone)').in('receipt_type', ['booking', 'onboarding', 'additional_payment', 'settlement']).order('created_at', { ascending: false }).range(from, to)),
    enabled: !!orgId,
  });

  const { data: notices = [] } = useQuery({
    queryKey: ['tenant_notices'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('tenant_notices').select('*, tenants(full_name, phone), beds(bed_code), tenant_allotments(apartments(apartment_code), properties(property_name))').order('created_at', { ascending: false }).range(from, to)),
    enabled: !!orgId,
  });

  const { data: exits = [] } = useQuery({
    queryKey: ['tenant_exits'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('tenant_exits').select('*, tenants(full_name, phone), beds(bed_code), tenant_allotments(apartments(apartment_code), properties(property_name))').order('created_at', { ascending: false }).range(from, to)),
    enabled: !!orgId,
  });

  const { data: electricityReadings = [] } = useQuery({
    queryKey: ['electricity_readings'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('electricity_readings').select('*').order('created_at', { ascending: false }).range(from, to)),
    enabled: !!orgId,
  });

  const { data: roomSwitches = [] } = useQuery({
    queryKey: ['room_switches'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('room_switches').select('*, tenants(full_name)').order('created_at', { ascending: false }).range(from, to)),
    enabled: !!orgId,
  });

  const { data: absenceRecords = [] } = useQuery({
    queryKey: ['tenant_absence_records'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('tenant_absence_records').select('*, tenants(full_name, phone)').order('created_at', { ascending: false }).range(from, to)),
    enabled: !!orgId,
  });


  const getConfig = () => {
    const today = new Date().toISOString().split('T')[0];
    return lifecycleConfig.find((c: any) => c.from_date <= today && (!c.to_date || c.to_date >= today)) || {
      booking_fee: 1000, onboarding_fee: 1000, advance_ratio: 1.5,
      exit_fee_under_1yr: 2250, key_loss_fee: 500, notice_period_days: 30, refund_deadline_days: 5,
    };
  };

  // Helper: Compute total tenant-days for an apartment in a given month
  const getTotalTenantDaysInMonth = (aptId: string, monthStart: Date) => {
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0); // last day
    const aptAllotments = allotments.filter((a: any) =>
      a.apartment_id === aptId &&
      a.onboarding_date &&
      ['Staying', 'On-Notice', 'Exited'].includes(a.staying_status)
    );
    let totalDays = 0;
    for (const a of aptAllotments) {
      const onboard = parseISO(a.onboarding_date);
      const exit = a.actual_exit_date ? parseISO(a.actual_exit_date) : null;
      const stayStart = onboard > monthStart ? onboard : monthStart;
      const stayEnd = exit && exit < monthEnd ? exit : monthEnd;
      const days = differenceInDays(stayEnd, stayStart) + 1;
      if (days > 0) totalDays += days;
    }
    return totalDays || getDaysInMonth(monthStart); // fallback to days in month if no data
  };

  // Helper: Get bed rate — picks correct date-effective rate, prefers property-specific
  const getBedRate = (bedId: string, date?: string) => {
    const bed = beds.find((b: any) => b.id === bedId);
    if (!bed) return 0;
    const apt = apartments.find((a: any) => a.id === bed.apartment_id);
    const propertyId = apt?.property_id || null;
    const targetDate = date || new Date().toISOString().split('T')[0];
    const matching = bedRates.filter((r: any) =>
      r.bed_type === bed.bed_type && r.toilet_type === bed.toilet_type &&
      r.from_date <= targetDate && (!r.to_date || r.to_date >= targetDate)
    );
    if (matching.length === 0) return 0;
    // Prefer property-specific rate
    if (propertyId) {
      const propSpecific = matching
        .filter((r: any) => r.property_id === propertyId)
        .sort((a: any, b: any) => b.from_date.localeCompare(a.from_date));
      if (propSpecific.length > 0) return propSpecific[0].monthly_rate;
    }
    // Fallback: latest from_date
    const sorted = matching.sort((a: any, b: any) => b.from_date.localeCompare(a.from_date));
    return sorted[0].monthly_rate;
  };

  // Derived data — eligible new tenants for booking (KYC done, status=new, not currently booked/staying)
  const eligibleTenants = tenants.filter((t: any) => {
    const hasKyc = t.kyc_completed === true;
    const stayStatus = (t.staying_status || 'new').toLowerCase();
    // Only show 'new' status tenants in booking
    if (stayStatus !== 'new') return false;
    const isBooked = allotments.some((a: any) => a.tenant_id === t.id && ['Booked', 'Staying'].includes(a.staying_status));
    return hasKyc && !isBooked;
  });

  // Returning tenants — previously exited, not currently booked/staying
  const returningTenants = tenants.filter((t: any) => {
    const hasExited = allotments.some((a: any) => a.tenant_id === t.id && a.staying_status === 'Exited');
    const isActive = allotments.some((a: any) => a.tenant_id === t.id && ['Booked', 'Staying', 'On-Notice'].includes(a.staying_status));
    return hasExited && !isActive;
  });

  const bookedAllotments = allotments.filter((a: any) => a.staying_status === 'Booked');
  const stayingAllotments = allotments.filter((a: any) => a.staying_status === 'Staying');
  const onNoticeAllotments = allotments.filter((a: any) => a.staying_status === 'On-Notice');
  const pendingPayments = allotments.filter((a: any) => a.staying_status === 'Staying' && (a.payment_status === 'partial' || a.payment_status === 'pending'));

  // Filtered apartments/beds for booking (gender-filtered)
  const selectedBookingTenantGender = getTenantGender(bookingForm.tenant_id);
  const filteredApartments = apartments.filter((a: any) => {
    if (a.status !== 'Live') return false;
    if (bookingForm.property_id && a.property_id !== bookingForm.property_id) return false;
    if (selectedBookingTenantGender && a.gender_allowed && a.gender_allowed.toLowerCase() !== 'both') {
      return a.gender_allowed.toLowerCase() === selectedBookingTenantGender.toLowerCase();
    }
    return true;
  });
  // Booking beds: filter across all gender-filtered active apartments (no apartment_id needed)
  const bookingBeds = beds.filter((b: any) => {
    const apt = filteredApartments.find((a: any) => a.id === b.apartment_id);
    if (!apt) return false;
    const activeAllot = allotments.find((a: any) => a.bed_id === b.id && ['Staying', 'On-Notice', 'Booked'].includes(a.staying_status));
    if (!activeAllot) return true; // vacant
    if (activeAllot.staying_status === 'On-Notice') {
      // Date-driven: only show notice beds if their exit date is before selected onboarding date
      if (bookingForm.probable_onboarding_date && activeAllot.estimated_exit_date) {
        return activeAllot.estimated_exit_date <= bookingForm.probable_onboarding_date;
      }
      return true; // no date selected yet, show all notice beds
    }
    return false; // occupied or booked
  }).sort((a: any, b: any) => {
    const aptA = apartments.find((ap: any) => ap.id === a.apartment_id)?.apartment_code || '';
    const aptB = apartments.find((ap: any) => ap.id === b.apartment_id)?.apartment_code || '';
    return `${aptA}-${a.bed_code}`.localeCompare(`${aptB}-${b.bed_code}`);
  });

  // Onboard beds: gender-filtered + alphabetically sorted
  const getOnboardBeds = () => {
    const allot = allotments.find((a: any) => a.id === onboardForm.allotment_id);
    const tenantGender = allot ? (allot.tenants?.gender || getTenantGender(allot.tenant_id)) : null;
    return beds.filter((b: any) => {
      const activeAllot = allotments.find((a: any) => a.bed_id === b.id && ['Staying', 'On-Notice', 'Booked'].includes(a.staying_status));
      if (activeAllot) return false; // not vacant
      if (tenantGender) {
        const apt = apartments.find((a: any) => a.id === b.apartment_id);
        if (apt?.gender_allowed && apt.gender_allowed.toLowerCase() !== 'both') {
          if (apt.gender_allowed.toLowerCase() !== tenantGender.toLowerCase()) return false;
        }
      }
      return true;
    }).sort((a: any, b: any) => {
      const aptA = apartments.find((ap: any) => ap.id === a.apartment_id)?.apartment_code || '';
      const aptB = apartments.find((ap: any) => ap.id === b.apartment_id)?.apartment_code || '';
      return `${aptA}-${a.bed_code}`.localeCompare(`${aptB}-${b.bed_code}`);
    });
  };
  const onboardBeds = getOnboardBeds();

  const switchBeds = beds.filter((b: any) => {
    if (b.id === switchForm.old_bed_id) return false;
    // Only show beds from active (Live) apartments
    const apt = apartments.find((a: any) => a.id === b.apartment_id);
    if (!apt || apt.status !== 'Live') return false;
    const activeAllot = allotments.find((a: any) => a.bed_id === b.id && ['Staying', 'On-Notice', 'Booked'].includes(a.staying_status));
    const status = activeAllot ? (activeAllot.staying_status === 'On-Notice' ? 'notice' : 'occupied') : 'vacant';
    if (switchForm.switch_type === 'immediate') return status === 'vacant';
    return ['vacant', 'notice'].includes(status);
  });

  // Calculate onboarding costs
  const calcOnboardingCosts = (allotId: string) => {
    const allot = allotments.find((a: any) => a.id === allotId);
    if (!allot) return null;
    const config = getConfig();
    const bedId = onboardForm.bed_id || allot.bed_id;
    const monthlyRent = getBedRate(bedId, onboardForm.actual_onboarding_date);
    const discount = allot.discount || 0;
    const premium = allot.premium || 0;
    const effectiveRent = Math.max(0, monthlyRent - discount + premium);
    const advance = effectiveRent * (config.advance_ratio || 1.5);
    const onboardDate = onboardForm.actual_onboarding_date ? parseISO(onboardForm.actual_onboarding_date) : new Date();
    const daysInMonth = getDaysInMonth(onboardDate);
    const remainingDays = daysInMonth - onboardDate.getDate() + 1;
    const proratedRent = (effectiveRent / daysInMonth) * remainingDays;
    const onboardingCharges = config.onboarding_fee || 1000;
    const totalDue = Math.ceil(onboardingCharges + advance + proratedRent);
    const alreadyPaid = Math.max(allot.paid_amount || 0, allot.deposit_paid || 0);
    const balance = totalDue - alreadyPaid;
    return { monthlyRent: Math.ceil(monthlyRent), effectiveRent: Math.ceil(effectiveRent), discount, premium, advance: Math.ceil(advance), proratedRent: Math.ceil(proratedRent), remainingDays, daysInMonth, onboardingCharges: Math.ceil(onboardingCharges), totalDue, alreadyPaid: Math.ceil(alreadyPaid), balance: Math.ceil(balance) };
  };

  // Image compression helper
  const compressImage = (file: File, maxWidth = 800, quality = 0.6): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) { resolve(file); return; }
      const img = new window.Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > maxWidth) { height = (height * maxWidth) / width; width = maxWidth; }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(file); return; }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => blob ? resolve(blob) : resolve(file), 'image/jpeg', quality);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
      img.src = url;
    });
  };

  // KYC Image upload helper
  const handleKycUpload = async (file: File, side: 'front' | 'back') => {
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Max 10MB', variant: 'destructive' });
      return;
    }
    try {
      const compressed = await compressImage(file);
      const path = `kyc/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
      const { error } = await supabase.storage.from('documents').upload(path, compressed, {
        contentType: 'image/jpeg',
      });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path);
      if (side === 'front') {
        setOnboardForm((prev: any) => ({ ...prev, kyc_front_url: publicUrl }));
      } else {
        setOnboardForm((prev: any) => ({ ...prev, kyc_back_url: publicUrl }));
      }
      toast({ title: `KYC ${side} uploaded` });
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    }
  };

  // BOOKING MUTATION
  const createBooking = useMutation({
    mutationFn: async () => {
      const config = getConfig();
      const rawAmt = parseFloat(bookingForm.amount);
      const amt = isNaN(rawAmt) ? config.booking_fee : rawAmt;
      const bed = beds.find((b: any) => b.id === bookingForm.bed_id);
      if (!bed) throw new Error('Bed not found');
      const apt = apartments.find((a: any) => a.id === bed.apartment_id);
      const propertyId = apt?.property_id || bookingForm.property_id;
      const apartmentId = bed.apartment_id;
      const bedStatus = (bed as any)?.bed_lifecycle_status || 'vacant';
      const newBedStatus = bedStatus === 'notice' ? 'notice-booked' : 'booked';

      // Create allotment
      const discountAmt = parseFloat(bookingForm.discount) || 0;
      const premiumAmt = parseFloat(bookingForm.premium) || 0;
      const { data: allot, error: allotErr } = await supabase.from('tenant_allotments').insert({
        tenant_id: bookingForm.tenant_id,
        property_id: propertyId,
        apartment_id: apartmentId,
        bed_id: bookingForm.bed_id,
        booking_date: new Date().toISOString().split('T')[0],
        onboarding_date: bookingForm.probable_onboarding_date || null,
        staying_status: 'Booked',
        deposit_paid: 0,
        onboarding_charges: amt,
        paid_amount: amt,
        payment_status: 'partial',
        discount: discountAmt,
        premium: premiumAmt,
        organization_id: orgId!,
      } as any).select().single();
      if (allotErr) throw allotErr;

      // Record receipt for booking payment (single source of truth)
      await supabase.from('receipts').insert({
        tenant_id: bookingForm.tenant_id,
        tenant_allotment_id: allot.id,
        amount_paid: amt,
        base_amount: amt,
        processing_fee: 0,
        payment_mode: bookingForm.payment_mode,
        reference_number: bookingForm.reference_number || null,
        payment_date: new Date().toISOString().split('T')[0],
        receipt_type: 'booking',
        organization_id: orgId!,
      } as any);

      // Update bed status
      await supabase.from('beds').update({ bed_lifecycle_status: newBedStatus } as any).eq('id', bookingForm.bed_id);

      // Update tenant staying_status
      await supabase.from('tenants').update({ staying_status: 'booked' } as any).eq('id', bookingForm.tenant_id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant_allotments'], refetchType: 'all' });
      qc.invalidateQueries({ queryKey: ['beds'], refetchType: 'all' });
      qc.invalidateQueries({ queryKey: ['lifecycle_receipts'], refetchType: 'all' });
      qc.invalidateQueries({ queryKey: ['tenants'], refetchType: 'all' });
      qc.invalidateQueries({ queryKey: ['acc-receipts'], refetchType: 'all' });
      setBookingOpen(false);
      setBookingForm({ tenant_id: '', property_id: '', apartment_id: '', bed_id: '', probable_onboarding_date: '', payment_mode: '', reference_number: '', amount: '1000', discount: '0', premium: '0' });
      toast({ title: 'Booking created successfully' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // ONBOARDING MUTATION
  const processOnboarding = useMutation({
    mutationFn: async () => {
      const allot = allotments.find((a: any) => a.id === onboardForm.allotment_id);
      if (!allot) throw new Error('Allotment not found');
      const costs = calcOnboardingCosts(onboardForm.allotment_id);
      if (!costs) throw new Error('Cannot calculate costs');
      const paidNow = parseFloat(onboardForm.paid_amount) || 0;
      // Add credit card surcharge to total if applicable
      const ccSurcharge = onboardForm.payment_mode === 'credit_card' ? Math.ceil(costs.balance * 0.015) : 0;
      const adjustedTotalDue = costs.totalDue + ccSurcharge;
      const totalPaid = costs.alreadyPaid + paidNow;
      const balanceDue = adjustedTotalDue - totalPaid;
      const paymentStatus = balanceDue <= 0 ? 'paid' : 'partial';
      const bedId = onboardForm.bed_id || allot.bed_id;

      // Update allotment
      const processingFeeOnboard = onboardForm.payment_mode === 'credit_card' ? Math.ceil((parseFloat(onboardForm.paid_amount) || 0) * 0.015) : 0;
      await supabase.from('tenant_allotments').update({
        staying_status: 'Staying',
        onboarding_date: onboardForm.actual_onboarding_date,
        bed_id: bedId,
        monthly_rental: costs.monthlyRent,
        deposit_paid: costs.advance,
        prorated_rent: costs.proratedRent,
        onboarding_charges: costs.onboardingCharges,
        total_due: adjustedTotalDue,
        paid_amount: totalPaid,
        balance_due: balanceDue > 0 ? balanceDue : 0,
        payment_status: paymentStatus,
        processing_fee: (allot.processing_fee || 0) + processingFeeOnboard,
        kyc_front_url: onboardForm.kyc_front_url || null,
        kyc_back_url: onboardForm.kyc_back_url || null,
        expected_stay_days: onboardForm.expected_stay_days ? parseInt(onboardForm.expected_stay_days) : null,
      } as any).eq('id', onboardForm.allotment_id);

      // Record receipt for onboarding payment (single source of truth)
      if (paidNow > 0) {
        const processingFee = onboardForm.payment_mode === 'credit_card' ? Math.ceil(paidNow * 0.015) : 0;
        await supabase.from('receipts').insert({
          tenant_id: allot.tenant_id,
          tenant_allotment_id: onboardForm.allotment_id,
          amount_paid: paidNow + processingFee,
          base_amount: paidNow,
          processing_fee: processingFee,
          payment_mode: onboardForm.payment_mode,
          reference_number: onboardForm.reference_number || null,
          payment_date: onboardForm.actual_onboarding_date || new Date().toISOString().split('T')[0],
          receipt_type: 'onboarding',
          organization_id: orgId!,
        } as any);
      }

      // Update bed statuses
      await supabase.from('beds').update({ bed_lifecycle_status: 'occupied' } as any).eq('id', bedId);
      if (bedId !== allot.bed_id) {
        await supabase.from('beds').update({ bed_lifecycle_status: 'vacant' } as any).eq('id', allot.bed_id);
      }

      // Update tenant staying_status
      await supabase.from('tenants').update({ staying_status: 'staying' } as any).eq('id', allot.tenant_id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant_allotments'], refetchType: 'all' });
      qc.invalidateQueries({ queryKey: ['beds'], refetchType: 'all' });
      qc.invalidateQueries({ queryKey: ['lifecycle_receipts'], refetchType: 'all' });
      qc.invalidateQueries({ queryKey: ['tenants'], refetchType: 'all' });
      qc.invalidateQueries({ queryKey: ['acc-receipts'], refetchType: 'all' });
      setOnboardOpen(false);
      toast({ title: 'Tenant onboarded successfully' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // ROOM SWITCH MUTATION
  const processSwitch = useMutation({
    mutationFn: async () => {
      const allot = allotments.find((a: any) => a.id === switchForm.allotment_id);
      if (!allot) throw new Error('Allotment not found');
      const oldRate = getBedRate(switchForm.old_bed_id);
      const newRate = getBedRate(switchForm.new_bed_id);
      const rentDiff = newRate - oldRate;
      const adjustmentType = rentDiff > 0 ? 'tenant_pays' : rentDiff < 0 ? 'credit_tenant' : 'none';

      await supabase.from('room_switches').insert({
        organization_id: orgId!,
        tenant_id: switchForm.tenant_id,
        allotment_id: switchForm.allotment_id,
        old_bed_id: switchForm.old_bed_id,
        new_bed_id: switchForm.new_bed_id,
        switch_type: switchForm.switch_type,
        switch_date: switchForm.switch_date || new Date().toISOString().split('T')[0],
        effective_date: switchForm.effective_date || switchForm.switch_date || new Date().toISOString().split('T')[0],
        rent_difference: rentDiff,
        adjustment_type: adjustmentType,
      } as any);

      // Update allotment
      await supabase.from('tenant_allotments').update({
        bed_id: switchForm.new_bed_id,
        monthly_rental: newRate,
      } as any).eq('id', switchForm.allotment_id);

      // Update bed statuses
      if (switchForm.switch_type === 'immediate') {
        await supabase.from('beds').update({ bed_lifecycle_status: 'vacant' } as any).eq('id', switchForm.old_bed_id);
        await supabase.from('beds').update({ bed_lifecycle_status: 'occupied' } as any).eq('id', switchForm.new_bed_id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant_allotments'], refetchType: 'all' });
      qc.invalidateQueries({ queryKey: ['beds'], refetchType: 'all' });
      qc.invalidateQueries({ queryKey: ['room_switches'], refetchType: 'all' });
      setSwitchOpen(false);
      toast({ title: 'Room switch processed' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // NOTICE MUTATION
  const createNotice = useMutation({
    mutationFn: async () => {
      const now = new Date();
      const noticeDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      // notice_date from form is the actual estimated exit date
      const exitDate = noticeForm.notice_date || format(addDays(new Date(), getConfig().notice_period_days || 30), 'yyyy-MM-dd');

      const { error: noticeErr } = await supabase.from('tenant_notices').insert({
        organization_id: orgId!,
        tenant_id: noticeForm.tenant_id,
        allotment_id: noticeForm.allotment_id,
        bed_id: noticeForm.bed_id,
        notice_date: noticeDate,
        exit_date: exitDate,
        notes: noticeForm.notes || null,
      } as any);
      if (noticeErr) throw new Error(noticeErr.message);

      const { error: allotErr } = await supabase.from('tenant_allotments').update({
        staying_status: 'On-Notice',
        notice_date: noticeDate,
        estimated_exit_date: exitDate,
      } as any).eq('id', noticeForm.allotment_id);
      if (allotErr) throw new Error(allotErr.message);

      const { error: bedErr } = await supabase.from('beds').update({ bed_lifecycle_status: 'notice' } as any).eq('id', noticeForm.bed_id);
      if (bedErr) throw new Error(bedErr.message);

      // Update tenant staying_status
      const { error: tenantErr } = await supabase.from('tenants').update({ staying_status: 'on-notice' } as any).eq('id', noticeForm.tenant_id);
      if (tenantErr) throw new Error(tenantErr.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant_allotments'], refetchType: 'all' });
      qc.invalidateQueries({ queryKey: ['beds'], refetchType: 'all' });
      qc.invalidateQueries({ queryKey: ['tenant_notices'], refetchType: 'all' });
      qc.invalidateQueries({ queryKey: ['tenants'], refetchType: 'all' });
      setNoticeOpen(false);
      toast({ title: 'Notice recorded' });
    },
    onError: (e: any) => {
      const msg = e.message || 'Failed to record notice';
      toast({ title: 'Notice Error', description: msg, variant: 'destructive' });
    },
  });

  // EDIT NOTICE MUTATION
  const updateNotice = useMutation({
    mutationFn: async () => {
      await supabase.from('tenant_notices').update({
        notice_date: editNoticeForm.notice_date,
        exit_date: editNoticeForm.exit_date,
        notes: editNoticeForm.notes || null,
      } as any).eq('id', editNoticeForm.id);

      if (editNoticeForm.allotment_id) {
        await supabase.from('tenant_allotments').update({
          notice_date: editNoticeForm.notice_date,
          estimated_exit_date: editNoticeForm.exit_date,
        } as any).eq('id', editNoticeForm.allotment_id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant_notices'], refetchType: 'all' });
      qc.invalidateQueries({ queryKey: ['tenant_allotments'], refetchType: 'all' });
      qc.invalidateQueries({ queryKey: ['beds'], refetchType: 'all' });
      qc.invalidateQueries({ queryKey: ['tenants'], refetchType: 'all' });
      setEditNoticeOpen(false);
      toast({ title: 'Notice updated' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // DELETE NOTICE MUTATION
  const deleteNotice = useMutation({
    mutationFn: async (noticeData: { id: string; allotment_id: string; bed_id: string; tenant_id: string }) => {
      await supabase.from('tenant_notices').delete().eq('id', noticeData.id);

      if (noticeData.allotment_id) {
        await supabase.from('tenant_allotments').update({
          staying_status: 'Staying',
          notice_date: null,
          estimated_exit_date: null,
        } as any).eq('id', noticeData.allotment_id);
      }
      if (noticeData.bed_id) {
        await supabase.from('beds').update({ bed_lifecycle_status: 'occupied' } as any).eq('id', noticeData.bed_id);
      }
      if (noticeData.tenant_id) {
        await supabase.from('tenants').update({ staying_status: 'staying' } as any).eq('id', noticeData.tenant_id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant_notices'], refetchType: 'all' });
      qc.invalidateQueries({ queryKey: ['tenant_allotments'], refetchType: 'all' });
      qc.invalidateQueries({ queryKey: ['beds'], refetchType: 'all' });
      qc.invalidateQueries({ queryKey: ['tenants'], refetchType: 'all' });
      toast({ title: 'Notice deleted, tenant reverted to Staying' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // EXIT MUTATION
  const processExit = useMutation({
    mutationFn: async () => {
      const allot = allotments.find((a: any) => a.id === exitForm.allotment_id);
      if (!allot) throw new Error('Allotment not found');
      const config = getConfig();
      const onboardDate = allot.onboarding_date ? parseISO(allot.onboarding_date) : new Date();
      const exitDate = exitForm.exit_date ? parseISO(exitForm.exit_date) : new Date();
      const stayDays = differenceInDays(exitDate, onboardDate);
      const stayUnder1Yr = stayDays < 365;

      const damageCharges = parseFloat(exitForm.damage_charges) || 0;
      const keyLoss = exitForm.key_returned ? 0 : (config.key_loss_fee || 500);
      const exitCharges = stayUnder1Yr ? (config.exit_fee_under_1yr || 2250) : 0;
      const pendingRent = allot.balance_due || 0;

      // Estimated EB calculation
      let ebCharges = 0;
      const aptId = allot.apartment_id;
      const daysInExitMonth = exitDate.getDate();
      const prevMonth = new Date(exitDate.getFullYear(), exitDate.getMonth() - 1, 1);
      const prevMonthStr1 = format(prevMonth, 'MMM-yy');
      const prevMonthStr2 = format(prevMonth, 'yyyy-MM');
      const reading = electricityReadings.find((r: any) => r.apartment_id === aptId && (r.billing_month === prevMonthStr1 || r.billing_month === prevMonthStr2));
      if (reading) {
        const totalUnits = Number(reading.reading_end) - Number(reading.reading_start);
        const unitCost = Number(reading.unit_cost);
        const totalBill = totalUnits * unitCost;
        const totalTenantDays = getTotalTenantDaysInMonth(aptId, prevMonth);
        const perDayRate = totalBill / totalTenantDays;
        ebCharges = Math.ceil(perDayRate * daysInExitMonth);
      }

      const totalDeductions = damageCharges + keyLoss + exitCharges + pendingRent + ebCharges;
      const advanceHeld = allot.deposit_paid || 0;
      const refundDue = advanceHeld - totalDeductions;

      await supabase.from('tenant_exits').insert({
        organization_id: orgId!,
        tenant_id: exitForm.tenant_id,
        allotment_id: exitForm.allotment_id,
        bed_id: exitForm.bed_id,
        exit_date: exitForm.exit_date || new Date().toISOString().split('T')[0],
        has_notice: exitForm.has_notice,
        room_inspection: exitForm.room_inspection,
        key_returned: exitForm.key_returned,
        damage_charges: damageCharges,
        key_loss_fee: keyLoss,
        exit_charges: exitCharges,
        eb_charges: ebCharges,
        pending_rent: pendingRent,
        total_deductions: totalDeductions,
        advance_held: advanceHeld,
        refund_due: refundDue > 0 ? refundDue : 0,
        refund_status: refundDue > 0 ? 'pending' : 'none',
        notes: exitForm.notes || null,
      } as any);

      await supabase.from('tenant_allotments').update({
        staying_status: 'Exited',
        actual_exit_date: exitForm.exit_date || new Date().toISOString().split('T')[0],
      } as any).eq('id', exitForm.allotment_id);

      await supabase.from('beds').update({ bed_lifecycle_status: 'vacant' } as any).eq('id', exitForm.bed_id);

      // Update tenant staying_status — check if they have any other active allotments
      const { data: otherActive } = await supabase.from('tenant_allotments')
        .select('id')
        .eq('tenant_id', exitForm.tenant_id)
        .neq('id', exitForm.allotment_id)
        .in('staying_status', ['Booked', 'Staying', 'On-Notice'])
        .limit(1);
      
      if (!otherActive || otherActive.length === 0) {
        await supabase.from('tenants').update({ staying_status: 'exited' } as any).eq('id', exitForm.tenant_id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant_allotments'], refetchType: 'all' });
      qc.invalidateQueries({ queryKey: ['beds'], refetchType: 'all' });
      qc.invalidateQueries({ queryKey: ['tenant_exits'], refetchType: 'all' });
      qc.invalidateQueries({ queryKey: ['tenants'], refetchType: 'all' });
      setExitOpen(false);
      toast({ title: 'Exit processed' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // CANCEL BOOKING MUTATION
  const cancelBooking = useMutation({
    mutationFn: async () => {
      const allot = allotments.find((a: any) => a.id === cancelForm.allotment_id);
      if (!allot) throw new Error('Allotment not found');

      await supabase.from('tenant_allotments').update({
        staying_status: 'Cancelled' as any,
      } as any).eq('id', cancelForm.allotment_id);

      // Release the bed
      await supabase.from('beds').update({ bed_lifecycle_status: 'vacant' } as any).eq('id', allot.bed_id);

      // Check if tenant has any other active allotments
      const { data: otherActive } = await supabase.from('tenant_allotments')
        .select('id')
        .eq('tenant_id', allot.tenant_id)
        .neq('id', cancelForm.allotment_id)
        .in('staying_status', ['Booked', 'Staying', 'On-Notice'])
        .limit(1);
      
      // Determine appropriate status
      const hasExited = allotments.some((a: any) => a.tenant_id === allot.tenant_id && a.staying_status === 'Exited');
      const newStatus = (!otherActive || otherActive.length === 0) ? (hasExited ? 'exited' : 'new') : undefined;
      if (newStatus) {
        await supabase.from('tenants').update({ staying_status: newStatus } as any).eq('id', allot.tenant_id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant_allotments'], refetchType: 'all' });
      qc.invalidateQueries({ queryKey: ['beds'], refetchType: 'all' });
      qc.invalidateQueries({ queryKey: ['tenants'], refetchType: 'all' });
      setCancelOpen(false);
      setCancelForm({ allotment_id: '', reason: '' });
      toast({ title: 'Booking cancelled' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // ADD PAYMENT MUTATION
  const addPayment = useMutation({
    mutationFn: async () => {
      const allot = allotments.find((a: any) => a.id === addPaymentForm.allotment_id);
      if (!allot) throw new Error('Allotment not found');
      const amt = parseFloat(addPaymentForm.amount) || 0;
      if (amt <= 0) throw new Error('Amount must be positive');

      const processingFee = addPaymentForm.payment_mode === 'credit_card' ? Math.ceil(amt * 0.015) : 0;
      await supabase.from('receipts').insert({
        tenant_id: addPaymentForm.tenant_id,
        tenant_allotment_id: addPaymentForm.allotment_id,
        amount_paid: amt + processingFee,
        base_amount: amt,
        processing_fee: processingFee,
        payment_mode: addPaymentForm.payment_mode,
        reference_number: addPaymentForm.reference_number || null,
        payment_date: new Date().toISOString().split('T')[0],
        receipt_type: 'additional_payment',
        organization_id: orgId!,
      } as any);

      const totalAmt = amt + processingFee;
      const newPaid = (allot.paid_amount || 0) + totalAmt;
      const newBalance = Math.max(0, (allot.total_due || 0) - newPaid);
      await supabase.from('tenant_allotments').update({
        paid_amount: newPaid,
        balance_due: newBalance,
        payment_status: newBalance <= 0 ? 'paid' : 'partial',
        processing_fee: (allot.processing_fee || 0) + processingFee,
      } as any).eq('id', addPaymentForm.allotment_id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant_allotments'], refetchType: 'all' });
      qc.invalidateQueries({ queryKey: ['lifecycle_receipts'], refetchType: 'all' });
      setAddPaymentOpen(false);
      setAddPaymentForm({ allotment_id: '', tenant_id: '', amount: '', payment_mode: '', reference_number: '' });
      toast({ title: 'Payment recorded' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // EDIT OCCUPIED MUTATION
  const updateOccupied = useMutation({
    mutationFn: async () => {
      const allot = allotments.find((a: any) => a.id === editOccupiedForm.allotment_id);
      if (!allot) throw new Error('Allotment not found');
      const discount = parseFloat(editOccupiedForm.discount) || 0;
      const premium = parseFloat(editOccupiedForm.premium) || 0;
      const deposit = parseFloat(editOccupiedForm.deposit_paid) || 0;

      await supabase.from('tenant_allotments').update({
        onboarding_date: editOccupiedForm.onboarding_date || allot.onboarding_date,
        discount,
        premium,
        deposit_paid: deposit,
      } as any).eq('id', editOccupiedForm.allotment_id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant_allotments'], refetchType: 'all' });
      setEditOccupiedOpen(false);
      toast({ title: 'Allotment updated successfully' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // Derive bed status from allotments (source of truth) instead of bed_lifecycle_status
  const getBedStatusFromAllotments = (bedId: string): string => {
    const activeAllot = allotments.find((a: any) =>
      a.bed_id === bedId && ['Staying', 'On-Notice', 'Booked'].includes(a.staying_status)
    );
    if (!activeAllot) return 'vacant';
    switch (activeAllot.staying_status) {
      case 'Staying': return 'occupied';
      case 'On-Notice': return 'notice';
      case 'Booked': return 'booked';
      default: return 'vacant';
    }
  };

  // Filter beds to only Live apartments (matching the visual map)
  const liveApartmentIds = useMemo(() => new Set(apartments.filter((a: any) => a.status === 'Live').map((a: any) => a.id)), [apartments]);
  const liveBeds = useMemo(() => beds.filter((b: any) => liveApartmentIds.has(b.apartment_id) && (b.status === 'Live' || b.status === 'live')), [beds, liveApartmentIds]);

  const bedCounts = useMemo(() => {
    const counts = { vacant: 0, booked: 0, occupied: 0, notice: 0 };
    liveBeds.forEach((b: any) => {
      const s = getBedStatusFromAllotments(b.id);
      if (s === 'vacant') counts.vacant++;
      else if (s === 'booked' || s === 'notice-booked') counts.booked++;
      else if (s === 'occupied') counts.occupied++;
      else if (s === 'notice') counts.notice++;
    });
    return counts;
  }, [liveBeds, allotments]);

  const pendingRefunds = exits.filter((e: any) => e.refund_status === 'pending');

  // Beds with specific statuses for detail views (pre-sorted)
  const bedSortFn = (a: any, b: any) => {
    const aptA = apartments.find((ap: any) => ap.id === a.apartment_id)?.apartment_code || '';
    const aptB = apartments.find((ap: any) => ap.id === b.apartment_id)?.apartment_code || '';
    return `${aptA}-${a.bed_code}`.localeCompare(`${aptB}-${b.bed_code}`);
  };
  const vacantBedsList = liveBeds.filter((b: any) => getBedStatusFromAllotments(b.id) === 'vacant').sort(bedSortFn);
  const bookedBedsList = liveBeds.filter((b: any) => ['booked', 'notice-booked'].includes(getBedStatusFromAllotments(b.id))).sort(bedSortFn);
  const occupiedBedsList = liveBeds.filter((b: any) => getBedStatusFromAllotments(b.id) === 'occupied').sort(bedSortFn);
  const noticeBedsList = liveBeds.filter((b: any) => getBedStatusFromAllotments(b.id) === 'notice').sort(bedSortFn);

  // For occupied/notice/booked beds, find their allotments
  const getAllotmentForBed = (bedId: string) => allotments.find((a: any) => a.bed_id === bedId && ['Staying', 'On-Notice', 'Booked'].includes(a.staying_status));
  const overdueRefunds = pendingRefunds.filter((e: any) => {
    const config = getConfig();
    const exitDate = e.exit_date ? parseISO(e.exit_date) : new Date();
    return differenceInDays(new Date(), exitDate) > (config.refund_deadline_days || 5);
  });

  // Absence record mutations
  const createAbsence = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('tenant_absence_records').insert({
        organization_id: orgId!,
        tenant_id: absenceForm.tenant_id,
        allotment_id: absenceForm.allotment_id || null,
        from_date: absenceForm.from_date,
        to_date: absenceForm.to_date,
        reason: absenceForm.reason || null,
        created_by: profile?.id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Absence record added' });
      qc.invalidateQueries({ queryKey: ['tenant_absence_records'], refetchType: 'all' });
      setAbsenceOpen(false);
      setAbsenceForm({ allotment_id: '', tenant_id: '', from_date: '', to_date: '', reason: '' });
      setAbsenceEditId(null);
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const updateAbsence = useMutation({
    mutationFn: async () => {
      if (!absenceEditId) throw new Error('No record selected');
      const { error } = await supabase.from('tenant_absence_records').update({
        from_date: absenceForm.from_date,
        to_date: absenceForm.to_date,
        reason: absenceForm.reason || null,
      }).eq('id', absenceEditId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Absence record updated' });
      qc.invalidateQueries({ queryKey: ['tenant_absence_records'], refetchType: 'all' });
      setAbsenceOpen(false);
      setAbsenceForm({ allotment_id: '', tenant_id: '', from_date: '', to_date: '', reason: '' });
      setAbsenceEditId(null);
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteAbsence = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tenant_absence_records').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Absence record deleted' });
      qc.invalidateQueries({ queryKey: ['tenant_absence_records'], refetchType: 'all' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const fmtDate = (d: string | null) => d ? format(parseISO(d), 'dd-MMM-yy') : '—';

  // Common table head style
  const thClass = "text-center";
  const amtClass = "text-right font-semibold";

  // Tenant data filtering — used inside tabs when user is tenant
  const tenantFilteredOnNotice = isTenantOnly && tenantRecord?.id
    ? onNoticeAllotments.filter((a: any) => a.tenant_id === tenantRecord.id)
    : onNoticeAllotments;
  const tenantFilteredStaying = isTenantOnly && tenantRecord?.id
    ? stayingAllotments.filter((a: any) => a.tenant_id === tenantRecord.id)
    : stayingAllotments;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tenant Lifecycle</h1>
          <p className="text-sm text-muted-foreground mt-1">Booking → Onboarding → Stay → Exit</p>
        </div>
      </div>

      {/* Dashboard Cards - Clickable (hidden for tenants) */}
      {!isTenantOnly && (allotmentsLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <Card key={i}><CardContent className="p-3 text-center"><Skeleton className="h-5 w-5 mx-auto mb-1 rounded-full" /><Skeleton className="h-6 w-10 mx-auto mb-1" /><Skeleton className="h-3 w-16 mx-auto" /></CardContent></Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <Card className={`cursor-pointer transition-all hover:ring-2 hover:ring-primary/30 ${dashboardDetail === 'vacant' ? 'ring-2 ring-primary' : ''}`} onClick={() => setDashboardDetail(dashboardDetail === 'vacant' ? null : 'vacant')}><CardContent className="p-3 text-center"><BedDouble className="h-5 w-5 mx-auto text-green-500 mb-1" /><p className="text-xl font-bold">{bedCounts.vacant}</p><p className="text-[10px] text-muted-foreground">Vacant</p></CardContent></Card>
          <Card className={`cursor-pointer transition-all hover:ring-2 hover:ring-primary/30 ${dashboardDetail === 'booked' ? 'ring-2 ring-primary' : ''}`} onClick={() => setDashboardDetail(dashboardDetail === 'booked' ? null : 'booked')}><CardContent className="p-3 text-center"><CalendarDays className="h-5 w-5 mx-auto text-blue-500 mb-1" /><p className="text-xl font-bold">{bedCounts.booked}</p><p className="text-[10px] text-muted-foreground">Booked</p></CardContent></Card>
          <Card className={`cursor-pointer transition-all hover:ring-2 hover:ring-primary/30 ${dashboardDetail === 'occupied' ? 'ring-2 ring-primary' : ''}`} onClick={() => setDashboardDetail(dashboardDetail === 'occupied' ? null : 'occupied')}><CardContent className="p-3 text-center"><Users className="h-5 w-5 mx-auto text-primary mb-1" /><p className="text-xl font-bold">{bedCounts.occupied}</p><p className="text-[10px] text-muted-foreground">Occupied</p></CardContent></Card>
          <Card className={`cursor-pointer transition-all hover:ring-2 hover:ring-primary/30 ${dashboardDetail === 'notice' ? 'ring-2 ring-primary' : ''}`} onClick={() => setDashboardDetail(dashboardDetail === 'notice' ? null : 'notice')}><CardContent className="p-3 text-center"><Bell className="h-5 w-5 mx-auto text-orange-500 mb-1" /><p className="text-xl font-bold">{bedCounts.notice}</p><p className="text-[10px] text-muted-foreground">Notice</p></CardContent></Card>
          <Card className={`cursor-pointer transition-all hover:ring-2 hover:ring-primary/30 ${dashboardDetail === 'pending_onboard' ? 'ring-2 ring-primary' : ''}`} onClick={() => setDashboardDetail(dashboardDetail === 'pending_onboard' ? null : 'pending_onboard')}><CardContent className="p-3 text-center"><Clock className="h-5 w-5 mx-auto text-yellow-600 mb-1" /><p className="text-xl font-bold">{bookedAllotments.length}</p><p className="text-[10px] text-muted-foreground">Pending Onboard</p></CardContent></Card>
          <Card className={`cursor-pointer transition-all hover:ring-2 hover:ring-primary/30 ${dashboardDetail === 'payment_due' ? 'ring-2 ring-primary' : ''}`} onClick={() => setDashboardDetail(dashboardDetail === 'payment_due' ? null : 'payment_due')}><CardContent className="p-3 text-center"><IndianRupee className="h-5 w-5 mx-auto text-red-500 mb-1" /><p className="text-xl font-bold">{pendingPayments.length}</p><p className="text-[10px] text-muted-foreground">Payment Due</p></CardContent></Card>
          <Card className={`cursor-pointer transition-all hover:ring-2 hover:ring-primary/30 ${dashboardDetail === 'refund_pending' ? 'ring-2 ring-primary' : ''} ${overdueRefunds.length > 0 ? 'border-destructive' : ''}`} onClick={() => setDashboardDetail(dashboardDetail === 'refund_pending' ? null : 'refund_pending')}><CardContent className="p-3 text-center"><RotateCcw className="h-5 w-5 mx-auto text-destructive mb-1" /><p className="text-xl font-bold">{pendingRefunds.length}</p><p className="text-[10px] text-muted-foreground">Refund Pending</p>{overdueRefunds.length > 0 && <Badge variant="destructive" className="text-[9px] mt-1">{overdueRefunds.length} overdue!</Badge>}</CardContent></Card>
        </div>
      ))}

      {/* Dashboard Detail Panel */}
      {!isTenantOnly && dashboardDetail && (
        <Card>
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm capitalize">{dashboardDetail.replace(/_/g, ' ')} — Detail ({
              dashboardDetail === 'vacant' ? vacantBedsList.length :
              dashboardDetail === 'booked' ? bookedAllotments.length :
              dashboardDetail === 'occupied' ? stayingAllotments.length :
              dashboardDetail === 'notice' ? onNoticeAllotments.length :
              dashboardDetail === 'pending_onboard' ? bookedAllotments.length :
              dashboardDetail === 'payment_due' ? pendingPayments.length :
              dashboardDetail === 'refund_pending' ? pendingRefunds.length : 0
            })</CardTitle>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setDashboardDetail(null)}><X className="h-4 w-4" /></Button>
          </CardHeader>
          <CardContent className="p-4 pt-0 max-h-[400px] overflow-auto">
            {dashboardDetail === 'vacant' && (
              <Table>
                <TableHeader><TableRow>
                  <TableHead className={thClass}>Apartment-Bed</TableHead><TableHead className={thClass}>Bed Type</TableHead><TableHead className={thClass}>Toilet</TableHead><TableHead className={thClass}>Rate</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {vacantBedsList.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">No vacant beds</TableCell></TableRow> :
                    vacantBedsList.map((b: any) => {
                      const apt = apartments.find((a: any) => a.id === b.apartment_id);
                      return (
                        <TableRow key={b.id}>
                          <TableCell className="font-medium">{apt?.apartment_code}-{b.bed_code}</TableCell>
                          <TableCell className="text-center capitalize">{b.bed_type}</TableCell>
                          <TableCell className="text-center capitalize">{b.toilet_type}</TableCell>
                          <TableCell className={amtClass}>₹{fmtAmt(getBedRate(b.id))}</TableCell>
                        </TableRow>
                      );
                    })
                  }
                </TableBody>
              </Table>
            )}

            {dashboardDetail === 'booked' && (
              <Table>
                <TableHeader><TableRow>
                  <TableHead className={thClass}>Tenant</TableHead><TableHead className={thClass}>Apartment-Bed</TableHead><TableHead className={thClass}>Booking Date</TableHead><TableHead className={thClass}>Planned Onboarding</TableHead><TableHead className={thClass}>Paid</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {bookedAllotments.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-4">No booked tenants</TableCell></TableRow> :
                    bookedAllotments.map((a: any) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.tenants?.full_name}</TableCell>
                        <TableCell className="text-center">{a.apartments?.apartment_code}-{a.beds?.bed_code}</TableCell>
                        <TableCell className="text-center">{fmtDate(a.booking_date)}</TableCell>
                        <TableCell className="text-center">{fmtDate(a.onboarding_date)}</TableCell>
                        <TableCell className={amtClass}>₹{fmtAmt(a.paid_amount || a.deposit_paid)}</TableCell>
                      </TableRow>
                    ))
                  }
                </TableBody>
              </Table>
            )}

            {dashboardDetail === 'occupied' && (() => {
              const sorted = [...stayingAllotments].sort((a: any, b: any) => (a.tenants?.full_name || '').localeCompare(b.tenants?.full_name || ''));
              const [occupiedSearch, setOccupiedSearch] = [occupiedSearchQ, setOccupiedSearchQ];
              const filtered = occupiedSearch.trim() ? sorted.filter((a: any) => a.tenants?.full_name?.toLowerCase().includes(occupiedSearch.toLowerCase())) : sorted;
              return (
                <>
                  <div className="relative max-w-sm mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search tenants..." value={occupiedSearch} onChange={(e) => setOccupiedSearchQ(e.target.value)} className="pl-9 h-9" />
                  </div>
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead className={thClass}>Tenant</TableHead><TableHead className={thClass}>Apartment-Bed</TableHead><TableHead className={thClass}>Onboarding Date</TableHead><TableHead className={thClass}>Rent</TableHead><TableHead className={thClass}>Discount</TableHead><TableHead className={thClass}>Premium</TableHead><TableHead className={thClass}>Advance</TableHead><TableHead className={thClass}></TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {filtered.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-4">No occupied beds</TableCell></TableRow> :
                        filtered.map((a: any) => (
                          <TableRow key={a.id}>
                            <TableCell className="font-medium">{a.tenants?.full_name}</TableCell>
                            <TableCell className="text-center">{a.apartments?.apartment_code}-{a.beds?.bed_code}</TableCell>
                            <TableCell className="text-center">{fmtDate(a.onboarding_date)}</TableCell>
                            <TableCell className={amtClass}>₹{fmtAmt(a.monthly_rental)}</TableCell>
                            <TableCell className={amtClass}>₹{fmtAmt(a.discount)}</TableCell>
                            <TableCell className={amtClass}>₹{fmtAmt(a.premium)}</TableCell>
                            <TableCell className={amtClass}>₹{fmtAmt(a.deposit_paid)}</TableCell>
                            <TableCell>
                              <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={() => {
                                setEditOccupiedForm({
                                  allotment_id: a.id,
                                  onboarding_date: a.onboarding_date || '',
                                  discount: String(a.discount || 0),
                                  premium: String(a.premium || 0),
                                  deposit_paid: String(a.deposit_paid || 0),
                                });
                                setEditOccupiedOpen(true);
                              }}>
                                <Pencil className="h-3 w-3" /> Edit
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      }
                    </TableBody>
                  </Table>
                </>
              );
            })()}

            {dashboardDetail === 'notice' && (
              <Table>
                <TableHeader><TableRow>
                  <TableHead className={thClass}>Tenant</TableHead><TableHead className={thClass}>Apartment-Bed</TableHead><TableHead className={thClass}>Notice Date</TableHead><TableHead className={thClass}>Est. Exit Date</TableHead><TableHead className={thClass}>Rent</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {onNoticeAllotments.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-4">No tenants on notice</TableCell></TableRow> :
                    onNoticeAllotments.map((a: any) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.tenants?.full_name}</TableCell>
                        <TableCell className="text-center">{a.apartments?.apartment_code}-{a.beds?.bed_code}</TableCell>
                        <TableCell className="text-center">{fmtDate(a.notice_date)}</TableCell>
                        <TableCell className="text-center">{fmtDate(a.estimated_exit_date)}</TableCell>
                        <TableCell className={amtClass}>₹{fmtAmt(a.monthly_rental)}</TableCell>
                      </TableRow>
                    ))
                  }
                </TableBody>
              </Table>
            )}

            {dashboardDetail === 'pending_onboard' && (
              <Table>
                <TableHeader><TableRow>
                  <TableHead className={thClass}>Tenant</TableHead><TableHead className={thClass}>Apartment-Bed</TableHead><TableHead className={thClass}>Booking Date</TableHead><TableHead className={thClass}>Planned Onboarding</TableHead><TableHead className={thClass}>Booking Amt</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {bookedAllotments.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-4">No pending onboardings</TableCell></TableRow> :
                    bookedAllotments.map((a: any) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.tenants?.full_name}</TableCell>
                        <TableCell className="text-center">{a.apartments?.apartment_code}-{a.beds?.bed_code}</TableCell>
                        <TableCell className="text-center">{fmtDate(a.booking_date)}</TableCell>
                        <TableCell className="text-center">{fmtDate(a.onboarding_date)}</TableCell>
                        <TableCell className={amtClass}>₹{fmtAmt(a.deposit_paid)}</TableCell>
                      </TableRow>
                    ))
                  }
                </TableBody>
              </Table>
            )}

            {dashboardDetail === 'payment_due' && (
              <Table>
                <TableHeader><TableRow>
                  <TableHead className={thClass}>Tenant</TableHead><TableHead className={thClass}>Apartment-Bed</TableHead><TableHead className={thClass}>Onboarding Date</TableHead><TableHead className={thClass}>Total Due</TableHead><TableHead className={thClass}>Paid</TableHead><TableHead className={thClass}>Balance</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {pendingPayments.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-4">No pending payments</TableCell></TableRow> :
                    pendingPayments.map((a: any) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.tenants?.full_name}</TableCell>
                        <TableCell className="text-center">{a.apartments?.apartment_code}-{a.beds?.bed_code}</TableCell>
                        <TableCell className="text-center">{fmtDate(a.onboarding_date)}</TableCell>
                        <TableCell className={amtClass}>₹{fmtAmt(a.total_due)}</TableCell>
                        <TableCell className={amtClass}>₹{fmtAmt(a.paid_amount)}</TableCell>
                        <TableCell className="text-right text-destructive font-semibold">₹{fmtAmt(a.balance_due)}</TableCell>
                      </TableRow>
                    ))
                  }
                </TableBody>
              </Table>
            )}

            {dashboardDetail === 'refund_pending' && (
              <Table>
                <TableHeader><TableRow>
                  <TableHead className={thClass}>Tenant</TableHead><TableHead className={thClass}>Exit Date</TableHead><TableHead className={thClass}>Advance Held</TableHead><TableHead className={thClass}>Deductions</TableHead><TableHead className={thClass}>Refund Amt</TableHead><TableHead className={thClass}>Days Since</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {pendingRefunds.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-4">No pending refunds</TableCell></TableRow> :
                    pendingRefunds.map((e: any) => {
                      const daysSince = differenceInDays(new Date(), parseISO(e.exit_date));
                      return (
                        <TableRow key={e.id}>
                          <TableCell className="font-medium">{e.tenants?.full_name}</TableCell>
                          <TableCell className="text-center">{fmtDate(e.exit_date)}</TableCell>
                          <TableCell className={amtClass}>₹{fmtAmt(e.advance_held)}</TableCell>
                          <TableCell className={amtClass}>₹{fmtAmt(e.total_deductions)}</TableCell>
                          <TableCell className="text-right font-bold text-green-600">₹{fmtAmt(e.refund_due)}</TableCell>
                          <TableCell className="text-center">{daysSince} days</TableCell>
                        </TableRow>
                      );
                    })
                  }
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue={
        isTenantOnly
          ? (['notices','exit','payments','refunds'].find(t => isTabVisible(t)) || 'notices')
          : (['visual-map','booking','onboarding','switching','notices','exit','payments','refunds','excel-upload'].find(t => isTabVisible(t)) || 'visual-map')
      }>
        <TabsList className="flex-wrap">
          {isTabVisible('visual-map') && <TabsTrigger value="visual-map" className="gap-1"><BedDouble className="h-3.5 w-3.5" /> Visual Map</TabsTrigger>}
          {isTabVisible('booking') && <TabsTrigger value="booking" className="gap-1"><CalendarDays className="h-3.5 w-3.5" /> Booking</TabsTrigger>}
          {isTabVisible('onboarding') && <TabsTrigger value="onboarding" className="gap-1"><LogIn className="h-3.5 w-3.5" /> Onboarding</TabsTrigger>}
          {isTabVisible('switching') && <TabsTrigger value="switching" className="gap-1"><ArrowRightLeft className="h-3.5 w-3.5" /> Switching</TabsTrigger>}
          {isTabVisible('notices') && <TabsTrigger value="notices" className="gap-1"><Bell className="h-3.5 w-3.5" /> Notices</TabsTrigger>}
          {isTabVisible('exit') && <TabsTrigger value="exit" className="gap-1"><LogOutIcon className="h-3.5 w-3.5" /> Exit</TabsTrigger>}
          {isTabVisible('payments') && <TabsTrigger value="payments" className="gap-1"><CreditCard className="h-3.5 w-3.5" /> Payments</TabsTrigger>}
          {isTabVisible('refunds') && <TabsTrigger value="refunds" className="gap-1"><RotateCcw className="h-3.5 w-3.5" /> Refunds</TabsTrigger>}
          {isTabVisible('not-in-property') && <TabsTrigger value="not-in-property" className="gap-1"><Home className="h-3.5 w-3.5" /> Not in Property</TabsTrigger>}
          {isTabVisible('excel-upload') && <TabsTrigger value="excel-upload" className="gap-1"><FileSpreadsheet className="h-3.5 w-3.5" /> Excel Upload</TabsTrigger>}
        </TabsList>

        {/* ═══════════ VISUAL MAP TAB ═══════════ */}
        <TabsContent value="visual-map" className="mt-4">
          <BedOccupancyMap
            beds={beds}
            apartments={apartments}
            properties={properties}
            allotments={allotments}
            notices={notices}
            getBedRate={getBedRate}
          />
        </TabsContent>

        {/* ═══════════ BOOKING TAB ═══════════ */}
        <TabsContent value="booking" className="space-y-4 mt-4">
          {/* Section 1: New KYC Tenants */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">New Tenants (KYC ✓)</h2>
            <Button className="gap-2" onClick={() => setBookingOpen(true)}><Plus className="h-4 w-4" /> New Booking</Button>
          </div>
          {eligibleTenants.length === 0 ? (
            <Card><CardContent className="py-6 text-center text-muted-foreground text-sm">No new tenants with completed KYC</CardContent></Card>
          ) : (
            <Card className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead className={thClass}>Tenant</TableHead><TableHead className={thClass}>Phone</TableHead><TableHead className={thClass}>KYC</TableHead><TableHead className={thClass}></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {eligibleTenants.map((t: any) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.full_name}</TableCell>
                      <TableCell>{t.phone}</TableCell>
                      <TableCell><Badge variant="outline" className="text-green-600"><Check className="h-3 w-3 mr-1" />Completed</Badge></TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => {
                          setBookingForm({ ...bookingForm, tenant_id: t.id });
                          setBookingOpen(true);
                        }}>Book</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}

          {/* Section 2: Returning Tenants (searchable) */}
          <div className="mt-6 space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <RotateCcw className="h-4 w-4" /> Returning Tenants (Previously Exited)
            </h3>
            <ReturningTenantSearch
              tenants={returningTenants}
              onBook={(tenantId: string) => {
                setBookingForm({ ...bookingForm, tenant_id: tenantId });
                setBookingOpen(true);
              }}
            />
          </div>

          {/* Booked list */}
          {bookedAllotments.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold mb-2 text-muted-foreground">Booked — Pending Onboarding</h3>
              <Card className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <SortableTableHead label="Tenant" sortKey="tenant" sortConfig={bookingSort.sortConfig} onSort={bookingSort.handleSort} className={thClass} />
                    <TableHead className={thClass}>Property</TableHead>
                    <TableHead className={thClass}>Apt-Bed</TableHead>
                    <SortableTableHead label="Booking Date" sortKey="booking_date" sortConfig={bookingSort.sortConfig} onSort={bookingSort.handleSort} className={thClass} />
                    <SortableTableHead label="Planned Onboarding" sortKey="onboarding_date" sortConfig={bookingSort.sortConfig} onSort={bookingSort.handleSort} className={thClass} />
                    <TableHead className={thClass}></TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {bookingSort.sortData(bookedAllotments, (item, key) => {
                      if (key === 'tenant') return item.tenants?.full_name;
                      if (key === 'booking_date') return item.booking_date;
                      if (key === 'onboarding_date') return item.onboarding_date;
                      return item[key];
                    }).map((a: any) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.tenants?.full_name}</TableCell>
                        <TableCell>{a.properties?.property_name}</TableCell>
                        <TableCell>{a.apartments?.apartment_code}-{a.beds?.bed_code}</TableCell>
                        <TableCell>{fmtDate(a.booking_date)}</TableCell>
                        <TableCell>{fmtDate(a.onboarding_date)}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="destructive" className="gap-1" onClick={() => {
                            setCancelForm({ allotment_id: a.id, reason: '' });
                            setCancelOpen(true);
                          }}>
                            <XCircle className="h-3 w-3" /> Cancel
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ═══════════ ONBOARDING TAB ═══════════ */}
        <TabsContent value="onboarding" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Booked Tenants — Ready for Onboarding</h2>
          </div>
          <Card className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <SortableTableHead label="Tenant" sortKey="tenant" sortConfig={onboardSort.sortConfig} onSort={onboardSort.handleSort} className={thClass} />
                <TableHead className={thClass}>Property</TableHead>
                <TableHead className={thClass}>Apt-Bed</TableHead>
                <SortableTableHead label="Booking Date" sortKey="booking_date" sortConfig={onboardSort.sortConfig} onSort={onboardSort.handleSort} className={thClass} />
                <SortableTableHead label="Planned Date" sortKey="onboarding_date" sortConfig={onboardSort.sortConfig} onSort={onboardSort.handleSort} className={thClass} />
                <SortableTableHead label="Paid" sortKey="paid_amount" sortConfig={onboardSort.sortConfig} onSort={onboardSort.handleSort} className={thClass} />
                <TableHead className={thClass}></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {bookedAllotments.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No pending onboardings</TableCell></TableRow> :
                  onboardSort.sortData(bookedAllotments, (item, key) => {
                    if (key === 'tenant') return item.tenants?.full_name;
                    if (key === 'booking_date') return item.booking_date;
                    if (key === 'onboarding_date') return item.onboarding_date;
                    if (key === 'paid_amount') return item.paid_amount || item.deposit_paid;
                    return item[key];
                  }).map((a: any) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.tenants?.full_name}</TableCell>
                      <TableCell>{a.properties?.property_name}</TableCell>
                      <TableCell>{a.apartments?.apartment_code}-{a.beds?.bed_code}</TableCell>
                      <TableCell>{fmtDate(a.booking_date)}</TableCell>
                      <TableCell>{fmtDate(a.onboarding_date)}</TableCell>
                      <TableCell className={amtClass}>₹{fmtAmt(a.paid_amount || a.deposit_paid)}</TableCell>
                      <TableCell className="space-x-1">
                        <Button size="sm" onClick={() => {
                          setOnboardForm({
                            allotment_id: a.id, actual_onboarding_date: a.onboarding_date || '',
                            bed_id: a.bed_id, payment_mode: '', reference_number: '', paid_amount: '',
                            kyc_front_url: '', kyc_back_url: '',
                          });
                          setOnboardOpen(true);
                        }}>Onboard</Button>
                        <Button size="sm" variant="destructive" className="gap-1" onClick={() => {
                          setCancelForm({ allotment_id: a.id, reason: '' });
                          setCancelOpen(true);
                        }}>
                          <XCircle className="h-3 w-3" /> Cancel
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                }
              </TableBody>
            </Table>
          </Card>

          {/* Payment pending list */}
          {pendingPayments.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold mb-2 text-muted-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-600" /> Onboarded — Payment Pending
              </h3>
              <Card className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead className={thClass}>Tenant</TableHead><TableHead className={thClass}>Total Due</TableHead><TableHead className={thClass}>Paid</TableHead><TableHead className={thClass}>Balance</TableHead><TableHead className={thClass}>Expected Date</TableHead><TableHead className={thClass}></TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {pendingPayments.map((a: any) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.tenants?.full_name}</TableCell>
                        <TableCell className={amtClass}>₹{fmtAmt(a.total_due)}</TableCell>
                        <TableCell className={amtClass}>₹{fmtAmt(a.paid_amount)}</TableCell>
                        <TableCell className="text-right text-destructive font-semibold">₹{fmtAmt(a.balance_due)}</TableCell>
                        <TableCell>{fmtDate(a.expected_payment_date)}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" className="gap-1" onClick={() => {
                            setAddPaymentForm({
                              allotment_id: a.id,
                              tenant_id: a.tenant_id,
                              amount: String(Math.ceil(a.balance_due || 0)),
                              payment_mode: '',
                              reference_number: '',
                            });
                            setAddPaymentOpen(true);
                          }}>
                            <Plus className="h-3 w-3" /> Add Payment
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ═══════════ SWITCHING TAB ═══════════ */}
        <TabsContent value="switching" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Room Switching</h2>
            <Button className="gap-2" onClick={() => setSwitchOpen(true)}><ArrowRightLeft className="h-4 w-4" /> New Switch</Button>
          </div>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by tenant name..." value={switchSearch} onChange={(e) => { setSwitchSearch(e.target.value); setSwitchPage(0); }} className="pl-9 h-9" />
          </div>
          {(() => {
            const lower = switchSearch.toLowerCase().trim();
            const filtered = lower ? roomSwitches.filter((s: any) => s.tenants?.full_name?.toLowerCase().includes(lower)) : roomSwitches;
            const sorted = switchSort.sortData(filtered, (item, key) => {
              if (key === 'tenant') return item.tenants?.full_name;
              if (key === 'switch_date') return item.switch_date;
              if (key === 'rent_difference') return item.rent_difference;
              if (key === 'status') return item.status;
              return item[key];
            });
            const totalCount = sorted.length;
            const totalPages = Math.ceil(totalCount / LIFECYCLE_PAGE_SIZE);
            const paged = sorted.slice(switchPage * LIFECYCLE_PAGE_SIZE, (switchPage + 1) * LIFECYCLE_PAGE_SIZE);
            return (
              <>
                <Card className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <SortableTableHead label="Tenant" sortKey="tenant" sortConfig={switchSort.sortConfig} onSort={switchSort.handleSort} className={thClass} />
                      <TableHead className={thClass}>Type</TableHead>
                      <SortableTableHead label="Switch Date" sortKey="switch_date" sortConfig={switchSort.sortConfig} onSort={switchSort.handleSort} className={thClass} />
                      <SortableTableHead label="Rent Diff" sortKey="rent_difference" sortConfig={switchSort.sortConfig} onSort={switchSort.handleSort} className={thClass} />
                      <SortableTableHead label="Status" sortKey="status" sortConfig={switchSort.sortConfig} onSort={switchSort.handleSort} className={thClass} />
                    </TableRow></TableHeader>
                    <TableBody>
                      {paged.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No room switches</TableCell></TableRow> :
                        paged.map((s: any) => (
                          <TableRow key={s.id}>
                            <TableCell className="font-medium">{s.tenants?.full_name}</TableCell>
                            <TableCell className="capitalize">{s.switch_type}</TableCell>
                            <TableCell>{fmtDate(s.switch_date)}</TableCell>
                            <TableCell className={amtClass}>₹{fmtAmt(s.rent_difference)}</TableCell>
                            <TableCell><StatusBadge status={s.status} type="entity" /></TableCell>
                          </TableRow>
                        ))
                      }
                    </TableBody>
                  </Table>
                </Card>
                <TablePagination page={switchPage} totalPages={totalPages} totalCount={totalCount} pageSize={LIFECYCLE_PAGE_SIZE} setPage={setSwitchPage} />
              </>
            );
          })()}
        </TabsContent>

        {/* ═══════════ NOTICES TAB ═══════════ */}
        <TabsContent value="notices" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{isTenantOnly ? 'Your Notices' : 'Tenant Notices'}</h2>
            {isTenantOnly ? (
              tenantFilteredStaying.length > 0 ? (
                <Button className="gap-2" onClick={() => {
                  const allot = tenantFilteredStaying[0];
                  setNoticeForm({
                    allotment_id: allot.id,
                    tenant_id: allot.tenant_id,
                    bed_id: allot.bed_id,
                    notice_date: '',
                    notes: '',
                  });
                  setNoticeOpen(true);
                }}>
                  <Bell className="h-4 w-4" /> Record Notice
                </Button>
              ) : tenantFilteredOnNotice.length > 0 ? null : (
                <p className="text-xs text-muted-foreground">
                  {!tenantRecord ? 'Your account is not linked to a tenant record. Please contact your administrator.' : 'No active stay found to submit notice.'}
                </p>
              )
            ) : (
              <Button className="gap-2" onClick={() => setNoticeOpen(true)}><Bell className="h-4 w-4" /> Record Notice</Button>
            )}
          </div>
          {!isTenantOnly && (
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by tenant name..." value={noticeSearch} onChange={(e) => { setNoticeSearch(e.target.value); setNoticePage(0); }} className="pl-9 h-9" />
            </div>
          )}
          {(() => {
            const lower = noticeSearch.toLowerCase().trim();
            const filtered = lower ? tenantFilteredOnNotice.filter((a: any) => a.tenants?.full_name?.toLowerCase().includes(lower)) : tenantFilteredOnNotice;
            const sorted = noticeSort.sortData(filtered, (item, key) => {
              if (key === 'tenant') return item.tenants?.full_name;
              if (key === 'notice_date') return item.notice_date;
              if (key === 'estimated_exit_date') return item.estimated_exit_date;
              if (key === 'property') return item.properties?.property_name;
              return item[key];
            });
            const totalCount = sorted.length;
            const totalPages = Math.ceil(totalCount / LIFECYCLE_PAGE_SIZE);
            const paged = sorted.slice(noticePage * LIFECYCLE_PAGE_SIZE, (noticePage + 1) * LIFECYCLE_PAGE_SIZE);
            return (
              <>
                <Card className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow>
                      {!isTenantOnly && <SortableTableHead label="Tenant" sortKey="tenant" sortConfig={noticeSort.sortConfig} onSort={noticeSort.handleSort} className={thClass} />}
                      <TableHead className={thClass}>Apt-Bed</TableHead>
                      <SortableTableHead label="Notice Date" sortKey="notice_date" sortConfig={noticeSort.sortConfig} onSort={noticeSort.handleSort} className={thClass} />
                      <SortableTableHead label="Est. Exit Date" sortKey="estimated_exit_date" sortConfig={noticeSort.sortConfig} onSort={noticeSort.handleSort} className={thClass} />
                      <SortableTableHead label="Property" sortKey="property" sortConfig={noticeSort.sortConfig} onSort={noticeSort.handleSort} className={thClass} />
                      {!isTenantOnly && <TableHead className={thClass}>Actions</TableHead>}
                    </TableRow></TableHeader>
                    <TableBody>
                      {paged.length === 0 ? <TableRow><TableCell colSpan={isTenantOnly ? 4 : 6} className="text-center text-muted-foreground py-8">No notices</TableCell></TableRow> :
                        paged.map((a: any) => {
                          const noticeRecord = notices.find((n: any) => n.allotment_id === a.id);
                          return (
                            <TableRow key={a.id}>
                              {!isTenantOnly && <TableCell className="font-medium">{a.tenants?.full_name}</TableCell>}
                              <TableCell className="text-center">{a.apartments?.apartment_code}-{a.beds?.bed_code}</TableCell>
                              <TableCell className="text-center">{fmtDate(a.notice_date)}</TableCell>
                              <TableCell className="text-center">{fmtDate(a.estimated_exit_date)}</TableCell>
                              <TableCell>{a.properties?.property_name}</TableCell>
                              {!isTenantOnly && (
                                <TableCell className="space-x-1">
                                  <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={() => {
                                    setEditNoticeForm({
                                      id: noticeRecord?.id || '',
                                      notice_date: a.notice_date || '',
                                      exit_date: a.estimated_exit_date || '',
                                      notes: noticeRecord?.notes || '',
                                      allotment_id: a.id,
                                    });
                                    setEditNoticeOpen(true);
                                  }}>
                                    <Pencil className="h-3 w-3" /> Edit
                                  </Button>
                                  <Button size="sm" variant="destructive" className="gap-1 h-7 text-xs" onClick={() => {
                                    if (confirm('Delete this notice? The tenant will revert to Staying status.')) {
                                      deleteNotice.mutate({
                                        id: noticeRecord?.id || '',
                                        allotment_id: a.id,
                                        bed_id: a.bed_id,
                                        tenant_id: a.tenant_id,
                                      });
                                    }
                                  }}>
                                    <XCircle className="h-3 w-3" /> Delete
                                  </Button>
                                </TableCell>
                              )}
                            </TableRow>
                          );
                        })
                      }
                    </TableBody>
                  </Table>
                </Card>
                <TablePagination page={noticePage} totalPages={totalPages} totalCount={totalCount} pageSize={LIFECYCLE_PAGE_SIZE} setPage={setNoticePage} />
              </>
            );
          })()}
        </TabsContent>

        {/* ═══════════ EXIT TAB ═══════════ */}
        <TabsContent value="exit" className="space-y-4 mt-4">
          <h2 className="text-lg font-semibold">Exit Management</h2>

          {/* Tenants on Notice — ready for exit */}
          <div>
            <h3 className="text-sm font-semibold mb-2 text-muted-foreground flex items-center gap-2">
              <Bell className="h-4 w-4 text-orange-500" /> Tenants on Notice — Process Exit
            </h3>
            <Card className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead className={thClass}>Tenant</TableHead>
                  <TableHead className={thClass}>Apt-Bed</TableHead>
                  <TableHead className={thClass}>Notice Date</TableHead>
                  <TableHead className={thClass}>Est. Exit Date</TableHead>
                  <TableHead className={thClass}>Rent</TableHead>
                  <TableHead className={thClass}>Advance Held</TableHead>
                  <TableHead className={thClass}></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {onNoticeAllotments.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No tenants on notice</TableCell></TableRow>
                  ) : onNoticeAllotments.map((a: any) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.tenants?.full_name}</TableCell>
                      <TableCell className="text-center">{a.apartments?.apartment_code}-{a.beds?.bed_code}</TableCell>
                      <TableCell className="text-center">{fmtDate(a.notice_date)}</TableCell>
                      <TableCell className="text-center">{fmtDate(a.estimated_exit_date)}</TableCell>
                      <TableCell className={amtClass}>₹{fmtAmt(a.monthly_rental)}</TableCell>
                      <TableCell className={amtClass}>₹{fmtAmt(a.deposit_paid)}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="destructive" className="gap-1" onClick={() => {
                          setExitForm({
                            allotment_id: a.id,
                            tenant_id: a.tenant_id,
                            bed_id: a.bed_id,
                            exit_date: a.estimated_exit_date || '',
                            has_notice: true,
                            room_inspection: false,
                            key_returned: true,
                            damage_charges: '0',
                            notes: '',
                            inspect_furniture: false, inspect_bed: false, inspect_walls: false, inspect_bathroom: false,
                          });
                          setExitOpen(true);
                        }}>
                          <LogOutIcon className="h-3 w-3" /> Process Exit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>

          {/* Past exits history */}
          <div className="mt-6">
            <h3 className="text-sm font-semibold mb-2 text-muted-foreground">Exit History</h3>
            <div className="relative max-w-sm mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by tenant name..." value={exitSearch} onChange={(e) => { setExitSearch(e.target.value); setExitPage(0); }} className="pl-9 h-9" />
            </div>
            {(() => {
              const lower = exitSearch.toLowerCase().trim();
              const filtered = lower ? exits.filter((e: any) => e.tenants?.full_name?.toLowerCase().includes(lower)) : exits;
              const sorted = exitSort.sortData(filtered, (item, key) => {
                if (key === 'tenant') return item.tenants?.full_name;
                if (key === 'exit_date') return item.exit_date;
                if (key === 'total_deductions') return item.total_deductions;
                if (key === 'refund_due') return item.refund_due;
                return item[key];
              });
              const totalCount = sorted.length;
              const totalPages = Math.ceil(totalCount / LIFECYCLE_PAGE_SIZE);
              const paged = sorted.slice(exitPage * LIFECYCLE_PAGE_SIZE, (exitPage + 1) * LIFECYCLE_PAGE_SIZE);
              return (
                <>
                  <Card className="overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow>
                        <SortableTableHead label="Tenant" sortKey="tenant" sortConfig={exitSort.sortConfig} onSort={exitSort.handleSort} className={thClass} />
                        <SortableTableHead label="Exit Date" sortKey="exit_date" sortConfig={exitSort.sortConfig} onSort={exitSort.handleSort} className={thClass} />
                        <TableHead className={thClass}>Notice?</TableHead>
                        <SortableTableHead label="Deductions" sortKey="total_deductions" sortConfig={exitSort.sortConfig} onSort={exitSort.handleSort} className={thClass} />
                        <SortableTableHead label="Refund Due" sortKey="refund_due" sortConfig={exitSort.sortConfig} onSort={exitSort.handleSort} className={thClass} />
                        <TableHead className={thClass}>Status</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {paged.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No exit records</TableCell></TableRow> :
                          paged.map((e: any) => (
                            <TableRow key={e.id}>
                              <TableCell className="font-medium">{e.tenants?.full_name}</TableCell>
                              <TableCell className="text-center">{fmtDate(e.exit_date)}</TableCell>
                              <TableCell className="text-center">
                                {e.has_notice ? <Badge variant="outline" className="text-green-600">Yes</Badge> : <Badge variant="destructive" className="text-[10px]">No Notice</Badge>}
                              </TableCell>
                              <TableCell className={amtClass}>₹{fmtAmt(e.total_deductions)}</TableCell>
                              <TableCell className={amtClass}>₹{fmtAmt(e.refund_due)}</TableCell>
                              <TableCell><StatusBadge status={e.refund_status} type="payment" /></TableCell>
                            </TableRow>
                          ))
                        }
                      </TableBody>
                    </Table>
                  </Card>
                  <TablePagination page={exitPage} totalPages={totalPages} totalCount={totalCount} pageSize={LIFECYCLE_PAGE_SIZE} setPage={setExitPage} />
                </>
              );
            })()}
          </div>
        </TabsContent>

        {/* ═══════════ PAYMENTS TAB ═══════════ */}
        <TabsContent value="payments" className="space-y-4 mt-4">
          <h2 className="text-lg font-semibold">All Lifecycle Payments</h2>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by tenant name..." value={paymentSearch} onChange={(e) => { setPaymentSearch(e.target.value); setPaymentPage(0); }} className="pl-9 h-9" />
          </div>
          {(() => {
            const lower = paymentSearch.toLowerCase().trim();
            const filtered = lower ? lifecycleReceipts.filter((p: any) => p.tenants?.full_name?.toLowerCase().includes(lower)) : lifecycleReceipts;
            const sorted = paymentSort.sortData(filtered, (item, key) => {
              if (key === 'tenant') return item.tenants?.full_name;
              if (key === 'amount_paid') return item.amount_paid;
              if (key === 'payment_date') return item.payment_date;
              return item[key];
            });
            const totalCount = sorted.length;
            const totalPages = Math.ceil(totalCount / LIFECYCLE_PAGE_SIZE);
            const paged = sorted.slice(paymentPage * LIFECYCLE_PAGE_SIZE, (paymentPage + 1) * LIFECYCLE_PAGE_SIZE);
            return (
              <>
                <Card className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <SortableTableHead label="Tenant" sortKey="tenant" sortConfig={paymentSort.sortConfig} onSort={paymentSort.handleSort} className={thClass} />
                      <TableHead className={thClass}>Type</TableHead>
                      <SortableTableHead label="Amount" sortKey="amount_paid" sortConfig={paymentSort.sortConfig} onSort={paymentSort.handleSort} className={thClass} />
                      <TableHead className={thClass}>Mode</TableHead>
                      <TableHead className={thClass}>Reference</TableHead>
                      <SortableTableHead label="Date" sortKey="payment_date" sortConfig={paymentSort.sortConfig} onSort={paymentSort.handleSort} className={thClass} />
                    </TableRow></TableHeader>
                    <TableBody>
                      {paged.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No payments</TableCell></TableRow> :
                        paged.map((p: any) => (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium">{p.tenants?.full_name}</TableCell>
                            <TableCell><Badge variant="outline" className="capitalize text-[10px]">{p.receipt_type}</Badge></TableCell>
                            <TableCell className={amtClass}>₹{fmtAmt(p.amount_paid)}</TableCell>
                            <TableCell className="capitalize">{p.payment_mode || '—'}</TableCell>
                            <TableCell className="text-xs">{p.reference_number || '—'}</TableCell>
                            <TableCell>{fmtDate(p.payment_date)}</TableCell>
                          </TableRow>
                        ))
                      }
                    </TableBody>
                  </Table>
                </Card>
                <TablePagination page={paymentPage} totalPages={totalPages} totalCount={totalCount} pageSize={LIFECYCLE_PAGE_SIZE} setPage={setPaymentPage} />
              </>
            );
          })()}
        </TabsContent>

        {/* ═══════════ REFUNDS TAB ═══════════ */}
        <TabsContent value="refunds" className="space-y-4 mt-4">
          <h2 className="text-lg font-semibold">Refund Tracking</h2>
          {overdueRefunds.length > 0 && (
            <Card className="border-destructive bg-destructive/5 p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <p className="text-sm font-semibold text-destructive">{overdueRefunds.length} refund(s) overdue ({'>'} {getConfig().refund_deadline_days || 5} working days)</p>
              </div>
            </Card>
          )}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by tenant name..." value={refundSearch} onChange={(e) => { setRefundSearch(e.target.value); setRefundPage(0); }} className="pl-9 h-9" />
          </div>
          {(() => {
            const lower = refundSearch.toLowerCase().trim();
            const filtered = lower ? pendingRefunds.filter((e: any) => e.tenants?.full_name?.toLowerCase().includes(lower)) : pendingRefunds;
            const sorted = refundSort.sortData(filtered, (item, key) => {
              if (key === 'tenant') return item.tenants?.full_name;
              if (key === 'exit_date') return item.exit_date;
              if (key === 'advance_held') return item.advance_held;
              if (key === 'total_deductions') return item.total_deductions;
              if (key === 'refund_due') return item.refund_due;
              return item[key];
            });
            const totalCount = sorted.length;
            const totalPages = Math.ceil(totalCount / LIFECYCLE_PAGE_SIZE);
            const paged = sorted.slice(refundPage * LIFECYCLE_PAGE_SIZE, (refundPage + 1) * LIFECYCLE_PAGE_SIZE);
            return (
              <>
                <Card className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <SortableTableHead label="Tenant" sortKey="tenant" sortConfig={refundSort.sortConfig} onSort={refundSort.handleSort} className={thClass} />
                      <SortableTableHead label="Exit Date" sortKey="exit_date" sortConfig={refundSort.sortConfig} onSort={refundSort.handleSort} className={thClass} />
                      <SortableTableHead label="Advance Held" sortKey="advance_held" sortConfig={refundSort.sortConfig} onSort={refundSort.handleSort} className={thClass} />
                      <SortableTableHead label="Deductions" sortKey="total_deductions" sortConfig={refundSort.sortConfig} onSort={refundSort.handleSort} className={thClass} />
                      <SortableTableHead label="Refund Due" sortKey="refund_due" sortConfig={refundSort.sortConfig} onSort={refundSort.handleSort} className={thClass} />
                      <TableHead className={thClass}>Days Since Exit</TableHead>
                      <TableHead className={thClass}>Status</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {paged.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No pending refunds</TableCell></TableRow> :
                        paged.map((e: any) => {
                          const daysSince = differenceInDays(new Date(), parseISO(e.exit_date));
                          const isOverdue = daysSince > (getConfig().refund_deadline_days || 5);
                          return (
                            <TableRow key={e.id} className={isOverdue ? 'bg-destructive/5' : ''}>
                              <TableCell className="font-medium">{e.tenants?.full_name}</TableCell>
                              <TableCell>{fmtDate(e.exit_date)}</TableCell>
                              <TableCell className={amtClass}>₹{fmtAmt(e.advance_held)}</TableCell>
                              <TableCell className={amtClass}>₹{fmtAmt(e.total_deductions)}</TableCell>
                              <TableCell className="text-right font-bold">₹{fmtAmt(e.refund_due)}</TableCell>
                              <TableCell>
                                <span className={isOverdue ? 'text-destructive font-semibold' : ''}>{daysSince} days</span>
                                {isOverdue && <AlertTriangle className="h-3 w-3 inline ml-1 text-destructive" />}
                              </TableCell>
                              <TableCell><StatusBadge status={e.refund_status} type="payment" /></TableCell>
                            </TableRow>
                          );
                        })
                      }
                    </TableBody>
                  </Table>
                </Card>
                <TablePagination page={refundPage} totalPages={totalPages} totalCount={totalCount} pageSize={LIFECYCLE_PAGE_SIZE} setPage={setRefundPage} />
              </>
            );
          })()}
        </TabsContent>

        {/* ═══════════ NOT IN PROPERTY TAB ═══════════ */}
        <TabsContent value="not-in-property" className="space-y-4 mt-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Not in Property (Absence Records)</h2>
            {!isTenantOnly && (
              <Button className="gap-2" onClick={() => {
                setAbsenceEditId(null);
                setAbsenceForm({ allotment_id: '', tenant_id: '', from_date: '', to_date: '', reason: '' });
                setAbsenceOpen(true);
              }}>
                <Plus className="h-4 w-4" /> Add Absence
              </Button>
            )}
            {isTenantOnly && tenantRecord?.id && (
              <Button className="gap-2" onClick={() => {
                const allot = stayingAllotments.find((a: any) => a.tenant_id === tenantRecord.id);
                setAbsenceEditId(null);
                setAbsenceForm({
                  allotment_id: allot?.id || '',
                  tenant_id: tenantRecord.id,
                  from_date: '', to_date: '', reason: '',
                });
                setAbsenceOpen(true);
              }}>
                <Plus className="h-4 w-4" /> Report Absence
              </Button>
            )}
          </div>
          <p className="text-sm text-muted-foreground">Record tenant absences exceeding 30 days to exclude them from electricity billing.</p>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by tenant name..." value={absenceSearch} onChange={(e) => { setAbsenceSearch(e.target.value); setAbsencePage(0); }} className="pl-9 h-9" />
          </div>
          {(() => {
            const lower = absenceSearch.toLowerCase().trim();
            const baseRecords = isTenantOnly && tenantRecord?.id
              ? absenceRecords.filter((r: any) => r.tenant_id === tenantRecord.id)
              : absenceRecords;
            const filtered = lower ? baseRecords.filter((r: any) => r.tenants?.full_name?.toLowerCase().includes(lower)) : baseRecords;
            const sorted = absenceSort.sortData(filtered, (item, key) => {
              if (key === 'tenant') return item.tenants?.full_name;
              if (key === 'from_date') return item.from_date;
              if (key === 'to_date') return item.to_date;
              if (key === 'duration') return item.from_date && item.to_date ? differenceInDays(parseISO(item.to_date), parseISO(item.from_date)) : 0;
              return item[key];
            });
            const totalCount = sorted.length;
            const totalPages = Math.ceil(totalCount / LIFECYCLE_PAGE_SIZE);
            const paged = sorted.slice(absencePage * LIFECYCLE_PAGE_SIZE, (absencePage + 1) * LIFECYCLE_PAGE_SIZE);

            return (
              <>
                <Card className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <SortableTableHead label="Tenant" sortKey="tenant" sortConfig={absenceSort.sortConfig} onSort={absenceSort.handleSort} className={thClass} />
                      <TableHead className={thClass}>Apt / Bed</TableHead>
                      <SortableTableHead label="From Date" sortKey="from_date" sortConfig={absenceSort.sortConfig} onSort={absenceSort.handleSort} className={thClass} />
                      <SortableTableHead label="To Date" sortKey="to_date" sortConfig={absenceSort.sortConfig} onSort={absenceSort.handleSort} className={thClass} />
                      <SortableTableHead label="Duration" sortKey="duration" sortConfig={absenceSort.sortConfig} onSort={absenceSort.handleSort} className={thClass} />
                      <TableHead className={thClass}>Reason</TableHead>
                      {!isTenantOnly && <TableHead className={thClass}>Actions</TableHead>}
                    </TableRow></TableHeader>
                    <TableBody>
                      {paged.length === 0 ? (
                        <TableRow><TableCell colSpan={isTenantOnly ? 6 : 7} className="text-center text-muted-foreground py-8">No absence records found</TableCell></TableRow>
                      ) : paged.map((r: any) => {
                        const allot = allotments.find((a: any) => a.id === r.allotment_id);
                        const duration = r.from_date && r.to_date ? differenceInDays(parseISO(r.to_date), parseISO(r.from_date)) + 1 : 0;
                        return (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium">{r.tenants?.full_name || '—'}</TableCell>
                            <TableCell className="text-center">{allot ? `${allot.apartments?.apartment_code}-${allot.beds?.bed_code}` : '—'}</TableCell>
                            <TableCell className="text-center">{fmtDate(r.from_date)}</TableCell>
                            <TableCell className="text-center">{fmtDate(r.to_date)}</TableCell>
                            <TableCell className="text-center">{duration} days</TableCell>
                            <TableCell className="text-center max-w-[200px] truncate">{r.reason || '—'}</TableCell>
                            {!isTenantOnly && (
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                                    setAbsenceEditId(r.id);
                                    setAbsenceForm({
                                      allotment_id: r.allotment_id || '',
                                      tenant_id: r.tenant_id,
                                      from_date: r.from_date,
                                      to_date: r.to_date,
                                      reason: r.reason || '',
                                    });
                                    setAbsenceOpen(true);
                                  }}>
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => {
                                    if (confirm('Delete this absence record?')) deleteAbsence.mutate(r.id);
                                  }}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Card>
                <TablePagination page={absencePage} totalPages={totalPages} totalCount={totalCount} pageSize={LIFECYCLE_PAGE_SIZE} setPage={setAbsencePage} />
              </>
            );
          })()}
        </TabsContent>

        {/* ═══════════ EXCEL UPLOAD TAB ═══════════ */}
        <TabsContent value="excel-upload" className="space-y-4 mt-4">
          <ExcelUpload
            orgId={orgId!}
            tenants={tenants}
            beds={beds}
            apartments={apartments}
            properties={properties}
            allotments={allotments}
            bedRates={bedRates}
            lifecycleConfig={lifecycleConfig}
            onComplete={() => {
              qc.invalidateQueries({ queryKey: ['tenant_allotments'], refetchType: 'all' });
              qc.invalidateQueries({ queryKey: ['beds'], refetchType: 'all' });
              qc.invalidateQueries({ queryKey: ['lifecycle_receipts'], refetchType: 'all' });
              qc.invalidateQueries({ queryKey: ['tenants'], refetchType: 'all' });
              qc.invalidateQueries({ queryKey: ['tenant_notices'], refetchType: 'all' });
              qc.invalidateQueries({ queryKey: ['tenant_exits'], refetchType: 'all' });
            }}
          />
        </TabsContent>
      </Tabs>

      {/* ═══════════ ABSENCE DRAWER ═══════════ */}
      <DrawerForm open={absenceOpen} onOpenChange={(v) => { setAbsenceOpen(v); if (!v) { setAbsenceEditId(null); setAbsenceForm({ allotment_id: '', tenant_id: '', from_date: '', to_date: '', reason: '' }); } }} title={absenceEditId ? 'Edit Absence Record' : 'Add Absence Record'}>
        {isTenantOnly && tenantRecord ? (
          <div>
            <Label>Tenant</Label>
            <Input value={tenantRecord.full_name || 'You'} disabled className="bg-muted" />
          </div>
        ) : (
          <div>
            <Label>Tenant (Staying) *</Label>
            <Select value={absenceForm.allotment_id} onValueChange={(v) => {
              const allot = [...stayingAllotments, ...onNoticeAllotments].find((a: any) => a.id === v);
              setAbsenceForm({ ...absenceForm, allotment_id: v, tenant_id: allot?.tenant_id || '' });
            }} disabled={!!absenceEditId}>
              <SelectTrigger><SelectValue placeholder="Select tenant" /></SelectTrigger>
              <SelectContent>
                {[...stayingAllotments, ...onNoticeAllotments].sort((x: any, y: any) => (x.tenants?.full_name || '').localeCompare(y.tenants?.full_name || '')).map((a: any) => (
                  <SelectItem key={a.id} value={a.id}>{a.tenants?.full_name} — {a.apartments?.apartment_code}-{a.beds?.bed_code}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <DatePickerField label="From Date *" value={absenceForm.from_date} onChange={(v) => setAbsenceForm({ ...absenceForm, from_date: v })} />
        <DatePickerField label="To Date *" value={absenceForm.to_date} onChange={(v) => setAbsenceForm({ ...absenceForm, to_date: v })} fromDate={absenceForm.from_date ? format(addDays(parseISO(absenceForm.from_date), 30), 'yyyy-MM-dd') : undefined} />
        {absenceForm.from_date && absenceForm.to_date && (() => {
          const days = differenceInDays(parseISO(absenceForm.to_date), parseISO(absenceForm.from_date)) + 1;
          const isValid = days >= 30;
          return (
            <p className={`text-sm ${isValid ? 'text-muted-foreground' : 'text-destructive'}`}>
              Duration: {days} days {!isValid && '(minimum 30 days required)'}
            </p>
          );
        })()}
        <div>
          <Label>Reason (optional)</Label>
          <Textarea value={absenceForm.reason} onChange={(e) => setAbsenceForm({ ...absenceForm, reason: e.target.value })} placeholder="e.g. Hometown visit, vacation..." rows={3} />
        </div>
        <Button
          className="w-full mt-4"
          disabled={
            !absenceForm.tenant_id || !absenceForm.from_date || !absenceForm.to_date ||
            (absenceForm.from_date && absenceForm.to_date && differenceInDays(parseISO(absenceForm.to_date), parseISO(absenceForm.from_date)) < 29) ||
            createAbsence.isPending || updateAbsence.isPending
          }
          onClick={() => absenceEditId ? updateAbsence.mutate() : createAbsence.mutate()}
        >
          {(createAbsence.isPending || updateAbsence.isPending) ? 'Saving...' : absenceEditId ? 'Update Record' : 'Add Record'}
        </Button>
      </DrawerForm>

      {/* ═══════════ BOOKING DRAWER ═══════════ */}
      <DrawerForm open={bookingOpen} onOpenChange={setBookingOpen} title="New Booking">
        <div>
          <Label>Tenant *</Label>
          <Select value={bookingForm.tenant_id} onValueChange={(v) => setBookingForm({ ...bookingForm, tenant_id: v, bed_id: '' })}>
            <SelectTrigger><SelectValue placeholder="Select tenant" /></SelectTrigger>
            <SelectContent>
              {eligibleTenants.filter((t: any) => !(t as any).staying_status || (t as any).staying_status === 'new').map((t: any) => (
                <SelectItem key={t.id} value={t.id}>{t.full_name} — {t.phone}</SelectItem>
              ))}
              {returningTenants.length > 0 && (
                <>
                  <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground border-t mt-1 pt-2">↩ Returning Tenants</div>
                  {returningTenants.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>↩ {t.full_name} — {t.phone}</SelectItem>
                  ))}
                </>
              )}
            </SelectContent>
          </Select>
        </div>
        <DatePickerField label="Probable Onboarding Date *" value={bookingForm.probable_onboarding_date} onChange={(v) => setBookingForm({ ...bookingForm, probable_onboarding_date: v, bed_id: '' })} />
        {bookingForm.probable_onboarding_date ? (
          <div>
            <Label>Bed * (Available on {format(parseISO(bookingForm.probable_onboarding_date), 'dd-MMM-yyyy')})</Label>
            <Select value={bookingForm.bed_id} onValueChange={(v) => {
              const bed = beds.find((b: any) => b.id === v);
              const apt = bed ? apartments.find((a: any) => a.id === bed.apartment_id) : null;
              setBookingForm({
                ...bookingForm,
                bed_id: v,
                apartment_id: apt?.id || '',
                property_id: apt?.property_id || bookingForm.property_id,
              });
            }}>
              <SelectTrigger><SelectValue placeholder="Select bed" /></SelectTrigger>
              <SelectContent>
                {bookingBeds.length === 0 ? <div className="p-3 text-sm text-muted-foreground text-center">No available beds{bookingForm.tenant_id ? '' : ' — select a tenant first'}</div> :
                  bookingBeds.map((b: any) => {
                    const apt = apartments.find((a: any) => a.id === b.apartment_id);
                    const bedTypeShort = ({'Single':'S','Double':'D','Triple':'T','Executive':'E','Quad':'Q'} as any)[b.bed_type] || b.bed_type?.charAt(0) || '?';
                    const toiletShort = b.toilet_type?.toLowerCase() === 'attached' ? 'AW' : 'CW';
                    const activeAllot = allotments.find((a: any) => a.bed_id === b.id && a.staying_status === 'On-Notice');
                    const statusLabel = activeAllot ? 'notice' : 'vacant';
                    return (
                      <SelectItem key={b.id} value={b.id}>
                        {apt?.apartment_code || '?'}-{b.bed_code} ({bedTypeShort}-{toiletShort}) — {statusLabel}
                      </SelectItem>
                    );
                  })
                }
              </SelectContent>
            </Select>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Select an onboarding date first to see available beds</p>
        )}
        {bookingForm.bed_id && (
          <Card className="bg-muted/30">
            <CardContent className="p-3 text-sm">
              <div className="flex justify-between"><span>Bed Rate</span><span className="font-semibold">₹{fmtAmt(getBedRate(bookingForm.bed_id))}/mo</span></div>
            </CardContent>
          </Card>
        )}
        <div>
          <Label>Monthly Discount (₹)</Label>
          <Input type="number" min="0" value={bookingForm.discount} onChange={(e) => setBookingForm({ ...bookingForm, discount: e.target.value })} placeholder="0" />
        </div>
        <div>
          <Label>Monthly Premium (₹)</Label>
          <Input type="number" min="0" value={bookingForm.premium} onChange={(e) => setBookingForm({ ...bookingForm, premium: e.target.value })} placeholder="0" />
        </div>
        {bookingForm.bed_id && (parseFloat(bookingForm.discount) > 0 || parseFloat(bookingForm.premium) > 0) && (
          <p className="text-xs text-muted-foreground">Effective Rent: ₹{fmtAmt(getBedRate(bookingForm.bed_id) - (parseFloat(bookingForm.discount) || 0) + (parseFloat(bookingForm.premium) || 0))}/mo</p>
        )}
        <div className="border-t pt-3 mt-2">
          <p className="text-sm font-semibold mb-2">Payment Details</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Amount</Label>
              <Input type="number" value={bookingForm.amount} onChange={(e) => setBookingForm({ ...bookingForm, amount: e.target.value })} />
            </div>
            <div>
              <Label>Mode *</Label>
              <Select value={bookingForm.payment_mode} onValueChange={(v) => setBookingForm({ ...bookingForm, payment_mode: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="rtgs">RTGS</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="credit_card">Credit Card</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-2">
            <Label>Transaction Reference</Label>
            <Input value={bookingForm.reference_number} onChange={(e) => setBookingForm({ ...bookingForm, reference_number: e.target.value })} />
          </div>
        </div>
        <Button className="w-full mt-4" disabled={!bookingForm.tenant_id || !bookingForm.bed_id || !bookingForm.payment_mode || !bookingForm.probable_onboarding_date || createBooking.isPending} onClick={() => createBooking.mutate()}>
          {createBooking.isPending ? 'Processing...' : 'Confirm Booking'}
        </Button>
      </DrawerForm>

      {/* ═══════════ ONBOARDING DRAWER ═══════════ */}
      <DrawerForm open={onboardOpen} onOpenChange={setOnboardOpen} title="Onboard Tenant">
        <div>
          <Label>Tenant</Label>
          <Select value={onboardForm.allotment_id} onValueChange={(v) => {
            const allot = bookedAllotments.find((a: any) => a.id === v);
            setOnboardForm({ ...onboardForm, allotment_id: v, bed_id: allot?.bed_id || '', kyc_front_url: '', kyc_back_url: '', paid_amount: '' });
          }}>
            <SelectTrigger><SelectValue placeholder="Select booked tenant" /></SelectTrigger>
            <SelectContent>
              {bookedAllotments.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.tenants?.full_name} — {a.apartments?.apartment_code}-{a.beds?.bed_code}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <DatePickerField label="Actual Onboarding Date *" value={onboardForm.actual_onboarding_date} onChange={(v) => setOnboardForm({ ...onboardForm, actual_onboarding_date: v, paid_amount: '' })} />
        <div>
          <Label>Bed (editable, Vacant only)</Label>
          <Select value={onboardForm.bed_id} onValueChange={(v) => setOnboardForm({ ...onboardForm, bed_id: v, paid_amount: '' })}>
            <SelectTrigger><SelectValue placeholder="Select bed" /></SelectTrigger>
            <SelectContent>
              {onboardBeds.map((b: any) => {
                const apt = apartments.find((a: any) => a.id === b.apartment_id);
                const gLabel = (apt?.gender_allowed || 'Both').charAt(0).toUpperCase() + (apt?.gender_allowed || 'Both').slice(1).toLowerCase();
                return <SelectItem key={b.id} value={b.id}>{apt?.apartment_code || '?'}-{gLabel}-{b.bed_code} ({b.bed_type})</SelectItem>;
              })}
            </SelectContent>
          </Select>
        </div>

        {/* Cost breakdown */}
        {onboardForm.allotment_id && onboardForm.actual_onboarding_date && (() => {
          const costs = calcOnboardingCosts(onboardForm.allotment_id);
          if (!costs) return null;
          const ccSurcharge = onboardForm.payment_mode === 'credit_card' ? Math.ceil(costs.balance * 0.015) : 0;
          const finalBalance = costs.balance + ccSurcharge;
          // Auto-fill paid_amount when balance changes
          if (onboardForm.paid_amount === '' || onboardForm.paid_amount === undefined) {
            setTimeout(() => setOnboardForm((prev: any) => ({ ...prev, paid_amount: String(Math.max(0, finalBalance)) })), 0);
          }
          return (
             <Card className="bg-muted/30">
              <CardContent className="p-4 space-y-1 text-sm">
                <div className="flex justify-between"><span>Bed Rate</span><span>₹{fmtAmt(costs.monthlyRent)}/-</span></div>
                {costs.discount > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>-₹{fmtAmt(costs.discount)}</span></div>}
                <div className="flex justify-between"><span>Effective Rent</span><span className="font-semibold">₹{fmtAmt(costs.effectiveRent)}/-</span></div>
                <div className="flex justify-between"><span>Onboarding Charges</span><span>₹{fmtAmt(costs.onboardingCharges)}</span></div>
                <div className="flex justify-between"><span>Advance (1.5 Months)</span><span>₹{fmtAmt(costs.advance)}</span></div>
                <div className="flex justify-between"><span>Pro-Rated Rental ({costs.remainingDays} Days)</span><span>₹{fmtAmt(costs.proratedRent)}</span></div>
                <div className="flex items-center justify-between border-t pt-1 mt-1">
                  <Label htmlFor="expected_stay_days" className="text-sm">Expected Stay (Days)</Label>
                  <Input
                    id="expected_stay_days"
                    type="number"
                    placeholder="e.g. 180"
                    className="w-24 h-7 text-sm text-right"
                    value={onboardForm.expected_stay_days}
                    onChange={(e) => setOnboardForm({ ...onboardForm, expected_stay_days: e.target.value })}
                  />
                </div>
                <div className="flex justify-between font-bold border-t pt-1 mt-1"><span>Total Due</span><span>₹{fmtAmt(costs.totalDue)}</span></div>
                <div className="flex justify-between text-green-600"><span>Already Paid</span><span>-₹{fmtAmt(costs.alreadyPaid)}</span></div>
                {ccSurcharge > 0 && (
                  <div className="flex justify-between text-orange-600"><span>CC Processing Fee (1.5%)</span><span>+₹{fmtAmt(ccSurcharge)}</span></div>
                )}
                <div className="flex justify-between font-bold text-destructive"><span>Balance Due</span><span>₹{fmtAmt(finalBalance)}</span></div>
              </CardContent>
            </Card>
          );
        })()}

        {/* Offline KYC Image Capture */}
        <div className="border-t pt-3">
          <p className="text-sm font-semibold mb-2">Offline KYC Document</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>KYC Front *</Label>
              {onboardForm.kyc_front_url ? (
                <div className="relative border rounded-lg p-2 bg-muted/30">
                  <img src={onboardForm.kyc_front_url} alt="KYC Front" className="w-full max-h-24 object-contain rounded" />
                  <Button variant="destructive" size="icon" className="absolute top-0 right-0 h-5 w-5" onClick={() => setOnboardForm({ ...onboardForm, kyc_front_url: '' })}>
                    <XCircle className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div
                  onClick={() => kycFrontRef.current?.click()}
                  className="border-2 border-dashed rounded-lg p-3 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
                >
                  <Camera className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                  <p className="text-[10px] text-muted-foreground">Capture / Upload Front</p>
                </div>
              )}
              <input ref={kycFrontRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleKycUpload(file, 'front');
                e.target.value = '';
              }} />
            </div>
            <div className="space-y-1">
              <Label>KYC Back *</Label>
              {onboardForm.kyc_back_url ? (
                <div className="relative border rounded-lg p-2 bg-muted/30">
                  <img src={onboardForm.kyc_back_url} alt="KYC Back" className="w-full max-h-24 object-contain rounded" />
                  <Button variant="destructive" size="icon" className="absolute top-0 right-0 h-5 w-5" onClick={() => setOnboardForm({ ...onboardForm, kyc_back_url: '' })}>
                    <XCircle className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div
                  onClick={() => kycBackRef.current?.click()}
                  className="border-2 border-dashed rounded-lg p-3 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
                >
                  <Camera className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                  <p className="text-[10px] text-muted-foreground">Capture / Upload Back</p>
                </div>
              )}
              <input ref={kycBackRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleKycUpload(file, 'back');
                e.target.value = '';
              }} />
            </div>
          </div>
        </div>

        <div className="border-t pt-3">
          <p className="text-sm font-semibold mb-2">Payment</p>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Amount Paying Now</Label><Input type="number" value={onboardForm.paid_amount} onChange={(e) => setOnboardForm({ ...onboardForm, paid_amount: e.target.value })} /></div>
            <div>
              <Label>Mode</Label>
              <Select value={onboardForm.payment_mode} onValueChange={(v) => {
                setOnboardForm({ ...onboardForm, payment_mode: v, paid_amount: '' });
              }}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="rtgs">RTGS</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="credit_card">Credit Card</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-2"><Label>Reference *</Label><Input value={onboardForm.reference_number} onChange={(e) => setOnboardForm({ ...onboardForm, reference_number: e.target.value })} /></div>
        </div>
        <Button
          className="w-full mt-4"
          disabled={
            !onboardForm.allotment_id ||
            !onboardForm.actual_onboarding_date ||
            !onboardForm.kyc_front_url ||
            !onboardForm.kyc_back_url ||
            !onboardForm.reference_number?.trim() ||
            processOnboarding.isPending
          }
          onClick={() => processOnboarding.mutate()}
        >
          {processOnboarding.isPending ? 'Processing...' : 'Complete Onboarding'}
        </Button>
      </DrawerForm>

      {/* ═══════════ SWITCH DRAWER ═══════════ */}
      <DrawerForm open={switchOpen} onOpenChange={setSwitchOpen} title="Room Switch">
        <div>
          <Label>Tenant (Staying) *</Label>
          <Select value={switchForm.allotment_id} onValueChange={(v) => {
            const allot = stayingAllotments.find((a: any) => a.id === v);
            setSwitchForm({ ...switchForm, allotment_id: v, tenant_id: allot?.tenant_id || '', old_bed_id: allot?.bed_id || '' });
          }}>
            <SelectTrigger><SelectValue placeholder="Select tenant" /></SelectTrigger>
            <SelectContent>
              {stayingAllotments.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.tenants?.full_name} — {a.apartments?.apartment_code}-{a.beds?.bed_code}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Switch Type</Label>
          <Select value={switchForm.switch_type} onValueChange={(v) => setSwitchForm({ ...switchForm, switch_type: v, new_bed_id: '' })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="immediate">Immediate</SelectItem>
              <SelectItem value="future">Future</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DatePickerField label="Switch Date" value={switchForm.switch_date} onChange={(v) => setSwitchForm({ ...switchForm, switch_date: v })} />
        {switchForm.switch_type === 'future' && (
          <DatePickerField label="Effective Date" value={switchForm.effective_date} onChange={(v) => setSwitchForm({ ...switchForm, effective_date: v })} />
        )}
        <div>
          <Label>New Bed *</Label>
          <Select value={switchForm.new_bed_id} onValueChange={(v) => setSwitchForm({ ...switchForm, new_bed_id: v })}>
            <SelectTrigger><SelectValue placeholder="Select new bed" /></SelectTrigger>
            <SelectContent>
              {switchBeds.map((b: any) => {
                const apt = apartments.find((a: any) => a.id === b.apartment_id);
                return <SelectItem key={b.id} value={b.id}>{apt?.apartment_code || '?'}-{b.bed_code} ({b.bed_type}) — ₹{fmtAmt(getBedRate(b.id))}/mo</SelectItem>;
              })}
            </SelectContent>
          </Select>
        </div>
        {switchForm.old_bed_id && switchForm.new_bed_id && (() => {
          const oldRate = getBedRate(switchForm.old_bed_id);
          const newRate = getBedRate(switchForm.new_bed_id);
          const diff = newRate - oldRate;
          return (
            <Card className="bg-muted/30">
              <CardContent className="p-3 text-sm space-y-1">
                <div className="flex justify-between"><span>Current Rent</span><span>₹{fmtAmt(oldRate)}</span></div>
                <div className="flex justify-between"><span>New Rent</span><span>₹{fmtAmt(newRate)}</span></div>
                <div className={`flex justify-between font-bold ${diff > 0 ? 'text-destructive' : diff < 0 ? 'text-green-600' : ''}`}>
                  <span>Difference</span><span>{diff > 0 ? '+' : ''}₹{fmtAmt(diff)}</span>
                </div>
                {diff > 0 && <p className="text-[10px] text-destructive">Tenant pays the difference</p>}
                {diff < 0 && <p className="text-[10px] text-green-600">Credit to tenant</p>}
              </CardContent>
            </Card>
          );
        })()}
        <Textarea placeholder="Notes" value={switchForm.notes} onChange={(e) => setSwitchForm({ ...switchForm, notes: e.target.value })} rows={2} />
        <Button className="w-full mt-4" disabled={!switchForm.allotment_id || !switchForm.new_bed_id || processSwitch.isPending} onClick={() => processSwitch.mutate()}>
          {processSwitch.isPending ? 'Processing...' : 'Process Switch'}
        </Button>
      </DrawerForm>

      {/* ═══════════ NOTICE DRAWER ═══════════ */}
      <DrawerForm open={noticeOpen} onOpenChange={setNoticeOpen} title="Record Notice">
        <div>
          <Label>Tenant (Staying) *</Label>
          {isTenantOnly && tenantRecord ? (
            <>
              <Input value={tenantRecord.full_name || 'You'} disabled className="bg-muted" />
              {noticeForm.allotment_id && (() => {
                const allot = stayingAllotments.find((a: any) => a.id === noticeForm.allotment_id);
                return allot ? <p className="text-xs text-muted-foreground mt-1">{allot.apartments?.apartment_code}-{allot.beds?.bed_code}</p> : null;
              })()}
            </>
          ) : (
            <Select value={noticeForm.allotment_id} onValueChange={(v) => {
              const allot = stayingAllotments.find((a: any) => a.id === v);
              setNoticeForm({ ...noticeForm, allotment_id: v, tenant_id: allot?.tenant_id || '', bed_id: allot?.bed_id || '' });
            }}>
              <SelectTrigger><SelectValue placeholder="Select tenant" /></SelectTrigger>
              <SelectContent>
                {[...stayingAllotments].sort((x: any, y: any) => (x.tenants?.full_name || '').localeCompare(y.tenants?.full_name || '')).map((a: any) => <SelectItem key={a.id} value={a.id}>{a.tenants?.full_name} — {a.apartments?.apartment_code}-{a.beds?.bed_code}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
        <DatePickerField label="Estimated Exit Date *" value={noticeForm.notice_date} onChange={(v) => setNoticeForm({ ...noticeForm, notice_date: v })} fromDate={isTenantOnly ? format(addDays(new Date(), 30), 'yyyy-MM-dd') : undefined} />
        {noticeForm.notice_date && (
          <Card className="bg-muted/30">
            <CardContent className="p-3 text-sm">
              <p>Estimated Exit Date: <strong>{format(parseISO(noticeForm.notice_date), 'dd-MMM-yyyy')}</strong></p>
            </CardContent>
          </Card>
        )}
        <Textarea placeholder="Notes" value={noticeForm.notes} onChange={(e) => setNoticeForm({ ...noticeForm, notes: e.target.value })} rows={2} />
        <Button className="w-full mt-4" disabled={!noticeForm.allotment_id || !noticeForm.notice_date || createNotice.isPending} onClick={() => createNotice.mutate()}>
          {createNotice.isPending ? 'Processing...' : 'Submit Notice'}
        </Button>
      </DrawerForm>

      {/* ═══════════ EXIT DRAWER ═══════════ */}
      <DrawerForm open={exitOpen} onOpenChange={setExitOpen} title="Process Exit">
        <div>
          <Label>Tenant *</Label>
          <Select value={exitForm.allotment_id} onValueChange={(v) => {
            const allot = [...stayingAllotments, ...onNoticeAllotments].find((a: any) => a.id === v);
            const hasNotice = allot?.staying_status === 'On-Notice';
            setExitForm({ ...exitForm, allotment_id: v, tenant_id: allot?.tenant_id || '', bed_id: allot?.bed_id || '', has_notice: hasNotice, inspect_furniture: false, inspect_bed: false, inspect_walls: false, inspect_bathroom: false, room_inspection: false });
          }}>
            <SelectTrigger><SelectValue placeholder="Select tenant" /></SelectTrigger>
            <SelectContent>
              {[...stayingAllotments, ...onNoticeAllotments].map((a: any) => (
                <SelectItem key={a.id} value={a.id}>{a.tenants?.full_name} — {a.apartments?.apartment_code}-{a.beds?.bed_code} ({a.staying_status})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {!exitForm.has_notice && exitForm.allotment_id && (
          <Card className="border-destructive bg-destructive/5 p-3">
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-semibold">Exit without notice!</span>
            </div>
          </Card>
        )}
        <DatePickerField label="Exit Date *" value={exitForm.exit_date} onChange={(v) => setExitForm({ ...exitForm, exit_date: v })} />

        {/* Room Inspection Checklist */}
        <p className="text-sm font-semibold mt-2">Room Inspection</p>
        <div className="space-y-2 border rounded-lg p-3 bg-muted/20">
          <div className="flex items-center gap-2">
            <Checkbox id="inspect_furniture" checked={exitForm.inspect_furniture} onCheckedChange={(v) => {
              const updated = { ...exitForm, inspect_furniture: !!v };
              updated.room_inspection = updated.inspect_furniture && updated.inspect_bed && updated.inspect_walls && updated.inspect_bathroom;
              setExitForm(updated);
            }} />
            <label htmlFor="inspect_furniture" className="text-sm">All furnitures are OK</label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="inspect_bed" checked={exitForm.inspect_bed} onCheckedChange={(v) => {
              const updated = { ...exitForm, inspect_bed: !!v };
              updated.room_inspection = updated.inspect_furniture && updated.inspect_bed && updated.inspect_walls && updated.inspect_bathroom;
              setExitForm(updated);
            }} />
            <label htmlFor="inspect_bed" className="text-sm">Bed not damaged</label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="inspect_walls" checked={exitForm.inspect_walls} onCheckedChange={(v) => {
              const updated = { ...exitForm, inspect_walls: !!v };
              updated.room_inspection = updated.inspect_furniture && updated.inspect_bed && updated.inspect_walls && updated.inspect_bathroom;
              setExitForm(updated);
            }} />
            <label htmlFor="inspect_walls" className="text-sm">Walls not damaged</label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="inspect_bathroom" checked={exitForm.inspect_bathroom} onCheckedChange={(v) => {
              const updated = { ...exitForm, inspect_bathroom: !!v };
              updated.room_inspection = updated.inspect_furniture && updated.inspect_bed && updated.inspect_walls && updated.inspect_bathroom;
              setExitForm(updated);
            }} />
            <label htmlFor="inspect_bathroom" className="text-sm">Bathroom not damaged</label>
          </div>
          <div className="flex items-center gap-2 pt-1 border-t">
            <Checkbox id="room_inspection_done" checked={exitForm.room_inspection} disabled />
            <label htmlFor="room_inspection_done" className={`text-sm font-semibold ${exitForm.room_inspection ? 'text-green-600' : 'text-muted-foreground'}`}>
              {exitForm.room_inspection ? '✓ Room Inspection Done' : 'Complete all checks above'}
            </label>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox id="key_returned" checked={exitForm.key_returned} onCheckedChange={(v) => setExitForm({ ...exitForm, key_returned: !!v })} />
            <label htmlFor="key_returned" className="text-sm">Key Returned</label>
          </div>
        </div>
        <div>
          <Label>Damage Charges</Label>
          <Input type="number" value={exitForm.damage_charges} onChange={(e) => setExitForm({ ...exitForm, damage_charges: e.target.value })} />
        </div>

        {/* Settlement Preview */}
        {exitForm.allotment_id && exitForm.exit_date && (() => {
          const allot = [...stayingAllotments, ...onNoticeAllotments].find((a: any) => a.id === exitForm.allotment_id);
          if (!allot) return null;
          const config = getConfig();
          const onboardDate = allot.onboarding_date ? parseISO(allot.onboarding_date) : new Date();
          const exitDate = parseISO(exitForm.exit_date);
          const stayDays = differenceInDays(exitDate, onboardDate);
          const stayUnder1Yr = stayDays < 365;
          const damageCharges = parseFloat(exitForm.damage_charges) || 0;
          const keyLoss = exitForm.key_returned ? 0 : (config.key_loss_fee || 500);
          const exitCharges = stayUnder1Yr ? (config.exit_fee_under_1yr || 2250) : 0;
          const pendingRent = allot.balance_due || 0;

          // Estimated EB: use previous month's per-day EB rate × days in current exit month
          let estimatedEB = 0;
          // Look for EB tenant shares from previous invoices for this tenant
          const aptId = allot.apartment_id;
          // Compute days in exit month the tenant stayed
          const exitMonthStart = new Date(exitDate.getFullYear(), exitDate.getMonth(), 1);
          const daysInExitMonth = exitDate.getDate(); // days from 1st to exit date

          // Find the latest eb_tenant_shares for this apartment to get per_day_rate
          // We'll use electricity readings + allotments to estimate
          // Simple approach: find last month's reading for this apartment
          const prevMonth = new Date(exitDate.getFullYear(), exitDate.getMonth() - 1, 1);
          const prevMonthStr1 = format(prevMonth, 'MMM-yy');
          const prevMonthStr2 = format(prevMonth, 'yyyy-MM');

          // Look at electricity readings for previous month
          const reading = electricityReadings.find((r: any) => r.apartment_id === aptId && (r.billing_month === prevMonthStr1 || r.billing_month === prevMonthStr2));
          // Calculate based on available data
          let perDayRate = 0;
          let totalTenantDays = 0;
          if (reading) {
            const totalUnits = Number(reading.reading_end) - Number(reading.reading_start);
            const unitCost = Number(reading.unit_cost);
            const totalBill = totalUnits * unitCost;
            totalTenantDays = getTotalTenantDaysInMonth(aptId, prevMonth);
            perDayRate = totalBill / totalTenantDays;
            estimatedEB = Math.ceil(perDayRate * daysInExitMonth);
          }

          // Early exit alert: < 60 days unless expected_stay_days < 60
          const showEarlyExitAlert = stayDays < 60 && (allot.expected_stay_days == null || allot.expected_stay_days >= 60);

          const totalDeductions = damageCharges + keyLoss + exitCharges + pendingRent + estimatedEB;
          const advanceHeld = allot.deposit_paid || 0;
          const refundDue = advanceHeld - totalDeductions;

          return (
            <>
            {showEarlyExitAlert && (
              <div className="rounded-lg border border-orange-300 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-700 p-3 flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-semibold text-orange-800 dark:text-orange-300">Early Exit Warning</p>
                  <p className="text-orange-700 dark:text-orange-400">This tenant has stayed only {stayDays} days, which is less than the minimum 60-day period.</p>
                </div>
              </div>
            )}
            <Card className="bg-muted/30">
              <CardHeader className="p-3 pb-1"><CardTitle className="text-sm">Settlement Preview</CardTitle></CardHeader>
              <CardContent className="p-3 pt-0 text-sm space-y-1">
                <div className="flex justify-between text-muted-foreground"><span>Stay Duration</span><span>{stayDays} days {stayUnder1Yr && '(< 1yr)'}</span></div>
                <div className="flex justify-between"><span>(a) Pending Rent/Dues</span><span>₹{fmtAmt(pendingRent)}</span></div>
                <div className="flex justify-between"><span>(b) Estimated EB ({daysInExitMonth} days × ₹{perDayRate.toFixed(2)}/day)</span><span>₹{fmtAmt(estimatedEB)}</span></div>
                <div className="flex justify-between"><span>(c) Damages</span><span>₹{fmtAmt(damageCharges)}</span></div>
                {!exitForm.key_returned && <div className="flex justify-between"><span>Key Loss</span><span>₹{fmtAmt(keyLoss)}</span></div>}
                {stayUnder1Yr && <div className="flex justify-between"><span>(d) Exit Charges (&lt;1yr)</span><span>₹{fmtAmt(exitCharges)}</span></div>}
                <div className="flex justify-between font-semibold border-t pt-1"><span>Total Deductions</span><span>₹{fmtAmt(totalDeductions)}</span></div>
                <div className="flex justify-between text-green-600"><span>Less: Advance Held</span><span>₹{fmtAmt(advanceHeld)}</span></div>
                <div className={`flex justify-between font-bold text-lg border-t pt-1 ${refundDue > 0 ? 'text-green-600' : 'text-destructive'}`}>
                  <span>{refundDue > 0 ? 'Refund Due' : 'Amount Owed'}</span>
                  <span>₹{fmtAmt(Math.abs(refundDue))}</span>
                </div>
              </CardContent>
            </Card>
            </>
          );
        })()}

        <Textarea placeholder="Notes" value={exitForm.notes} onChange={(e) => setExitForm({ ...exitForm, notes: e.target.value })} rows={2} />
        <Button className="w-full mt-4" variant="destructive" disabled={!exitForm.allotment_id || !exitForm.exit_date || !exitForm.room_inspection || processExit.isPending} onClick={() => processExit.mutate()}>
          {processExit.isPending ? 'Processing...' : 'Process Exit & Generate Settlement'}
        </Button>
        {!exitForm.room_inspection && exitForm.allotment_id && (
          <p className="text-xs text-destructive text-center">Complete room inspection to enable exit processing</p>
        )}
      </DrawerForm>

      {/* ═══════════ CANCEL BOOKING DRAWER ═══════════ */}
      <DrawerForm open={cancelOpen} onOpenChange={setCancelOpen} title="Cancel Booking">
        {(() => {
          const allot = allotments.find((a: any) => a.id === cancelForm.allotment_id);
          if (!allot) return <p className="text-sm text-muted-foreground">No booking selected</p>;
          return (
            <Card className="bg-muted/30">
              <CardContent className="p-4 text-sm space-y-1">
                <div className="flex justify-between"><span>Tenant</span><span className="font-medium">{allot.tenants?.full_name}</span></div>
                <div className="flex justify-between"><span>Property</span><span>{allot.properties?.property_name}</span></div>
                <div className="flex justify-between"><span>Bed</span><span>{allot.apartments?.apartment_code}-{allot.beds?.bed_code}</span></div>
                <div className="flex justify-between"><span>Booking Date</span><span>{fmtDate(allot.booking_date)}</span></div>
              </CardContent>
            </Card>
          );
        })()}
        <div>
          <Label>Reason for Cancellation *</Label>
          <Textarea placeholder="Enter reason..." value={cancelForm.reason} onChange={(e) => setCancelForm({ ...cancelForm, reason: e.target.value })} rows={3} />
        </div>
        <Button className="w-full mt-4" variant="destructive" disabled={!cancelForm.allotment_id || !cancelForm.reason.trim() || cancelBooking.isPending} onClick={() => cancelBooking.mutate()}>
          {cancelBooking.isPending ? 'Processing...' : 'Confirm Cancellation'}
        </Button>
      </DrawerForm>

      {/* ═══════════ EDIT NOTICE DRAWER ═══════════ */}
      <DrawerForm open={editNoticeOpen} onOpenChange={setEditNoticeOpen} title="Edit Notice">
        <DatePickerField label="Notice Date *" value={editNoticeForm.notice_date} onChange={(v) => {
          const config = getConfig();
          const newExit = v ? format(addDays(parseISO(v), config.notice_period_days || 30), 'yyyy-MM-dd') : editNoticeForm.exit_date;
          setEditNoticeForm({ ...editNoticeForm, notice_date: v, exit_date: newExit });
        }} />
        <DatePickerField label="Exit Date" value={editNoticeForm.exit_date} onChange={(v) => setEditNoticeForm({ ...editNoticeForm, exit_date: v })} />
        <Textarea placeholder="Notes" value={editNoticeForm.notes} onChange={(e) => setEditNoticeForm({ ...editNoticeForm, notes: e.target.value })} rows={2} />
        <Button className="w-full mt-4" disabled={!editNoticeForm.notice_date || updateNotice.isPending} onClick={() => updateNotice.mutate()}>
          {updateNotice.isPending ? 'Updating...' : 'Update Notice'}
        </Button>
      </DrawerForm>

      {/* ═══════════ ADD PAYMENT DRAWER ═══════════ */}
      <DrawerForm open={addPaymentOpen} onOpenChange={setAddPaymentOpen} title="Add Payment">
        {(() => {
          const allot = allotments.find((a: any) => a.id === addPaymentForm.allotment_id);
          if (!allot) return null;
          return (
            <Card className="bg-muted/30">
              <CardContent className="p-4 text-sm space-y-1">
                <div className="flex justify-between"><span>Tenant</span><span className="font-medium">{allot.tenants?.full_name}</span></div>
                <div className="flex justify-between"><span>Total Due</span><span>₹{fmtAmt(allot.total_due)}</span></div>
                <div className="flex justify-between"><span>Already Paid</span><span>₹{fmtAmt(allot.paid_amount)}</span></div>
                <div className="flex justify-between font-bold text-destructive"><span>Balance Due</span><span>₹{fmtAmt(allot.balance_due)}</span></div>
              </CardContent>
            </Card>
          );
        })()}
        <div>
          <Label>Amount *</Label>
          <Input type="number" value={addPaymentForm.amount} onChange={(e) => setAddPaymentForm({ ...addPaymentForm, amount: e.target.value })} />
        </div>
        <div>
          <Label>Mode *</Label>
          <Select value={addPaymentForm.payment_mode} onValueChange={(v) => setAddPaymentForm({ ...addPaymentForm, payment_mode: v })}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="upi">UPI</SelectItem>
              <SelectItem value="rtgs">RTGS</SelectItem>
              <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
              <SelectItem value="credit_card">Credit Card</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Reference</Label>
          <Input value={addPaymentForm.reference_number} onChange={(e) => setAddPaymentForm({ ...addPaymentForm, reference_number: e.target.value })} />
        </div>
        <Button className="w-full mt-4" disabled={!addPaymentForm.amount || !addPaymentForm.payment_mode || addPayment.isPending} onClick={() => addPayment.mutate()}>
          {addPayment.isPending ? 'Processing...' : 'Record Payment'}
        </Button>
      </DrawerForm>

      {/* ═══════════ EDIT OCCUPIED DRAWER ═══════════ */}
      <DrawerForm open={editOccupiedOpen} onOpenChange={setEditOccupiedOpen} title="Edit Occupied Tenant">
        {(() => {
          const allot = allotments.find((a: any) => a.id === editOccupiedForm.allotment_id);
          if (!allot) return <p className="text-sm text-muted-foreground">No allotment selected</p>;
          return (
            <Card className="bg-muted/30">
              <CardContent className="p-4 text-sm space-y-1">
                <div className="flex justify-between"><span>Tenant</span><span className="font-medium">{allot.tenants?.full_name}</span></div>
                <div className="flex justify-between"><span>Bed</span><span>{allot.apartments?.apartment_code}-{allot.beds?.bed_code}</span></div>
                <div className="flex justify-between"><span>Bed Rate</span><span>₹{fmtAmt(getBedRate(allot.bed_id))}/mo</span></div>
              </CardContent>
            </Card>
          );
        })()}
        <DatePickerField label="Onboarding Date" value={editOccupiedForm.onboarding_date} onChange={(v) => setEditOccupiedForm({ ...editOccupiedForm, onboarding_date: v })} />
        <div>
          <Label>Monthly Discount (₹)</Label>
          <Input type="number" min="0" value={editOccupiedForm.discount} onChange={(e) => setEditOccupiedForm({ ...editOccupiedForm, discount: e.target.value })} />
        </div>
        <div>
          <Label>Monthly Premium (₹)</Label>
          <Input type="number" min="0" value={editOccupiedForm.premium} onChange={(e) => setEditOccupiedForm({ ...editOccupiedForm, premium: e.target.value })} />
        </div>
        <div>
          <Label>Security Deposit (₹)</Label>
          <Input type="number" min="0" value={editOccupiedForm.deposit_paid} onChange={(e) => setEditOccupiedForm({ ...editOccupiedForm, deposit_paid: e.target.value })} />
        </div>
        {editOccupiedForm.allotment_id && (() => {
          const allot = allotments.find((a: any) => a.id === editOccupiedForm.allotment_id);
          if (!allot) return null;
          const rate = getBedRate(allot.bed_id);
          const disc = parseFloat(editOccupiedForm.discount) || 0;
          const prem = parseFloat(editOccupiedForm.premium) || 0;
          const effective = Math.max(0, rate - disc + prem);
          return (
            <Card className="bg-muted/30">
              <CardContent className="p-3 text-sm space-y-1">
                <div className="flex justify-between"><span>Bed Rate</span><span>₹{fmtAmt(rate)}</span></div>
                <div className="flex justify-between"><span>Discount</span><span className="text-green-600">-₹{fmtAmt(disc)}</span></div>
                <div className="flex justify-between"><span>Premium</span><span className="text-orange-600">+₹{fmtAmt(prem)}</span></div>
                <div className="flex justify-between font-bold border-t pt-1"><span>Effective Rent</span><span>₹{fmtAmt(effective)}/mo</span></div>
              </CardContent>
            </Card>
          );
        })()}
        <Button className="w-full mt-4" disabled={!editOccupiedForm.allotment_id || updateOccupied.isPending} onClick={() => updateOccupied.mutate()}>
          {updateOccupied.isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </DrawerForm>
    </div>
  );
}
