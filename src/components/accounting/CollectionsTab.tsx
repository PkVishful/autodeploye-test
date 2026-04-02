import { useState, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  CreditCard,
  Download,
  Upload,
  Search,
  Receipt,
  Plus,
  CheckCircle2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FileText,
  Pencil,
  Trash2,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRBAC } from "@/hooks/useRBAC";
import { useQueryClient } from "@tanstack/react-query";
import { useAuditLog } from "@/hooks/useAuditLog";
import { DatePickerField } from "@/components/shared/DatePickerField";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { generateReceiptNumber } from "@/lib/document-number-utils";
import { parseExcelDateUTC, fmtMonthLabel } from "@/lib/date-utils";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const fmtDate = (d: string | null) => {
  if (!d) return "—";
  try {
    return format(new Date(d), "dd-MMM-yy");
  } catch {
    return d;
  }
};
const fmtAmt = (v: number) =>
  `₹${new Intl.NumberFormat("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.ceil(v))}`;

interface Props {
  invoices: any[];
  receipts: any[];
  allotments: any[];
  tenants: any[];
  apartments: any[];
  beds: any[];
  orgId: string;
  properties?: any[];
  organization?: any;
  bankAccounts?: any[];
  isTenantView?: boolean;
}

type SortKey = "tenant" | "location" | "amount" | "date" | "mode";
const fmtMonth = (m: string | null) => fmtMonthLabel(m);

