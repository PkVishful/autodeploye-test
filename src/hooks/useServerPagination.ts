import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface Filter {
  column: string;
  value: string;
}

interface UseServerPaginationOptions {
  table: string;
  select?: string;
  pageSize?: number;
  filters?: Filter[];
  search?: { column: string; term: string } | null;
  searchColumns?: string[];
  searchTerm?: string;
  orderBy?: { column: string; ascending?: boolean };
  enabled?: boolean;
  queryKey?: string[];
}

export function useServerPagination<T = any>({
  table,
  select = '*',
  pageSize = 25,
  filters = [],
  search = null,
  searchColumns,
  searchTerm,
  orderBy = { column: 'created_at', ascending: false },
  enabled = true,
  queryKey = [],
}: UseServerPaginationOptions) {
  const [page, setPage] = useState(0);

  // Reset page when filters/search change
  const filterKey = JSON.stringify(filters);
  const searchKey = search?.term || searchTerm || '';
  const prevFilterRef = useRef(filterKey);
  const prevSearchRef = useRef(searchKey);

  useEffect(() => {
    if (prevFilterRef.current !== filterKey || prevSearchRef.current !== searchKey) {
      setPage(0);
      prevFilterRef.current = filterKey;
      prevSearchRef.current = searchKey;
    }
  }, [filterKey, searchKey]);

  const effectiveQueryKey = [
    'paginated',
    table,
    page,
    pageSize,
    filterKey,
    searchKey,
    JSON.stringify(orderBy),
    ...queryKey,
  ];

  const { data: result, isLoading, error } = useQuery({
    queryKey: effectiveQueryKey,
    queryFn: async () => {
      const from = page * pageSize;
      const to = from + pageSize - 1;

      let q = supabase
        .from(table as any)
        .select(select, { count: 'exact' })
        .order(orderBy.column, { ascending: orderBy.ascending ?? false })
        .range(from, to);

      // Apply filters
      for (const f of filters) {
        if (f.value && f.value !== 'all') {
          q = q.eq(f.column, f.value) as any;
        }
      }

      // Multi-column search via .or()
      if (searchColumns && searchColumns.length > 0 && searchTerm?.trim()) {
        const term = searchTerm.trim();
        const orClause = searchColumns.map(col => `${col}.ilike.%${term}%`).join(',');
        q = q.or(orClause) as any;
      }
      // Single-column search (legacy)
      else if (search?.term && search.term.trim()) {
        q = q.ilike(search.column, `%${search.term.trim()}%`) as any;
      }

      const { data, error, count } = await q;
      if (error) throw error;
      return { data: (data || []) as T[], totalCount: count || 0 };
    },
    enabled,
  });

  const totalCount = result?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  return {
    data: (result?.data || []) as T[],
    totalCount,
    totalPages,
    isLoading,
    error,
    page,
    setPage,
    pageSize,
    hasNextPage: page < totalPages - 1,
    hasPrevPage: page > 0,
  };
}
