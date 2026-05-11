// 8 Core Policy Variables with defaults, categorized and enriched for the UI
export const DEFAULT_POLICIES = {
  loan_period_days: { 
    value: "14", 
    label: "Borrowing Period",
    description: "Standard duration for book borrows.",
    example: "Example: 14 days.",
    category: "circulation",
    icon: "Calendar"
  },
  max_borrow_limit: { 
    value: "5", 
    label: "Max Borrows",
    description: "Maximum books a student can borrow at once.",
    example: "Example: 5 books.",
    category: "circulation",
    icon: "BookCopy"
  },
  max_renewal_count: { 
    value: "3", 
    label: "Max Renewals",
    description: "Number of times a borrow can be extended.",
    example: "Example: 3 times.",
    category: "circulation",
    icon: "RotateCw"
  },
  renewal_period_days: { 
    value: "14", 
    label: "Renewal Period",
    description: "Days added per renewal.",
    example: "Example: 14 days.",
    category: "circulation",
    icon: "History"
  },
  hold_expiry_days: { 
    value: "7", 
    label: "Hold Shelf Life",
    description: "Days a reserved book stays on hold.",
    example: "Example: 7 days.",
    category: "reservations",
    icon: "Clock"
  },
  max_reservations_per_student: { 
    value: "3", 
    label: "Max Reservations",
    description: "Maximum concurrent book reservations.",
    example: "Example: 3 books.",
    category: "reservations",
    icon: "Ticket"
  },
  student_faq_list: { 
    value: JSON.stringify([
      { question: "How do I borrow a book?", answer: "Open the catalog, find a title, then present your digital library card QR at the circulation desk for checkout." },
      { question: "What if the catalog says available but I cannot find it?", answer: "Open the book details and use the report action. The librarian queue will be notified for shelf verification." },
      { question: "Can I use the card on my phone only?", answer: "Yes. The QR on your digital card is valid. You can also export a copy from the My Card page if needed." },
      { question: "Where can I see my current borrows?", answer: "Use Borrow History from the dashboard quick actions to review active and past borrowing records." }
    ]),
    label: "FAQ Management",
    description: "Questions shown on the student dashboard.",
    example: "",
    category: "support",
    icon: "HelpCircle"
  },
  academic_programs: { 
    value: JSON.stringify(["BS Information Technology", "BS Computer Science", "BS Information Systems", "Associate in Computer Technology", "BS Business Administration", "BS Hospitality Management"]), 
    label: "Academic Programs",
    description: "List of programs for student registration.",
    example: "Example: BS Information Technology.",
    category: "identity",
    icon: "User"
  },
  due_soon_reminder_days: {
    value: "1",
    label: "Reminder Offset",
    description: "Days before due date to send reminder.",
    example: "Example: 1 day.",
    category: "broadcasts",
    icon: "Megaphone"
  }
};

export const DEFAULT_STUDENT_FAQS = JSON.parse(DEFAULT_POLICIES.student_faq_list.value) as { question: string; answer: string }[];
