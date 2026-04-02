

## Proportional Rental & Expense Allocation at Bed Level

### Problem
Currently, the bed-level drill-down in profitability shows only direct bed expenses and no rental cost column. The user wants:
1. **Rental column** at bed level — split the apartment's total rental proportionally based on each bed's maximum revenue potential (bed rate) relative to the total apartment revenue potential.
2. **Expense allocation** — bed-specific expenses go directly to that bed; apartment-level expenses (where `apartment_id` is set but `bed_id` is null) are split proportionally using the same ratio.

### Formula
For apartment with rental = ₹35,000 and 5 beds with rates totaling ₹79,500:
- Bed rental share = (bed_rate / sum_of_all_bed_rates) × apartment_rental
- Bed shared expense = (bed_rate / sum_of_all_bed_rates) × apartment-level_expense

### Changes

**1. Pass `bedRates` to ProfitabilityTab**
- In `Accounting.tsx`, add `bedRates={data.bedRates}` prop.
- Update the `Props` interface in `ProfitabilityTab.tsx` to accept `bedRates`.

**2. Compute bed rate lookup in `bedData` memo**
For each bed in the selected apartment:
- Look up the current applicable rate from `bedRates` (matching `bed_type`, `toilet_type`, and property, with date range check).
- Sum all bed rates for the apartment to get the total potential revenue.
- Compute each bed's **weight** = `bed_rate / total_apartment_rate`.

**3. Split rental proportionally**
- Get the apartment's total rental from `ownerPayments` (already computed in `apartmentData`).
- Each bed's rental share = weight × apartment rental.

**4. Split expenses correctly**
- **Direct expenses** (where `bed_id === bed.id`): assigned fully to that bed.
- **Shared apartment expenses** (where `apartment_id === selectedApartmentId` AND `bed_id` is null): split proportionally using the same weight.
- Total bed expense = direct + proportional share of apartment-level expenses.

**5. Update bed-level table UI**
- Add "Rental Cost" column at bed level (currently hidden with `drillLevel !== 'bed'` condition).
- Add "Bed Type" column for clarity.
- Update profit calculation: `profit = revenue - totalExpense - rentalShare`.
- Update totals row to include rental cost sum.

### Technical Detail — Rate Lookup
```
function getBedRate(bed, bedRates, propertyId): number {
  // Find rate matching bed_type, toilet_type, property_id 
  // where from_date <= today and (to_date is null or to_date >= today)
  // Fall back to rate without property_id filter
  return matchedRate?.monthly_rate || 0;
}
```

### Files Modified
- `src/pages/Accounting.tsx` — pass `bedRates` prop
- `src/components/accounting/ProfitabilityTab.tsx` — all logic and UI changes

