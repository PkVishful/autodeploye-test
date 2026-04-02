/**
 * Document numbering utility
 * Format: <Property 5 chars>/<FY>/<Month>/<5-digit running number>
 * Example: VISHL/25-26/03/00001
 */

/**
 * Get Indian Financial Year string from a billing month (yyyy-MM)
 * e.g. 2025-03 → "24-25", 2025-04 → "25-26"
 */
export function getFY(billingMonth: string): string {
  const [y, m] = billingMonth.split('-').map(Number);
  // Indian FY: Apr–Mar. If month >= 4 (Apr), FY starts this year
  const fyStart = m >= 4 ? y : y - 1;
  const fyEnd = fyStart + 1;
  return `${String(fyStart).slice(-2)}-${String(fyEnd).slice(-2)}`;
}

/**
 * Get property abbreviation (first 5 chars, uppercase, padded)
 */
export function getPropertyAbbr(propertyName: string): string {
  return propertyName.replace(/\s+/g, '').slice(0, 5).toUpperCase().padEnd(5, 'X');
}

/**
 * Generate invoice numbers for a batch of previews
 * Format: <Prop5>/<FY>/<MM>/00001
 */
export function generateInvoiceNumbers(
  previews: { property_id: string }[],
  billingMonth: string,
  propertyMap: Map<string, string> // property_id → property_name
): string[] {
  const fy = getFY(billingMonth);
  const mm = billingMonth.split('-')[1]; // "03" from "2026-03"
  
  // Group by property to maintain separate running numbers per property
  const counterByProperty = new Map<string, number>();
  
  return previews.map(p => {
    const propName = propertyMap.get(p.property_id) || 'UNKNO';
    const abbr = getPropertyAbbr(propName);
    const count = (counterByProperty.get(p.property_id) || 0) + 1;
    counterByProperty.set(p.property_id, count);
    return `${abbr}/${fy}/${mm}/${String(count).padStart(5, '0')}`;
  });
}

/**
 * Generate a single receipt number
 * Format: <Prop5>/<FY>/<MM>/R00001
 */
export function generateReceiptNumber(
  propertyName: string,
  paymentDate: string, // yyyy-MM-dd
  existingCount: number
): string {
  const [y, m] = paymentDate.split('-').map(Number);
  const billingMonth = `${y}-${String(m).padStart(2, '0')}`;
  const fy = getFY(billingMonth);
  const mm = String(m).padStart(2, '0');
  const abbr = getPropertyAbbr(propertyName);
  return `${abbr}/${fy}/${mm}/R${String(existingCount + 1).padStart(5, '0')}`;
}
