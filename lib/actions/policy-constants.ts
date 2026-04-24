// 8 Core Policy Variables with defaults, categorized and enriched for the UI
export const DEFAULT_POLICIES = {
  loan_period_days: { 
    value: "14", 
    label: "Standard Borrowing Window",
    description: "How many days a student can keep a book before it is marked overdue.",
    example: "Example: If borrowed on Monday, it is due 2 weeks later on Monday.",
    category: "circulation",
    icon: "Calendar"
  },
  max_borrow_limit: { 
    value: "5", 
    label: "Inventory Capacity per Student",
    description: "The total number of books a single student can have at any given time.",
    example: "Example: A student with 5 books must return one before taking another.",
    category: "circulation",
    icon: "BookCopy"
  },
  max_renewal_count: { 
    value: "3", 
    label: "Renewal Allowance",
    description: "How many times a student can extend their own due date.",
    example: "Example: Allows students to keep a popular book for up to 2 extra months.",
    category: "circulation",
    icon: "RotateCw"
  },
  renewal_period_days: { 
    value: "14", 
    label: "Renewal Extension Term",
    description: "Number of days added to the due date upon a successful renewal.",
    example: "Example: A 14-day renewal gives the student 2 more weeks from their current due date.",
    category: "circulation",
    icon: "History"
  },
  hold_expiry_days: { 
    value: "7", 
    label: "Reservation Shelf Life",
    description: "Number of days a reserved book stays on the hold shelf before being released back to inventory.",
    example: "Example: If not picked up within 7 days, the next student in queue gets the book.",
    category: "reservations",
    icon: "Clock"
  },
  max_reservations_per_student: { 
    value: "3", 
    label: "Queue Slot Limit",
    description: "Maximum number of books a student can have on hold simultaneously.",
    example: "Example: Prevents students from 'hogging' the entire upcoming popular catalog.",
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
    label: "Student FAQ Directory",
    description: "Manage the list of frequently asked questions displayed on the student dashboard.",
    category: "support",
    icon: "HelpCircle"
  },
  academic_programs: { 
    value: JSON.stringify(["BS Information Technology", "BS Computer Science", "BS Information Systems", "Associate in Computer Technology", "BS Business Administration", "BS Hospitality Management"]), 
    label: "Academic Program Registry",
    description: "Registry of available academic programs for student onboarding.",
    example: "Example: Add 'BS Nursing' to allow nursing students to register.",
    category: "identity",
    icon: "User"
  },
};

export const DEFAULT_STUDENT_FAQS = JSON.parse(DEFAULT_POLICIES.student_faq_list.value) as { question: string; answer: string }[];
