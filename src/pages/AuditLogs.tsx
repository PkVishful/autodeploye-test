import { useState } from 'react';
import { ScrollText, Filter, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/supabase-utils';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { useServerPagination } from '@/hooks/useServerPagination';
import { TablePagination } from '@/components/shared/TablePagination';
import { Skeleton } from '@/components/ui/skeleton';

const TABLE_OPTIONS = [
  'properties', 'apartments', 'beds', 'bed_rates',
  'owners', 'owner_contracts',
  'team_members', 'team_payments', 'team_attendance',
  'issue_types', 'ticket_assignment_rules',
];

const ACTION_OPTIONS = ['created', 'updated', 'deleted'];

const actionColors: Record<string, string> = {
  created: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  updated: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  deleted: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

export default function AuditLogs() {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;

  const [tableFilter, setTableFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [fromDate, setFromDate] = useState<Date | undefined>();
  const [toDate, setToDate] = useState<Date | undefined>();

  // Build filters array for server pagination
  const filters = [];
  if (tableFilter !== 'all') filters.push({ column: 'table_name', value: tableFilter });
  if (actionFilter !== 'all') filters.push({ column: 'action', value: actionFilter });
  if (userFilter !== 'all') filters.push({ column: 'performed_by', value: userFilter });

  const { data: logs, isLoading, page, setPage, totalPages, totalCount, pageSize } = useServerPagination({
    table: 'audit_logs',
    select: '*',
    pageSize: 50,
    filters,
    orderBy: { column: 'performed_at', ascending: false },
    enabled: !!orgId,
    queryKey: ['audit-logs', fromDate?.toISOString() || '', toDate?.toISOString() || ''],
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['org_profiles_audit'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('profiles').select('id, full_name, email').range(from, to)),
    enabled: !!orgId,
  });

  const getUserName = (userId: string | null) => {
    if (!userId) return 'System';
    const p = profiles.find((pr: any) => pr.id === userId);
    return p?.full_name || p?.email || userId.slice(0, 8);
  };

  const hasFilters = tableFilter !== 'all' || actionFilter !== 'all' || userFilter !== 'all' || fromDate || toDate;

  const clearFilters = () => {
    setTableFilter('all');
    setActionFilter('all');
    setUserFilter('all');
    setFromDate(undefined);
    setToDate(undefined);
  };

  const renderChanges = (changes: any) => {
    if (!changes || typeof changes !== 'object' || Object.keys(changes).length === 0) return <span className="text-muted-foreground text-xs">—</span>;
    const entries = Object.entries(changes).filter(([k]) => !['organization_id', 'created_at', 'id'].includes(k));
    if (entries.length === 0) return <span className="text-muted-foreground text-xs">—</span>;
    return (
      <div className="flex flex-wrap gap-1 max-w-md">
        {entries.slice(0, 5).map(([key, val]) => (
          <Badge key={key} variant="outline" className="text-[10px] font-normal">
            {key.replace(/_/g, ' ')}: {val === null ? 'null' : String(val).slice(0, 30)}
          </Badge>
        ))}
        {entries.length > 5 && <Badge variant="outline" className="text-[10px]">+{entries.length - 5} more</Badge>}
      </div>
    );
  };

  // Get unique users from the current page of logs for the user filter dropdown
  const uniqueUsers = [...new Set(logs.map((l: any) => l.performed_by).filter(Boolean))];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ScrollText className="h-6 w-6" /> Audit Logs
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Track all data changes across the system</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-4 w-4 text-muted-foreground" />

            <Select value={tableFilter} onValueChange={setTableFilter}>
              <SelectTrigger className="w-[170px] h-9"><SelectValue placeholder="All tables" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tables</SelectItem>
                {TABLE_OPTIONS.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-[130px] h-9"><SelectValue placeholder="All actions" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                {ACTION_OPTIONS.map(a => <SelectItem key={a} value={a} className="capitalize">{a}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger className="w-[170px] h-9"><SelectValue placeholder="All users" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All users</SelectItem>
                {uniqueUsers.map((uid: any) => <SelectItem key={uid} value={uid}>{getUserName(uid)}</SelectItem>)}
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("h-9 gap-2", !fromDate && "text-muted-foreground")}>
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {fromDate ? format(fromDate, 'dd-MMM-yy') : 'From'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={fromDate} onSelect={setFromDate} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("h-9 gap-2", !toDate && "text-muted-foreground")}>
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {toDate ? format(toDate, 'dd-MMM-yy') : 'To'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={toDate} onSelect={setToDate} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>

            {hasFilters && (
              <Button variant="ghost" size="sm" className="h-9 gap-1" onClick={clearFilters}>
                <X className="h-3.5 w-3.5" /> Clear
              </Button>
            )}

            <span className="ml-auto text-xs text-muted-foreground">{totalCount} records</span>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[160px]">Timestamp</TableHead>
              <TableHead className="w-[130px]">Table</TableHead>
              <TableHead className="w-[90px]">Action</TableHead>
              <TableHead className="w-[140px]">User</TableHead>
              <TableHead>Changes</TableHead>
              <TableHead className="w-[100px]">Record ID</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, r) => (
                <TableRow key={r}>{Array.from({ length: 6 }).map((_, c) => <TableCell key={c}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
              ))
            ) : logs.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No audit logs found</TableCell></TableRow>
            ) : (
              logs.map((log: any) => (
                <TableRow key={log.id} className="text-sm">
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(log.performed_at), 'dd-MMM-yy HH:mm')}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] font-mono">{log.table_name?.replace(/_/g, ' ')}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={cn('text-[10px] border-0', actionColors[log.action] || '')}>{log.action}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">{getUserName(log.performed_by)}</TableCell>
                  <TableCell>{renderChanges(log.changes)}</TableCell>
                  <TableCell className="text-[10px] font-mono text-muted-foreground">{log.record_id?.slice(0, 8)}…</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination page={page} totalPages={totalPages} totalCount={totalCount} pageSize={pageSize} setPage={setPage} isLoading={isLoading} />
      </Card>
    </div>
  );
}
