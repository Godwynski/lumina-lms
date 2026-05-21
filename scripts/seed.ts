import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// Define profiles/users we expect in the DB
const profileIds = {
  godwynStudent: 'f1d742df-ca66-4ac8-a4e2-7369c1dc4460',
  kayleStudent: '00000000-0000-0000-0000-000000000006',
  jericoSA: '5e674c6d-cf73-4b78-a2e9-9f32f9553511',
  luminaSA: '00000000-0000-0000-0000-000000000005',
  rhedLibrarian: '31afd312-7272-413a-892a-a67be05caf10',
  luminaLibrarian: '00000000-0000-0000-0000-000000000002',
  kennethAdmin: '486205e4-1fad-421c-8946-fdd0da5217bf',
  luminaSuperAdmin: '00000000-0000-0000-0000-000000000008',
  luminaAdmin: '00000000-0000-0000-0000-000000000001',
};

async function seed() {
  console.info('🌱 Starting database seed...');

  // 1. Seed Categories
  const categories = [
    { name: 'Computer Science', slug: 'computer-science', description: 'Programming, software design, algorithms, databases, AI, and systems engineering.' },
    { name: 'Mathematics', slug: 'mathematics', description: 'Calculus, algebra, discrete structures, probability, and numerical methods.' },
    { name: 'Science & Technology', slug: 'science-technology', description: 'Physics, chemistry, biology, general science, and engineering advancements.' },
    { name: 'Literature & Fiction', slug: 'literature-fiction', description: 'Classic novels, poetry, plays, and modern fictional works.' },
    { name: 'History & Biography', slug: 'history-biography', description: 'Global historical events, biographical memoirs, and cultural studies.' },
    { name: 'Business & Economics', slug: 'business-economics', description: 'Finance, marketing, management, macro/microeconomics, and entrepreneurship.' },
    { name: 'Philosophy & Ethics', slug: 'philosophy-ethics', description: 'Ancient philosophies, logic, ethics, and modern philosophical discourse.' },
  ];

  const { data: catData, error: catError } = await supabase
    .from('categories')
    .insert(categories)
    .select();

  if (catError) {
    console.error('Error seeding categories:', catError);
    return;
  }
  console.info(`✅ Seeded ${catData.length} categories`);

  const catMap = new Map(catData.map(c => [c.slug, c.id]));

  // 2. Seed Books
  const booksToSeed = [
    // Computer Science
    {
      title: 'Clean Code',
      author: 'Robert C. Martin',
      isbn: '9780132350884',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780132350884-L.jpg',
      category_id: catMap.get('computer-science'),
      tags: ['programming', 'software-design', 'clean-code'],
      location: 'Shelf A1',
      section: 'Computer Science',
      dewey_decimal: '005.1',
      description: "Even bad code can function. But if code isn't clean, it can bring a development organization to its knees.",
      published_year: 2008
    },
    {
      title: 'The Pragmatic Programmer',
      author: 'Andrew Hunt & David Thomas',
      isbn: '9780135957059',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780135957059-L.jpg',
      category_id: catMap.get('computer-science'),
      tags: ['software-engineering', 'best-practices', 'pragmatic'],
      location: 'Shelf A1',
      section: 'Computer Science',
      dewey_decimal: '005.1',
      description: 'The Pragmatic Programmer cuts through the increasing specialization and technicalities of modern software development.',
      published_year: 1999
    },
    {
      title: 'Introduction to Algorithms',
      author: 'Thomas H. Cormen',
      isbn: '9780262033848',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780262033848-L.jpg',
      category_id: catMap.get('computer-science'),
      tags: ['algorithms', 'data-structures', 'cs-core'],
      location: 'Shelf A2',
      section: 'Computer Science',
      dewey_decimal: '005.1',
      description: 'A comprehensive introduction to the modern study of computer algorithms.',
      published_year: 2009
    },
    {
      title: 'Designing Data-Intensive Applications',
      author: 'Martin Kleppmann',
      isbn: '9781449373320',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9781449373320-L.jpg',
      category_id: catMap.get('computer-science'),
      tags: ['system-design', 'databases', 'distributed-systems'],
      location: 'Shelf A2',
      section: 'Computer Science',
      dewey_decimal: '004',
      description: 'Key principles, tradeoffs, and architectures for designing data systems.',
      published_year: 2017
    },
    // Mathematics
    {
      title: 'Calculus Vol 1',
      author: 'Tom M. Apostol',
      isbn: '9788126515196',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9788126515196-L.jpg',
      category_id: catMap.get('mathematics'),
      tags: ['calculus', 'math-analysis', 'textbook'],
      location: 'Shelf B1',
      section: 'Mathematics',
      dewey_decimal: '515',
      description: 'An introduction to calculus, with an emphasis on rigorous proof and historical context.',
      published_year: 1967
    },
    {
      title: 'Linear Algebra and Its Applications',
      author: 'Gilbert Strang',
      isbn: '9780030105678',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780030105678-L.jpg',
      category_id: catMap.get('mathematics'),
      tags: ['linear-algebra', 'matrices', 'textbook'],
      location: 'Shelf B1',
      section: 'Mathematics',
      dewey_decimal: '512',
      description: 'Renowned professor Gilbert Strang introduces linear algebra with clear explanations and real-world examples.',
      published_year: 2005
    },
    // Science & Tech
    {
      title: 'A Brief History of Time',
      author: 'Stephen Hawking',
      isbn: '9780553380163',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780553380163-L.jpg',
      category_id: catMap.get('science-technology'),
      tags: ['astrophysics', 'popular-science', 'cosmology'],
      location: 'Shelf C1',
      section: 'Science',
      dewey_decimal: '523.1',
      description: "Stephen Hawking's landmark bestseller about the origin and fate of the universe.",
      published_year: 1998
    },
    {
      title: 'The Selfish Gene',
      author: 'Richard Dawkins',
      isbn: '9780198788607',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780198788607-L.jpg',
      category_id: catMap.get('science-technology'),
      tags: ['evolutionary-biology', 'genetics', 'science'],
      location: 'Shelf C2',
      section: 'Science',
      dewey_decimal: '576.82',
      description: 'Dawkins explains how natural selection operates at the level of genes, transforming our understanding of biology.',
      published_year: 1976
    },
    // Literature & Fiction
    {
      title: 'To Kill a Mockingbird',
      author: 'Harper Lee',
      isbn: '9780446310789',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780446310789-L.jpg',
      category_id: catMap.get('literature-fiction'),
      tags: ['classic', 'american-literature', 'fiction'],
      location: 'Shelf D1',
      section: 'Literature',
      dewey_decimal: '813.54',
      description: "Compassionate, dramatic, and deeply moving, Harper Lee's classic novel explores racial injustice and childhood in the American South.",
      published_year: 1960
    },
    {
      title: '1984',
      author: 'George Orwell',
      isbn: '9780451524935',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780451524935-L.jpg',
      category_id: catMap.get('literature-fiction'),
      tags: ['dystopian', 'classic', 'political-fiction'],
      location: 'Shelf D2',
      section: 'Literature',
      dewey_decimal: '823.912',
      description: 'Winston Smith toes the Party line, rewriting history to satisfy the Ministry of Truth. But deep inside, he harbors a rebellion.',
      published_year: 1949
    },
    // History & Biography
    {
      title: 'Sapiens: A Brief History of Humankind',
      author: 'Yuval Noah Harari',
      isbn: '9780062316097',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780062316097-L.jpg',
      category_id: catMap.get('history-biography'),
      tags: ['history', 'anthropology', 'human-evolution'],
      location: 'Shelf E1',
      section: 'History',
      dewey_decimal: '909',
      description: 'Harari spans the whole of human history, from the very first humans to walk the earth to the radical breakthroughs of our age.',
      published_year: 2011
    },
    {
      title: 'The Diary of a Young Girl',
      author: 'Anne Frank',
      isbn: '9780553296983',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780553296983-L.jpg',
      category_id: catMap.get('history-biography'),
      tags: ['biography', 'world-war-ii', 'history'],
      location: 'Shelf E2',
      section: 'History',
      dewey_decimal: '940.5318',
      description: 'The classic diary of a young Jewish girl during the Nazi occupation of the Netherlands.',
      published_year: 1947
    },
    // Business & Economics
    {
      title: 'Thinking, Fast and Slow',
      author: 'Daniel Kahneman',
      isbn: '9780374275631',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780374275631-L.jpg',
      category_id: catMap.get('business-economics'),
      tags: ['economics', 'psychology', 'decision-making'],
      location: 'Shelf F1',
      section: 'Business',
      dewey_decimal: '153.4',
      description: 'A comprehensive analysis of the two systems that drive the way we think and make choices.',
      published_year: 2011
    },
    {
      title: 'The Intelligent Investor',
      author: 'Benjamin Graham',
      isbn: '9780060555665',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780060555665-L.jpg',
      category_id: catMap.get('business-economics'),
      tags: ['finance', 'investing', 'business-classic'],
      location: 'Shelf F2',
      section: 'Business',
      dewey_decimal: '332.6',
      description: 'The classic text on value investing, providing time-tested strategies for financial success.',
      published_year: 1949
    },
    // Philosophy & Ethics
    {
      title: 'The Republic',
      author: 'Plato',
      isbn: '9780140455113',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780140455113-L.jpg',
      category_id: catMap.get('philosophy-ethics'),
      tags: ['philosophy', 'political-science', 'classics'],
      location: 'Shelf G1',
      section: 'Philosophy',
      dewey_decimal: '184',
      description: "Plato's dialogue concerning justice, the order and character of the just city-state, and the just man.",
      published_year: -375
    },
    {
      title: 'Meditations',
      author: 'Marcus Aurelius',
      isbn: '9780812968255',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780812968255-L.jpg',
      category_id: catMap.get('philosophy-ethics'),
      tags: ['philosophy', 'stoicism', 'classics'],
      location: 'Shelf G2',
      section: 'Philosophy',
      dewey_decimal: '188',
      description: 'A series of personal writings by the Roman Emperor Marcus Aurelius, offering Stoic guidance on life.',
      published_year: 180
    }
  ];

  const { data: bookData, error: bookError } = await supabase
    .from('books')
    .insert(booksToSeed)
    .select();

  if (bookError) {
    console.error('Error seeding books:', bookError);
    return;
  }
  console.info(`✅ Seeded ${bookData.length} books`);

  // 3. Seed Book Copies
  const copies: any[] = [];
  const bookCopiesMap: { [bookTitle: string]: any[] } = {};

  for (const book of bookData) {
    bookCopiesMap[book.title] = [];
    
    // Copy 1 (will be BORROWED / AVAILABLE)
    copies.push({ book_id: book.id, condition: 'New', status: 'AVAILABLE' });
    // Copy 2 (will be AVAILABLE)
    copies.push({ book_id: book.id, condition: 'Good', status: 'AVAILABLE' });
    // Copy 3 (will be AVAILABLE)
    copies.push({ book_id: book.id, condition: 'Good', status: 'AVAILABLE' });
    // Copy 4 (will be MAINTENANCE)
    copies.push({ book_id: book.id, condition: 'Fair', status: 'MAINTENANCE' });
  }

  const { data: insertedCopies, error: copyError } = await supabase
    .from('book_copies')
    .insert(copies)
    .select();

  if (copyError) {
    console.error('Error seeding book copies:', copyError);
    return;
  }
  console.info(`✅ Seeded ${insertedCopies.length} book copies`);

  // Populate bookCopiesMap with database ids and details
  for (const copy of insertedCopies) {
    const bookObj = bookData.find(b => b.id === copy.book_id);
    if (bookObj) {
      bookCopiesMap[bookObj.title].push(copy);
    }
  }

  // 4. Seed Library Cards for Profiles
  const libraryCards = [
    { user_id: profileIds.godwynStudent, card_number: 'LIB-2026-N1122334', status: 'ACTIVE', expires_at: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString() },
    { user_id: profileIds.kayleStudent, card_number: 'LIB-2026-F5566778', status: 'ACTIVE', expires_at: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString() },
    { user_id: profileIds.jericoSA, card_number: 'LIB-2026-D9988776', status: 'ACTIVE', expires_at: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString() },
    { user_id: profileIds.luminaSA, card_number: 'LIB-2026-S1111222', status: 'ACTIVE', expires_at: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString() },
    { user_id: profileIds.rhedLibrarian, card_number: 'LIB-2026-R3333444', status: 'ACTIVE', expires_at: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString() },
    { user_id: profileIds.luminaLibrarian, card_number: 'LIB-2026-L5555666', status: 'ACTIVE', expires_at: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString() },
    { user_id: profileIds.kennethAdmin, card_number: 'LIB-2026-T7777888', status: 'ACTIVE', expires_at: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString() },
    { user_id: profileIds.luminaSuperAdmin, card_number: 'LIB-2026-A8888999', status: 'ACTIVE', expires_at: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString() },
    { user_id: profileIds.luminaAdmin, card_number: 'LIB-2026-A1111222', status: 'ACTIVE', expires_at: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString() },
  ];

  const { error: cardError } = await supabase
    .from('library_cards')
    .insert(libraryCards);

  if (cardError) {
    console.error('Error seeding library cards:', cardError);
    return;
  }
  console.info('✅ Seeded library cards');

  // 5. Seed Borrowing Records
  const now = new Date();
  
  // Future dates (ACTIVE)
  const dueFuture1 = new Date(now.getTime() + 12 * 24 * 60 * 60 * 1000).toISOString(); // 12 days from now
  const dueFuture2 = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString(); // 10 days from now
  const dueFuture3 = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000).toISOString(); // 8 days from now
  const dueFuture4 = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(); // 14 days from now

  // Past dates for completed/returned borrows
  const borrowPast1 = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString();
  const duePast1 = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString();
  const returnPast1 = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(); // Returned early

  const borrowPast2 = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();
  const duePast2 = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString();
  const returnPast2 = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString(); // Returned on due date

  const borrowPast3 = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString();
  const duePast3 = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString();
  const returnPast3 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(); // Returned early

  const borrowPast4 = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();
  const duePast4 = new Date(now.getTime() + 9 * 24 * 60 * 60 * 1000).toISOString();
  const returnPast4 = new Date(now.getTime()).toISOString(); // Returned today

  // Select copies to borrow
  const copyCleanCode = bookCopiesMap['Clean Code'][0];
  const copyPragmatic = bookCopiesMap['The Pragmatic Programmer'][0];
  const copyAlgorithms = bookCopiesMap['Introduction to Algorithms'][0];
  const copyDataIntensive = bookCopiesMap['Designing Data-Intensive Applications'][0];
  
  const copyCalculus = bookCopiesMap['Calculus Vol 1'][0];
  const copyLinearAlgebra = bookCopiesMap['Linear Algebra and Its Applications'][0];
  const copyBriefHistory = bookCopiesMap['A Brief History of Time'][0];
  const copySelfishGene = bookCopiesMap['The Selfish Gene'][0];

  const borrowsToSeed = [
    // 4 ACTIVE Borrows (due in the future)
    {
      user_id: profileIds.godwynStudent,
      book_copy_id: copyCleanCode.id,
      processed_by: profileIds.rhedLibrarian,
      borrowed_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      due_date: dueFuture1,
      status: 'ACTIVE'
    },
    {
      user_id: profileIds.kayleStudent,
      book_copy_id: copyCalculus.id,
      processed_by: profileIds.luminaLibrarian,
      borrowed_at: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      due_date: dueFuture2,
      status: 'ACTIVE'
    },
    {
      user_id: profileIds.jericoSA,
      book_copy_id: copyBriefHistory.id,
      processed_by: profileIds.rhedLibrarian,
      borrowed_at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      due_date: dueFuture3,
      status: 'ACTIVE'
    },
    {
      user_id: profileIds.luminaSA,
      book_copy_id: copyAlgorithms.id,
      processed_by: profileIds.luminaLibrarian,
      borrowed_at: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      due_date: dueFuture4,
      status: 'ACTIVE'
    },

    // 4 RETURNED Borrows
    {
      user_id: profileIds.godwynStudent,
      book_copy_id: copyPragmatic.id,
      processed_by: profileIds.rhedLibrarian,
      borrowed_at: borrowPast1,
      due_date: duePast1,
      returned_at: returnPast1,
      returned_by: profileIds.rhedLibrarian,
      status: 'RETURNED'
    },
    {
      user_id: profileIds.kayleStudent,
      book_copy_id: copySelfishGene.id,
      processed_by: profileIds.luminaLibrarian,
      borrowed_at: borrowPast2,
      due_date: duePast2,
      returned_at: returnPast2,
      returned_by: profileIds.luminaLibrarian,
      status: 'RETURNED'
    },
    {
      user_id: profileIds.luminaSA,
      book_copy_id: copyDataIntensive.id,
      processed_by: profileIds.rhedLibrarian,
      borrowed_at: borrowPast3,
      due_date: duePast3,
      returned_at: returnPast3,
      returned_by: profileIds.rhedLibrarian,
      status: 'RETURNED'
    },
    {
      user_id: profileIds.rhedLibrarian,
      book_copy_id: copyLinearAlgebra.id,
      processed_by: profileIds.luminaLibrarian,
      borrowed_at: borrowPast4,
      due_date: duePast4,
      returned_at: returnPast4,
      returned_by: profileIds.luminaLibrarian,
      status: 'RETURNED'
    }
  ];

  const { data: borrowData, error: borrowError } = await supabase
    .from('borrowing_records')
    .insert(borrowsToSeed)
    .select();

  if (borrowError) {
    console.error('Error seeding borrowing records:', borrowError);
    return;
  }
  console.info(`✅ Seeded ${borrowData.length} borrowing records`);

  // Update book_copies statuses that are currently borrowed to 'BORROWED'
  const activeCopiesToUpdate = [copyCleanCode.id, copyCalculus.id, copyBriefHistory.id, copyAlgorithms.id];
  const { error: updateCopiesError } = await supabase
    .from('book_copies')
    .update({ status: 'BORROWED' })
    .in('id', activeCopiesToUpdate);

  if (updateCopiesError) {
    console.error('Error updating borrowed copies status:', updateCopiesError);
    return;
  }
  console.info('✅ Updated borrowed book copies status to BORROWED');

  // 7. Seed Reservations
  const bookCleanCodeObj = bookData.find(b => b.title === 'Clean Code');
  const bookCalculusObj = bookData.find(b => b.title === 'Calculus Vol 1');
  const bookSapiensObj = bookData.find(b => b.title === 'Sapiens: A Brief History of Humankind');

  const reservationsToSeed = [
    {
      user_id: profileIds.godwynStudent,
      book_id: bookCalculusObj.id,
      status: 'ACTIVE',
      queue_position: 1,
      reserved_at: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      user_id: profileIds.kayleStudent,
      book_id: bookCleanCodeObj.id,
      status: 'FULFILLED',
      copy_id: bookCopiesMap['Clean Code'][1].id,
      queue_position: 1,
      reserved_at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      fulfilled_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      user_id: profileIds.jericoSA,
      book_id: bookSapiensObj.id,
      status: 'ACTIVE',
      queue_position: 1,
      reserved_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString()
    }
  ];

  const { error: reservationError } = await supabase
    .from('reservations')
    .insert(reservationsToSeed);

  if (reservationError) {
    console.error('Error seeding reservations:', reservationError);
  } else {
    console.info('✅ Seeded reservations');
  }

  // 8. Seed Attendance (Condition: "dont make currently active attendance, maybe attendance completed")
  const attendanceToSeed = [
    // Godwyn Neri completed attendances
    {
      user_id: profileIds.godwynStudent,
      check_in_at: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000 - 8 * 60 * 60 * 1000).toISOString(), // 5 days ago, 8:00 AM
      check_out_at: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000 - 4 * 60 * 60 * 1000).toISOString(), // 5 days ago, 12:00 PM
      notes: 'Study session'
    },
    {
      user_id: profileIds.godwynStudent,
      check_in_at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000 - 7 * 60 * 60 * 1000).toISOString(), // 3 days ago, 9:00 AM
      check_out_at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000 - 2 * 60 * 60 * 1000).toISOString(), // 3 days ago, 2:00 PM
      notes: 'Group project research'
    },
    // Kayle Floriano completed attendances
    {
      user_id: profileIds.kayleStudent,
      check_in_at: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000 - 6 * 60 * 60 * 1000).toISOString(),
      check_out_at: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000 - 1 * 60 * 60 * 1000).toISOString(),
      notes: 'Calculus assignment work'
    },
    {
      user_id: profileIds.kayleStudent,
      check_in_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000 - 5 * 60 * 60 * 1000).toISOString(),
      check_out_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000 - 1 * 60 * 60 * 1000).toISOString(),
      notes: 'Reading'
    },
    // Jerico SA completed attendances
    {
      user_id: profileIds.jericoSA,
      check_in_at: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000 - 9 * 60 * 60 * 1000).toISOString(),
      check_out_at: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000 - 3 * 60 * 60 * 1000).toISOString(),
      notes: 'Library duty shift'
    },
    {
      user_id: profileIds.jericoSA,
      check_in_at: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000 - 8 * 60 * 60 * 1000).toISOString(),
      check_out_at: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000 - 4 * 60 * 60 * 1000).toISOString(),
      notes: 'Shelf organizing shift'
    },
    // Lumina SA completed attendances
    {
      user_id: profileIds.luminaSA,
      check_in_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000 - 9 * 60 * 60 * 1000).toISOString(),
      check_out_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000 - 5 * 60 * 60 * 1000).toISOString(),
      notes: 'Morning shift'
    }
  ];

  const { error: attendanceError } = await supabase
    .from('attendance')
    .insert(attendanceToSeed);

  if (attendanceError) {
    console.error('Error seeding attendance:', attendanceError);
  } else {
    console.info('✅ Seeded completed attendance records');
  }


  const notificationsToSeed = [
    {
      user_id: profileIds.godwynStudent,
      title: 'Welcome to Lumina Library!',
      content: 'Your digital library card is now active. Explore the catalog and enjoy borrowing resources.',
      type: 'SYSTEM',
      priority: 'medium',
      is_read: true,
      metadata: {}
    },
    {
      user_id: profileIds.godwynStudent,
      title: 'Book Borrow Confirmed',
      content: 'You have borrowed "Clean Code". It is due on ' + new Date(dueFuture1).toLocaleDateString() + '.',
      type: 'CIRCULATION',
      priority: 'medium',
      is_read: false,
      metadata: {}
    }
  ];

  const { error: notificationError } = await supabase
    .from('notifications')
    .insert(notificationsToSeed);

  if (notificationError) {
    console.error('Error seeding notifications:', notificationError);
  } else {
    console.info('✅ Seeded notifications');
  }

  // 12. Seed Announcements
  const announcementsToSeed = [
    {
      title: 'Lumina Library System Upgrade',
      content: 'We have successfully upgraded our library catalog system to support automated QR checkouts and a brand new modern dashboard.',
      priority: 'medium',
      is_active: true,
      target_role: null,
      starts_at: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      created_by: profileIds.luminaAdmin
    },
    {
      title: 'Library Hours Extended for Exams',
      content: 'To support your exam preparation, library study hours are extended to 9:00 PM starting this Friday.',
      priority: 'high',
      is_active: true,
      target_role: 'student',
      starts_at: new Date(now.getTime()).toISOString(),
      created_by: profileIds.rhedLibrarian
    },
    {
      title: 'Annual Shelf Inventory Audit',
      content: 'Librarians and Staff: Please prepare files and reports for the annual shelf inventory audit on Friday.',
      priority: 'medium',
      is_active: true,
      target_role: 'librarian',
      starts_at: new Date(now.getTime()).toISOString(),
      created_by: profileIds.luminaAdmin
    }
  ];

  const { error: announcementError } = await supabase
    .from('announcements')
    .insert(announcementsToSeed);

  if (announcementError) {
    console.error('Error seeding announcements:', announcementError);
  } else {
    console.info('✅ Seeded announcements');
  }

  // 13. Seed Reports
  const reportsToSeed = [
    {
      book_id: bookCleanCodeObj.id,
      user_id: profileIds.godwynStudent,
      notes: 'Pages 102 to 110 are heavily smeared with ink and illegible. Reporting for review.',
      status: 'resolved',
      created_at: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      book_id: bookCalculusObj.id,
      user_id: profileIds.kayleStudent,
      notes: 'The front cover page is partially torn off.',
      status: 'pending',
      created_at: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString()
    }
  ];

  const { error: reportError } = await supabase
    .from('reports')
    .insert(reportsToSeed);

  if (reportError) {
    console.error('Error seeding reports:', reportError);
  } else {
    console.info('✅ Seeded reports');
  }

  // 14. Seed Audit Logs
  const auditLogsToSeed = [
    {
      admin_id: profileIds.luminaAdmin,
      entity_type: 'books',
      action: 'CREATE_BOOK',
      reason: 'Standard catalog initialization',
      details: { count: bookData.length }
    },
    {
      admin_id: profileIds.luminaAdmin,
      entity_type: 'system_settings',
      action: 'UPDATE_SYSTEM_SETTINGS',
      reason: 'Revised loan policy per admin instruction',
      details: { key: 'loan_period_days', value: '14' }
    }
  ];

  const { error: auditError } = await supabase
    .from('audit_logs')
    .insert(auditLogsToSeed);

  if (auditError) {
    console.error('Error seeding audit logs:', auditError);
  } else {
    console.info('✅ Seeded audit logs');
  }

  // 15. Seed Checklist Options
  console.info('🌱 Seeding checklist options...');
  const optionsToSeed = [
    { type: 'user_role', value: 'student' },
    { type: 'user_role', value: 'librarian' },
    { type: 'user_role', value: 'student_assistant' },
    { type: 'user_role', value: 'super_admin' },
    { type: 'module', value: 'Authentication' },
    { type: 'module', value: 'Catalog' },
    { type: 'module', value: 'Circulation' },
    { type: 'module', value: 'Attendance' },
    { type: 'module', value: 'Announcements' },
    { type: 'module', value: 'Reports' },
    { type: 'module', value: 'Settings' },
    { type: 'module', value: 'Dashboard' }
  ];
  const { error: optionsError } = await supabase
    .from('checklist_dropdown_options')
    .insert(optionsToSeed);
  if (optionsError) {
    console.error('Error seeding checklist options:', optionsError);
  } else {
    console.info('✅ Seeded checklist options');
  }

  // 16. Seed Checklist Items
  console.info('🌱 Seeding checklist items...');
  const itemsToSeed = [
    { problem: 'UI overflow in catalog cards on mobile screens', explanation: 'The tags section stretches too wide and breaks the grid layout.', user_role: 'student', module: 'Catalog', is_completed: false },
    { problem: 'Session timeout occurs too quickly during scan operations', explanation: 'Librarians get logged out during continuous book checking scans.', user_role: 'librarian', module: 'Circulation', is_completed: true },
    { problem: 'Audit logs fail to capture custom settings change events', explanation: 'Changing settings through the admin dashboard settings page is not logging correctly.', user_role: 'super_admin', module: 'Settings', is_completed: false }
  ];
  const { error: itemsError } = await supabase
    .from('checklist_items')
    .insert(itemsToSeed);
  if (itemsError) {
    console.error('Error seeding checklist items:', itemsError);
  } else {
    console.info('✅ Seeded checklist items');
  }

  console.info('✨ Seeding completed successfully!');
}

seed().catch(err => {
  console.error('Unexpected error during seeding:', err);
  process.exit(1);
});
