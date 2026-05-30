import { computeAuditAccounting, type AuditCounts, type CostsConfig } from '../audit';

const pricing = { entryFeeCAD: 30, charityPortionCAD: 5 };

const costs: CostsConfig = {
  overheadMonths: 24,
  devPerSubmissionCAD: 0.5,
  recurring: [
    { label: 'Hosting', amount: 5, cadence: 'monthly' },
    { label: 'AI tooling', amount: 157.5, cadence: 'monthly', attributionPct: 0.5 },
    { label: 'Email', amount: 40, cadence: 'yearly' },
    { label: 'Domain', amount: 150, cadence: 'multiYear', years: 4 },
  ],
};

const counts: AuditCounts = {
  totalRegistrations: 120,
  usersWithPaidPrediction: 60,
  totalEntries: 110,
  cashPaidCount: 100,
  freeEntries: 10,
  referralCreditsRedeemed: 4,
  loyaltyCreditsRedeemed: 3,
};

describe('computeAuditAccounting', () => {
  const result = computeAuditAccounting(counts, { pricing, costs });

  it('computes revenue and charity from cash-paid entries', () => {
    expect(result.grossIncome).toBe(3000); // 100 × $30
    expect(result.charity).toBe(500); // 100 × $5
  });

  it('normalizes each recurring cost cadence and applies attribution + overhead months', () => {
    const byLabel = Object.fromEntries(result.costLines.map((l) => [l.label, l.amount]));
    expect(byLabel['Hosting']).toBe(120); // $5/mo × 24
    expect(byLabel['AI tooling']).toBe(1890); // $157.50/mo × 50% × 24
    expect(byLabel['Email']).toBe(80); // ($40/12)/mo × 24
    expect(byLabel['Domain']).toBe(75); // ($150/48)/mo × 24
  });

  it('charges dev/management per paid submission', () => {
    const dev = result.costLines.find((l) => l.label === 'Development / Management');
    expect(dev?.amount).toBe(50); // $0.50 × 100
    expect(dev?.detail).toBe('$0.50 × 100 paid');
  });

  it('annotates each line with its derivation', () => {
    const byLabel = Object.fromEntries(result.costLines.map((l) => [l.label, l.detail]));
    expect(byLabel['AI tooling']).toBe('$157.50/mo × 50% × 24 mo');
    expect(byLabel['Email']).toBe('$40.00/yr × 24 mo');
    expect(byLabel['Domain']).toBe('$150.00/4yr × 24 mo');
  });

  it('totals costs and derives net payout / retained margin', () => {
    expect(result.totalCosts).toBe(2215); // 120 + 1890 + 80 + 75 + 50
    expect(result.netPayout).toBe(285); // 3000 − 500 − 2215
    expect(result.retainedMargin).toBe(285);
    expect(result.monthlyOverhead).toBeCloseTo(90.2083, 3); // 5 + 78.75 + 3.333 + 3.125
  });

  it('handles an empty pool without dividing by zero', () => {
    const zero = computeAuditAccounting(
      { ...counts, cashPaidCount: 0 },
      { pricing, costs }
    );
    expect(zero.grossIncome).toBe(0);
    expect(zero.charity).toBe(0);
    // Recurring overhead is fixed regardless of entries; net payout goes negative.
    expect(zero.totalCosts).toBe(2165);
    expect(zero.netPayout).toBe(-2165);
  });
});
