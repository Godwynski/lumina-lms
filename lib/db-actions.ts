import { SupabaseClient } from '@supabase/supabase-js';

// Profile IDs matching the demo accounts in auth.users
export const profileIds = {
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

// 1. COMPLETE DATABASE CLEAR
export async function clearDatabase(supabase: SupabaseClient) {
  const log: string[] = [];
  const logInfo = (msg: string) => {
    console.info(msg);
    log.push(msg);
  };

  logInfo('🧹 Starting full database purge...');

  // Deletion in order to respect foreign key constraints
  const tablesToDelete = [
    'renewals',
    'fines',
    'violations',
    'borrowing_records',
    'reservations',
    'book_copies',
    'books',
    'categories',
    'audit_logs',
    'checkout_idempotency',
    'return_idempotency',
    'rate_limit_log',
    'attendance',
    'notifications',
    'announcements',
    'reports',
    'deleted_profile_info',
    'library_cards',
    'ui_preferences'
  ];

  for (const table of tablesToDelete) {
    logInfo(`Deleting records from ${table}...`);
    const { error } = await supabase
      .from(table)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (error) {
      logInfo(`⚠️ Error deleting from ${table}: ${error.message}`);
    } else {
      logInfo(`✅ Deleted records from ${table}`);
    }
  }

  // Reset profiles (avatars only, keeping the demo accounts intact)
  logInfo('Resetting profile avatar_urls to NULL...');
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ avatar_url: null })
    .neq('id', '00000000-0000-0000-0000-000000000000');
    
  if (profileError) {
    logInfo(`⚠️ Error resetting profiles: ${profileError.message}`);
  } else {
    logInfo('✅ Reset all profile avatar_urls to NULL');
  }

  // Clear storage buckets
  const buckets = ['avatars', 'book-covers', 'library-cards'];
  for (const bucket of buckets) {
    logInfo(`Clearing bucket ${bucket}...`);
    const { data: files, error: listError } = await supabase.storage.from(bucket).list();
    
    if (listError) {
      logInfo(`⚠️ Error listing files in bucket ${bucket}: ${listError.message}`);
      continue;
    }
    
    if (files && files.length > 0) {
      const fileNames = files
        .map((f) => f.name)
        .filter((name) => name !== '.emptyFolderPlaceholder');
        
      if (fileNames.length > 0) {
        const { error: deleteError } = await supabase.storage.from(bucket).remove(fileNames);
        if (deleteError) {
          logInfo(`⚠️ Error deleting files from bucket ${bucket}: ${deleteError.message}`);
        } else {
          logInfo(`✅ Deleted ${fileNames.length} files from bucket ${bucket}`);
        }
      } else {
        logInfo(`✅ Bucket ${bucket} is already empty`);
      }
    } else {
      logInfo(`✅ Bucket ${bucket} is already empty`);
    }
  }

  logInfo('✨ Database purge completed successfully!');
  return log;
}

// 2. CLEAR ONLY LOGS AND BORROWING HISTORY
export async function clearLogsAndBorrows(supabase: SupabaseClient) {
  const log: string[] = [];
  const logInfo = (msg: string) => {
    console.info(msg);
    log.push(msg);
  };

  logInfo('🧹 Clearing only logs, borrowing history, violations, and attendance...');

  const tablesToDelete = [
    'renewals',
    'fines',
    'violations',
    'borrowing_records',
    'reservations',
    'audit_logs',
    'checkout_idempotency',
    'return_idempotency',
    'rate_limit_log',
    'attendance',
    'notifications',
    'reports'
  ];

  for (const table of tablesToDelete) {
    logInfo(`Deleting records from ${table}...`);
    const { error } = await supabase
      .from(table)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (error) {
      logInfo(`⚠️ Error deleting from ${table}: ${error.message}`);
    } else {
      logInfo(`✅ Deleted records from ${table}`);
    }
  }

  // Reset book copies status to AVAILABLE since logs are gone
  logInfo('Resetting all book copies status to AVAILABLE...');
  const { error: copyError } = await supabase
    .from('book_copies')
    .update({ status: 'AVAILABLE' })
    .neq('id', '00000000-0000-0000-0000-000000000000');

  if (copyError) {
    logInfo(`⚠️ Error resetting book copies: ${copyError.message}`);
  } else {
    logInfo('✅ All book copies set to AVAILABLE');
  }

  logInfo('✨ Logs and borrowing records cleared successfully!');
  return log;
}

