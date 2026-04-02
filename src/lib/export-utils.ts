import { format } from 'date-fns';
import { calculateWorkingHoursElapsed } from '@/lib/date-utils';
import { saveAs } from 'file-saver';

// ──────────────── CSV Export ────────────────
export function exportToCSV(data: Record<string, any>[], filename: string, columns?: { key: string; label: string }[]) {
  if (data.length === 0) return;

  const cols = columns || Object.keys(data[0]).map(k => ({ key: k, label: k }));
  const header = cols.map(c => `"${c.label}"`).join(',');
  const rows = data.map(row =>
    cols.map(c => {
      const val = row[c.key];
      if (val === null || val === undefined) return '""';
      if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
      return `"${String(val).replace(/"/g, '""')}"`;
    }).join(',')
  );
  const csv = [header, ...rows].join('\n');
  downloadFile(csv, `${filename}.csv`, 'text/csv');
}

// ──────────────── PDF Export (HTML-based) ────────────────
export function exportToPDF(title: string, data: Record<string, any>[], columns: { key: string; label: string }[], summary?: Record<string, string>, logoUrl?: string) {
  if (data.length === 0) return;

  const now = format(new Date(), 'dd-MMM-yyyy HH:mm');
  
  const summaryHTML = summary
    ? `<div style="margin-bottom:20px;padding:12px;background:#f8f9fa;border-radius:6px;">
        ${Object.entries(summary).map(([k, v]) => `<div style="display:inline-block;margin-right:24px;"><strong>${k}:</strong> ${v}</div>`).join('')}
      </div>`
    : '';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 30px; color: #1a1a1a; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 2px solid #e5e7eb; }
    .header h1 { font-size: 18px; font-weight: 700; }
    .header .meta { font-size: 11px; color: #6b7280; text-align: right; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { background: #f3f4f6; padding: 8px 10px; text-align: left; font-weight: 600; border-bottom: 2px solid #d1d5db; }
    td { padding: 6px 10px; border-bottom: 1px solid #e5e7eb; }
    tr:nth-child(even) { background: #fafafa; }
    .footer { margin-top: 20px; font-size: 10px; color: #9ca3af; text-align: center; }
    @media print { body { padding: 15px; } }
  </style>
</head>
<body>
  <div class="header">
    <div style="display:flex;align-items:center;gap:12px;">
      ${logoUrl ? `<img src="${logoUrl}" style="height:40px;width:auto;" />` : ''}
      <h1>${title}</h1>
    </div>
    <div class="meta">Generated: ${now}<br/>Records: ${data.length}</div>
  </div>
  ${summaryHTML}
  <table>
    <thead><tr>${columns.map(c => `<th>${c.label}</th>`).join('')}</tr></thead>
    <tbody>
      ${data.map(row => `<tr>${columns.map(c => {
        let val = row[c.key];
        if (val === null || val === undefined) val = '—';
        return `<td>${val}</td>`;
      }).join('')}</tr>`).join('')}
    </tbody>
  </table>
  <div class="footer">Vishful OS — Financial Report</div>
</body>
</html>`;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  }
}

// ──────────────── Helper ────────────────
function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  saveAs(blob, filename);
}

// ──────────────── Pre-built Export Functions ────────────────

export function exportInvoices(invoices: any[], mode: 'csv' | 'pdf') {
  const columns = [
    { key: 'invoice_number', label: 'Invoice #' },
    { key: 'tenant_name', label: 'Tenant' },
    { key: 'property_name', label: 'Property' },
    { key: 'billing_month', label: 'Month' },
    { key: 'rent_amount', label: 'Rent (₹)' },
    { key: 'electricity_amount', label: 'EB (₹)' },
    { key: 'late_fee', label: 'Late Fee (₹)' },
    { key: 'total_amount', label: 'Total (₹)' },
    { key: 'due_date', label: 'Due Date' },
    { key: 'status', label: 'Status' },
  ];

  const data = invoices.map(inv => ({
    invoice_number: inv.invoice_number || '—',
    tenant_name: inv.tenants?.full_name || '—',
    property_name: inv.properties?.property_name || '—',
    billing_month: inv.billing_month || '—',
    rent_amount: Number(inv.rent_amount || 0).toLocaleString(),
    electricity_amount: Number(inv.electricity_amount || 0).toLocaleString(),
    late_fee: Number(inv.late_fee || 0).toLocaleString(),
    total_amount: Number(inv.total_amount || 0).toLocaleString(),
    due_date: inv.due_date ? format(new Date(inv.due_date), 'dd-MMM-yy') : '—',
    status: inv.status || 'pending',
  }));

  const total = invoices.reduce((s: number, i: any) => s + Number(i.total_amount || 0), 0);
  const summary = { 'Total Invoices': String(invoices.length), 'Total Amount': `₹${total.toLocaleString()}` };

  if (mode === 'csv') exportToCSV(data, `invoices-${format(new Date(), 'yyyy-MM-dd')}`, columns);
  else exportToPDF('Invoice Report', data, columns, summary);
}

export function exportReceipts(receipts: any[], mode: 'csv' | 'pdf') {
  const columns = [
    { key: 'invoice_number', label: 'Invoice #' },
    { key: 'tenant_name', label: 'Tenant' },
    { key: 'amount_paid', label: 'Amount (₹)' },
    { key: 'payment_mode', label: 'Mode' },
    { key: 'payment_date', label: 'Date' },
  ];

  const data = receipts.map(r => ({
    invoice_number: r.invoices?.invoice_number || '—',
    tenant_name: r.invoices?.tenants?.full_name || '—',
    amount_paid: Number(r.amount_paid).toLocaleString(),
    payment_mode: r.payment_mode || '—',
    payment_date: r.payment_date ? format(new Date(r.payment_date), 'dd-MMM-yy') : '—',
  }));

  const total = receipts.reduce((s: number, r: any) => s + Number(r.amount_paid), 0);
  const summary = { 'Total Receipts': String(receipts.length), 'Total Collected': `₹${total.toLocaleString()}` };

  if (mode === 'csv') exportToCSV(data, `receipts-${format(new Date(), 'yyyy-MM-dd')}`, columns);
  else exportToPDF('Payment Receipts Report', data, columns, summary);
}

export function exportExpenses(expenses: any[], mode: 'csv' | 'pdf') {
  const columns = [
    { key: 'expense_date', label: 'Date' },
    { key: 'category', label: 'Category' },
    { key: 'property_name', label: 'Property' },
    { key: 'apartment_code', label: 'Apartment' },
    { key: 'vendor', label: 'Vendor' },
    { key: 'description', label: 'Description' },
    { key: 'amount', label: 'Amount (₹)' },
  ];

  const data = expenses.map(e => ({
    expense_date: e.expense_date ? format(new Date(e.expense_date), 'dd-MMM-yy') : '—',
    category: e.category || '—',
    property_name: e.properties?.property_name || '—',
    apartment_code: e.apartments?.apartment_code || '—',
    vendor: e.vendor || '—',
    description: e.description || '—',
    amount: Number(e.amount).toLocaleString(),
  }));

  const total = expenses.reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
  const summary = { 'Total Expenses': String(expenses.length), 'Total Amount': `₹${total.toLocaleString()}` };

  if (mode === 'csv') exportToCSV(data, `expenses-${format(new Date(), 'yyyy-MM-dd')}`, columns);
  else exportToPDF('Expense Report', data, columns, summary);
}

export function exportSettlements(settlements: any[], mode: 'csv' | 'pdf') {
  const columns = [
    { key: 'tenant_name', label: 'Tenant' },
    { key: 'deposit_amount', label: 'Deposit (₹)' },
    { key: 'pending_rent', label: 'Rent Due (₹)' },
    { key: 'pending_eb', label: 'EB Due (₹)' },
    { key: 'pending_late_fees', label: 'Late Fees (₹)' },
    { key: 'damages', label: 'Damages (₹)' },
    { key: 'total_deductions', label: 'Total Ded. (₹)' },
    { key: 'refund_amount', label: 'Refund (₹)' },
    { key: 'status', label: 'Status' },
    { key: 'settlement_date', label: 'Date' },
  ];

  const data = settlements.map(s => ({
    tenant_name: s.tenants?.full_name || '—',
    deposit_amount: Number(s.deposit_amount).toLocaleString(),
    pending_rent: Number(s.pending_rent).toLocaleString(),
    pending_eb: Number(s.pending_eb).toLocaleString(),
    pending_late_fees: Number(s.pending_late_fees).toLocaleString(),
    damages: Number(s.damages).toLocaleString(),
    total_deductions: Number(s.total_deductions).toLocaleString(),
    refund_amount: Number(s.refund_amount).toLocaleString(),
    status: s.status || '—',
    settlement_date: s.settlement_date ? format(new Date(s.settlement_date), 'dd-MMM-yy') : '—',
  }));

  if (mode === 'csv') exportToCSV(data, `settlements-${format(new Date(), 'yyyy-MM-dd')}`, columns);
  else exportToPDF('Deposit Settlement Statements', data, columns);
}

export function exportTickets(tickets: any[], mode: 'csv' | 'pdf') {
  const columns = [
    { key: 'ticket_number', label: 'Ticket #' },
    { key: 'tenant_name', label: 'Tenant' },
    { key: 'property', label: 'Property' },
    { key: 'issue', label: 'Issue' },
    { key: 'priority', label: 'Priority' },
    { key: 'status', label: 'Status' },
    { key: 'created_at', label: 'Created' },
    { key: 'sla_status', label: 'SLA' },
  ];

  const now = new Date();
  const data = tickets.map(t => {
    let slaStatus = '—';
    if (t.sla_deadline) {
      const deadline = new Date(t.sla_deadline);
      if (['completed', 'closed'].includes(t.status)) slaStatus = 'Done';
      else if (now > deadline) slaStatus = 'Breached';
      else {
        const slaHours = t.issue_types?.sla_hours || 24;
        const totalMs = slaHours * 3600000;
        const slaStart = new Date(deadline.getTime() - totalMs);
        const elapsed = calculateWorkingHoursElapsed(slaStart, now);
        slaStatus = (elapsed / totalMs) * 100 >= 50 ? 'Warning' : 'On Track';
      }
    }
    return {
      ticket_number: t.ticket_number || '—',
      tenant_name: t.tenant_name || t.tenants?.full_name || '—',
      property: `${t.properties?.property_name || '—'}${t.apartments?.apartment_code ? ' • ' + t.apartments.apartment_code : ''}`,
      issue: t.issue_types?.name || '—',
      priority: t.priority || '—',
      status: t.status || '—',
      created_at: t.created_at ? format(new Date(t.created_at), 'dd-MMM-yy') : '—',
      sla_status: slaStatus,
    };
  });

  const summary = {
    'Total Tickets': String(tickets.length),
    'Open': String(tickets.filter(t => !['completed', 'closed'].includes(t.status)).length),
    'Closed': String(tickets.filter(t => ['completed', 'closed'].includes(t.status)).length),
  };

  if (mode === 'csv') exportToCSV(data, `tickets-${format(new Date(), 'yyyy-MM-dd')}`, columns);
  else exportToPDF('Maintenance Tickets Report', data, columns, summary);
}
