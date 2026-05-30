import { computeAuditAccounting, type AuditCounts, type CostsConfig } from '../audit';

const pricing = { entryFeeCAD: 30, charityPortionCAD: 5 };

const costs: CostsConfig = {
  devPerSubmissionCAD: 0.5,
  recurring: [
    { label: 'Hosting', amount: 10 },
    { label: 'AI tooling', amount: 157.5 },
    { label: 'Email', amount: 7 },
    { label: 'Domain', amount: 6 },
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

  it('uses each recurring cost as a flat amount', () => {
    const byLabel = Object.fromEntries(result.costLines.map((l) => [l.label, l.amount]));
    expect(byLabel['Hosting']).toBe(10);
    expect(byLabel['AI tooling']).toBe(157.5);
    expect(byLabel['Email']).toBe(7);
    expect(byLabel['Domain']).toBe(6);
  });

  it('charges dev/management per paid submission', () => {
    const dev = result.costLines.find((l) => l.label === 'Development / Management');
    expect(dev?.amount).toBe(50); // $0.50 × 100
    expect(dev?.detail).toBe('$0.50 × 100 paid');
  });

  it('totals costs and derives net payout / retained margin', () => {
    expect(result.totalCosts).toBe(230.5); // 10 + 157.5 + 7 + 6 + 50
    expect(result.netPayout).toBe(2269.5); // 3000 − 500 − 230.5
    expect(result.retainedMargin).toBe(2269.5);
  });

  it('handles an empty pool — only flat recurring costs remain', () => {
    const zero = computeAuditAccounting({ ...counts, cashPaidCount: 0 }, { pricing, costs });
    expect(zero.grossIncome).toBe(0);
    expect(zero.charity).toBe(0);
    expect(zero.totalCosts).toBe(180.5); // recurring only, dev = 0
    expect(zero.netPayout).toBe(-180.5);
  });
});