// 3. CLEAR ONLY CATALOG
export async function clearCatalog(supabase: SupabaseClient) {
  const log: string[] = [];
  const logInfo = (msg: string) => {
    console.info(msg);
    log.push(msg);
  };

  logInfo('🧹 Clearing Catalog data (Books, Copies, Categories)...');

  // Deleting catalog-dependent records first to satisfy FKs
  const tablesToDelete = [
    'renewals',
    'fines',
    'violations',
    'borrowing_records',
    'reservations',
    'reports',
    'book_copies',
    'books',
    'categories',
    'audit_logs',
    'attendance'
  ];

  for (const table of tablesToDelete) {
    logInfo(`Deleting records from ${table}...`);
    const { error } = await supabase
      .from(table)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (error) {
      logInfo(`⚠️ Error deleting from ${table}: ${error.message}`);
    } else {
      logInfo(`✅ Deleted records from ${table}`);
    }
  }

  // Clear book covers bucket
  logInfo('Clearing book-covers storage bucket...');
  const { data: files, error: listError } = await supabase.storage.from('book-covers').list();
  if (!listError && files && files.length > 0) {
    const fileNames = files
      .map((f) => f.name)
      .filter((name) => name !== '.emptyFolderPlaceholder');
    if (fileNames.length > 0) {
      const { error: deleteError } = await supabase.storage.from('book-covers').remove(fileNames);
      if (deleteError) {
        logInfo(`⚠️ Error clearing book-covers bucket: ${deleteError.message}`);
      } else {
        logInfo(`✅ Deleted ${fileNames.length} cover files`);
      }
    }
  }

  logInfo('✨ Catalog cleared successfully!');
  return log;
}

// 4. SEED ONLY CATALOG (Categories, Books, Book Copies mark AVAILABLE)
export async function seedCatalog(supabase: SupabaseClient) {
  const log: string[] = [];
  const logInfo = (msg: string) => {
    console.info(msg);
    log.push(msg);
  };

  logInfo('🌱 Starting Catalog Seeding...');

  // 1. Clear catalog first
  const clearLogs = await clearCatalog(supabase);
  log.push(...clearLogs);

  logInfo('🌱 Inserting categories...');
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
    logInfo(`❌ Error seeding categories: ${catError.message}`);
    return log;
  }
  logInfo(`✅ Seeded ${catData.length} categories`);

  const catMap = new Map(catData.map(c => [c.slug, c.id]));

  logInfo('🌱 Inserting books...');
  const booksToSeed = [
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
    logInfo(`❌ Error seeding books: ${bookError.message}`);
    return log;
  }
  logInfo(`✅ Seeded ${bookData.length} books`);

  logInfo('🌱 Inserting book copies (all marked as AVAILABLE)...');
  const copies: { book_id: string; condition: string; status: string }[] = [];
  for (const book of bookData) {
    copies.push({ book_id: book.id, condition: 'New', status: 'AVAILABLE' });
    copies.push({ book_id: book.id, condition: 'Good', status: 'AVAILABLE' });
    copies.push({ book_id: book.id, condition: 'Good', status: 'AVAILABLE' });
    copies.push({ book_id: book.id, condition: 'Fair', status: 'MAINTENANCE' });
  }

  const { data: insertedCopies, error: copyError } = await supabase
    .from('book_copies')
    .insert(copies)
    .select();

  if (copyError) {
    logInfo(`❌ Error seeding book copies: ${copyError.message}`);
    return log;
  }
  logInfo(`✅ Seeded ${insertedCopies.length} book copies in AVAILABLE status`);
  logInfo('✨ Catalog seeding completed successfully!');
  return log;
}

