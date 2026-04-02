export interface NavRegistryItem {
  module: string;
  label: string;
  icon: string;
  tabs: { key: string; label: string }[];
}

export const NAV_REGISTRY: NavRegistryItem[] = [
  { module: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', tabs: [] },
  { module: 'properties', label: 'Properties', icon: 'Building2', tabs: [] },
  { module: 'owners', label: 'Owners', icon: 'UserCircle', tabs: [] },
  { module: 'tenants', label: 'Tenants', icon: 'Users', tabs: [] },
  {
    module: 'tenant_lifecycle', label: 'Tenant Lifecycle', icon: 'UserCog',
    tabs: [
      { key: 'visual-map', label: 'Visual Map' },
      { key: 'booking', label: 'Booking' },
      { key: 'onboarding', label: 'Onboarding' },
      { key: 'switching', label: 'Switching' },
      { key: 'notices', label: 'Notices' },
      { key: 'exit', label: 'Exit' },
      { key: 'payments', label: 'Payments' },
      { key: 'refunds', label: 'Refunds' },
      { key: 'not-in-property', label: 'Not in Property' },
      { key: 'excel-upload', label: 'Excel Upload' },
    ],
  },
  {
    module: 'assets', label: 'Assets', icon: 'Package',
    tabs: [
      { key: 'inventory', label: 'Inventory' },
      { key: 'vendors', label: 'Vendors' },
      { key: 'allocations', label: 'Allocations' },
      { key: 'categories', label: 'Categories' },
      { key: 'analytics', label: 'Analytics' },
      { key: 'forecasts', label: 'Forecasts' },
    ],
  },
  {
    module: 'tickets', label: 'Tickets', icon: 'Wrench',
    tabs: [
      { key: 'list', label: 'Tickets' },
      { key: 'regular', label: 'Regular Maintenance' },
      { key: 'dashboard', label: 'Dashboard' },
      { key: 'ai', label: 'AI Insights' },
    ],
  },
  {
    module: 'accounting', label: 'Accounting', icon: 'Receipt',
    tabs: [
      { key: 'billing', label: 'Billing' },
      { key: 'invoices', label: 'Invoices' },
      { key: 'adjustments', label: 'Adjustments' },
      { key: 'collections', label: 'Collections' },
      { key: 'expenses', label: 'Expenses' },
      { key: 'rental_payments', label: 'Rental Payments' },
      { key: 'settlements', label: 'Settlements' },
      { key: 'ledger', label: 'Ledger' },
      { key: 'profitability', label: 'Profitability' },
      { key: 'reports', label: 'Reports' },
    ],
  },
  {
    module: 'electricity', label: 'Electricity', icon: 'Zap',
    tabs: [
      { key: 'readings', label: 'Meter Readings' },
      { key: 'shares', label: 'Tenant Shares' },
      { key: 'rates', label: 'EB Rates' },
    ],
  },
  { module: 'reports', label: 'Reports', icon: 'BarChart3', tabs: [] },
  { module: 'announcements', label: 'Announcements', icon: 'Megaphone', tabs: [] },
  { module: 'team', label: 'Team', icon: 'Users2', tabs: [] },
  { module: 'audit_logs', label: 'Audit Logs', icon: 'ScrollText', tabs: [] },
  { module: 'settings', label: 'Settings', icon: 'Settings', tabs: [] },
];
