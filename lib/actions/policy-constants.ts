// 8 Core Policy Variables with defaults
export const DEFAULT_POLICIES = {
  default_loan_period_days: { value: "14", description: "Default loan period in days" },
  max_borrow_limit: { value: "5", description: "Maximum books a student can borrow" },
  max_renewal_count: { value: "3", description: "Maximum renewals per borrowing record" },
  hold_expiry_days: { value: "7", description: "Days to hold a reserved book" },
  renewal_period_days: { value: "14", description: "Renewal extends due date by N days" },
  card_validity_years: { value: "4", description: "Library card validity in years" },
  overdue_fine_per_day: { value: "0.50", description: "Fine per day for overdue books (currency)" },
  fine_cap_amount: { value: "50.00", description: "Maximum fine per book (currency)" },
};