// 5. SEED LOGS AND BORROWING HISTORY ONLY
export async function seedLogsAndBorrows(supabase: SupabaseClient) {
  const log: string[] = [];
  const logInfo = (msg: string) => {
    console.info(msg);
    log.push(msg);
  };

  logInfo('🌱 Seeding operational history, borrows, and logs...');

  // Clear existing history first
  const clearLogs = await clearLogsAndBorrows(supabase);
  log.push(...clearLogs);

  // Fetch existing books and copies from DB
  const { data: books, error: fetchBooksErr } = await supabase.from('books').select('id, title');
  const { data: copies, error: fetchCopiesErr } = await supabase.from('book_copies').select('id, book_id, status');

  if (fetchBooksErr || fetchCopiesErr || !books || !copies || books.length === 0 || copies.length === 0) {
    logInfo('⚠️ Could not find catalog books or copies in database. Please seed the Catalog first!');
    return log;
  }

  // Ensure library cards exist
  logInfo('Ensuring library cards exist...');
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

  for (const card of libraryCards) {
    const { error: cardErr } = await supabase
      .from('library_cards')
      .upsert(card, { onConflict: 'user_id' });
    if (cardErr) {
      logInfo(`⚠️ Error upserting library card for ${card.user_id}: ${cardErr.message}`);
    }
  }
  logInfo('✅ library_cards table verified');

  const bookCopiesMap: { [bookTitle: string]: { id: string; book_id: string; status: string }[] } = {};
  for (const b of books) {
    bookCopiesMap[b.title] = copies.filter(c => c.book_id === b.id);
  }

  const getCopyId = (title: string, index: number): string | null => {
    const list = bookCopiesMap[title];
    return list && list[index] ? list[index].id : null;
  };

  const copyCleanCodeId = getCopyId('Clean Code', 0);
  const copyPragmaticId = getCopyId('The Pragmatic Programmer', 0);
  const copyAlgorithmsId = getCopyId('Introduction to Algorithms', 0);
  const copyDataIntensiveId = getCopyId('Designing Data-Intensive Applications', 0);
  const copyCalculusId = getCopyId('Calculus Vol 1', 0);
  const copyLinearAlgebraId = getCopyId('Linear Algebra and Its Applications', 0);
  const copyBriefHistoryId = getCopyId('A Brief History of Time', 0);
  const copySelfishGeneId = getCopyId('The Selfish Gene', 0);

  const now = new Date();
  const dueFuture1 = new Date(now.getTime() + 12 * 24 * 60 * 60 * 1000).toISOString();
  const dueFuture2 = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString();
  const dueFuture3 = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000).toISOString();
  const dueFuture4 = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();

  const borrowPast1 = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString();
  const duePast1 = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString();
  const returnPast1 = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();

  const borrowPast2 = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();
  const duePast2 = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString();
  const returnPast2 = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString();

  const borrowPast3 = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString();
  const duePast3 = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString();
  const returnPast3 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const borrowPast4 = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();
  const duePast4 = new Date(now.getTime() + 9 * 24 * 60 * 60 * 1000).toISOString();
  const returnPast4 = new Date(now.getTime()).toISOString();

  const borrowsToSeed: {
    user_id: string;
    book_copy_id: string;
    processed_by: string;
    borrowed_at: string;
    due_date: string;
    status: string;
    renewal_count: number;
    returned_at?: string | null;
    returned_by?: string | null;
  }[] = [];
  const activeCopiesToUpdate: string[] = [];

  if (copyCleanCodeId) {
    borrowsToSeed.push({
      user_id: profileIds.godwynStudent,
      book_copy_id: copyCleanCodeId,
      processed_by: profileIds.rhedLibrarian,
      borrowed_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      due_date: dueFuture1,
      status: 'ACTIVE',
      renewal_count: 0
    });
    activeCopiesToUpdate.push(copyCleanCodeId);
  }

  if (copyCalculusId) {
    borrowsToSeed.push({
      user_id: profileIds.kayleStudent,
      book_copy_id: copyCalculusId,
      processed_by: profileIds.luminaLibrarian,
      borrowed_at: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      due_date: dueFuture2,
      status: 'ACTIVE',
      renewal_count: 0
    });
    activeCopiesToUpdate.push(copyCalculusId);
  }

  if (copyBriefHistoryId) {
    borrowsToSeed.push({
      user_id: profileIds.jericoSA,
      book_copy_id: copyBriefHistoryId,
      processed_by: profileIds.rhedLibrarian,
      borrowed_at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      due_date: dueFuture3,
      status: 'ACTIVE',
      renewal_count: 0
    });
    activeCopiesToUpdate.push(copyBriefHistoryId);
  }

  if (copyAlgorithmsId) {
    borrowsToSeed.push({
      user_id: profileIds.luminaSA,
      book_copy_id: copyAlgorithmsId,
      processed_by: profileIds.luminaLibrarian,
      borrowed_at: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      due_date: dueFuture4,
      status: 'ACTIVE',
      renewal_count: 0
    });
    activeCopiesToUpdate.push(copyAlgorithmsId);
  }

  // Returned records
  if (copyPragmaticId) {
    borrowsToSeed.push({
      user_id: profileIds.godwynStudent,
      book_copy_id: copyPragmaticId,
      processed_by: profileIds.rhedLibrarian,
      borrowed_at: borrowPast1,
      due_date: duePast1,
      returned_at: returnPast1,
      returned_by: profileIds.rhedLibrarian,
      status: 'RETURNED',
      renewal_count: 0
    });
  }
  if (copySelfishGeneId) {
    borrowsToSeed.push({
      user_id: profileIds.kayleStudent,
      book_copy_id: copySelfishGeneId,
      processed_by: profileIds.luminaLibrarian,
      borrowed_at: borrowPast2,
      due_date: duePast2,
      returned_at: returnPast2,
      returned_by: profileIds.luminaLibrarian,
      status: 'RETURNED',
      renewal_count: 0
    });
  }
  if (copyDataIntensiveId) {
    borrowsToSeed.push({
      user_id: profileIds.luminaSA,
      book_copy_id: copyDataIntensiveId,
      processed_by: profileIds.rhedLibrarian,
      borrowed_at: borrowPast3,
      due_date: duePast3,
      returned_at: returnPast3,
      returned_by: profileIds.rhedLibrarian,
      status: 'RETURNED',
      renewal_count: 0
    });
  }
  if (copyLinearAlgebraId) {
    borrowsToSeed.push({
      user_id: profileIds.rhedLibrarian,
      book_copy_id: copyLinearAlgebraId,
      processed_by: profileIds.luminaLibrarian,
      borrowed_at: borrowPast4,
      due_date: duePast4,
      returned_at: returnPast4,
      returned_by: profileIds.luminaLibrarian,
      status: 'RETURNED',
      renewal_count: 0
    });
  }

  if (borrowsToSeed.length > 0) {
    const { data: insertedBorrows, error: borrowError } = await supabase
      .from('borrowing_records')
      .insert(borrowsToSeed)
      .select();

    if (borrowError) {
      logInfo(`❌ Error seeding borrowing records: ${borrowError.message}`);
      return log;
    }
    logInfo(`✅ Seeded ${insertedBorrows.length} borrowing records`);

    if (activeCopiesToUpdate.length > 0) {
      const { error: updateCopiesError } = await supabase
        .from('book_copies')
        .update({ status: 'BORROWED' })
        .in('id', activeCopiesToUpdate);

      if (updateCopiesError) {
        logInfo(`❌ Error updating copy statuses to BORROWED: ${updateCopiesError.message}`);
      } else {
        logInfo('✅ Updated borrowed copies status to BORROWED');
      }
    }

    // Seed Renewals
    const returnedBorrowRecord = insertedBorrows.find(b => b.status === 'RETURNED' && b.user_id === profileIds.godwynStudent);
    if (returnedBorrowRecord) {
      const renewalsToSeed = [
        {
          borrowing_record_id: returnedBorrowRecord.id,
          renewed_by: profileIds.rhedLibrarian,
          renewed_at: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString(),
          new_due_date: new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString()
        }
      ];

      const { error: renewalError } = await supabase.from('renewals').insert(renewalsToSeed);
      if (renewalError) logInfo(`❌ Error seeding renewals: ${renewalError.message}`);
      else logInfo('✅ Seeded renewals');
    }
  }

  // Reservations
  const bookCleanCode = books.find(b => b.title === 'Clean Code');
  const bookCalculus = books.find(b => b.title === 'Calculus Vol 1');
  const bookSapiens = books.find(b => b.title === 'Sapiens: A Brief History of Humankind');

  const reservationsToSeed: {
    user_id: string;
    book_id: string;
    status: string;
    queue_position: number;
    reserved_at: string;
    fulfilled_at?: string | null;
    copy_id?: string | null;
  }[] = [];
  if (bookCalculus) {
    reservationsToSeed.push({
      user_id: profileIds.godwynStudent,
      book_id: bookCalculus.id,
      status: 'ACTIVE',
      queue_position: 1,
      reserved_at: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString()
    });
  }
  if (bookCleanCode) {
    const cleanCodeCopy2 = getCopyId('Clean Code', 1);
    reservationsToSeed.push({
      user_id: profileIds.kayleStudent,
      book_id: bookCleanCode.id,
      status: 'FULFILLED',
      copy_id: cleanCodeCopy2,
      queue_position: 1,
      reserved_at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      fulfilled_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString()
    });
  }
  if (bookSapiens) {
    reservationsToSeed.push({
      user_id: profileIds.jericoSA,
      book_id: bookSapiens.id,
      status: 'ACTIVE',
      queue_position: 1,
      reserved_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString()
    });
  }

  if (reservationsToSeed.length > 0) {
    const { error: reservationError } = await supabase.from('reservations').insert(reservationsToSeed);
    if (reservationError) logInfo(`❌ Error seeding reservations: ${reservationError.message}`);
    else logInfo('✅ Seeded reservations');
  }

  // Attendance
  const attendanceToSeed = [
    {
      user_id: profileIds.godwynStudent,
      check_in_at: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000 - 8 * 60 * 60 * 1000).toISOString(),
      check_out_at: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000 - 4 * 60 * 60 * 1000).toISOString(),
      notes: 'Study session'
    },
    {
      user_id: profileIds.godwynStudent,
      check_in_at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000 - 7 * 60 * 60 * 1000).toISOString(),
      check_out_at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000 - 2 * 60 * 60 * 1000).toISOString(),
      notes: 'Group project research'
    },
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
    {
      user_id: profileIds.luminaSA,
      check_in_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000 - 9 * 60 * 60 * 1000).toISOString(),
      check_out_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000 - 5 * 60 * 60 * 1000).toISOString(),
      notes: 'Morning shift'
    }
  ];

  const { error: attendanceError } = await supabase.from('attendance').insert(attendanceToSeed);
  if (attendanceError) logInfo(`❌ Error seeding attendance: ${attendanceError.message}`);
  else logInfo('✅ Seeded completed attendance records');

  // Fines & Violations
  const finesToSeed = [
    {
      user_id: profileIds.godwynStudent,
      amount: 50.00,
      status: 'PAID',
      reason: 'Damaged page (spilled coffee) on To Kill a Mockingbird',
      created_at: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      user_id: profileIds.kayleStudent,
      amount: 20.00,
      status: 'UNPAID',
      reason: 'Lost accompanying media CD for Linear Algebra',
      created_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString()
    }
  ];

  const { error: fineError } = await supabase.from('fines').insert(finesToSeed);
  if (fineError) logInfo(`❌ Error seeding fines: ${fineError.message}`);
  else logInfo('✅ Seeded fines');

  const violationsToSeed = [
    {
      user_id: profileIds.godwynStudent,
      violation_type: 'LOUD_CONDUCT',
      severity: 'low',
      points: 2,
      description: 'Loud talking and laughing in the quiet study zone on the second floor.',
      incident_date: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'RESOLVED',
      resolved_at: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString(),
      resolution_notes: 'Student was verbally warned and complied immediately. Resolved.'
    },
    {
      user_id: profileIds.kayleStudent,
      violation_type: 'EATING_DRINKING',
      severity: 'low',
      points: 1,
      description: 'Eating chips and drinking soda in the computer laboratory section.',
      incident_date: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'RESOLVED',
      resolved_at: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      resolution_notes: 'Resolved after student moved items to the lobby areas.'
    }
  ];

  const { error: violationError } = await supabase.from('violations').insert(violationsToSeed);
  if (violationError) logInfo(`❌ Error seeding violations: ${violationError.message}`);
  else logInfo('✅ Seeded violations');

  // Reports
  if (bookCleanCode && bookCalculus) {
    const reportsToSeed = [
      {
        book_id: bookCleanCode.id,
        user_id: profileIds.godwynStudent,
        notes: 'Pages 102 to 110 are heavily smeared with ink and illegible. Reporting for review.',
        status: 'resolved',
        created_at: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        book_id: bookCalculus.id,
        user_id: profileIds.kayleStudent,
        notes: 'The front cover page is partially torn off.',
        status: 'pending',
        created_at: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];

    const { error: reportError } = await supabase.from('reports').insert(reportsToSeed);
    if (reportError) logInfo(`❌ Error seeding reports: ${reportError.message}`);
    else logInfo('✅ Seeded reports');
  }

  // Audit Logs
  const auditLogsToSeed = [
    {
      admin_id: profileIds.luminaAdmin,
      entity_type: 'system_settings',
      action: 'UPDATE_SYSTEM_SETTINGS',
      reason: 'Revised loan policy per admin instruction',
      details: { key: 'loan_period_days', value: '14' }
    },
    {
      admin_id: profileIds.rhedLibrarian,
      entity_type: 'violations',
      action: 'RESOLVE_VIOLATION',
      reason: 'Student paid the fine and completed community shelf assistance hour.',
      details: { student_id: 'STU-376375' }
    }
  ];

  const { error: auditError } = await supabase.from('audit_logs').insert(auditLogsToSeed);
  if (auditError) logInfo(`❌ Error seeding audit logs: ${auditError.message}`);
  else logInfo('✅ Seeded audit logs');

  logInfo('✨ Operational history and logs seeding completed successfully!');
  return log;
}

