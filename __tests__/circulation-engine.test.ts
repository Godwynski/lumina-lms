import { describe, it, expect } from 'vitest';
import { calculateOverdueFine, canBorrow, canRenew } from '../lib/circulation-engine';
import { subDays, format } from 'date-fns';

const MOCK_POLICY = {
  default_loan_period_days: 14,
  max_borrow_limit: 5,
  max_renewal_count: 3,
  overdue_fine_per_day: 0.50,
  fine_cap_amount: 50.00
};

describe('Circulation Engine: Penalty Calculations', () => {
  it('calculates zero fine if book is returned on time', () => {
    const due = format(new Date(), 'yyyy-MM-dd');
    const returned = format(new Date(), 'yyyy-MM-dd');
    
    expect(calculateOverdueFine(due, returned, MOCK_POLICY)).toBe(0);
  });

  it('calculates fine correctly for 10 days overdue', () => {
    const due = format(subDays(new Date(), 10), 'yyyy-MM-dd');
    const returned = format(new Date(), 'yyyy-MM-dd');
    
    // 10 days * 0.50 = 5.00
    expect(calculateOverdueFine(due, returned, MOCK_POLICY)).toBe(5);
  });

  it('caps the fine based on policy', () => {
    const due = format(subDays(new Date(), 500), 'yyyy-MM-dd'); // 500 days overdue
    const returned = format(new Date(), 'yyyy-MM-dd');
    
    // 500 * 0.50 = 250, but capped at 50
    expect(calculateOverdueFine(due, returned, MOCK_POLICY)).toBe(50);
  });
});

describe('Circulation Engine: Eligibility Checks', () => {
  it('allows borrowing within limits', () => {
    const result = canBorrow(2, false, MOCK_POLICY);
    expect(result.eligible).toBe(true);
  });

  it('blocks borrowing when max limit reached', () => {
    const result = canBorrow(5, false, MOCK_POLICY);
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('Maximum borrow limit reached');
  });

  it('blocks borrowing when user has overdue books', () => {
    const result = canBorrow(1, true, MOCK_POLICY);
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('return overdue books');
  });
});

describe('Circulation Engine: Renewal Logic', () => {
  it('allows renewal when within limits', () => {
    const result = canRenew(0, false, MOCK_POLICY);
    expect(result.eligible).toBe(true);
  });

  it('blocks renewal for overdue books', () => {
    const result = canRenew(0, true, MOCK_POLICY);
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('Overdue books cannot be renewed');
  });

  it('blocks renewal when max count reached', () => {
    const result = canRenew(3, false, MOCK_POLICY);
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('Maximum renewal count reached');
  });
});
