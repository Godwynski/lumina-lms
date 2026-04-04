import { differenceInDays, parseISO } from 'date-fns';

export interface PolicySettings {
  default_loan_period_days: number;
  max_borrow_limit: number;
  max_renewal_count: number;
  overdue_fine_per_day: number;
  fine_cap_amount: number;
}

/**
 * Calculates the fine for an overdue book.
 * 
 * Logic:
 * 1. Calculate days between due date and return date (or today).
 * 2. Multiply by daily rate.
 * 3. Cap the total fine based on policy.
 */
export function calculateOverdueFine(
  dueDate: string | Date,
  returnDate: string | Date = new Date(),
  policy: Pick<PolicySettings, 'overdue_fine_per_day' | 'fine_cap_amount'>
): number {
  const due = typeof dueDate === 'string' ? parseISO(dueDate) : dueDate;
  const returned = typeof returnDate === 'string' ? parseISO(returnDate) : returnDate;

  if (returned <= due) return 0;

  const daysOverdue = differenceInDays(returned, due);
  const calculatedFine = daysOverdue * policy.overdue_fine_per_day;

  return Math.min(calculatedFine, policy.fine_cap_amount);
}

/**
 * Validates if a user is eligible to borrow a new book.
 * 
 * Logic:
 * 1. Check if user has reached max borrow limit.
 * 2. Check if user has active "Overdue" status loans.
 * 3. Check if user has unpaid fines exceeding threshold (implied logic).
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
