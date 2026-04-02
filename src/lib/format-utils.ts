/**
 * Format a number as Indian-style currency: ₹1,23,456.00
 */
export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '₹0.00';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format a number with commas and 2 decimal places: 1,23,456.00
 */
export function formatDecimal(value: number | null | undefined): string {
  if (value == null) return '0.00';
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format a number as integer with commas: 1,23,456
 */
export function formatInteger(value: number | null | undefined): string {
  if (value == null) return '0';
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}
