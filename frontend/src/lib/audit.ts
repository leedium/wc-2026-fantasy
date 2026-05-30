/**
 * Pure accounting layer for the /audit transparency page. All configurable
 * money math lives here (driven by PRICING + OPERATING_COSTS in constants.ts)
 * so it can be unit-tested in isolation and the page stays a thin renderer.
 *
 * Costs are flat per-tournament totals (no per-month / per-year normalization).
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
  /** Flat dollar cost for the tournament. */
  amount: number;
}

export interface CostsConfig {
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
  /** Optional human-readable derivation (e.g. dev cost per submission). */
  detail?: string;
}

export interface AuditAccounting {
  grossIncome: number;
  charity: number;
  costLines: CostLine[];
  totalCosts: number;
  netPayout: number;
  /** Same surplus as netPayout, framed as operator-retained rather than paid out. */
  retainedMargin: number;
}

export function computeAuditAccounting(
  counts: AuditCounts,
  config: { pricing: PricingConfig; costs: CostsConfig }
): AuditAccounting {
  const { pricing, costs } = config;
  const { entryFeeCAD, charityPortionCAD } = pricing;

  const grossIncome = counts.cashPaidCount * entryFeeCAD;
  const charity = counts.cashPaidCount * charityPortionCAD;

  const recurringLines: CostLine[] = costs.recurring.map((c) => ({
    label: c.label,
    amount: c.amount,
  }));

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
    costLines,
    totalCosts,
    netPayout,
    retainedMargin: netPayout,
  };
}
