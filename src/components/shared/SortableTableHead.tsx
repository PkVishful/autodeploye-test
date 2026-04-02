import { useState, useCallback } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { TableHead } from '@/components/ui/table';
import { cn } from '@/lib/utils';

export type SortDirection = 'asc' | 'desc' | null;
export type SortConfig = { key: string; direction: SortDirection };

interface SortableTableHeadProps {
  label: string;
  sortKey: string;
  sortConfig: SortConfig;
  onSort: (key: string) => void;
  className?: string;
}

export function SortableTableHead({ label, sortKey, sortConfig, onSort, className }: SortableTableHeadProps) {
  const isActive = sortConfig.key === sortKey;
  return (
    <TableHead
      className={cn('cursor-pointer select-none hover:text-foreground transition-colors', className)}
      onClick={() => onSort(sortKey)}
    >
      <div className="flex items-center gap-1">
        {label}
        {isActive && sortConfig.direction === 'asc' ? (
          <ArrowUp className="h-3.5 w-3.5 text-primary" />
        ) : isActive && sortConfig.direction === 'desc' ? (
          <ArrowDown className="h-3.5 w-3.5 text-primary" />
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 opacity-30" />
        )}
      </div>
    </TableHead>
  );
}

// ISO date pattern: 2024-01-15 or 2024-01-15T...
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}/;
// Purely numeric string (integers or decimals, optional sign)
const NUMERIC_RE = /^-?\d+(\.\d+)?$/;

function compareValues(valA: any, valB: any, direction: 'asc' | 'desc'): number {
  // Nulls always last
  if (valA == null && valB == null) return 0;
  if (valA == null) return 1;
  if (valB == null) return -1;

  const strA = String(valA).trim();
  const strB = String(valB).trim();

  // Both are numbers natively
  if (typeof valA === 'number' && typeof valB === 'number') {
    return direction === 'asc' ? valA - valB : valB - valA;
  }

  // Both look like ISO dates
  if (ISO_DATE_RE.test(strA) && ISO_DATE_RE.test(strB)) {
    const tA = new Date(strA).getTime();
    const tB = new Date(strB).getTime();
    if (!isNaN(tA) && !isNaN(tB)) {
      return direction === 'asc' ? tA - tB : tB - tA;
    }
  }

  // Both are purely numeric strings
  if (NUMERIC_RE.test(strA) && NUMERIC_RE.test(strB)) {
    const nA = parseFloat(strA);
    const nB = parseFloat(strB);
    return direction === 'asc' ? nA - nB : nB - nA;
  }

  // Fallback: locale string compare
  const cmp = strA.toLowerCase().localeCompare(strB.toLowerCase());
  return direction === 'asc' ? cmp : -cmp;
}

export function useSort(defaultKey = '', defaultDir: SortDirection = null) {
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: defaultKey, direction: defaultDir });

  const handleSort = (key: string) => {
    setSortConfig(prev => {
      if (prev.key === key) {
        if (prev.direction === 'asc') return { key, direction: 'desc' };
        if (prev.direction === 'desc') return { key: '', direction: null };
        return { key, direction: 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const sortData = useCallback(<T extends Record<string, any>>(data: T[], getVal?: (item: T, key: string) => any): T[] => {
    if (!sortConfig.key || !sortConfig.direction) return data;
    return [...data].sort((a, b) => {
      const valA = getVal ? getVal(a, sortConfig.key) : a[sortConfig.key];
      const valB = getVal ? getVal(b, sortConfig.key) : b[sortConfig.key];
      return compareValues(valA, valB, sortConfig.direction!);
    });
  }, [sortConfig]);

  return { sortConfig, handleSort, sortData };
}
