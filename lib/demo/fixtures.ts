import { createHash } from 'node:crypto';

function fixtureId(kind: string, number: number) {
  const hash = createHash('sha256').update(`lumina-capstone:${kind}:${number}`).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

const subjects = [
  'Computer Science', 'Data Structures', 'Database Design', 'Web Development',
  'Cybersecurity', 'Mathematics', 'Statistics', 'Physics', 'Communication',
  'Philippine History', 'Business Management', 'Software Engineering',
];
const series = ['Foundations', 'Workbook', 'Case Studies', 'Reference Guide', 'Practical Methods', 'Research Readings',
  'Introduction', 'Advanced Topics', 'Field Guide', 'Practice Problems', 'Laboratory Manual', 'Review Notes'];

export function buildDemoFixtures(ids: { patron: string; librarian: string; borrower: string }, now: Date) {
  const date = (days: number, hours = 0) => new Date(now.getTime() + days * 86400000 + hours * 3600000).toISOString();
  const categories = subjects.map((name, index) => ({
    id: fixtureId('category', index), name: `Demo ${name}`, slug: `capstone-demo-${index + 1}`,
  }));
  const books = series.flatMap((label, group) => subjects.map((subject, index) => ({
    id: fixtureId('title', group * subjects.length + index),
    title: `${subject} ${label}`,
    author: `Lumina Demo Collection ${index + 1}`,
    category_id: categories[index].id,
    location: `Shelf ${index + 1}`,
    description: 'Synthetic catalog record for capstone evaluation.',
  })));
  const copies = books.flatMap((book, index) => Array.from({ length: 3 }, (_, copy) => ({
    id: fixtureId('copy', index * 3 + copy),
    book_id: book.id,
    status: index === 120 ? 'BORROWED' : index >= 112 && index <= 117 && copy === 0
      ? 'BORROWED' : index >= 121 && index < 128 && copy === 0 ? 'RESERVED' : 'AVAILABLE',
    condition: 'GOOD',
  })));
  const loanCopies = [...copies.filter(copy => copy.status === 'BORROWED'),
    ...copies.filter(copy => copy.status === 'AVAILABLE').slice(0, 111)];
  const loans = loanCopies.map((copy, index) => {
    const returned = copy.status === 'AVAILABLE';
    const overdue = index < 3;
    const resolved = returned && index % 9 === 0;
    const borrowed = returned ? -(8 + index % 84) : overdue ? -17 : -3;
    return {
      id: fixtureId('loan', index),
      user_id: returned ? ids.patron : ids.borrower,
      book_copy_id: copy.id,
      processed_by: ids.librarian,
      borrowed_at: date(borrowed),
      due_date: date(borrowed + 7),
      returned_at: returned ? date(borrowed + (resolved ? 9 : 4)) : null,
      returned_by: returned ? ids.librarian : null,
      status: returned ? 'RETURNED' : overdue ? 'OVERDUE' : 'ACTIVE',
      fine_amount: overdue ? 50 : resolved ? 10 : 0,
      fine_resolution: resolved ? (index % 2 ? 'PAID' : 'CONDONED') : null,
      fine_settled_at: resolved ? date(borrowed + 9) : null,
      fine_settled_by: resolved ? ids.librarian : null,
      fine_remarks: resolved ? 'Synthetic settlement for capstone evaluation' : null,
      reminder_sent: true,
      overdue_notified: true,
    };
  });
  const reservations = [120, 121, 122, 123, 124, 125, 126, 127].map((index, position) => ({
    id: fixtureId('reservation', position),
    user_id: index < 123 ? ids.patron : ids.borrower,
    book_id: books[index].id,
    copy_id: index === 120 ? null : copies[index * 3].id,
    status: index === 120 ? 'ACTIVE' : 'READY',
    queue_position: 1,
    reserved_at: date(-1),
    hold_expires_at: index === 120 ? null : date(3),
  }));
  const attendance = Array.from({ length: 180 }, (_, index) => ({
    id: fixtureId('visit', index),
    user_id: index % 2 ? ids.patron : ids.borrower,
    check_in_at: date(-1 - Math.floor(index / 2), index % 5),
    check_out_at: date(-1 - Math.floor(index / 2), index % 5 + 1),
    notes: index % 12 === 0 ? 'No Log Out' : 'Capstone demo visit',
  }));
  const notifications = Array.from({ length: 12 }, (_, index) => ({
    id: fixtureId('notification', index),
    user_id: index % 2 ? ids.patron : ids.borrower,
    title: index % 2 ? 'Demo library update' : 'Demo loan reminder',
    content: 'This notice is part of the capstone evaluation dataset.',
    type: 'SYSTEM',
    is_read: index % 3 === 0,
    created_at: date(-index),
  }));
  return { categories, books, copies, loans, reservations, attendance, notifications };
}
