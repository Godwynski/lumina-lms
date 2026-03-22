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
  faq_student_q1: { value: "How do I borrow a book?", description: "Student FAQ #1 question" },
  faq_student_a1: { value: "Open the catalog, find a title, then present your digital library card QR at the circulation desk for checkout.", description: "Student FAQ #1 answer" },
  faq_student_q2: { value: "What if the catalog says available but I cannot find it?", description: "Student FAQ #2 question" },
  faq_student_a2: { value: "Open the book details and use the report action. The librarian queue will be notified for shelf verification.", description: "Student FAQ #2 answer" },
  faq_student_q3: { value: "Can I use the card on my phone only?", description: "Student FAQ #3 question" },
  faq_student_a3: { value: "Yes. The QR on your digital card is valid. You can also export a copy from the My Card page if needed.", description: "Student FAQ #3 answer" },
  faq_student_q4: { value: "Where can I see my current loans?", description: "Student FAQ #4 question" },
  faq_student_a4: { value: "Use Loan History from the dashboard quick actions to review active and past borrowing records.", description: "Student FAQ #4 answer" },
};

export const DEFAULT_STUDENT_FAQS = [
  {
    question: DEFAULT_POLICIES.faq_student_q1.value,
    answer: DEFAULT_POLICIES.faq_student_a1.value,
  },
  {
    question: DEFAULT_POLICIES.faq_student_q2.value,
    answer: DEFAULT_POLICIES.faq_student_a2.value,
  },
  {
    question: DEFAULT_POLICIES.faq_student_q3.value,
    answer: DEFAULT_POLICIES.faq_student_a3.value,
  },
  {
    question: DEFAULT_POLICIES.faq_student_q4.value,
    answer: DEFAULT_POLICIES.faq_student_a4.value,
  },
] as const;
