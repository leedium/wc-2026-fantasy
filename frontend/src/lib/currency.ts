/**
 * Shared CAD currency formatting. Consolidates the `Intl.NumberFormat('en-CA',
 * …)` pattern that's otherwise duplicated across PoolStatsBar / AdminDashboard /
 * HomePageContent.
 *
 * By default whole-dollar (no cents) to match the existing pot/charity display;
 * pass `{ cents: true }` for two-decimal amounts (fractional cost lines, etc.).
 */
const WHOLE = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
  maximumFractionDigits: 0,
});

const CENTS = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCAD(value: number, opts?: { cents?: boolean }): string {
  return (opts?.cents ? CENTS : WHOLE).format(value);
}
