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
    'checklist_items',
    'checklist_dropdown_options',
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
    let query = supabase.from(table).delete();
    
    if (table === 'library_cards') {
      // Keep library cards for demo access users
      query = query.not('user_id', 'in', `(${Object.values(profileIds).join(',')})`);
    } else {
      query = query.neq('id', '00000000-0000-0000-0000-000000000000');
    }

    const { error } = await query;
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

  logInfo('✨ Database purge completed successfully! (Preserved demo library cards)');
  return log;
}

// 2. CLEAR ONLY LOGS AND BORROWING HISTORY
export async function clearLogsAndBorrows(supabase: SupabaseClient) {
  const log: string[] = [];
  const logInfo = (msg: string) => {
    console.info(msg);
    log.push(msg);
  };

  logInfo('🧹 Clearing only logs, borrowing history, and attendance...');

  const tablesToDelete = [
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
    { name: 'Art & Design', slug: 'art-design', description: 'Visual arts, graphic design, architecture, photography, and user experience design.' },
    { name: 'Health & Medicine', slug: 'health-medicine', description: 'Human anatomy, clinical medicine, public health, nutrition, and mental health.' },
    { name: 'Law & Politics', slug: 'law-politics', description: 'Constitutional law, international relations, political theory, and public policy.' },
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
    {
      title: 'Refactoring: Improving the Design of Existing Code',
      author: 'Martin Fowler',
      isbn: '9780134757599',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780134757599-L.jpg',
      category_id: catMap.get('computer-science'),
      tags: ['refactoring', 'software-design', 'clean-code'],
      location: 'Shelf A3',
      section: 'Computer Science',
      dewey_decimal: '005.11',
      description: 'Martin Fowler’s guide to improving the design of existing code without changing its external behavior.',
      published_year: 2018
    },
    {
      title: 'Design Patterns: Elements of Reusable Object-Oriented Software',
      author: 'Erich Gamma, Richard Helm, Ralph Johnson, John Vlissides',
      isbn: '9780201633610',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780201633610-L.jpg',
      category_id: catMap.get('computer-science'),
      tags: ['design-patterns', 'oop', 'software-architecture'],
      location: 'Shelf A3',
      section: 'Computer Science',
      dewey_decimal: '005.12',
      description: 'The seminal textbook on object-oriented software design patterns from the "Gang of Four".',
      published_year: 1994
    },
    {
      title: 'The Mythical Man-Month',
      author: 'Frederick P. Brooks Jr.',
      isbn: '9780201835953',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780201835953-L.jpg',
      category_id: catMap.get('computer-science'),
      tags: ['project-management', 'software-engineering', 'classics'],
      location: 'Shelf A4',
      section: 'Computer Science',
      dewey_decimal: '005.1',
      description: 'Influential essays on software engineering and project management.',
      published_year: 1995
    },
    {
      title: 'Compilers: Principles, Techniques, and Tools',
      author: 'Alfred V. Aho, Monica S. Lam, Ravi Sethi, Jeffrey D. Ullman',
      isbn: '9780321486813',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780321486813-L.jpg',
      category_id: catMap.get('computer-science'),
      tags: ['compilers', 'computer-science', 'parser'],
      location: 'Shelf A4',
      section: 'Computer Science',
      dewey_decimal: '005.453',
      description: 'Known as the "Dragon Book", this is the definitive guide to compiler construction.',
      published_year: 2006
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
    {
      title: 'Linear Algebra Done Right',
      author: 'Sheldon Axler',
      isbn: '9783319110790',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9783319110790-L.jpg',
      category_id: catMap.get('mathematics'),
      tags: ['linear-algebra', 'theory', 'pure-math'],
      location: 'Shelf B2',
      section: 'Mathematics',
      dewey_decimal: '512.5',
      description: 'A popular undergraduate textbook focusing on linear operators on finite-dimensional vector spaces.',
      published_year: 2015
    },
    {
      title: 'Gödel, Escher, Bach: An Eternal Golden Braid',
      author: 'Douglas R. Hofstadter',
      isbn: '9780465026562',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780465026562-L.jpg',
      category_id: catMap.get('mathematics'),
      tags: ['math-logic', 'cognitive-science', 'philosophy'],
      location: 'Shelf B2',
      section: 'Mathematics',
      dewey_decimal: '510.1',
      description: 'A Pulitzer Prize-winning book exploring common themes in the lives and works of mathematician Kurt Gödel, artist M.C. Escher, and composer Johann Sebastian Bach.',
      published_year: 1979
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
    {
      title: 'Cosmos',
      author: 'Carl Sagan',
      isbn: '9780375508325',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780375508325-L.jpg',
      category_id: catMap.get('science-technology'),
      tags: ['astronomy', 'science-history', 'popular-science'],
      location: 'Shelf C2',
      section: 'Science',
      dewey_decimal: '520',
      description: 'Carl Sagan’s classic exploration of the universe, science, and the human journey of discovery.',
      published_year: 1980
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
    {
      title: 'The Great Gatsby',
      author: 'F. Scott Fitzgerald',
      isbn: '9780743273565',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780743273565-L.jpg',
      category_id: catMap.get('literature-fiction'),
      tags: ['classic', 'american-literature', 'fiction'],
      location: 'Shelf D3',
      section: 'Literature',
      dewey_decimal: '813.52',
      description: 'The story of the mysteriously wealthy Jay Gatsby and his love for the beautiful Daisy Buchanan.',
      published_year: 1925
    },
    {
      title: 'Brave New World',
      author: 'Aldous Huxley',
      isbn: '9780060850524',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780060850524-L.jpg',
      category_id: catMap.get('literature-fiction'),
      tags: ['dystopian', 'classic', 'science-fiction'],
      location: 'Shelf D3',
      section: 'Literature',
      dewey_decimal: '823.912',
      description: 'A dystopian novel detailing a genetically modified and consumerist society.',
      published_year: 1932
    },
    {
      title: 'The Hobbit',
      author: 'J.R.R. Tolkien',
      isbn: '9780345339683',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780345339683-L.jpg',
      category_id: catMap.get('literature-fiction'),
      tags: ['fantasy', 'adventure', 'classics'],
      location: 'Shelf D4',
      section: 'Literature',
      dewey_decimal: '823.912',
      description: 'Bilbo Baggins is whisked away from his comfortable hobbit hole by Gandalf the wizard and a band of dwarves.',
      published_year: 1937
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
    {
      title: 'Guns, Germs, and Steel',
      author: 'Jared Diamond',
      isbn: '9780393317558',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780393317558-L.jpg',
      category_id: catMap.get('history-biography'),
      tags: ['history', 'anthropology', 'geography'],
      location: 'Shelf E3',
      section: 'History',
      dewey_decimal: '303.4',
      description: 'An exploration of how environmental factors shaped the modern world’s geopolitical inequalities.',
      published_year: 1997
    },
    {
      title: 'Steve Jobs',
      author: 'Walter Isaacson',
      isbn: '9781451648539',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9781451648539-L.jpg',
      category_id: catMap.get('history-biography'),
      tags: ['biography', 'technology', 'entrepreneurship'],
      location: 'Shelf E4',
      section: 'Biography',
      dewey_decimal: '920',
      description: 'The definitive biography of Apple co-founder Steve Jobs based on interviews conducted over two years.',
      published_year: 2011
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
    {
      title: 'The Lean Startup',
      author: 'Eric Ries',
      isbn: '9780307887894',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780307887894-L.jpg',
      category_id: catMap.get('business-economics'),
      tags: ['business', 'startups', 'entrepreneurship'],
      location: 'Shelf F3',
      section: 'Business',
      dewey_decimal: '658.11',
      description: 'A methodology for developing businesses and products through validated learning and rapid experimentation.',
      published_year: 2011
    },
    {
      title: 'Zero to One',
      author: 'Peter Thiel',
      isbn: '9780804139298',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780804139298-L.jpg',
      category_id: catMap.get('business-economics'),
      tags: ['startups', 'entrepreneurship', 'strategy'],
      location: 'Shelf F4',
      section: 'Business',
      dewey_decimal: '658.11',
      description: 'Notes on startups, how to build the future, and creating a monopoly.',
      published_year: 2014
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
    },
    {
      title: "Man's Search for Meaning",
      author: 'Viktor E. Frankl',
      isbn: '9780807014295',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780807014295-L.jpg',
      category_id: catMap.get('philosophy-ethics'),
      tags: ['psychology', 'philosophy', 'memoir'],
      location: 'Shelf G3',
      section: 'Philosophy',
      dewey_decimal: '150.195',
      description: 'Frankl’s experiences in concentration camps and his development of logotherapy, exploring the human search for purpose.',
      published_year: 1946
    },
    // Art & Design
    {
      title: 'The Design of Everyday Things',
      author: 'Don Norman',
      isbn: '9780465050659',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780465050659-L.jpg',
      category_id: catMap.get('art-design'),
      tags: ['ux-design', 'ergonomics', 'product-design'],
      location: 'Shelf H1',
      section: 'Art & Design',
      dewey_decimal: '745.2',
      description: 'A fundamental book on design and usability, arguing that everyday objects should be intuitive.',
      published_year: 1988
    },
    {
      title: "Don't Make Me Think",
      author: 'Steve Krug',
      isbn: '9780321965516',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780321965516-L.jpg',
      category_id: catMap.get('art-design'),
      tags: ['web-usability', 'ux-design', 'interface-design'],
      location: 'Shelf H1',
      section: 'Art & Design',
      dewey_decimal: '006.7',
      description: 'A common-sense guide to web usability, focusing on simple design principles.',
      published_year: 2000
    },
    // Health & Medicine
    {
      title: 'The Emperor of All Maladies',
      author: 'Siddhartha Mukherjee',
      isbn: '9781439170915',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9781439170915-L.jpg',
      category_id: catMap.get('health-medicine'),
      tags: ['medicine', 'history', 'science'],
      location: 'Shelf I1',
      section: 'Health & Medicine',
      dewey_decimal: '616.994',
      description: 'A biography of cancer, documenting its history, treatment research, and human toll.',
      published_year: 2010
    },
    {
      title: 'Being Mortal',
      author: 'Atul Gawande',
      isbn: '9781250076229',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9781250076229-L.jpg',
      category_id: catMap.get('health-medicine'),
      tags: ['medicine', 'ethics', 'society'],
      location: 'Shelf I1',
      section: 'Health & Medicine',
      dewey_decimal: '362.175',
      description: 'Gawande addresses aging and end-of-life care, focusing on quality of life rather than just survival.',
      published_year: 2014
    },
    {
      title: 'Why We Sleep',
      author: 'Matthew Walker',
      isbn: '9781501144317',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9781501144317-L.jpg',
      category_id: catMap.get('health-medicine'),
      tags: ['neuroscience', 'sleep-science', 'health'],
      location: 'Shelf I2',
      section: 'Health & Medicine',
      dewey_decimal: '612.821',
      description: 'An exploration of the vital importance of sleep for human health, cognitive function, and longevity.',
      published_year: 2017
    },
    // Law & Politics
    {
      title: 'A Promised Land',
      author: 'Barack Obama',
      isbn: '9781524763169',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9781524763169-L.jpg',
      category_id: catMap.get('law-politics'),
      tags: ['memoir', 'politics', 'history'],
      location: 'Shelf J1',
      section: 'Politics',
      dewey_decimal: '973.932',
      description: 'The first volume of presidential memoirs by the 44th president of the United States.',
      published_year: 2020
    },
    {
      title: 'Educated',
      author: 'Tara Westover',
      isbn: '9780399590504',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780399590504-L.jpg',
      category_id: catMap.get('literature-fiction'),
      tags: ['memoir', 'biography', 'education'],
      location: 'Shelf E4',
      section: 'Biography',
      dewey_decimal: '920.72',
      description: 'A memoir about a young girl who leaves her survivalist family in Idaho to pursue higher education.',
      published_year: 2018
    },
    {
      title: 'Atomic Habits',
      author: 'James Clear',
      isbn: '9780735211292',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780735211292-L.jpg',
      category_id: catMap.get('business-economics'),
      tags: ['self-help', 'productivity', 'habits'],
      location: 'Shelf F5',
      section: 'Self Help',
      dewey_decimal: '158.1',
      description: 'An easy and proven way to build good habits and break bad ones.',
      published_year: 2018
    },
    {
      title: 'Deep Work',
      author: 'Cal Newport',
      isbn: '9781455586691',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9781455586691-L.jpg',
      category_id: catMap.get('computer-science'),
      tags: ['productivity', 'focus', 'self-help'],
      location: 'Shelf A5',
      section: 'Self Help',
      dewey_decimal: '650.1',
      description: 'Rules for focused success in a distracted world.',
      published_year: 2016
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
    // Choose number of copies dynamically based on title popularity
    let numCopies = 3;
    if (['Clean Code', 'Introduction to Algorithms', 'Atomic Habits', 'The Design of Everyday Things'].includes(book.title)) {
      numCopies = 5;
    } else if (['Linear Algebra Done Right', 'Gödel, Escher, Bach: An Eternal Golden Braid', 'A Promised Land'].includes(book.title)) {
      numCopies = 2;
    } else if (['Calculus Vol 1'].includes(book.title)) {
      numCopies = 1;
    }

    for (let i = 0; i < numCopies; i++) {
      let condition = 'Good';
      if (i === 0) {
        condition = 'New';
      } else if (i === numCopies - 1 && numCopies > 2) {
        condition = 'Fair';
      } else if (i === 1) {
        condition = 'Good';
      } else {
        condition = 'Worn';
      }
      copies.push({ book_id: book.id, condition, status: 'AVAILABLE' });
    }
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

  const now = new Date();
  const borrowsToSeed: any[] = [];
  const activeCopiesToUpdate: string[] = [];

  // Active Borrows (due in the future)
  const activeConfigs = [
    { title: 'Clean Code', copyIdx: 0, student: 'godwynStudent', daysAgo: 2, dueDays: 12 },
    { title: 'Deep Work', copyIdx: 0, student: 'godwynStudent', daysAgo: 4, dueDays: 10 },
    { title: 'Calculus Vol 1', copyIdx: 0, student: 'kayleStudent', daysAgo: 1, dueDays: 13 },
    { title: 'A Brief History of Time', copyIdx: 0, student: 'jericoSA', daysAgo: 3, dueDays: 11 },
    { title: 'Introduction to Algorithms', copyIdx: 0, student: 'luminaSA', daysAgo: 4, dueDays: 10 },
    { title: 'Designing Data-Intensive Applications', copyIdx: 0, student: 'luminaSA', daysAgo: 5, dueDays: 9 },
    { title: 'The Design of Everyday Things', copyIdx: 0, student: 'kennethAdmin', daysAgo: 2, dueDays: 12 },
  ];

  for (const conf of activeConfigs) {
    const copyId = getCopyId(conf.title, conf.copyIdx);
    if (copyId) {
      borrowsToSeed.push({
        user_id: (profileIds as any)[conf.student],
        book_copy_id: copyId,
        processed_by: profileIds.rhedLibrarian,
        borrowed_at: new Date(now.getTime() - conf.daysAgo * 24 * 60 * 60 * 1000).toISOString(),
        due_date: new Date(now.getTime() + conf.dueDays * 24 * 60 * 60 * 1000).toISOString(),
        status: 'ACTIVE'
      });
      activeCopiesToUpdate.push(copyId);
    }
  }

  // Overdue Borrows (due in the past)
  const overdueConfigs = [
    { title: 'The Pragmatic Programmer', copyIdx: 1, student: 'godwynStudent', daysAgo: 20, dueDaysAgo: 6 },
    { title: 'Zero to One', copyIdx: 0, student: 'kayleStudent', daysAgo: 25, dueDaysAgo: 11 },
    { title: 'Atomic Habits', copyIdx: 1, student: 'kennethAdmin', daysAgo: 30, dueDaysAgo: 16 },
  ];

  for (const conf of overdueConfigs) {
    const copyId = getCopyId(conf.title, conf.copyIdx);
    if (copyId) {
      borrowsToSeed.push({
        user_id: (profileIds as any)[conf.student],
        book_copy_id: copyId,
        processed_by: profileIds.luminaLibrarian,
        borrowed_at: new Date(now.getTime() - conf.daysAgo * 24 * 60 * 60 * 1000).toISOString(),
        due_date: new Date(now.getTime() - conf.dueDaysAgo * 24 * 60 * 60 * 1000).toISOString(),
        status: 'OVERDUE'
      });
      activeCopiesToUpdate.push(copyId);
    }
  }

  // Returned Borrows (completed borrows - 20 records)
  const returnedConfigs = [
    { title: 'The Pragmatic Programmer', copyIdx: 0, student: 'kayleStudent', borrowDaysAgo: 35, returnDaysAgo: 21 },
    { title: 'Refactoring: Improving the Design of Existing Code', copyIdx: 0, student: 'godwynStudent', borrowDaysAgo: 22, returnDaysAgo: 10 },
    { title: 'Design Patterns: Elements of Reusable Object-Oriented Software', copyIdx: 0, student: 'jericoSA', borrowDaysAgo: 28, returnDaysAgo: 14 },
    { title: 'Linear Algebra and Its Applications', copyIdx: 0, student: 'luminaSA', borrowDaysAgo: 19, returnDaysAgo: 5 },
    { title: 'The Selfish Gene', copyIdx: 0, student: 'godwynStudent', borrowDaysAgo: 18, returnDaysAgo: 4 },
    { title: 'Cosmos', copyIdx: 0, student: 'kayleStudent', borrowDaysAgo: 17, returnDaysAgo: 3 },
    { title: 'To Kill a Mockingbird', copyIdx: 0, student: 'jericoSA', borrowDaysAgo: 16, returnDaysAgo: 2 },
    { title: '1984', copyIdx: 0, student: 'godwynStudent', borrowDaysAgo: 15, returnDaysAgo: 1 },
    { title: 'The Great Gatsby', copyIdx: 0, student: 'kayleStudent', borrowDaysAgo: 14, returnDaysAgo: 0 },
    { title: 'Brave New World', copyIdx: 0, student: 'luminaSA', borrowDaysAgo: 13, returnDaysAgo: 2 },
    { title: 'The Hobbit', copyIdx: 0, student: 'godwynStudent', borrowDaysAgo: 12, returnDaysAgo: 3 },
    { title: 'Sapiens: A Brief History of Humankind', copyIdx: 0, student: 'kayleStudent', borrowDaysAgo: 11, returnDaysAgo: 4 },
    { title: 'The Diary of a Young Girl', copyIdx: 0, student: 'jericoSA', borrowDaysAgo: 10, returnDaysAgo: 2 },
    { title: 'Guns, Germs, and Steel', copyIdx: 0, student: 'godwynStudent', borrowDaysAgo: 9, returnDaysAgo: 1 },
    { title: 'Steve Jobs', copyIdx: 0, student: 'kayleStudent', borrowDaysAgo: 8, returnDaysAgo: 0 },
    { title: 'Thinking, Fast and Slow', copyIdx: 0, student: 'jericoSA', borrowDaysAgo: 7, returnDaysAgo: 1 },
    { title: 'The Intelligent Investor', copyIdx: 0, student: 'luminaSA', borrowDaysAgo: 6, returnDaysAgo: 2 },
    { title: 'The Lean Startup', copyIdx: 0, student: 'godwynStudent', borrowDaysAgo: 5, returnDaysAgo: 1 },
    { title: 'The Republic', copyIdx: 0, student: 'kayleStudent', borrowDaysAgo: 4, returnDaysAgo: 0 },
    { title: 'Meditations', copyIdx: 0, student: 'jericoSA', borrowDaysAgo: 3, returnDaysAgo: 1 },
  ];

  for (const conf of returnedConfigs) {
    const copyId = getCopyId(conf.title, conf.copyIdx);
    if (copyId) {
      borrowsToSeed.push({
        user_id: (profileIds as any)[conf.student],
        book_copy_id: copyId,
        processed_by: profileIds.rhedLibrarian,
        borrowed_at: new Date(now.getTime() - conf.borrowDaysAgo * 24 * 60 * 60 * 1000).toISOString(),
        due_date: new Date(now.getTime() - (conf.borrowDaysAgo - 14) * 24 * 60 * 60 * 1000).toISOString(),
        returned_at: new Date(now.getTime() - conf.returnDaysAgo * 24 * 60 * 60 * 1000).toISOString(),
        returned_by: profileIds.rhedLibrarian,
        status: 'RETURNED'
      });
    }
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
  }

  // Reservations
  const bookRefactoring = books.find(b => b.title === 'Refactoring: Improving the Design of Existing Code');
  const bookSteveJobs = books.find(b => b.title === 'Steve Jobs');
  const bookCleanCode = books.find(b => b.title === 'Clean Code');
  const bookSapiens = books.find(b => b.title === 'Sapiens: A Brief History of Humankind');

  const refactoringCopies = bookCopiesMap['Refactoring: Improving the Design of Existing Code'] || [];
  const cleanCodeCopies = bookCopiesMap['Clean Code'] || [];
  const sapiensCopies = bookCopiesMap['Sapiens: A Brief History of Humankind'] || [];

  const reservationsToSeed: any[] = [];
  const reservedCopiesToUpdate: string[] = [];

  if (bookRefactoring && refactoringCopies[1]) {
    reservationsToSeed.push({
      user_id: profileIds.kayleStudent,
      book_id: bookRefactoring.id,
      copy_id: refactoringCopies[1].id,
      status: 'READY',
      queue_position: 1,
      reserved_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      hold_expires_at: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString()
    });
    reservationsToSeed.push({
      user_id: profileIds.godwynStudent,
      book_id: bookRefactoring.id,
      status: 'ACTIVE',
      queue_position: 2,
      reserved_at: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString()
    });
    reservedCopiesToUpdate.push(refactoringCopies[1].id);
  }

  if (bookSteveJobs) {
    reservationsToSeed.push({
      user_id: profileIds.jericoSA,
      book_id: bookSteveJobs.id,
      status: 'ACTIVE',
      queue_position: 1,
      reserved_at: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString()
    });
  }

  if (bookCleanCode && cleanCodeCopies[1]) {
    reservationsToSeed.push({
      user_id: profileIds.kayleStudent,
      book_id: bookCleanCode.id,
      copy_id: cleanCodeCopies[1].id,
      status: 'FULFILLED',
      queue_position: 1,
      reserved_at: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      fulfilled_at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString()
    });
  }

  if (bookSapiens && sapiensCopies[1]) {
    reservationsToSeed.push({
      user_id: profileIds.godwynStudent,
      book_id: bookSapiens.id,
      copy_id: sapiensCopies[1].id,
      status: 'EXPIRED',
      queue_position: 1,
      reserved_at: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      hold_expires_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString()
    });
  }

  if (reservationsToSeed.length > 0) {
    const { error: reservationError } = await supabase.from('reservations').insert(reservationsToSeed);
    if (reservationError) {
      logInfo(`❌ Error seeding reservations: ${reservationError.message}`);
    } else {
      logInfo('✅ Seeded reservations');
    }
  }

  if (reservedCopiesToUpdate.length > 0) {
    const { error: updateReservedError } = await supabase
      .from('book_copies')
      .update({ status: 'RESERVED' })
      .in('id', reservedCopiesToUpdate);
    if (updateReservedError) {
      logInfo(`❌ Error updating reserved copies status: ${updateReservedError.message}`);
    } else {
      logInfo('✅ Updated reserved book copies status to RESERVED');
    }
  }

  // Attendance (30 completed records over past 15 days)
  const attendanceToSeed: any[] = [];
  const profilesForAttendance = [
    profileIds.godwynStudent,
    profileIds.kayleStudent,
    profileIds.jericoSA,
    profileIds.luminaSA,
    profileIds.rhedLibrarian
  ];
  
  for (let d = 1; d <= 15; d++) {
    const dayDate = new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
    const index1 = (d * 3) % profilesForAttendance.length;
    const index2 = (d * 7 + 1) % profilesForAttendance.length;
    
    const checkIn1 = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), 8 + (d % 3), d % 60);
    const checkOut1 = new Date(checkIn1.getTime() + (3 + (d % 4)) * 60 * 60 * 1000);
    
    const checkIn2 = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), 13 + (d % 2), (d * 5) % 60);
    const checkOut2 = new Date(checkIn2.getTime() + (2 + (d % 3)) * 60 * 60 * 1000);
    
    attendanceToSeed.push({
      user_id: profilesForAttendance[index1],
      check_in_at: checkIn1.toISOString(),
      check_out_at: checkOut1.toISOString(),
      notes: d % 3 === 0 ? 'Study session' : d % 3 === 1 ? 'Research work' : 'Group meeting'
    });
    
    attendanceToSeed.push({
      user_id: profilesForAttendance[index2],
      check_in_at: checkIn2.toISOString(),
      check_out_at: checkOut2.toISOString(),
      notes: d % 2 === 0 ? 'Library assistant duty' : 'Studying calculus'
    });
  }

  const { error: attendanceError } = await supabase.from('attendance').insert(attendanceToSeed);
  if (attendanceError) {
    logInfo(`❌ Error seeding attendance: ${attendanceError.message}`);
  } else {
    logInfo('✅ Seeded completed attendance records');
  }

  // Notifications (5 records)
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
      content: 'You have borrowed "Clean Code". It is due on ' + new Date(now.getTime() + 12 * 24 * 60 * 60 * 1000).toLocaleDateString() + '.',
      type: 'CIRCULATION',
      priority: 'medium',
      is_read: false,
      metadata: {}
    },
    {
      user_id: profileIds.godwynStudent,
      title: 'OVERDUE NOTICE: "The Pragmatic Programmer"',
      content: 'The copy of "The Pragmatic Programmer" you borrowed was due on ' + new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000).toLocaleDateString() + '. Please return it immediately to avoid account suspension.',
      type: 'CIRCULATION',
      priority: 'high',
      is_read: false,
      metadata: {}
    },
    {
      user_id: profileIds.kayleStudent,
      title: 'Reservation Ready for Pickup',
      content: 'Your reservation for "Refactoring" is ready. You have until ' + new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000).toLocaleDateString() + ' to pick it up at the circulation desk.',
      type: 'CIRCULATION',
      priority: 'high',
      is_read: false,
      metadata: {}
    },
    {
      user_id: profileIds.kennethAdmin,
      title: 'System Policy Setting Updated',
      content: 'Admin Lumina Admin updated key: "loan_period_days" to "14".',
      type: 'SYSTEM',
      priority: 'low',
      is_read: true,
      metadata: {}
    }
  ];

  const { error: notificationError } = await supabase.from('notifications').insert(notificationsToSeed);
  if (notificationError) {
    logInfo(`❌ Error seeding notifications: ${notificationError.message}`);
  } else {
    logInfo('✅ Seeded notifications');
  }

  // Reports (3 damage reports)
  const bookCleanCodeObj = books.find(b => b.title === 'Clean Code');
  const bookCalculusObj = books.find(b => b.title === 'Calculus Vol 1');
  if (bookCleanCodeObj && bookCalculusObj && bookSteveJobs) {
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
      },
      {
        book_id: bookSteveJobs.id,
        user_id: profileIds.jericoSA,
        notes: 'Water damage detected on the last 20 pages, pages are warped but readable.',
        status: 'pending',
        created_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];

    const { error: reportError } = await supabase.from('reports').insert(reportsToSeed);
    if (reportError) {
      logInfo(`❌ Error seeding reports: ${reportError.message}`);
    } else {
      logInfo('✅ Seeded reports');
    }
  }

  // Audit Logs (4 logs)
  const auditLogsToSeed = [
    {
      admin_id: profileIds.luminaAdmin,
      entity_type: 'books',
      action: 'CREATE_BOOK',
      reason: 'Standard catalog initialization',
      details: { count: books.length }
    },
    {
      admin_id: profileIds.luminaAdmin,
      entity_type: 'system_settings',
      action: 'UPDATE_SYSTEM_SETTINGS',
      reason: 'Revised loan policy per admin instruction',
      details: { key: 'loan_period_days', value: '14' }
    },
    {
      admin_id: profileIds.kennethAdmin,
      entity_type: 'profiles',
      action: 'UPDATE_USER_ROLE',
      reason: 'Promoted to Student Assistant role',
      details: { user_id: profileIds.jericoSA, role: 'student_assistant' }
    },
    {
      admin_id: profileIds.rhedLibrarian,
      entity_type: 'books',
      action: 'UPDATE_BOOK_DETAILS',
      reason: 'Updated location shelf coordinates',
      details: { book_title: 'The Design of Everyday Things', old_location: 'Shelf H1', new_location: 'Shelf H1-A' }
    }
  ];

  const { error: auditError } = await supabase.from('audit_logs').insert(auditLogsToSeed);
  if (auditError) {
    logInfo(`❌ Error seeding audit logs: ${auditError.message}`);
  } else {
    logInfo('✅ Seeded audit logs');
  }

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
  const now = new Date();
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
    },
    {
      title: 'Urgent: Maintenance in West Wing Study Area',
      content: 'Due to air conditioning repairs, the West Wing study room will be closed this Wednesday. Please use main hall study desks.',
      priority: 'critical',
      is_active: true,
      target_role: null,
      starts_at: new Date(now.getTime()).toISOString(),
      created_by: profileIds.kennethAdmin
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

  // Seed Checklist Options
  logInfo('🌱 Seeding checklist options...');
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
    { type: 'module', value: 'Dashboard' },
    { type: 'module', value: 'Penalties' }
  ];
  const { error: optionsError } = await supabase
    .from('checklist_dropdown_options')
    .insert(optionsToSeed);
  if (optionsError) {
    logInfo(`❌ Error seeding checklist options: ${optionsError.message}`);
  } else {
    logInfo('✅ Seeded checklist options');
  }

  // Seed Checklist Items
  logInfo('🌱 Seeding checklist items...');
  const itemsToSeed = [
    { problem: 'UI overflow in catalog cards on mobile screens', explanation: 'The tags section stretches too wide and breaks the grid layout.', user_role: 'student', module: 'Catalog', is_completed: false },
    { problem: 'Session timeout occurs too quickly during scan operations', explanation: 'Librarians get logged out during continuous book checking scans.', user_role: 'librarian', module: 'Circulation', is_completed: true },
    { problem: 'Audit logs fail to capture custom settings change events', explanation: 'Changing settings through the admin dashboard settings page is not logging correctly.', user_role: 'super_admin', module: 'Settings', is_completed: false },
    { problem: 'Overdue auto-status update cron fails intermittently', explanation: 'Some profiles do not get marked as suspended when having 3+ overdue items.', user_role: 'super_admin', module: 'Penalties', is_completed: false },
    { problem: 'QR scanner camera fails to open on Safari (iOS)', explanation: 'Permission request prompts do not trigger on Safari browsers.', user_role: 'student_assistant', module: 'Circulation', is_completed: false }
  ];
  const { error: itemsError } = await supabase
    .from('checklist_items')
    .insert(itemsToSeed);
  if (itemsError) {
    logInfo(`❌ Error seeding checklist items: ${itemsError.message}`);
  } else {
    logInfo('✅ Seeded checklist items');
  }

  logInfo('✨ Full database seeding completed successfully!');
  return log;
}
