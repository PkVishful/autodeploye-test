import { supabase } from '@/integrations/supabase/client';

/**
 * Fetches all rows from a Supabase query, paginating in batches of 1000
 * to bypass the default 1000-row limit.
 * 
 * @param queryBuilder - A function that receives (from, to) range params and returns a Supabase query
 * @param pageSize - Number of rows per batch (default 1000)
 * @returns All rows combined
 */
export async function fetchAllRows<T = any>(
  queryBuilder: (from: number, to: number) => any,
  pageSize = 1000
): Promise<T[]> {
  const allData: T[] = [];
  const seenIds = new Set<string>();
  let from = 0;
  while (true) {
    const { data, error } = await queryBuilder(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const row of data) {
      const key = (row as any)?.id;
      if (key && seenIds.has(key)) continue;
      if (key) seenIds.add(key);
      allData.push(row);
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return allData;
}
