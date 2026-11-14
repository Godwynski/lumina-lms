// Synthetic evaluation identities shared by provisioning and the demo buttons.
// These are application fixtures, not institutional Microsoft accounts.
export type DemoAccount = {
  email: string;
  legacyEmail: string;
  label: string;
  fullName: string;
  role: 'super_admin' | 'librarian' | 'student_assistant' | 'student';
  studentId: string;
  department: string;
  phone: string;
  address: string;
  cardNumber: string;
  permissions: {
    manage_circulation: boolean;
    manage_attendance: boolean;
    view_admin_dashboard: boolean;
  };
};

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    email: 'demo.aquino@alabang.sti.edu.ph', legacyEmail: 'admin@lumina.test',
    label: 'Super Admin', fullName: 'Teresita Aquino', role: 'super_admin',
    studentId: 'FAC-DEMO.AQUINO', department: 'Library Services',
    phone: '+63 917 555 0101', address: 'STI College Alabang, Muntinlupa City (demo)',
    cardNumber: 'DEMO-ADM-001',
    permissions: { manage_circulation: true, manage_attendance: true, view_admin_dashboard: true },
  },
  {
    email: 'demo.galang@alabang.sti.edu.ph', legacyEmail: 'librarian@lumina.test',
    label: 'Librarian', fullName: 'Benedict Galang', role: 'librarian',
    studentId: 'FAC-DEMO.GALANG', department: 'Library Services',
    phone: '+63 917 555 0102', address: 'STI College Alabang, Muntinlupa City (demo)',
    cardNumber: 'DEMO-LIB-001',
    permissions: { manage_circulation: true, manage_attendance: true, view_admin_dashboard: true },
  },
  {
    email: 'demo.marasigan.20230148@alabang.sti.edu.ph', legacyEmail: 'staff@lumina.test',
    label: 'Student Assistant', fullName: 'Kaye Marasigan', role: 'student_assistant',
    studentId: 'STU-20230148', department: 'BS Information Technology',
    phone: '+63 917 555 0103', address: 'Alabang, Muntinlupa City (demo)',
    cardNumber: 'DEMO-STF-001',
    permissions: { manage_circulation: true, manage_attendance: true, view_admin_dashboard: true },
  },
  {
    email: 'demo.bautista.20220271@alabang.sti.edu.ph', legacyEmail: 'student@lumina.test',
    label: 'Student', fullName: 'Paolo Ian Bautista', role: 'student',
    studentId: 'STU-20220271', department: 'BS Computer Science',
    phone: '+63 917 555 0104', address: 'Cupang, Muntinlupa City (demo)',
    cardNumber: 'DEMO-STU-001',
    permissions: { manage_circulation: false, manage_attendance: false, view_admin_dashboard: false },
  },
];
