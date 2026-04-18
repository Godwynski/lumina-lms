import { describe, it, expect } from 'vitest';
import { canBorrow, canRenew } from '../lib/circulation-engine';

const MOCK_POLICY = {
  default_loan_period_days: 14,
  max_borrow_limit: 5,
  max_renewal_count: 3,
};



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