export function CollectionsTab({
  invoices,
  receipts,
  allotments,
  tenants,
  apartments,
  beds,
  orgId,
  properties = [],
  organization,
  bankAccounts = [],
  isTenantView = false,
}: Props) {
  const qc = useQueryClient();
  const { log: auditLog } = useAuditLog();
  const { canPerform } = useRBAC();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [propertyFilter, setPropertyFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState(format(new Date(), "yyyy-MM"));
  const [apartmentFilter, setApartmentFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number; status: string } | null>(null);

  // Add collection dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    tenant_id: "",
    amount: "",
    payment_date: format(new Date(), "yyyy-MM-dd"),
    payment_mode: "upi",
    reference: "",
    bank_account_id: "",
  });

  // Detail sheet
  const [detailReceipt, setDetailReceipt] = useState<any>(null);

  // Edit mode
  const [editReceipt, setEditReceipt] = useState<any>(null);
  const [editForm, setEditForm] = useState({ amount_paid: 0, payment_date: "", payment_mode: "", bank_account_id: "" });

  // Tenant lookup maps
  const tenantMap = useMemo(() => new Map(tenants.map((t: any) => [t.id, t])), [tenants]);
  const bankMap = useMemo(() => new Map(bankAccounts.map((ba: any) => [ba.id, ba])), [bankAccounts]);

  // Active/on-notice tenants with their allotment info for the add-collection form
  const activeTenants = useMemo(() => {
    const active = allotments.filter((a: any) => ["Staying", "On-Notice"].includes(a.staying_status || ""));
    return active.map((a: any) => {
      const tenant = tenantMap.get(a.tenant_id);
      const apt = apartments.find((ap: any) => ap.id === a.apartment_id);
      const bed = beds.find((b: any) => b.id === a.bed_id);
      return {
        tenant_id: a.tenant_id,
        allotment_id: a.id,
        full_name: tenant?.full_name || "Unknown",
        apartment_code: apt?.apartment_code || "",
        bed_code: bed?.bed_code || "",
        property_id: a.property_id,
      };
    });
  }, [allotments, tenantMap, apartments, beds]);

  // Filter active tenants by property
  const filteredActiveTenants = useMemo(() => {
    if (propertyFilter === "all") return activeTenants;
    return activeTenants.filter((t) => t.property_id === propertyFilter);
  }, [activeTenants, propertyFilter]);

  // Selected tenant info for the add form
  const selectedAddTenant = useMemo(() => {
    return activeTenants.find((t) => t.tenant_id === addForm.tenant_id);
  }, [addForm.tenant_id, activeTenants]);

  // Normalize a string for sorting: trim, lowercase, collapse whitespace
  const normalizeForSort = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

  // Enrich receipts with tenant/apartment/bed info + sort keys (deduplicated by id)
  const enrichedReceipts = useMemo(() => {
    const seen = new Set<string>();
    return receipts.filter((r: any) => {
      if (!r.id || seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    }).map((r: any) => {
      const allot = r.tenant_allotments;
      const tenantName = (r.tenants?.full_name || "Unknown").trim();
      const aptCode = allot?.apartment_id
        ? apartments.find((a: any) => a.id === allot.apartment_id)?.apartment_code
        : "";
      const bedCode = allot?.bed_id ? beds.find((b: any) => b.id === allot.bed_id)?.bed_code : "";
      const propertyId = allot?.property_id || "";
      const apartmentId = allot?.apartment_id || "";
      const aptBed = `${aptCode || ""}-${bedCode || ""}`;
      return {
        ...r,
        tenant_name: tenantName,
        tenant_name_sort: normalizeForSort(tenantName),
        apt_bed: aptBed,
        apt_bed_sort: normalizeForSort(aptBed),
        apartment_code: aptCode || "",
        apartment_id: apartmentId,
        property_id: propertyId,
        bank_name: r.bank_account_id ? bankMap.get(r.bank_account_id)?.bank_name || "" : "",
        bank_acct_last4: r.bank_account_id ? bankMap.get(r.bank_account_id)?.account_number?.slice(-4) || "" : "",
      };
    });
  }, [receipts, bankMap, apartments, beds]);

  // Unique months from receipt payment dates
  const uniqueMonths = useMemo(() => {
    const months = new Set<string>();
    enrichedReceipts.forEach((r: any) => {
      if (r.payment_date) {
        const m = r.payment_date.slice(0, 7);
        months.add(m);
      }
    });
    return Array.from(months).sort().reverse();
  }, [enrichedReceipts]);

  const filteredApartments = useMemo(() => {
    let apts = apartments;
    if (propertyFilter !== "all") apts = apts.filter((a: any) => a.property_id === propertyFilter);
    return apts;
  }, [apartments, propertyFilter]);

  // Filter receipts
  const filtered = useMemo(() => {
    return enrichedReceipts.filter((r: any) => {
      if (propertyFilter !== "all" && r.property_id !== propertyFilter) return false;
      if (monthFilter !== "all" && r.payment_date?.slice(0, 7) !== monthFilter) return false;
      if (apartmentFilter !== "all" && r.apartment_id !== apartmentFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (
          !r.tenant_name.toLowerCase().includes(q) &&
          !r.apt_bed.toLowerCase().includes(q) &&
          !(r.receipt_number || "").toLowerCase().includes(q) &&
          !(r.payment_mode || "").toLowerCase().includes(q) &&
          !(r.reference_number || "").toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [enrichedReceipts, propertyFilter, monthFilter, apartmentFilter, searchQuery]);

  // Sort with deterministic tie-breakers
  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a: any, b: any) => {
      let primary = 0;
      switch (sortKey) {
        case "tenant":
          primary = a.tenant_name_sort.localeCompare(b.tenant_name_sort);
          break;
        case "location":
          primary = a.apt_bed_sort.localeCompare(b.apt_bed_sort);
          break;
        case "amount":
          primary = Number(a.amount_paid) - Number(b.amount_paid);
          break;
        case "date":
          primary = (a.payment_date || "").localeCompare(b.payment_date || "");
          break;
        case "mode":
          primary = (a.payment_mode || "").toLowerCase().localeCompare((b.payment_mode || "").toLowerCase());
          break;
      }
      if (primary !== 0) return primary * dir;
      // Tie-breakers: payment_date desc, then tenant, then id
      const dateCmp = (b.payment_date || "").localeCompare(a.payment_date || "");
      if (dateCmp !== 0) return dateCmp;
      const nameCmp = a.tenant_name_sort.localeCompare(b.tenant_name_sort);
      if (nameCmp !== 0) return nameCmp;
      return (a.id || "").localeCompare(b.id || "");
    });
  }, [filtered, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 opacity-30 inline ml-1" />;
    return sortDir === "asc" ? (
      <ArrowUp className="h-3 w-3 text-primary inline ml-1" />
    ) : (
      <ArrowDown className="h-3 w-3 text-primary inline ml-1" />
    );
  };

  // Selection
  const toggleAll = () => {
    if (selectedIds.size === sorted.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(sorted.map((r: any) => r.id)));
  };
  const toggleOne = (id: string) => {
    const s = new Set(selectedIds);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelectedIds(s);
  };

  // Add Collection — standalone receipt
  const handleAddCollection = async () => {
    if (!addForm.tenant_id || !addForm.amount || !addForm.payment_date) {
      toast({ title: "Fill required fields", variant: "destructive" });
      return;
    }
    const amount = parseFloat(addForm.amount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Invalid amount", variant: "destructive" });
      return;
    }

    try {
      const tenantAllotment = activeTenants.find((t) => t.tenant_id === addForm.tenant_id);
      const propName = tenantAllotment
        ? properties.find((p: any) => p.id === tenantAllotment.property_id)?.property_name || "UNKNO"
        : "UNKNO";
      const { count: existingCount } = await supabase
        .from("receipts")
        .select("id", { count: "exact", head: true })
        .gte("created_at", `${addForm.payment_date.slice(0, 7)}-01`);
      const receiptNum = generateReceiptNumber(propName, addForm.payment_date, existingCount || 0);

      const { data: receipt, error } = await supabase
        .from("receipts")
        .insert({
          organization_id: orgId,
          tenant_id: addForm.tenant_id,
          tenant_allotment_id: tenantAllotment?.allotment_id || null,
          amount_paid: amount,
          payment_date: addForm.payment_date,
          payment_mode: addForm.payment_mode,
          receipt_number: receiptNum,
          ...(addForm.reference ? { reference_number: addForm.reference } : {}),
          ...(addForm.bank_account_id ? { bank_account_id: addForm.bank_account_id } : {}),
        } as any)
        .select()
        .single();
      if (error) throw error;

      auditLog("receipts", receipt.id, "created", { amount, mode: addForm.payment_mode });
      toast({ title: `${fmtAmt(amount)} payment recorded` });
      setAddOpen(false);
      setAddForm({
        tenant_id: "",
        amount: "",
        payment_date: format(new Date(), "yyyy-MM-dd"),
        payment_mode: "upi",
        reference: "",
        bank_account_id: "",
      });
      qc.invalidateQueries({ queryKey: ["acc-receipts"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  // Delete receipt — standalone, no FIFO reversal
  const handleDeleteReceipt = async (receipt: any) => {
    if (!window.confirm("Delete this receipt?")) return;
    await supabase.from("receipts").delete().eq("id", receipt.id);
    auditLog("receipts", receipt.id, "deleted", { amount: receipt.amount_paid });
    qc.invalidateQueries({ queryKey: ["acc-receipts"] });
    toast({ title: "Receipt deleted" });
  };

  // Edit receipt
  const handleStartEdit = (r: any) => {
    setEditReceipt(r);
    setEditForm({
      amount_paid: Number(r.amount_paid),
      payment_date: r.payment_date || "",
      payment_mode: r.payment_mode || "upi",
      bank_account_id: r.bank_account_id || "",
    });
  };

  const handleSaveEdit = async () => {
    if (!editReceipt) return;
    const { error } = await supabase
      .from("receipts")
      .update({
        amount_paid: editForm.amount_paid,
        payment_date: editForm.payment_date,
        payment_mode: editForm.payment_mode,
        ...(editForm.bank_account_id ? { bank_account_id: editForm.bank_account_id } : { bank_account_id: null }),
      } as any)
      .eq("id", editReceipt.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    auditLog("receipts", editReceipt.id, "updated", editForm);
    setEditReceipt(null);
    qc.invalidateQueries({ queryKey: ["acc-receipts"] });
    toast({ title: "Receipt updated" });
  };

  // Open receipt detail
  const openReceiptDetail = (receipt: any) => {
    setDetailReceipt(receipt);
  };

  // PDF Export
  const handleExportPDF = () => {
    const orgName = organization?.organization_name || "Vishful Living";
    const gstNumber = organization?.gst_number || "";
    const selected = sorted.filter((r: any) => selectedIds.has(r.id));
    const data = selected.length > 0 ? selected : sorted;

    const receiptPages = data
      .map((r: any) => {
        return `<div class="receipt-page">
        <div class="rcpt-header"><h2>${orgName}</h2><p class="sub">Payment Receipt</p>
          ${gstNumber ? `<p class="gst-info">GSTIN: ${gstNumber}</p>` : ""}
          <p class="hsn-info">HSN Code: 99632</p>
        </div>
        <div class="rcpt-info">
          ${r.receipt_number ? `<p><strong>Receipt #:</strong> ${r.receipt_number}</p>` : ""}
          <p><strong>Tenant:</strong> ${r.tenant_name}</p>
          <p><strong>Unit:</strong> ${r.apt_bed}</p>
          <p><strong>Date:</strong> ${fmtDate(r.payment_date)}</p>
          <p><strong>Mode:</strong> ${(r.payment_mode || "").toUpperCase()}</p>
        </div>
        <table><thead><tr><th>Amount Received</th><th>Mode</th><th>Date</th></tr></thead>
        <tbody><tr>
          <td class="text-green">${fmtAmt(Number(r.amount_paid))}</td>
          <td>${(r.payment_mode || "").toUpperCase()}</td>
          <td>${fmtDate(r.payment_date)}</td>
        </tr></tbody></table>
        <div class="rcpt-footer">${orgName}${gstNumber ? ` | GSTIN: ${gstNumber}` : ""} | HSN: 99632 — Payment Receipt</div>
      </div>`;
      })
      .join("");

    const html = `<!DOCTYPE html><html><head><title>Receipts — ${orgName}</title>
    <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;color:#1a1a1a}
    .receipt-page{padding:40px;page-break-after:always;max-width:800px;margin:0 auto}
    .receipt-page:last-child{page-break-after:auto}
    .rcpt-header{border-bottom:3px solid #2563eb;padding-bottom:16px;margin-bottom:20px}
    .rcpt-header h2{font-size:22px;color:#2563eb}.rcpt-header .sub{font-size:13px;color:#6b7280}
    .gst-info{font-size:11px;color:#374151;margin-top:4px;font-weight:600}.hsn-info{font-size:10px;color:#6b7280}
    .rcpt-info{background:#f8fafc;padding:12px 16px;border-radius:6px;margin-bottom:20px;font-size:13px;line-height:1.8}
    table{width:100%;border-collapse:collapse;margin-bottom:20px}
    th{background:#f1f5f9;padding:10px 14px;text-align:left;font-size:12px;font-weight:600;border-bottom:2px solid #cbd5e1}
    td{padding:8px 14px;border-bottom:1px solid #e2e8f0;font-size:13px}
    .text-green{color:#16a34a;font-weight:bold;font-size:16px}
    .rcpt-footer{border-top:1px solid #e2e8f0;padding-top:12px;font-size:10px;color:#9ca3af;text-align:center}
    @media print{body{padding:0}.receipt-page{padding:20px}}</style></head><body>${receiptPages}</body></html>`;
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
      setTimeout(() => w.print(), 500);
    }
  };

  // Download template for import
  const handleDownloadTemplate = () => {
    const headers = [
      "Allotment ID",
      "Tenant ID",
      "Amount",
      "Payment Date",
      "Payment Mode",
      "Bank Account ID",
      "Bank Account",
      "Reference Number",
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Collections");
    saveAs(new Blob([XLSX.write(wb, { bookType: "xlsx", type: "array" })]), "collections-template.xlsx");
    toast({ title: "Template downloaded" });
  };

  // Excel Export
  const handleExportExcel = () => {
    const selected = sorted.filter((r: any) => selectedIds.has(r.id));
    const data = (selected.length > 0 ? selected : sorted).map((r: any) => ({
      Tenant: r.tenant_name,
      "Apt-Bed": r.apt_bed,
      Amount: Number(r.amount_paid),
      Mode: r.payment_mode || "",
      Date: r.payment_date || "",
      Reference: r.reference_number || "",
      "Receipt #": r.receipt_number || "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Collections");
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(
      new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      `collections-${format(new Date(), "yyyy-MM-dd")}.xlsx`,
    );
    toast({ title: "Excel exported" });
  };

  // File select → ask replace/append
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Excel Import — standalone receipts (no FIFO)
  const executeImport = async (mode: "replace" | "append") => {
    if (!importFile) return;
    const file = importFile;
    setImportFile(null);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: "binary" });
        const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        if (rows.length === 0) {
          toast({ title: "No data rows found", variant: "destructive" });
          return;
        }

        let created = 0,
          skipped = 0;
        const totalRows = rows.length;
        setImportProgress({ current: 0, total: totalRows, status: "Parsing rows…" });

        const parsedRows = rows.map((row) => {
          const allotmentId = String(row["Allotment ID"] || "").trim();
          const tenantId = String(row["Tenant ID"] || "").trim();
          const amount = Number(row["Amount"] || row["Received"] || 0);
          const rawDate = row["Payment Date"] || row["Date"] || "";
          const payMode = String(row["Payment Mode"] || row["Mode"] || "upi").toLowerCase();
          const bankAccountId = String(row["Bank Account ID"] || "").trim();
          const bankAccountName = String(row["Bank Account"] || "").trim();
          const referenceNumber = String(row["Reference Number"] || row["Reference"] || "").trim();

          const payDate: string = parseExcelDateUTC(rawDate) || format(new Date(), "yyyy-MM-dd");

          const matchedBank = bankAccountId
            ? bankAccounts.find((ba: any) => ba.id === bankAccountId)
            : bankAccountName
              ? bankAccounts.find(
                  (ba: any) =>
                    ba.bank_name?.toLowerCase().includes(bankAccountName.toLowerCase()) ||
                    ba.account_number?.endsWith(bankAccountName),
                )
              : null;

          // Resolve tenant_id from allotment if not directly provided
          let resolvedTenantId = tenantId;
          if (!resolvedTenantId && allotmentId) {
            const allotment = allotments.find((a: any) => a.id === allotmentId);
            resolvedTenantId = allotment?.tenant_id || "";
          }

          return { allotmentId, tenantId: resolvedTenantId, amount, payDate, payMode, matchedBank, referenceNumber };
        });

        // Get a single receipt count for numbering
        const { count: baseCount } = await supabase.from("receipts").select("id", { count: "exact", head: true });
        let receiptCounter = baseCount || 0;

        // If replace mode — delete existing receipts for matching dates
        if (mode === "replace") {
          setImportProgress({ current: 0, total: totalRows, status: "Removing existing matching records…" });
          const uniqueDates = new Set<string>();
          parsedRows.forEach((r) => {
            if (r.amount > 0 && r.payDate) uniqueDates.add(r.payDate);
          });
          for (const date of uniqueDates) {
            const matchingReceipts = receipts.filter((r: any) => r.payment_date === date);
            if (matchingReceipts.length > 0) {
              await supabase
                .from("receipts")
                .delete()
                .in(
                  "id",
                  matchingReceipts.map((r: any) => r.id),
                );
            }
          }
        }

        // Process in batches
        const BATCH_SIZE = 50;
        for (let i = 0; i < parsedRows.length; i += BATCH_SIZE) {
          const batch = parsedRows.slice(i, i + BATCH_SIZE);
          setImportProgress({
            current: i,
            total: totalRows,
            status: `Processing rows ${i + 1}–${Math.min(i + BATCH_SIZE, totalRows)}…`,
          });

          const receiptInserts: any[] = [];
          for (const row of batch) {
            if ((!row.tenantId && !row.allotmentId) || row.amount <= 0) {
              skipped++;
              continue;
            }

            const allotment = allotments.find((a: any) => a.id === row.allotmentId);
            const propName = allotment
              ? properties.find((p: any) => p.id === allotment.property_id)?.property_name || "UNKNO"
              : "UNKNO";
            const receiptNum = generateReceiptNumber(propName, row.payDate, receiptCounter);
            receiptCounter++;

            receiptInserts.push({
              organization_id: orgId,
              tenant_id: row.tenantId || allotment?.tenant_id,
              tenant_allotment_id: row.allotmentId || null,
              amount_paid: row.amount,
              payment_date: row.payDate,
              payment_mode: row.payMode,
              receipt_number: receiptNum,
              ...(row.matchedBank ? { bank_account_id: row.matchedBank.id } : {}),
              ...(row.referenceNumber ? { reference_number: row.referenceNumber } : {}),
            });
          }

          if (receiptInserts.length > 0) {
            const { data: inserted, error } = await supabase
              .from("receipts")
              .insert(receiptInserts as any)
              .select("id");
            if (error) {
              console.error("Receipt batch insert error:", error);
              toast({ title: "Insert error", description: error.message, variant: "destructive" });
              skipped += receiptInserts.length;
            } else {
              created += inserted?.length || 0;
            }
          }
        }

        setImportProgress(null);
        qc.invalidateQueries({ queryKey: ["acc-receipts"] });
        const parts = [`${created} receipt(s) imported`];
        if (skipped > 0) parts.push(`${skipped} skipped`);
        toast({ title: parts.join(", ") });
      } catch (err: any) {
        setImportProgress(null);
        toast({ title: "Import error", description: err.message, variant: "destructive" });
      }
    };
    reader.readAsBinaryString(file);
  };

  // Stats
  const totalCollected = sorted.reduce((s: number, r: any) => s + Number(r.amount_paid || 0), 0);

  return (
    <div className="space-y-4">
      {/* Import Progress Overlay */}
      {importProgress && (
        <Card className="border-primary">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm font-medium">{importProgress.status}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {importProgress.current}/{importProgress.total} rows
              </span>
            </div>
            <Progress
              value={importProgress.total > 0 ? (importProgress.current / importProgress.total) * 100 : 0}
              className="h-2"
            />
          </CardContent>
        </Card>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-green-600">{fmtAmt(totalCollected)}</p>
            <p className="text-xs text-muted-foreground">Total Collected (filtered)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold">{sorted.length}</p>
            <p className="text-xs text-muted-foreground">Receipts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold">{receipts.length}</p>
            <p className="text-xs text-muted-foreground">Total Receipts</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center bg-info-panel rounded-lg p-3">
        <Select
          value={propertyFilter}
          onValueChange={(v) => {
            setPropertyFilter(v);
            setApartmentFilter("all");
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Property" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Properties</SelectItem>
            {properties.map((p: any) => (
              <SelectItem key={p.id} value={p.id}>
                {p.property_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={monthFilter} onValueChange={setMonthFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Month" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Months</SelectItem>
            {uniqueMonths.map((m) => (
              <SelectItem key={m} value={m}>
                {fmtMonth(m)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={apartmentFilter} onValueChange={setApartmentFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Apartment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Apartments</SelectItem>
            {filteredApartments.map((a: any) => (
              <SelectItem key={a.id} value={a.id}>
                {a.apartment_code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tenant, unit, receipt…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <div className="ml-auto flex gap-2">
          {!isTenantView && (
            <>
              <Button size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> Add Collection
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Download className="h-3.5 w-3.5" /> Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={handleExportPDF}>
                    <FileText className="h-3.5 w-3.5 mr-2" /> PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportExcel}>
                    <Download className="h-3.5 w-3.5 mr-2" /> Excel
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5" disabled={!!importProgress}>
                    <Upload className="h-3.5 w-3.5" /> Import
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={handleDownloadTemplate}>
                    <Download className="h-3.5 w-3.5 mr-2" /> Download Template
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-3.5 w-3.5 mr-2" /> Upload Excel
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleFileSelect}
              />
            </>
          )}
        </div>
      </div>

      {/* Collections Table */}
      <Card>
        <Table>
          <TableHeader className="bg-table-header">
            <TableRow>
              <TableHead className="w-8">
                <Checkbox
                  checked={selectedIds.size === sorted.length && sorted.length > 0}
                  onCheckedChange={toggleAll}
                />
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort("tenant")}>
                Tenant
                <SortIcon col="tenant" />
              </TableHead>
              <TableHead
                className="cursor-pointer select-none whitespace-nowrap"
                onClick={() => handleSort("location")}
              >
                Apt-Bed
                <SortIcon col="location" />
              </TableHead>
              <TableHead className="cursor-pointer select-none text-right" onClick={() => handleSort("amount")}>
                Amount
                <SortIcon col="amount" />
              </TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort("mode")}>
                Mode
                <SortIcon col="mode" />
              </TableHead>
              <TableHead>Bank</TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort("date")}>
                Date
                <SortIcon col="date" />
              </TableHead>
              {!isTenantView && <TableHead className="w-24">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  <CheckCircle2 className="h-8 w-8 mx-auto text-green-500 mb-2" />
                  No collection records found
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((r: any) => (
                <TableRow
                  key={r.id}
                  className="cursor-pointer hover:bg-muted/50 even:bg-table-row-alt"
                  onClick={() => openReceiptDetail(r)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={selectedIds.has(r.id)} onCheckedChange={() => toggleOne(r.id)} />
                  </TableCell>
                  <TableCell className="text-sm">{r.tenant_name}</TableCell>
                  <TableCell className="font-medium whitespace-nowrap text-xs">{r.apt_bed}</TableCell>
                  <TableCell className="text-right font-semibold text-green-600 text-sm">
                    {fmtAmt(Number(r.amount_paid))}
                  </TableCell>
                  <TableCell className="capitalize text-xs">{r.payment_mode}</TableCell>
                  <TableCell className="text-xs">
                    {r.bank_name ? `${r.bank_name} …${r.bank_acct_last4}` : "—"}
                  </TableCell>
                  <TableCell className="text-xs">{fmtDate(r.payment_date)}</TableCell>
                  {!isTenantView && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleStartEdit(r)}
                          title="Edit"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => handleDeleteReceipt(r)}
                          title="Delete"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Replace/Append Dialog */}
      <Dialog
        open={!!importFile}
        onOpenChange={(open) => {
          if (!open) setImportFile(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Collections</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">How would you like to handle existing collection records?</p>
          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => executeImport("append")}>
              Append New Data
            </Button>
            <Button variant="destructive" onClick={() => executeImport("replace")}>
              Replace Existing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Collection Sheet */}
      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" /> Add Collection
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Tenant</Label>
              <Select value={addForm.tenant_id} onValueChange={(v) => setAddForm({ ...addForm, tenant_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select tenant" />
                </SelectTrigger>
                <SelectContent>
                  {filteredActiveTenants.map((t) => (
                    <SelectItem key={t.tenant_id} value={t.tenant_id}>
                      {t.full_name} — {t.apartment_code}/{t.bed_code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedAddTenant && (
              <Card className="bg-muted/30">
                <CardContent className="p-3 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-muted-foreground">Apartment:</span>{" "}
                      <strong>{selectedAddTenant.apartment_code}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Bed:</span> <strong>{selectedAddTenant.bed_code}</strong>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            <div>
              <Label>Amount (₹)</Label>
              <Input
                type="number"
                value={addForm.amount}
                onChange={(e) => setAddForm({ ...addForm, amount: e.target.value })}
              />
            </div>
            <DatePickerField
              label="Payment Date"
              value={addForm.payment_date}
              onChange={(v) => setAddForm({ ...addForm, payment_date: v })}
            />
            <div>
              <Label>Payment Mode</Label>
              <Select value={addForm.payment_mode} onValueChange={(v) => setAddForm({ ...addForm, payment_mode: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="rtgs">RTGS</SelectItem>
                  <SelectItem value="credit_card">Credit Card</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {bankAccounts.length > 0 && (
              <div>
                <Label>Bank Account</Label>
                <Select
                  value={addForm.bank_account_id}
                  onValueChange={(v) => setAddForm({ ...addForm, bank_account_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select bank account" />
                  </SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map((ba: any) => (
                      <SelectItem key={ba.id} value={ba.id}>
                        {ba.bank_name} — {ba.account_number?.slice(-4)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Reference / Notes</Label>
              <Textarea
                value={addForm.reference}
                onChange={(e) => setAddForm({ ...addForm, reference: e.target.value })}
              />
            </div>
            <Button
              className="w-full"
              onClick={handleAddCollection}
              disabled={!addForm.tenant_id || !addForm.amount || parseFloat(addForm.amount) <= 0}
            >
              Record Payment
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Edit Receipt Sheet */}
      <Sheet
        open={!!editReceipt}
        onOpenChange={(open) => {
          if (!open) setEditReceipt(null);
        }}
      >
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit Receipt</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Amount (₹)</Label>
              <Input
                type="number"
                value={editForm.amount_paid}
                onChange={(e) => setEditForm({ ...editForm, amount_paid: Number(e.target.value) })}
              />
            </div>
            <DatePickerField
              label="Payment Date"
              value={editForm.payment_date}
              onChange={(v) => setEditForm({ ...editForm, payment_date: v })}
            />
            <div>
              <Label>Mode</Label>
              <Select
                value={editForm.payment_mode}
                onValueChange={(v) => setEditForm({ ...editForm, payment_mode: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="rtgs">RTGS</SelectItem>
                  <SelectItem value="credit_card">Credit Card</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {bankAccounts.length > 0 && (
              <div>
                <Label>Bank Account</Label>
                <Select
                  value={editForm.bank_account_id}
                  onValueChange={(v) => setEditForm({ ...editForm, bank_account_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select bank account" />
                  </SelectTrigger>
                  <SelectContent>
                    {bankAccounts.map((ba: any) => (
                      <SelectItem key={ba.id} value={ba.id}>
                        {ba.bank_name} — {ba.account_number?.slice(-4)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setEditReceipt(null)}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleSaveEdit}>
                Save
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Receipt Detail Sheet */}
      <Sheet
        open={!!detailReceipt}
        onOpenChange={(open) => {
          if (!open) setDetailReceipt(null);
        }}
      >
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {detailReceipt && (
            <>
              <SheetHeader>
                <SheetTitle>Receipt Detail</SheetTitle>
              </SheetHeader>
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {detailReceipt.receipt_number && (
                    <div>
                      <span className="text-muted-foreground">Receipt #:</span>{" "}
                      <strong>{detailReceipt.receipt_number}</strong>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Tenant:</span> <strong>{detailReceipt.tenant_name}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Unit:</span> <strong>{detailReceipt.apt_bed}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Amount:</span>{" "}
                    <strong className="text-green-600">{fmtAmt(Number(detailReceipt.amount_paid))}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Mode:</span>{" "}
                    <strong className="capitalize">{detailReceipt.payment_mode}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Date:</span>{" "}
                    <strong>{fmtDate(detailReceipt.payment_date)}</strong>
                  </div>
                  {detailReceipt.reference_number && (
                    <div>
                      <span className="text-muted-foreground">Reference:</span>{" "}
                      <strong>{detailReceipt.reference_number}</strong>
                    </div>
                  )}
                  {detailReceipt.bank_name && (
                    <div>
                      <span className="text-muted-foreground">Bank:</span>{" "}
                      <strong>
                        {detailReceipt.bank_name} …{detailReceipt.bank_acct_last4}
                      </strong>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
