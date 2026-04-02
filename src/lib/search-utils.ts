const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SKIP_KEYS = new Set(['id', 'created_at', 'updated_at', 'organization_id']);

/**
 * Search an explicit set of display-ready string values against a query.
 * Use this for table rows where you control what's searchable.
 */
export function searchDisplayValues(values: (string | number | null | undefined)[], query: string): boolean {
  if (!query || !query.trim()) return true;
  const q = query.toLowerCase().trim();
  return values.some(v => {
    if (v == null) return false;
    return String(v).toLowerCase().includes(q);
  });
}

/**
 * Universal search: searches all string/number values in an object (depth 1)
 * against the given query. Skips UUIDs and internal fields.
 */
export function searchAllFields(item: any, query: string): boolean {
  if (!query || !query.trim()) return true;
  const q = query.toLowerCase().trim();

  function matchValue(val: any, key: string | null, depth: number): boolean {
    if (depth > 1) return false;
    if (val == null) return false;
    if (key && (SKIP_KEYS.has(key) || key.endsWith('_id'))) return false;
    if (typeof val === 'string') {
      if (UUID_RE.test(val)) return false;
      return val.toLowerCase().includes(q);
    }
    if (typeof val === 'number') return val.toString().includes(q);
    if (Array.isArray(val)) return val.some((v) => matchValue(v, null, depth + 1));
    if (typeof val === 'object') {
      return Object.entries(val).some(([k, v]) => matchValue(v, k, depth + 1));
    }
    return false;
  }

  return matchValue(item, null, 0);
}
