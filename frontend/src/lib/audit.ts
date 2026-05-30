/**
 * Pure accounting layer for the /audit transparency page. All configurable
 * money math lives here (driven by PRICING + OPERATING_COSTS in constants.ts)
 * so it can be unit-tested in isolation and the page stays a thin renderer.
 */

export interface AuditCounts {
  totalRegistrations: number;
  usersWithPaidPrediction: number;
  totalEntries: number;
  cashPaidCount: number;
  freeEntries: number;
  referralCreditsRedeemed: number;
  loyaltyCreditsRedeemed: number;
}

export interface RecurringCost {
  label: string;
  amount: number;
  cadence: 'monthly' | 'yearly' | 'multiYear';
  /** Required for `multiYear` cadence. */
  years?: number;
  /** Share of a shared subscription billed to this project (default 1). */
  attributionPct?: number;
}

export interface CostsConfig {
  overheadMonths: number;
  devPerSubmissionCAD: number;
  recurring: ReadonlyArray<RecurringCost>;
}

export interface PricingConfig {
  entryFeeCAD: number;
  charityPortionCAD: number;
}

export interface CostLine {
  label: string;
  amount: number;
  /** Human-readable derivation, e.g. "$157.50/mo × 50% × 24 mo". */
  detail: string;
}

export interface AuditAccounting {
  grossIncome: number;
  charity: number;
  overheadMonths: number;
  /** Effective combined overhead per month (recurring only, dev excluded). */
  monthlyOverhead: number;
  costLines: CostLine[];
  totalCosts: number;
  netPayout: number;
  /** Same surplus as netPayout, framed as operator-retained rather than paid out. */
  retainedMargin: number;
}

/** Normalize a recurring cost to a per-month rate before attribution. */
function monthlyEquivalent(c: RecurringCost): number {
  switch (c.cadence) {
    case 'monthly':
      return c.amount;
    case 'yearly':
      return c.amount / 12;
    case 'multiYear':
      return c.amount / ((c.years ?? 1) * 12);
  }
}

function cadenceLabel(c: RecurringCost): string {
  switch (c.cadence) {
    case 'monthly':
      return `$${c.amount.toFixed(2)}/mo`;
    case 'yearly':
      return `$${c.amount.toFixed(2)}/yr`;
    case 'multiYear':
      return `$${c.amount.toFixed(2)}/${c.years ?? 1}yr`;
  }
}

export function computeAuditAccounting(
  counts: AuditCounts,
  config: { pricing: PricingConfig; costs: CostsConfig }
): AuditAccounting {
  const { pricing, costs } = config;
  const { entryFeeCAD, charityPortionCAD } = pricing;
  const { overheadMonths } = costs;

  const grossIncome = counts.cashPaidCount * entryFeeCAD;
  const charity = counts.cashPaidCount * charityPortionCAD;

  let monthlyOverhead = 0;
  const recurringLines: CostLine[] = costs.recurring.map((c) => {
    const pct = c.attributionPct ?? 1;
    const effectiveMonthly = monthlyEquivalent(c) * pct;
    monthlyOverhead += effectiveMonthly;
    const pctPart = pct === 1 ? '' : ` × ${Math.round(pct * 100)}%`;
    return {
      label: c.label,
      amount: effectiveMonthly * overheadMonths,
      detail: `${cadenceLabel(c)}${pctPart} × ${overheadMonths} mo`,
    };
  });

  const dev = costs.devPerSubmissionCAD * counts.cashPaidCount;
  const devLine: CostLine = {
    label: 'Development / Management',
    amount: dev,
    detail: `$${costs.devPerSubmissionCAD.toFixed(2)} × ${counts.cashPaidCount} paid`,
  };

  const costLines = [...recurringLines, devLine];
  const totalCosts = costLines.reduce((sum, l) => sum + l.amount, 0);
  const netPayout = grossIncome - charity - totalCosts;

  return {
    grossIncome,
    charity,
    overheadMonths,
    monthlyOverhead,
    costLines,
    totalCosts,
    netPayout,
    retainedMargin: netPayout,
  };
}
