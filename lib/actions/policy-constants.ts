export interface PolicyValidation {
  type: "number" | "json";
  min?: number;
  max?: number;
  step?: number;
}

export interface PolicyConfig {
  value: string;
  label: string;
  description: string;
  example: string;
  category: string;
  icon: string;
  validation?: PolicyValidation;
}

// 8 Core Policy Variables with defaults, categorized and enriched for the UI
export const DEFAULT_POLICIES: Record<string, PolicyConfig> = {
  loan_period_days: { 
    value: "14", 
    label: "Borrowing Duration",
    description: "The number of days a student is allowed to keep a borrowed book before it is marked overdue.",
    example: "Example: 14 days.",
    category: "circulation",
    icon: "Calendar",
    validation: { min: 1, max: 90, type: "number" }
  },
  max_borrow_limit: { 
    value: "5", 
    label: "Maximum Books Allowed",
    description: "The maximum number of physical books a student can have borrowed at the same time.",
    example: "Example: 5 books.",
    category: "circulation",
    icon: "BookCopy",
    validation: { min: 1, max: 20, type: "number" }
  },
  hold_expiry_days: { 
    value: "7", 
    label: "Pickup Hold Window",
    description: "How many days a reserved book stays on the pickup shelf before the reservation is automatically cancelled and offered to the next student.",
    example: "Example: 7 days.",
    category: "reservations",
    icon: "Clock",
    validation: { min: 1, max: 14, type: "number" }
  },
  max_reservations_per_student: { 
    value: "3", 
    label: "Maximum Active Holds",
    description: "The maximum number of book hold requests a student can place at the same time.",
    example: "Example: 3 books.",
    category: "reservations",
    icon: "Ticket",
    validation: { min: 1, max: 10, type: "number" }
  },
  student_faq_list: { 
    value: JSON.stringify([
      { question: "How do I borrow a book?", answer: "Open the catalog, find a title, then present your digital library card QR at the circulation desk for checkout." },
      { question: "What if the catalog says available but I cannot find it?", answer: "Open the book details and use the report action. The librarian queue will be notified for shelf verification." },
      { question: "Can I use the card on my phone only?", answer: "Yes. The QR on your digital card is valid. You can also export a copy from the My Card page if needed." },
      { question: "Where can I see my current borrows?", answer: "Use My Borrowing from the dashboard quick actions to review active and past borrowing records." }
    ]),
    label: "Student Help Center (FAQ)",
    description: "Helpful questions and answers shown in the student dashboard to guide them on borrowing, returns, and library cards.",
    example: "",
    category: "support",
    icon: "HelpCircle",
    validation: { type: "json" }
  },
  academic_programs: { 
    value: JSON.stringify(["BS Information Technology", "BS Computer Science", "BS Information Systems", "Associate in Computer Technology", "BS Business Administration", "BS Hospitality Management"]), 
    label: "Degree Programs & Courses",
    description: "The official college degree programs and courses available for students to select during enrollment and profile setup.",
    example: "Example: BS Information Technology.",
    category: "identity",
    icon: "User",
    validation: { type: "json" }
  },
  due_soon_reminder_days: {
    value: "1",
    label: "Due Date Reminder Timing",
    description: "How many days before the due date the system will email a friendly reminder to the student.",
    example: "Example: 1 day before.",
    category: "broadcasts",
    icon: "Megaphone",
    validation: { min: 1, max: 7, type: "number" }
  }
};

export const DEFAULT_STUDENT_FAQS = JSON.parse(DEFAULT_POLICIES.student_faq_list.value) as { question: string; answer: string }[];