// 6. FULL SYSTEM SEED
export async function seedDatabase(supabase: SupabaseClient) {
  const log: string[] = [];
  const logInfo = (msg: string) => {
    console.info(msg);
    log.push(msg);
  };

  logInfo('🌱 Starting complete database seeding (Full Seed)...');

  // Seed Catalog First
  const catalogLogs = await seedCatalog(supabase);
  log.push(...catalogLogs);

  // Seed Logs and History Next
  const logsAndBorrows = await seedLogsAndBorrows(supabase);
  log.push(...logsAndBorrows);

  // Add Announcements
  logInfo('🌱 Adding announcements...');
  const announcementsToSeed = [
    {
      title: 'Lumina Library System Upgrade',
      content: 'We have successfully upgraded our library catalog system to support automated QR checkouts and a brand new modern dashboard.',
      priority: 'medium',
      is_active: true,
      target_role: null,
      starts_at: new Date().toISOString(),
      created_by: profileIds.luminaAdmin
    },
    {
      title: 'Library Hours Extended for Exams',
      content: 'To support your exam preparation, library study hours are extended to 9:00 PM starting this Friday.',
      priority: 'high',
      is_active: true,
      target_role: 'student',
      starts_at: new Date().toISOString(),
      created_by: profileIds.rhedLibrarian
    },
    {
      title: 'Annual Shelf Inventory Audit',
      content: 'Librarians and Staff: Please prepare files and reports for the annual shelf inventory audit on Friday.',
      priority: 'medium',
      is_active: true,
      target_role: 'librarian',
      starts_at: new Date().toISOString(),
      created_by: profileIds.luminaAdmin
    }
  ];

  const { error: announcementError } = await supabase
    .from('announcements')
    .insert(announcementsToSeed);

  if (announcementError) {
    logInfo(`❌ Error seeding announcements: ${announcementError.message}`);
  } else {
    logInfo('✅ Seeded announcements');
  }

  logInfo('✨ Full database seeding completed successfully!');
  return log;
}
