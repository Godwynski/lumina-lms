
export interface PolicySettings {
  default_loan_period_days: number;
  max_borrow_limit: number;
  max_renewal_count: number;
}



/**
 * Validates if a user is eligible to borrow a new book.
 * 
 * Logic:
 * 1. Check if user has reached max borrow limit.
 * 2. Check if user has active "Overdue" status loans.
 */
export function canBorrow(
  currentLoanCount: number,
  hasOverdueBooks: boolean,
  policy: Pick<PolicySettings, 'max_borrow_limit'>
): { eligible: boolean; reason?: string } {
  if (currentLoanCount >= policy.max_borrow_limit) {
    return { eligible: false, reason: 'Maximum borrow limit reached.' };
  }

  if (hasOverdueBooks) {
    return { eligible: false, reason: 'Please return overdue books before borrowing more.' };
  }

  return { eligible: true };
}

/**
 * Validates if a loan can be renewed.
 * 
 * Logic:
 * 1. Check if book is already overdue (usually prevents self-renewal).
 * 2. Check if max renewal count is reached.
 */
export function canRenew(
  renewalCount: number,
  isOverdue: boolean,
  policy: Pick<PolicySettings, 'max_renewal_count'>
): { eligible: boolean; reason?: string } {
  if (isOverdue) {
    return { eligible: false, reason: 'Overdue books cannot be renewed online.' };
  }

  if (renewalCount >= policy.max_renewal_count) {
    return { eligible: false, reason: 'Maximum renewal count reached.' };
  }

  return { eligible: true };
}
