// 8 Core Policy Variables with defaults, categorized and enriched for the UI
export const DEFAULT_POLICIES = {
  loan_period_days: { 
    value: "14", 
    description: "How many days a student can keep a book before it is marked overdue.",
    category: "circulation",
    icon: "Calendar"
  },
  max_borrow_limit: { 
    value: "5", 
    description: "The total number of books a single student can have at any given time.",
    category: "circulation",
    icon: "BookCopy"
  },
  max_renewal_count: { 
    value: "3", 
    description: "How many times a student can extend their own due date.",
    category: "circulation",
    icon: "RotateCw"
  },
  renewal_period_days: { 
    value: "14", 
    description: "Number of days added to the due date upon a successful renewal.",
    category: "circulation",
    icon: "History"
  },
  hold_expiry_days: { 
    value: "7", 
    description: "Number of days a reserved book stays on the hold shelf before being released back to inventory.",
    category: "reservations",
    icon: "Clock"
  },
  max_reservations_per_student: { 
    value: "3", 
    description: "Maximum number of books a student can have on hold simultaneously.",
    category: "reservations",
    icon: "Ticket"
  },
  faq_student_q1: { value: "How do I borrow a book?", description: "Student FAQ #1 question", category: "support", icon: "HelpCircle" },
  faq_student_a1: { value: "Open the catalog, find a title, then present your digital library card QR at the circulation desk for checkout.", description: "Student FAQ #1 answer", category: "support", icon: "MessageSquare" },
  faq_student_q2: { value: "What if the catalog says available but I cannot find it?", description: "Student FAQ #2 question", category: "support", icon: "HelpCircle" },
  faq_student_a2: { value: "Open the book details and use the report action. The librarian queue will be notified for shelf verification.", description: "Student FAQ #2 answer", category: "support", icon: "MessageSquare" },
  faq_student_q3: { value: "Can I use the card on my phone only?", description: "Student FAQ #3 question", category: "support", icon: "HelpCircle" },
  faq_student_a3: { value: "Yes. The QR on your digital card is valid. You can also export a copy from the My Card page if needed.", description: "Student FAQ #3 answer", category: "support", icon: "MessageSquare" },
  faq_student_q4: { value: "Where can I see my current borrows?", description: "Student FAQ #4 question", category: "support", icon: "HelpCircle" },
  faq_student_a4: { value: "Use Borrow History from the dashboard quick actions to review active and past borrowing records.", description: "Student FAQ #4 answer", category: "support", icon: "MessageSquare" },
  academic_programs: { 
    value: "BS Information Technology, BS Computer Science, BS Information Systems, Associate in Computer Technology, BS Business Administration, BS Hospitality Management", 
    description: "Comma-separated list of available academic programs for student onboarding.",
    category: "identity",
    icon: "User"
  },
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
