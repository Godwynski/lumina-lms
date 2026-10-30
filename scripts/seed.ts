import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });
dotenv.config({ path: resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// Define all profiles/users in the database
export const profileIds = {
  godwynStudent: 'f1d742df-ca66-4ac8-a4e2-7369c1dc4460', // Godwyn Neri (STU-376375)
  calinogStudent: '36d142ea-ade7-4f20-9095-80373b63f67c', // Josh Raizen Calinog (STU-190782)
  kayleStudent: '31a98d40-ad47-4593-aee1-b62ff387153d', // Kayle Andrew Floriano (STU-376536)
  kaylePersonal: 'ed6532f0-0a72-4689-8a87-6080a289d3b8', // Kayle Floriano Personal (STU-826019)
  jericoSA: '5e674c6d-cf73-4b78-a2e9-9f32f9553511', // Jerico Dadea (STU-368330)
  kennethStudent: '486205e4-1fad-421c-8946-fdd0da5217bf', // Kenneth James Tolentino (STU-351534)
  rhedStudent: '31afd312-7272-413a-892a-a67be05caf10', // Rhed Resurreccion (STU-357161)
  baybayLibrarian: '769c24e8-098a-464e-b304-b42049da60fa', // John Renaund Baybay (FAC-982441)
  luminaAdmin: '00000000-0000-0000-0000-000000000001', // Lumina Admin (FAC-ADM-001)
  luminaLibrarian: '00000000-0000-0000-0000-000000000002', // Lumina Librarian (FAC-LIB-001)
  luminaSA: '00000000-0000-0000-0000-000000000005', // Lumina Staff (FAC-STF-001)
  demoStudent: '00000000-0000-0000-0000-000000000006', // Demo Student Patron (STU-001)
  luminaSuperAdmin: '00000000-0000-0000-0000-000000000008', // Lumina Super Admin (FAC-SAD-001)
};

async function seed() {
  console.info('🌱 Starting comprehensive organized database seed...');

  // --- Clean-up Phase ---
  console.info('🧹 Cleaning up database tables in dependency order...');
  
  await supabase.from('rate_limit_log').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('deleted_profile_info').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('ui_preferences').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('checklist_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('checklist_dropdown_options').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('audit_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('reports').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('announcements').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('notifications').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('attendance').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('reservations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('borrowing_records').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('checkout_idempotency').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('return_idempotency').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('library_cards').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('book_copies').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('books').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('categories').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  console.info('🧹 Clean-up completed.');

  // 1. Seed Categories
  console.info('📚 Seeding organized categories...');
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
    console.error('Error seeding categories:', catError);
    return;
  }
  console.info(`✅ Seeded ${catData.length} categories`);

  const catMap = new Map(catData.map(c => [c.slug, c.id]));
  const getCatId = (slug: string) => catMap.get(slug);

  // 2. Sanitize & Verify User Profiles
  console.info('👤 Verifying and organizing user profiles...');
  const userProfileUpdates = [
    { id: profileIds.godwynStudent, full_name: 'Neri, Godwyn', department: 'BS Information Technology', phone: '+63 917 845 2911', address: 'Alabang, Muntinlupa City', status: 'ACTIVE', onboarding_completed: true },
    { id: profileIds.calinogStudent, full_name: 'Calinog, Josh Raizen', department: 'BS Information Technology', phone: '+63 921 542 1982', address: 'Putatan, Muntinlupa City', status: 'ACTIVE', onboarding_completed: true },
    { id: profileIds.kayleStudent, full_name: 'Floriano, Kayle Andrew', department: 'BS Computer Science', phone: '+63 961 509 1963', address: 'San Pedro, Laguna', status: 'ACTIVE', onboarding_completed: true },
    { id: profileIds.kaylePersonal, full_name: 'Floriano, Kayle (Personal)', department: 'BS Computer Science', phone: '+63 961 509 1963', address: 'San Pedro, Laguna', status: 'ACTIVE', onboarding_completed: true },
    { id: profileIds.jericoSA, full_name: 'Dadea, Jerico', department: 'BS Information Technology', phone: '+63 985 403 6633', address: 'Bagumbayan, Taguig City', status: 'ACTIVE', onboarding_completed: true },
    { id: profileIds.kennethStudent, full_name: 'Tolentino, Kenneth James', department: 'BS Information Technology', phone: '+63 969 166 0480', address: 'Cupang, Muntinlupa City', status: 'ACTIVE', onboarding_completed: true },
    { id: profileIds.rhedStudent, full_name: 'Resurreccion, Rhed', department: 'BS Information Technology', phone: '+63 945 972 7869', address: 'Poblacion, Muntinlupa City', status: 'ACTIVE', onboarding_completed: true },
    { id: profileIds.baybayLibrarian, full_name: 'Baybay, John Renaund', department: 'College of Information Technology', phone: '+63 918 334 1109', address: 'Alabang, Muntinlupa City', status: 'ACTIVE', onboarding_completed: true },
    { id: profileIds.luminaSuperAdmin, full_name: 'Lumina Super Admin', department: 'Administration', phone: '+63 917 100 0008', address: 'Lumina Learning Resource Center', status: 'ACTIVE', onboarding_completed: true, role: 'librarian' },
    { id: profileIds.luminaAdmin, full_name: 'Lumina System Admin', department: 'IT Administration', phone: '+63 917 100 0001', address: 'Lumina Learning Resource Center', status: 'ACTIVE', onboarding_completed: true, role: 'super_admin' },
    { id: profileIds.luminaLibrarian, full_name: 'Lumina Head Librarian', department: 'Library Services', phone: '+63 917 100 0002', address: 'Lumina Learning Resource Center', status: 'ACTIVE', onboarding_completed: true },
    { id: profileIds.luminaSA, full_name: 'Lumina Desk Assistant', department: 'Library Services', phone: '+63 917 100 0005', address: 'Lumina Learning Resource Center', status: 'ACTIVE', onboarding_completed: true },
    { id: profileIds.demoStudent, full_name: 'Demo Student Patron', department: 'BS Computer Science', phone: '+63 917 100 0006', address: 'STI College Alabang', status: 'ACTIVE', onboarding_completed: true },
  ];

  for (const prof of userProfileUpdates) {
    await supabase.from('profiles').update(prof).eq('id', prof.id);
  }
  console.info('✅ Profiles sanitized and organized');

  // // 3. Define Books
const booksToSeed = [
    // --- COMPUTER SCIENCE ---
    {
      title: 'Clean Code',
      author: 'Robert C. Martin',
      isbn: '9780132350884',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780132350884-L.jpg',
      category_id: getCatId('computer-science'),
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
      category_id: getCatId('computer-science'),
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
      category_id: getCatId('computer-science'),
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
      category_id: getCatId('computer-science'),
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
      category_id: getCatId('computer-science'),
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
      category_id: getCatId('computer-science'),
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
      category_id: getCatId('computer-science'),
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
      category_id: getCatId('computer-science'),
      tags: ['compilers', 'computer-science', 'parser'],
      location: 'Shelf A4',
      section: 'Computer Science',
      dewey_decimal: '005.453',
      description: 'Known as the "Dragon Book", this is the definitive guide to compiler construction.',
      published_year: 2006
    },
    {
      title: 'Structure and Interpretation of Computer Programs',
      author: 'Harold Abelson & Gerald Jay Sussman',
      isbn: '9780262510875',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780262510875-L.jpg',
      category_id: getCatId('computer-science'),
      tags: ['lisp', 'programming-languages', 'computer-science'],
      location: 'Shelf A5',
      section: 'Computer Science',
      dewey_decimal: '005.1',
      description: 'A classic introduction to computer science using Scheme/Lisp.',
      published_year: 1996
    },
    {
      title: 'Code Complete',
      author: 'Steve McConnell',
      isbn: '9780735619678',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780735619678-L.jpg',
      category_id: getCatId('computer-science'),
      tags: ['software-construction', 'coding-style', 'programming'],
      location: 'Shelf A5',
      section: 'Computer Science',
      dewey_decimal: '005.1',
      description: 'A comprehensive handbook of software construction and best coding practices.',
      published_year: 2004
    },
    // --- MATHEMATICS ---
    {
      title: 'Calculus Vol 1',
      author: 'Tom M. Apostol',
      isbn: '9788126515196',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9788126515196-L.jpg',
      category_id: getCatId('mathematics'),
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
      category_id: getCatId('mathematics'),
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
      category_id: getCatId('mathematics'),
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
      category_id: getCatId('mathematics'),
      tags: ['math-logic', 'cognitive-science', 'philosophy'],
      location: 'Shelf B2',
      section: 'Mathematics',
      dewey_decimal: '510.1',
      description: 'A Pulitzer Prize-winning book exploring common themes in math, logic, art, and music.',
      published_year: 1979
    },
    {
      title: 'Introduction to Topology',
      author: 'Bert Mendelson',
      isbn: '9780486663524',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780486663524-L.jpg',
      category_id: getCatId('mathematics'),
      tags: ['topology', 'pure-mathematics', 'geometry'],
      location: 'Shelf B3',
      section: 'Mathematics',
      dewey_decimal: '514',
      description: 'A classic, highly accessible introduction to metric spaces and topological spaces.',
      published_year: 1990
    },
    {
      title: 'Discrete Mathematics and Its Applications',
      author: 'Kenneth H. Rosen',
      isbn: '9780073383095',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780073383095-L.jpg',
      category_id: getCatId('mathematics'),
      tags: ['discrete-math', 'logic', 'computer-science-math'],
      location: 'Shelf B3',
      section: 'Mathematics',
      dewey_decimal: '511.3',
      description: 'The standard textbook on discrete mathematical structures for computer science students.',
      published_year: 2011
    },
    {
      title: 'Abstract Algebra',
      author: 'David S. Dummit & Richard M. Foote',
      isbn: '9780471433347',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780471433347-L.jpg',
      category_id: getCatId('mathematics'),
      tags: ['algebra', 'groups-rings-fields', 'pure-math'],
      location: 'Shelf B4',
      section: 'Mathematics',
      dewey_decimal: '512.02',
      description: 'A comprehensive, clear textbook covering the core topics of abstract algebra.',
      published_year: 2003
    },
    {
      title: 'Probability and Random Processes',
      author: 'Geoffrey Grimmett & David Stirzaker',
      isbn: '9780198572220',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780198572220-L.jpg',
      category_id: getCatId('mathematics'),
      tags: ['probability', 'statistics', 'random-processes'],
      location: 'Shelf B4',
      section: 'Mathematics',
      dewey_decimal: '519.2',
      description: 'A detailed treatment of probability theory and random variables.',
      published_year: 2001
    },
    {
      title: 'Calculus on Manifolds',
      author: 'Michael Spivak',
      isbn: '9780805390216',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780805390216-L.jpg',
      category_id: getCatId('mathematics'),
      tags: ['calculus', 'differential-geometry', 'analysis'],
      location: 'Shelf B5',
      section: 'Mathematics',
      dewey_decimal: '515',
      description: 'A modern approach to advanced calculus in several variables on manifolds.',
      published_year: 1965
    },
    {
      title: 'The Princeton Companion to Mathematics',
      author: 'Timothy Gowers',
      isbn: '9780691118802',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780691118802-L.jpg',
      category_id: getCatId('mathematics'),
      tags: ['math-reference', 'history-of-math', 'encyclopedia'],
      location: 'Shelf B5',
      section: 'Mathematics',
      dewey_decimal: '510',
      description: 'An expansive reference guide to the key concepts, branches, and practitioners of modern mathematics.',
      published_year: 2008
    },
    // --- SCIENCE & TECHNOLOGY ---
    {
      title: 'A Brief History of Time',
      author: 'Stephen Hawking',
      isbn: '9780553380163',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780553380163-L.jpg',
      category_id: getCatId('science-technology'),
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
      category_id: getCatId('science-technology'),
      tags: ['evolutionary-biology', 'genetics', 'science'],
      location: 'Shelf C1',
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
      category_id: getCatId('science-technology'),
      tags: ['astronomy', 'science-history', 'popular-science'],
      location: 'Shelf C2',
      section: 'Science',
      dewey_decimal: '520',
      description: 'Carl Sagan’s classic exploration of the universe, science, and the human journey of discovery.',
      published_year: 1980
    },
    {
      title: 'The Elegant Universe',
      author: 'Brian Greene',
      isbn: '9780393058581',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780393058581-L.jpg',
      category_id: getCatId('science-technology'),
      tags: ['string-theory', 'physics', 'relativity'],
      location: 'Shelf C2',
      section: 'Science',
      dewey_decimal: '539.7',
      description: 'Superstrings, hidden dimensions, and the quest for the ultimate theory of physics.',
      published_year: 1999
    },
    {
      title: 'A Short History of Nearly Everything',
      author: 'Bill Bryson',
      isbn: '9780767908177',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780767908177-L.jpg',
      category_id: getCatId('science-technology'),
      tags: ['general-science', 'history-of-science', 'popular-science'],
      location: 'Shelf C3',
      section: 'Science',
      dewey_decimal: '500',
      description: 'A witty and informative journey through the history of scientific discovery and human knowledge.',
      published_year: 2003
    },
    {
      title: 'The Gene: An Intimate History',
      author: 'Siddhartha Mukherjee',
      isbn: '9781476715490',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9781476715490-L.jpg',
      category_id: getCatId('science-technology'),
      tags: ['genetics', 'biology', 'science-history'],
      location: 'Shelf C3',
      section: 'Science',
      dewey_decimal: '576.5',
      description: 'The story of the birth, growth, and future of genetics, told with Mukherjee’s signature narrative drive.',
      published_year: 2016
    },
    {
      title: 'Silent Spring',
      author: 'Rachel Carson',
      isbn: '9780618249060',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780618249060-L.jpg',
      category_id: getCatId('science-technology'),
      tags: ['ecology', 'environmentalism', 'pesticides'],
      location: 'Shelf C4',
      section: 'Science',
      dewey_decimal: '363.7',
      description: 'The seminal environmental book exposing the dangers of synthetic pesticides and launching the ecological movement.',
      published_year: 1962
    },
    {
      title: 'The Double Helix',
      author: 'James D. Watson',
      isbn: '9780743216302',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780743216302-L.jpg',
      category_id: getCatId('science-technology'),
      tags: ['dna', 'molecular-biology', 'memoir'],
      location: 'Shelf C4',
      section: 'Science',
      dewey_decimal: '572.8',
      description: 'Watson’s personal account of the discovery of the structure of DNA, offering a look inside scientific competition.',
      published_year: 1968
    },
    {
      title: 'Chaos: Making a New Science',
      author: 'James Gleick',
      isbn: '9780143113454',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780143113454-L.jpg',
      category_id: getCatId('science-technology'),
      tags: ['chaos-theory', 'physics', 'mathematics'],
      location: 'Shelf C5',
      section: 'Science',
      dewey_decimal: '501',
      description: 'The story of the breakthroughs in the physics of complexity and fractal structures.',
      published_year: 1987
    },
    {
      title: "Gödel's Proof",
      author: 'Ernest Nagel & James R. Newman',
      isbn: '9780415355286',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780415355286-L.jpg',
      category_id: getCatId('science-technology'),
      tags: ['logic', 'mathematical-logic', 'incompleteness'],
      location: 'Shelf C5',
      section: 'Science',
      dewey_decimal: '511.3',
      description: 'A short, readable, and highly precise explanation of Kurt Gödel’s famous incompleteness theorems.',
      published_year: 1958
    },
    // --- LITERATURE & FICTION ---
    {
      title: 'To Kill a Mockingbird',
      author: 'Harper Lee',
      isbn: '9780446310789',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780446310789-L.jpg',
      category_id: getCatId('literature-fiction'),
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
      category_id: getCatId('literature-fiction'),
      tags: ['dystopian', 'classic', 'political-fiction'],
      location: 'Shelf D1',
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
      category_id: getCatId('literature-fiction'),
      tags: ['classic', 'american-literature', 'fiction'],
      location: 'Shelf D2',
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
      category_id: getCatId('literature-fiction'),
      tags: ['dystopian', 'classic', 'science-fiction'],
      location: 'Shelf D2',
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
      category_id: getCatId('literature-fiction'),
      tags: ['fantasy', 'adventure', 'classics'],
      location: 'Shelf D3',
      section: 'Literature',
      dewey_decimal: '823.912',
      description: 'Bilbo Baggins is whisked away from his comfortable hobbit hole by Gandalf the wizard and a band of dwarves.',
      published_year: 1937
    },
    {
      title: 'Crime and Punishment',
      author: 'Fyodor Dostoevsky',
      isbn: '9780140449136',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780140449136-L.jpg',
      category_id: getCatId('literature-fiction'),
      tags: ['russian-classics', 'psychological-novel', 'philosophy'],
      location: 'Shelf D3',
      section: 'Literature',
      dewey_decimal: '891.73',
      description: 'The psychological struggles of Raskolnikov, a poor student in St. Petersburg who kills a pawnbroker.',
      published_year: 1866
    },
    {
      title: 'Pride and Prejudice',
      author: 'Jane Austen',
      isbn: '9780141439518',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780141439518-L.jpg',
      category_id: getCatId('literature-fiction'),
      tags: ['romance', 'classic-literature', 'satire'],
      location: 'Shelf D4',
      section: 'Literature',
      dewey_decimal: '823.7',
      description: 'A romantic comedy of manners detailing the turbulent relationship between Elizabeth Bennet and Mr. Darcy.',
      published_year: 1813
    },
    {
      title: 'Fahrenheit 451',
      author: 'Ray Bradbury',
      isbn: '9781451673319',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9781451673319-L.jpg',
      category_id: getCatId('literature-fiction'),
      tags: ['sci-fi', 'dystopian', 'classics'],
      location: 'Shelf D4',
      section: 'Literature',
      dewey_decimal: '813.54',
      description: 'A future society where books are outlawed and "firemen" burn any that are found.',
      published_year: 1953
    },
    {
      title: 'One Hundred Years of Solitude',
      author: 'Gabriel García Márquez',
      isbn: '9780060883287',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780060883287-L.jpg',
      category_id: getCatId('literature-fiction'),
      tags: ['magical-realism', 'colombian', 'literary-classic'],
      location: 'Shelf D5',
      section: 'Literature',
      dewey_decimal: '863',
      description: 'The multi-generational story of the Buendía family, whose patriarch founded the town of Macondo.',
      published_year: 1967
    },
    {
      title: 'Moby Dick',
      author: 'Herman Melville',
      isbn: '9781503280786',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9781503280786-L.jpg',
      category_id: getCatId('literature-fiction'),
      tags: ['adventure', 'classics', 'sea-fiction'],
      location: 'Shelf D5',
      section: 'Literature',
      dewey_decimal: '813.3',
      description: 'Sailor Ishmael’s narrative of the obsessive quest of Ahab, captain of the Pequod, for revenge on Moby Dick.',
      published_year: 1851
    },
    {
      title: 'Educated',
      author: 'Tara Westover',
      isbn: '9780399590504',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780399590504-L.jpg',
      category_id: getCatId('literature-fiction'),
      tags: ['memoir', 'biography', 'education'],
      location: 'Shelf D5',
      section: 'Literature',
      dewey_decimal: '920.72',
      description: 'A memoir about a young girl who leaves her survivalist family in Idaho to pursue higher education.',
      published_year: 2018
    },
    // --- HISTORY & BIOGRAPHY ---
    {
      title: 'Sapiens: A Brief History of Humankind',
      author: 'Yuval Noah Harari',
      isbn: '9780062316097',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780062316097-L.jpg',
      category_id: getCatId('history-biography'),
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
      category_id: getCatId('history-biography'),
      tags: ['biography', 'world-war-ii', 'history'],
      location: 'Shelf E1',
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
      category_id: getCatId('history-biography'),
      tags: ['history', 'anthropology', 'geography'],
      location: 'Shelf E2',
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
      category_id: getCatId('history-biography'),
      tags: ['biography', 'technology', 'entrepreneurship'],
      location: 'Shelf E2',
      section: 'Biography',
      dewey_decimal: '920',
      description: 'The definitive biography of Apple co-founder Steve Jobs based on interviews conducted over two years.',
      published_year: 2011
    },
    {
      title: 'Team of Rivals: The Political Genius of Abraham Lincoln',
      author: 'Doris Kearns Goodwin',
      isbn: '9780684824901',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780684824901-L.jpg',
      category_id: getCatId('history-biography'),
      tags: ['presidential-biography', 'lincoln', 'us-history'],
      location: 'Shelf E3',
      section: 'History',
      dewey_decimal: '973.7',
      description: 'A study of Lincoln’s political mastery in incorporating his major rivals into his cabinet.',
      published_year: 2005
    },
    {
      title: 'The Guns of August',
      author: 'Barbara W. Tuchman',
      isbn: '9780345386236',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780345386236-L.jpg',
      category_id: getCatId('history-biography'),
      tags: ['world-war-i', 'military-history', 'europe'],
      location: 'Shelf E3',
      section: 'History',
      dewey_decimal: '940.4',
      description: 'The classic narrative of the opening month of World War I, highlighting diplomatic and military failures.',
      published_year: 1962
    },
    {
      title: 'Alexander Hamilton',
      author: 'Ron Chernow',
      isbn: '9780143034759',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780143034759-L.jpg',
      category_id: getCatId('history-biography'),
      tags: ['biography', 'founding-fathers', 'american-history'],
      location: 'Shelf E4',
      section: 'Biography',
      dewey_decimal: '973.4',
      description: 'The sweeping biography of the founding father who shaped America’s financial and political structure.',
      published_year: 2004
    },
    {
      title: 'Leonardo da Vinci',
      author: 'Walter Isaacson',
      isbn: '9781501139154',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9781501139154-L.jpg',
      category_id: getCatId('history-biography'),
      tags: ['biography', 'renaissance', 'art-history'],
      location: 'Shelf E4',
      section: 'Biography',
      dewey_decimal: '709.2',
      description: 'An intimate study of the genius who combined art, anatomy, science, and technology.',
      published_year: 2017
    },
    {
      title: 'The Rise and Fall of the Third Reich',
      author: 'William L. Shirer',
      isbn: '9781451651683',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9781451651683-L.jpg',
      category_id: getCatId('history-biography'),
      tags: ['nazi-germany', 'world-war-ii', 'history'],
      location: 'Shelf E5',
      section: 'History',
      dewey_decimal: '943.086',
      description: 'The monumentally detailed history of Nazi Germany based on captured German archives.',
      published_year: 1960
    },
    {
      title: 'Nelson Mandela: Long Walk to Freedom',
      author: 'Nelson Mandela',
      isbn: '9780316548182',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780316548182-L.jpg',
      category_id: getCatId('history-biography'),
      tags: ['autobiography', 'apartheid', 'human-rights'],
      location: 'Shelf E5',
      section: 'Biography',
      dewey_decimal: '920',
      description: 'Mandela’s inspiring autobiography detailing his early life, imprisonment, and rise to president of South Africa.',
      published_year: 1994
    },
    // --- BUSINESS & ECONOMICS ---
    {
      title: 'Thinking, Fast and Slow',
      author: 'Daniel Kahneman',
      isbn: '9780374275631',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780374275631-L.jpg',
      category_id: getCatId('business-economics'),
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
      category_id: getCatId('business-economics'),
      tags: ['finance', 'investing', 'business-classic'],
      location: 'Shelf F1',
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
      category_id: getCatId('business-economics'),
      tags: ['business', 'startups', 'entrepreneurship'],
      location: 'Shelf F2',
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
      category_id: getCatId('business-economics'),
      tags: ['startups', 'entrepreneurship', 'strategy'],
      location: 'Shelf F2',
      section: 'Business',
      dewey_decimal: '658.11',
      description: 'Notes on startups, how to build the future, and creating a monopoly.',
      published_year: 2014
    },
    {
      title: 'Atomic Habits',
      author: 'James Clear',
      isbn: '9780735211292',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780735211292-L.jpg',
      category_id: getCatId('business-economics'),
      tags: ['self-help', 'productivity', 'habits'],
      location: 'Shelf F3',
      section: 'Self Help',
      dewey_decimal: '158.1',
      description: 'An easy and proven way to build good habits and break bad ones.',
      published_year: 2018
    },
    {
      title: 'Good to Great',
      author: 'Jim Collins',
      isbn: '9780066620992',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780066620992-L.jpg',
      category_id: getCatId('business-economics'),
      tags: ['management', 'leadership', 'organizational-growth'],
      location: 'Shelf F3',
      section: 'Business',
      dewey_decimal: '658',
      description: 'Why some companies make the leap to great performance, and others don’t.',
      published_year: 2001
    },
    {
      title: 'Freakonomics',
      author: 'Steven D. Levitt & Stephen J. Dubner',
      isbn: '9780060731335',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780060731335-L.jpg',
      category_id: getCatId('business-economics'),
      tags: ['behavioral-economics', 'incentives', 'social-issues'],
      location: 'Shelf F4',
      section: 'Business',
      dewey_decimal: '330',
      description: 'A rogue economist explores the hidden side of everything, from cheat patterns to incentive structures.',
      published_year: 2005
    },
    {
      title: 'The Black Swan',
      author: 'Nassim Nicholas Taleb',
      isbn: '9781400063512',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9781400063512-L.jpg',
      category_id: getCatId('business-economics'),
      tags: ['probability', 'finance', 'risk-management'],
      location: 'Shelf F4',
      section: 'Business',
      dewey_decimal: '330',
      description: 'The impact of the highly improbable, exposing human blindness to randomness and large shocks.',
      published_year: 2007
    },
    {
      title: 'Capital in the Twenty-First Century',
      author: 'Thomas Piketty',
      isbn: '9780674430006',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780674430006-L.jpg',
      category_id: getCatId('business-economics'),
      tags: ['wealth-inequality', 'macroeconomics', 'capitalism'],
      location: 'Shelf F5',
      section: 'Business',
      dewey_decimal: '330.1',
      description: 'The definitive macroeconomic study analyzing structural dynamics of wealth inequality over centuries.',
      published_year: 2013
    },
    {
      title: 'Outliers: The Story of Success',
      author: 'Malcolm Gladwell',
      isbn: '9780316017923',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780316017923-L.jpg',
      category_id: getCatId('business-economics'),
      tags: ['sociology', 'success', 'popular-psychology'],
      location: 'Shelf F5',
      section: 'Business',
      dewey_decimal: '302',
      description: 'Gladwell looks at the cultural, family, and generational factors that lead to extreme high achievement.',
      published_year: 2008
    },
    // --- PHILOSOPHY & ETHICS ---
    {
      title: 'The Republic',
      author: 'Plato',
      isbn: '9780140455113',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780140455113-L.jpg',
      category_id: getCatId('philosophy-ethics'),
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
      category_id: getCatId('philosophy-ethics'),
      tags: ['philosophy', 'stoicism', 'classics'],
      location: 'Shelf G1',
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
      category_id: getCatId('philosophy-ethics'),
      tags: ['psychology', 'philosophy', 'memoir'],
      location: 'Shelf G2',
      section: 'Philosophy',
      dewey_decimal: '150.195',
      description: 'Frankl’s experiences in concentration camps and his development of logotherapy, exploring the human search for purpose.',
      published_year: 1946
    },
    {
      title: 'Beyond Good and Evil',
      author: 'Friedrich Nietzsche',
      isbn: '9780140449235',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780140449235-L.jpg',
      category_id: getCatId('philosophy-ethics'),
      tags: ['existentialism', 'ethics', 'philosophy'],
      location: 'Shelf G2',
      section: 'Philosophy',
      dewey_decimal: '193',
      description: 'Nietzsche attacks traditional morality and outlines his concepts of the will to power and individual self-creation.',
      published_year: 1886
    },
    {
      title: 'Thus Spoke Zarathustra',
      author: 'Friedrich Nietzsche',
      isbn: '9780140441628',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780140441628-L.jpg',
      category_id: getCatId('philosophy-ethics'),
      tags: ['philosophy', 'existentialism', 'classics'],
      location: 'Shelf G3',
      section: 'Philosophy',
      dewey_decimal: '193',
      description: 'Nietzsche’s masterpiece detailing the concepts of the Übermensch, the death of God, and eternal recurrence.',
      published_year: 1883
    },
    {
      title: 'Nicomachean Ethics',
      author: 'Aristotle',
      isbn: '9780199213610',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780199213610-L.jpg',
      category_id: getCatId('philosophy-ethics'),
      tags: ['ethics', 'virtue-ethics', 'classics'],
      location: 'Shelf G3',
      section: 'Philosophy',
      dewey_decimal: '185',
      description: 'Aristotle’s foundational study on virtue, happiness, character development, and practical wisdom.',
      published_year: -340
    },
    {
      title: 'Critique of Pure Reason',
      author: 'Immanuel Kant',
      isbn: '9780521558280',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780521558280-L.jpg',
      category_id: getCatId('philosophy-ethics'),
      tags: ['epistemology', 'metaphysics', 'german-idealism'],
      location: 'Shelf G4',
      section: 'Philosophy',
      dewey_decimal: '193',
      description: 'Kant explores the limits and structure of human understanding and synthetic a priori knowledge.',
      published_year: 1781
    },
    {
      title: 'Ethics',
      author: 'Benedict de Spinoza',
      isbn: '9780140435719',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780140435719-L.jpg',
      category_id: getCatId('philosophy-ethics'),
      tags: ['pantheism', 'metaphysics', 'rationalism'],
      location: 'Shelf G4',
      section: 'Philosophy',
      dewey_decimal: '170',
      description: 'Written in a geometric style, Spinoza outlines his vision of God, nature, mind, and human freedom.',
      published_year: 1677
    },
    {
      title: 'The Ethics of Ambiguity',
      author: 'Simone de Beauvoir',
      isbn: '9781504054225',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9781504054225-L.jpg',
      category_id: getCatId('philosophy-ethics'),
      tags: ['existentialism', 'ethics', 'feminism'],
      location: 'Shelf G5',
      section: 'Philosophy',
      dewey_decimal: '194',
      description: 'Beauvoir applies existentialist principles to ethics, arguing that individual freedom requires the freedom of others.',
      published_year: 1947
    },
    {
      title: 'Zen and the Art of Motorcycle Maintenance',
      author: 'Robert M. Pirsig',
      isbn: '9780060589462',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780060589462-L.jpg',
      category_id: getCatId('philosophy-ethics'),
      tags: ['philosophy-of-quality', 'novel', 'inquiry'],
      location: 'Shelf G5',
      section: 'Philosophy',
      dewey_decimal: '100',
      description: 'A philosophical inquiry into the nature of Quality, told through a motorcycle trip with a father and son.',
      published_year: 1974
    },
    // --- ART & DESIGN ---
    {
      title: 'The Design of Everyday Things',
      author: 'Don Norman',
      isbn: '9780465050659',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780465050659-L.jpg',
      category_id: getCatId('art-design'),
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
      category_id: getCatId('art-design'),
      tags: ['web-usability', 'ux-design', 'interface-design'],
      location: 'Shelf H1',
      section: 'Art & Design',
      dewey_decimal: '006.7',
      description: 'A common-sense guide to web usability, focusing on simple design principles.',
      published_year: 2000
    },
    {
      title: 'Interaction of Color',
      author: 'Josef Albers',
      isbn: '9780300179354',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780300179354-L.jpg',
      category_id: getCatId('art-design'),
      tags: ['color-theory', 'fine-art', 'education'],
      location: 'Shelf H2',
      section: 'Art & Design',
      dewey_decimal: '701.8',
      description: 'A masterclass in color perception, demonstrating how color changes relative to its environment.',
      published_year: 1963
    },
    {
      title: 'Grid Systems in Graphic Design',
      author: 'Josef Müller-Brockmann',
      isbn: '9783721201451',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9783721201451-L.jpg',
      category_id: getCatId('art-design'),
      tags: ['typography', 'layout', 'swiss-design'],
      location: 'Shelf H2',
      section: 'Art & Design',
      dewey_decimal: '741.6',
      description: 'The definitive guide to grid systems, introducing order, hierarchy, and structure into graphic design.',
      published_year: 1981
    },
    {
      title: 'About Face: The Essentials of Interaction Design',
      author: 'Alan Cooper',
      isbn: '9781118766576',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9781118766576-L.jpg',
      category_id: getCatId('art-design'),
      tags: ['interaction-design', 'product-management', 'ui-ux'],
      location: 'Shelf H3',
      section: 'Art & Design',
      dewey_decimal: '006.76',
      description: 'Cooper’s guide to designing high-quality interaction patterns and user interfaces.',
      published_year: 2014
    },
    {
      title: 'Universal Principles of Design',
      author: 'William Lidwell',
      isbn: '9781592535873',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9781592535873-L.jpg',
      category_id: getCatId('art-design'),
      tags: ['design-rules', 'usability', 'problem-solving'],
      location: 'Shelf H3',
      section: 'Art & Design',
      dewey_decimal: '745.4',
      description: 'A cross-disciplinary encyclopedia of design rules, combining psychology, engineering, and visual design.',
      published_year: 2003
    },
    {
      title: 'The Elements of User Experience',
      author: 'Jesse James Garrett',
      isbn: '9780321683687',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780321683687-L.jpg',
      category_id: getCatId('art-design'),
      tags: ['ux-architecture', 'content-strategy', 'user-research'],
      location: 'Shelf H4',
      section: 'Art & Design',
      dewey_decimal: '006.7',
      description: 'Garrett’s model dividing UX design into five planes: strategy, scope, structure, skeleton, and surface.',
      published_year: 2002
    },
    {
      title: 'Thinking with Type',
      author: 'Ellen Lupton',
      isbn: '9781568989693',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9781568989693-L.jpg',
      category_id: getCatId('art-design'),
      tags: ['typography', 'fonts', 'layout'],
      location: 'Shelf H4',
      section: 'Art & Design',
      dewey_decimal: '686.2',
      description: 'A practical, visually stunning guide to typesetting, hierarchy, page grids, and custom font pairings.',
      published_year: 2004
    },
    {
      title: 'Ways of Seeing',
      author: 'John Berger',
      isbn: '9780140135152',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780140135152-L.jpg',
      category_id: getCatId('art-design'),
      tags: ['art-criticism', 'visual-culture', 'ideology'],
      location: 'Shelf H5',
      section: 'Art & Design',
      dewey_decimal: '701',
      description: 'A classic critique of classical art history, showing how our social context shapes how we view pictures.',
      published_year: 1972
    },
    {
      title: 'Steal Like an Artist',
      author: 'Austin Kleon',
      isbn: '9780761169253',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780761169253-L.jpg',
      category_id: getCatId('art-design'),
      tags: ['creativity', 'self-help', 'art'],
      location: 'Shelf H5',
      section: 'Art & Design',
      dewey_decimal: '700.1',
      description: 'An illustrated guide to unlocking creativity, arguing that all creative work is built on what came before.',
      published_year: 2012
    },
    // --- HEALTH & MEDICINE ---
    {
      title: 'The Emperor of All Maladies',
      author: 'Siddhartha Mukherjee',
      isbn: '9781439170915',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9781439170915-L.jpg',
      category_id: getCatId('health-medicine'),
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
      category_id: getCatId('health-medicine'),
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
      category_id: getCatId('health-medicine'),
      tags: ['neuroscience', 'sleep-science', 'health'],
      location: 'Shelf I2',
      section: 'Health & Medicine',
      dewey_decimal: '612.821',
      description: 'An exploration of the vital importance of sleep for human health, cognitive function, and longevity.',
      published_year: 2017
    },
    {
      title: 'The Checklist Manifesto',
      author: 'Atul Gawande',
      isbn: '9780312430009',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780312430009-L.jpg',
      category_id: getCatId('health-medicine'),
      tags: ['systems', 'safety', 'medicine'],
      location: 'Shelf I2',
      section: 'Health & Medicine',
      dewey_decimal: '610',
      description: 'Gawande explains how simple checklists can radically improve outcomes in medicine, aviation, and engineering.',
      published_year: 2009
    },
    {
      title: 'Gut: The Inside Story of Our Body\'s Most Underrated Organ',
      author: 'Giulia Enders',
      isbn: '9781771641494',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9781771641494-L.jpg',
      category_id: getCatId('health-medicine'),
      tags: ['biology', 'digestive-system', 'popular-science'],
      location: 'Shelf I3',
      section: 'Health & Medicine',
      dewey_decimal: '612.3',
      description: 'A charming, witty, and highly informative dive into our digestive system and its link to mental health.',
      published_year: 2014
    },
    {
      title: 'When Breath Becomes Air',
      author: 'Paul Kalanithi',
      isbn: '9780812988406',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780812988406-L.jpg',
      category_id: getCatId('health-medicine'),
      tags: ['memoir', 'neurosurgery', 'mortality'],
      location: 'Shelf I3',
      section: 'Health & Medicine',
      dewey_decimal: '616.99409',
      description: 'A young neurosurgeon diagnosed with terminal lung cancer writes a moving reflection on facing death and fatherhood.',
      published_year: 2016
    },
    {
      title: 'Deep Medicine: How Artificial Intelligence Can Make Healthcare Human Again',
      author: 'Eric Topol',
      isbn: '9781541644632',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9781541644632-L.jpg',
      category_id: getCatId('health-medicine'),
      tags: ['digital-health', 'artificial-intelligence', 'future-medicine'],
      location: 'Shelf I4',
      section: 'Health & Medicine',
      dewey_decimal: '610.285',
      description: 'Topol details how AI can automate repetitive medical tasks, restoring the physician-patient connection.',
      published_year: 2019
    },
    {
      title: 'Internal Medicine',
      author: 'Dennis R. M.D. Novak',
      isbn: '9780781711200',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780781711200-L.jpg',
      category_id: getCatId('health-medicine'),
      tags: ['textbook', 'clinical-medicine', 'reference'],
      location: 'Shelf I4',
      section: 'Health & Medicine',
      dewey_decimal: '616',
      description: 'A core textbook detailing diagnosis and therapeutic strategies for adult internal medical conditions.',
      published_year: 1999
    },
    {
      title: 'The Body: A Guide for Occupants',
      author: 'Bill Bryson',
      isbn: '9780385539302',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780385539302-L.jpg',
      category_id: getCatId('health-medicine'),
      tags: ['anatomy', 'physiology', 'popular-science'],
      location: 'Shelf I5',
      section: 'Health & Medicine',
      dewey_decimal: '612',
      description: 'A grand tour of the human body, detailing how it works, how it heals, and how it occasionally breaks down.',
      published_year: 2019
    },
    {
      title: 'Outlive: The Science and Art of Longevity',
      author: 'Peter Attia',
      isbn: '9780593236598',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780593236598-L.jpg',
      category_id: getCatId('health-medicine'),
      tags: ['preventive-medicine', 'longevity', 'exercise-science'],
      location: 'Shelf I5',
      section: 'Health & Medicine',
      dewey_decimal: '613',
      description: 'A comprehensive preventive guide to extending healthy life span and avoiding chronic diseases.',
      published_year: 2023
    },
    // --- LAW & POLITICS ---
    {
      title: 'A Promised Land',
      author: 'Barack Obama',
      isbn: '9781524763169',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9781524763169-L.jpg',
      category_id: getCatId('law-politics'),
      tags: ['memoir', 'politics', 'history'],
      location: 'Shelf J1',
      section: 'Politics',
      dewey_decimal: '973.932',
      description: 'The first volume of presidential memoirs by the 44th president of the United States.',
      published_year: 2020
    },
    {
      title: 'The Clash of Civilizations',
      author: 'Samuel P. Huntington',
      isbn: '9780684844411',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780684844411-L.jpg',
      category_id: getCatId('law-politics'),
      tags: ['geopolitics', 'international-relations', 'history'],
      location: 'Shelf J1',
      section: 'Politics',
      dewey_decimal: '327',
      description: 'Huntington argues that after the Cold War, cultural and religious identities will be the primary source of conflict.',
      published_year: 1996
    },
    {
      title: 'On Liberty',
      author: 'John Stuart Mill',
      isbn: '9780486421643',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780486421643-L.jpg',
      category_id: getCatId('law-politics'),
      tags: ['liberalism', 'utilitarianism', 'political-philosophy'],
      location: 'Shelf J2',
      section: 'Politics',
      dewey_decimal: '323',
      description: 'Mill’s defense of individual liberty, detailing the harm principle and free speech rights.',
      published_year: 1859
    },
    {
      title: 'The Prince',
      author: 'Niccolò Machiavelli',
      isbn: '9780393964080',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780393964080-L.jpg',
      category_id: getCatId('law-politics'),
      tags: ['statecraft', 'political-realism', 'classics'],
      location: 'Shelf J2',
      section: 'Politics',
      dewey_decimal: '320',
      description: 'The classic treatise on political power, statecraft, and pragmatic leadership.',
      published_year: 1532
    },
    {
      title: 'Leviathan',
      author: 'Thomas Hobbes',
      isbn: '9780140431957',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780140431957-L.jpg',
      category_id: getCatId('law-politics'),
      tags: ['social-contract', 'political-philosophy', 'sovereignty'],
      location: 'Shelf J3',
      section: 'Politics',
      dewey_decimal: '320.1',
      description: 'Hobbes argues for absolute sovereignty to escape the chaotic "state of nature" and preserve order.',
      published_year: 1651
    },
    {
      title: 'The Federalist Papers',
      author: 'Alexander Hamilton, James Madison, John Jay',
      isbn: '9780451528896',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780451528896-L.jpg',
      category_id: getCatId('law-politics'),
      tags: ['constitutional-law', 'us-history', 'founding-documents'],
      location: 'Shelf J3',
      section: 'Politics',
      dewey_decimal: '342.73',
      description: 'A collection of 85 essays arguing for the ratification of the United States Constitution.',
      published_year: 1788
    },
    {
      title: 'The Tyranny of Merit',
      author: 'Michael J. Sandel',
      isbn: '9780374228446',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780374228446-L.jpg',
      category_id: getCatId('law-politics'),
      tags: ['justice', 'ethics', 'politics'],
      location: 'Shelf J4',
      section: 'Politics',
      dewey_decimal: '320.01',
      description: 'Sandel questions how the meritocratic ideal has divided societies, calling for a return to the common good.',
      published_year: 2020
    },
    {
      title: 'Political Order and Political Decay',
      author: 'Francis Fukuyama',
      isbn: '9780374227357',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780374227357-L.jpg',
      category_id: getCatId('law-politics'),
      tags: ['political-institutions', 'state-building', 'democracy'],
      location: 'Shelf J4',
      section: 'Politics',
      dewey_decimal: '320.9',
      description: 'Fukuyama explores how states construct effective, rule-of-law institutions, and why they decay.',
      published_year: 2014
    },
    {
      title: 'Why Nations Fail',
      author: 'Daron Acemoglu & James A. Robinson',
      isbn: '9780307719218',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780307719218-L.jpg',
      category_id: getCatId('law-politics'),
      tags: ['economics', 'institutions', 'world-development'],
      location: 'Shelf J5',
      section: 'Politics',
      dewey_decimal: '330',
      description: 'Acemoglu and Robinson show that inclusive political institutions, rather than geography or culture, drive long-term prosperity.',
      published_year: 2012
    },
    {
      title: 'The Spirit of the Laws',
      author: 'Montesquieu',
      isbn: '9780521369749',
      cover_url: 'https://covers.openlibrary.org/b/isbn/9780521369749-L.jpg',
      category_id: getCatId('law-politics'),
      tags: ['law', 'separation-of-powers', 'political-theory'],
      location: 'Shelf J5',
      section: 'Politics',
      dewey_decimal: '320.1',
      description: 'Montesquieu outlines his influential theories on the division of political power into branches.',
      published_year: 1748
    }
  ];
  // Insert books in batches
  console.info('📖 Seeding 101 books across all categories...');
  const { data: bookData, error: bookError } = await supabase
    .from('books')
    .insert(booksToSeed)
    .select();

  if (bookError || !bookData) {
    console.error('Error seeding books:', bookError);
    return;
  }
  console.info(`✅ Seeded ${bookData.length} books`);

  // 4. Seed Book Copies (3-5 copies per book, ~400+ copies)
  console.info('📦 Seeding physical book copies...');
  const copies: any[] = [];
  const bookCopiesMap: { [bookTitle: string]: any[] } = {};

  const getSimpleHash = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash);
  };

  let globalCopyIndex = 1;
  for (const book of bookData) {
    bookCopiesMap[book.title] = [];
    const hashVal = getSimpleHash(book.title);
    let numCopies = 3;
    if (['Clean Code', 'Introduction to Algorithms', 'Atomic Habits', 'The Design of Everyday Things', 'Deep Work', 'Sapiens: A Brief History of Humankind'].includes(book.title)) {
      numCopies = 5;
    } else if (hashVal % 4 === 0) {
      numCopies = 4;
    } else if (hashVal % 5 === 0) {
      numCopies = 2;
    }

    for (let i = 0; i < numCopies; i++) {
      let status = 'AVAILABLE';
      let condition = 'Good';

      if (i === 0) {
        condition = 'New';
      } else if (i === numCopies - 1 && numCopies > 2) {
        condition = 'Fair';
      } else if (i === 1) {
        condition = 'Good';
      } else if (i === 2) {
        condition = 'Worn';
      }

      // Occasional maintenance/lost for realism
      if ((hashVal + i) % 23 === 0) {
        status = 'MAINTENANCE';
        condition = 'Damaged';
      } else if ((hashVal + i) % 47 === 0) {
        status = 'LOST';
      }

      const accessionNumber = `ACC-${String(globalCopyIndex).padStart(5, '0')}`;
      const qrString = `QR-ACC-${String(globalCopyIndex).padStart(5, '0')}`;
      globalCopyIndex++;

      copies.push({
        book_id: book.id,
        accession_number: accessionNumber,
        qr_string: qrString,
        condition,
        status
      });
    }
  }

  // Insert copies in chunks of 100
  const insertedCopies: any[] = [];
  const chunkSize = 100;
  for (let i = 0; i < copies.length; i += chunkSize) {
    const chunk = copies.slice(i, i + chunkSize);
    const { data: chunkData, error: chunkErr } = await supabase
      .from('book_copies')
      .insert(chunk)
      .select();
    if (chunkErr) {
      console.error('Error inserting copy chunk:', chunkErr);
      return;
    }
    if (chunkData) insertedCopies.push(...chunkData);
  }
  console.info(`✅ Seeded ${insertedCopies.length} book copies`);

  for (const copy of insertedCopies) {
    const bookObj = bookData.find(b => b.id === copy.book_id);
    if (bookObj) {
      bookCopiesMap[bookObj.title].push(copy);
    }
  }

  // 5. Seed Library Cards for ALL Users
  console.info('🪪 Seeding active digital library cards for all users...');
  const cardIssueDate = new Date('2026-08-15T08:00:00Z');
  const cardExpiryDate = new Date('2030-08-15T08:00:00Z');

  const libraryCards = [
    { user_id: profileIds.godwynStudent, card_number: 'STU-376375', status: 'ACTIVE', issued_at: cardIssueDate.toISOString(), expires_at: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString() },
    { user_id: profileIds.calinogStudent, card_number: 'STU-190782', status: 'ACTIVE', issued_at: cardIssueDate.toISOString(), expires_at: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString() },
    { user_id: profileIds.kayleStudent, card_number: 'STU-376536', status: 'ACTIVE', issued_at: cardIssueDate.toISOString(), expires_at: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString() },
    { user_id: profileIds.kaylePersonal, card_number: 'STU-826019', status: 'ACTIVE', issued_at: cardIssueDate.toISOString(), expires_at: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString() },
    { user_id: profileIds.jericoSA, card_number: 'STU-368330', status: 'ACTIVE', issued_at: cardIssueDate.toISOString(), expires_at: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString() },
    { user_id: profileIds.kennethStudent, card_number: 'STU-351534', status: 'ACTIVE', issued_at: cardIssueDate.toISOString(), expires_at: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString() },
    { user_id: profileIds.rhedStudent, card_number: 'STU-357161', status: 'ACTIVE', issued_at: cardIssueDate.toISOString(), expires_at: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString() },
    { user_id: profileIds.baybayLibrarian, card_number: 'FAC-982441', status: 'ACTIVE', issued_at: cardIssueDate.toISOString(), expires_at: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString() },
    { user_id: profileIds.luminaAdmin, card_number: 'FAC-ADM-001', status: 'ACTIVE', issued_at: cardIssueDate.toISOString(), expires_at: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString() },
    { user_id: profileIds.luminaLibrarian, card_number: 'FAC-LIB-001', status: 'ACTIVE', issued_at: cardIssueDate.toISOString(), expires_at: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString() },
    { user_id: profileIds.luminaSA, card_number: 'FAC-STF-001', status: 'ACTIVE', issued_at: cardIssueDate.toISOString(), expires_at: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString() },
    { user_id: profileIds.demoStudent, card_number: 'STU-001', status: 'ACTIVE', issued_at: cardIssueDate.toISOString(), expires_at: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString() },
    { user_id: profileIds.luminaSuperAdmin, card_number: 'FAC-SAD-001', status: 'ACTIVE', issued_at: cardIssueDate.toISOString(), expires_at: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString() },
  ];

  const { error: cardError } = await supabase
    .from('library_cards')
    .insert(libraryCards);

  if (cardError) {
    console.error('Error seeding library cards:', cardError);
    return;
  }
  console.info(`✅ Seeded ${libraryCards.length} library cards`);

  // 6. Seed Borrowing Records (Returned, Active, Overdue)
  console.info('📚 Generating organized borrowing records (125 returned, 20 active, 8 overdue)...');
  const now = new Date();
  const borrowsToSeed: any[] = [];
  
  const studentBorrowers = [
    profileIds.godwynStudent,
    profileIds.calinogStudent,
    profileIds.kayleStudent,
    profileIds.jericoSA,
    profileIds.kennethStudent,
    profileIds.rhedStudent,
    profileIds.demoStudent,
  ];

  const deskStaff = [
    profileIds.baybayLibrarian,
    profileIds.luminaLibrarian,
    profileIds.luminaSA,
    profileIds.jericoSA,
  ];

  const availablePool = insertedCopies.filter(c => c.status === 'AVAILABLE');
  let poolIdx = 0;
  const pickCopy = () => {
    if (availablePool.length === 0) return null;
    const c = availablePool[poolIdx % availablePool.length];
    poolIdx++;
    return c;
  };

  // 125 Returned borrows spread over May 2026 to mid October 2026
  for (let i = 1; i <= 125; i++) {
    const dayOffset = 16 + (i * 1.25); // 16 to 172 days ago
    const borrowDate = new Date(now.getTime() - dayOffset * 24 * 60 * 60 * 1000);
    const dueDate = new Date(borrowDate.getTime() + 14 * 24 * 60 * 60 * 1000);
    const returnedDays = (i % 7 === 0) ? 16 : (i % 3 === 0) ? 9 : 5;
    const returnedDate = new Date(borrowDate.getTime() + returnedDays * 24 * 60 * 60 * 1000);

    const borrower = studentBorrowers[i % studentBorrowers.length];
    const staff = deskStaff[i % deskStaff.length];
    const copy = pickCopy();
    if (copy) {
      borrowsToSeed.push({
        user_id: borrower,
        book_copy_id: copy.id,
        processed_by: staff,
        borrowed_at: borrowDate.toISOString(),
        due_date: dueDate.toISOString(),
        returned_at: returnedDate.toISOString(),
        returned_by: deskStaff[(i + 1) % deskStaff.length],
        status: 'RETURNED'
      });
    }
  }

  // 20 Active borrows (due in early November 2026)
  const activeCopyIds: string[] = [];
  for (let i = 1; i <= 20; i++) {
    const borrowOffset = 1 + (i % 6); // 1 to 6 days ago
    const borrowDate = new Date(now.getTime() - borrowOffset * 24 * 60 * 60 * 1000);
    const dueDate = new Date(borrowDate.getTime() + 14 * 24 * 60 * 60 * 1000); // 8-13 days in future

    const borrower = studentBorrowers[i % studentBorrowers.length];
    const staff = deskStaff[i % deskStaff.length];
    const copy = pickCopy();
    if (copy) {
      borrowsToSeed.push({
        user_id: borrower,
        book_copy_id: copy.id,
        processed_by: staff,
        borrowed_at: borrowDate.toISOString(),
        due_date: dueDate.toISOString(),
        status: 'ACTIVE'
      });
      activeCopyIds.push(copy.id);
    }
  }

  // 8 Overdue borrows (due 8-22 days ago in October 2026)
  const overdueCopyIds: string[] = [];
  for (let i = 1; i <= 8; i++) {
    const borrowOffset = 22 + (i * 2); // 24 to 38 days ago
    const borrowDate = new Date(now.getTime() - borrowOffset * 24 * 60 * 60 * 1000);
    const dueDate = new Date(borrowDate.getTime() + 14 * 24 * 60 * 60 * 1000); // 10 to 24 days ago

    const borrower = studentBorrowers[(i + 2) % studentBorrowers.length];
    const staff = deskStaff[i % deskStaff.length];
    const copy = pickCopy();
    if (copy) {
      borrowsToSeed.push({
        user_id: borrower,
        book_copy_id: copy.id,
        processed_by: staff,
        borrowed_at: borrowDate.toISOString(),
        due_date: dueDate.toISOString(),
        status: 'OVERDUE',
        reminder_sent: true
      });
      overdueCopyIds.push(copy.id);
    }
  }

  // Batch insert borrows
  for (let i = 0; i < borrowsToSeed.length; i += chunkSize) {
    const chunk = borrowsToSeed.slice(i, i + chunkSize);
    const { error: bErr } = await supabase.from('borrowing_records').insert(chunk);
    if (bErr) {
      console.error('Error inserting borrows chunk:', bErr);
      return;
    }
  }
  console.info(`✅ Seeded ${borrowsToSeed.length} borrowing records (125 returned, 20 active, 8 overdue)`);

  // Update borrowed book copies
  const allBorrowedCopyIds = [...activeCopyIds, ...overdueCopyIds];
  if (allBorrowedCopyIds.length > 0) {
    await supabase.from('book_copies').update({ status: 'BORROWED' }).in('id', allBorrowedCopyIds);
    console.info(`✅ Updated ${allBorrowedCopyIds.length} copies to BORROWED status`);
  }

  // 7. Seed Reservations (READY, ACTIVE, FULFILLED, CANCELLED)
  console.info('📑 Seeding reservations...');
  const reservationsToSeed: any[] = [];
  const reservedCopyIds: string[] = [];

  // 5 READY for Pickup
  const readyTitles = [
    'Clean Code',
    'The Pragmatic Programmer',
    'Introduction to Algorithms',
    'Designing Data-Intensive Applications',
    'Atomic Habits'
  ];

  for (let i = 0; i < readyTitles.length; i++) {
    const title = readyTitles[i];
    const book = bookData.find(b => b.title === title);
    if (!book) continue;
    const availCopy = bookCopiesMap[title]?.find(c => c.status === 'AVAILABLE' && !allBorrowedCopyIds.includes(c.id));
    if (availCopy) {
      reservationsToSeed.push({
        user_id: studentBorrowers[i % studentBorrowers.length],
        book_id: book.id,
        copy_id: availCopy.id,
        status: 'READY',
        queue_position: 1,
        reserved_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        hold_expires_at: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString()
      });
      reservedCopyIds.push(availCopy.id);
    }
  }

  // 10 ACTIVE in Queue
  const queueTitles = [
    'Artificial Intelligence: A Modern Approach',
    'Design Patterns: Elements of Reusable Object-Oriented Software',
    'Structure and Interpretation of Computer Programs',
    'Deep Work',
    'Clean Code'
  ];

  for (let i = 0; i < queueTitles.length; i++) {
    const book = bookData.find(b => b.title === queueTitles[i]);
    if (!book) continue;
    reservationsToSeed.push({
      user_id: studentBorrowers[(i + 1) % studentBorrowers.length],
      book_id: book.id,
      status: 'ACTIVE',
      queue_position: 1,
      reserved_at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString()
    });
    reservationsToSeed.push({
      user_id: studentBorrowers[(i + 3) % studentBorrowers.length],
      book_id: book.id,
      status: 'ACTIVE',
      queue_position: 2,
      reserved_at: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString()
    });
  }

  // 15 FULFILLED Reservations
  for (let i = 0; i < 15; i++) {
    const book = bookData[i % 20];
    const reservedAt = new Date(now.getTime() - (20 + i * 2) * 24 * 60 * 60 * 1000);
    const fulfilledAt = new Date(reservedAt.getTime() + 2 * 24 * 60 * 60 * 1000);
    reservationsToSeed.push({
      user_id: studentBorrowers[i % studentBorrowers.length],
      book_id: book.id,
      status: 'FULFILLED',
      queue_position: 1,
      reserved_at: reservedAt.toISOString(),
      fulfilled_at: fulfilledAt.toISOString()
    });
  }

  // 5 CANCELLED Reservations
  for (let i = 0; i < 5; i++) {
    const book = bookData[(i + 25) % bookData.length];
    reservationsToSeed.push({
      user_id: studentBorrowers[(i + 2) % studentBorrowers.length],
      book_id: book.id,
      status: 'CANCELLED',
      queue_position: 1,
      reserved_at: new Date(now.getTime() - (15 + i) * 24 * 60 * 60 * 1000).toISOString()
    });
  }

  const { error: resErr } = await supabase.from('reservations').insert(reservationsToSeed);
  if (resErr) {
    console.error('Error seeding reservations:', resErr);
    return;
  }
  console.info(`✅ Seeded ${reservationsToSeed.length} reservations`);

  if (reservedCopyIds.length > 0) {
    await supabase.from('book_copies').update({ status: 'RESERVED' }).in('id', reservedCopyIds);
    console.info(`✅ Updated ${reservedCopyIds.length} copies to RESERVED status`);
  }

  // 8. Seed Attendance (Active today + Completed today + Historical)
  console.info('🚪 Seeding attendance tracking records...');
  const attendanceToSeed: any[] = [];

  // Active TODAY (currently inside the library)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const activeTodayPatrons = [
    { user_id: profileIds.godwynStudent, hour: 9, min: 15, notes: 'Thesis prototype & hardware testing' },
    { user_id: profileIds.calinogStudent, hour: 9, min: 30, notes: 'Circulation desk shift & patron assistance' },
    { user_id: profileIds.kayleStudent, hour: 10, min: 0, notes: 'Capstone mock defense review' },
    { user_id: profileIds.kennethStudent, hour: 10, min: 15, notes: 'System architecture reference study' },
    { user_id: profileIds.jericoSA, hour: 10, min: 30, notes: 'Inventory scanner counter check' },
    { user_id: profileIds.demoStudent, hour: 11, min: 0, notes: 'Algorithms textbook reading' }
  ];

  for (const p of activeTodayPatrons) {
    const checkIn = new Date(today.getFullYear(), today.getMonth(), today.getDate(), p.hour, p.min);
    attendanceToSeed.push({
      user_id: p.user_id,
      check_in_at: checkIn.toISOString(),
      check_out_at: null,
      notes: p.notes
    });
  }

  // Completed visits TODAY
  const completedTodayPatrons = [
    { user_id: profileIds.rhedStudent, inH: 8, inM: 0, outH: 10, outM: 30, notes: 'Morning discrete structures study' },
    { user_id: profileIds.baybayLibrarian, inH: 7, inM: 45, outH: 12, outM: 0, notes: 'Faculty library collection review' },
    { user_id: profileIds.luminaLibrarian, inH: 8, inM: 0, outH: 12, outM: 30, notes: 'Morning circulation supervision' },
    { user_id: profileIds.luminaSA, inH: 8, inM: 30, outH: 11, outM: 45, notes: 'Book accessioning and shelf arrangement' },
    { user_id: profileIds.kaylePersonal, inH: 9, inM: 0, outH: 10, outM: 45, notes: 'Digital card scanner testing' }
  ];

  for (const c of completedTodayPatrons) {
    const checkIn = new Date(today.getFullYear(), today.getMonth(), today.getDate(), c.inH, c.inM);
    const checkOut = new Date(today.getFullYear(), today.getMonth(), today.getDate(), c.outH, c.outM);
    attendanceToSeed.push({
      user_id: c.user_id,
      check_in_at: checkIn.toISOString(),
      check_out_at: checkOut.toISOString(),
      notes: c.notes
    });
  }

  // 180 Historical visits over 55 days
  const allPatrons = Object.values(profileIds);
  const studyNotes = [
    'Thesis capstone research', 'Review for midterm exams', 'Web development group study',
    'Book inquiry & return', 'Circulation desk shift', 'Discrete math problem solving',
    'Quiet individual study', 'Database lab assignment', 'Reference reading', 'Consulting librarian'
  ];

  for (let d = 1; d <= 55; d++) {
    const dayDate = new Date(today.getTime() - d * 24 * 60 * 60 * 1000);
    const isWeekend = dayDate.getDay() === 0 || dayDate.getDay() === 6;
    const visits = isWeekend ? 1 : ((d % 3 === 0) ? 4 : (d % 3 === 1) ? 3 : 2);

    for (let v = 0; v < visits; v++) {
      const patronId = allPatrons[(d * 7 + v) % allPatrons.length];
      const inHour = 8 + (v * 2) + (d % 3);
      const inMin = (d * 13 + v * 17) % 60;
      const checkIn = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), inHour, inMin);
      const durationHours = 1.5 + (v % 3) * 0.75;
      const checkOut = new Date(checkIn.getTime() + durationHours * 60 * 60 * 1000);

      attendanceToSeed.push({
        user_id: patronId,
        check_in_at: checkIn.toISOString(),
        check_out_at: checkOut.toISOString(),
        notes: studyNotes[(d + v) % studyNotes.length]
      });
    }
  }

  for (let i = 0; i < attendanceToSeed.length; i += chunkSize) {
    const chunk = attendanceToSeed.slice(i, i + chunkSize);
    const { error: aErr } = await supabase.from('attendance').insert(chunk);
    if (aErr) {
      console.error('Error inserting attendance chunk:', aErr);
      return;
    }
  }
  console.info(`✅ Seeded ${attendanceToSeed.length} attendance records (6 active today, 5 completed today, ${attendanceToSeed.length - 11} historical)`);

  // 9. Seed Announcements
  console.info('📢 Seeding announcements...');
  const announcements = [
    {
      title: 'Upcoming Capstone Mock Defense: Extended Library Hours',
      content: 'The library will remain open until 9:00 PM throughout the midterm defense period to support students conducting research, system verification, and prototype testing.',
      priority: 'high',
      is_active: true,
      starts_at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      expires_at: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      created_by: profileIds.kennethStudent
    },
    {
      title: 'New Semester Circulation Guidelines & Digital QR Scanner Counter',
      content: 'Students can now present their digital library card QR code directly from their mobile devices for instant counter check-in, checkout, and returns.',
      priority: 'high',
      is_active: true,
      starts_at: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      expires_at: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      created_by: profileIds.baybayLibrarian
    },
    {
      title: 'New Computer Science, AI, and Cybersecurity References Available',
      content: 'Over 30 new print volumes covering machine learning, modern systems architecture, algorithms, and distributed databases are now available in Stacks A.',
      priority: 'medium',
      is_active: true,
      starts_at: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      expires_at: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      created_by: profileIds.luminaLibrarian
    },
    {
      title: 'Annual Learning Resource Center Physical Inventory Audit Complete',
      content: 'All collection holdings across 10 academic disciplines have been verified, accessioned, and mapped to the digital catalog.',
      priority: 'medium',
      is_active: true,
      starts_at: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      expires_at: new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000).toISOString(),
      created_by: profileIds.luminaAdmin
    },
    {
      title: 'Quiet Zone Protocol: 3rd Floor Individual Study Carrels',
      content: 'Please observe silence in designated quiet areas. Discussion rooms and collaborative pods are available on the 1st floor.',
      priority: 'low',
      is_active: true,
      starts_at: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      expires_at: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      created_by: profileIds.baybayLibrarian
    },
    {
      title: 'Research Consultation Hours with College Librarian',
      content: 'Students writing their thesis or capstone manuscript may book 1-on-1 literature citation consultations at the reference desk.',
      priority: 'low',
      is_active: true,
      starts_at: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      expires_at: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      created_by: profileIds.baybayLibrarian
    },
    {
      title: 'Library Orientation for First-Year Students',
      content: 'Annual library walkthrough and orientation on digital catalog usage and student services.',
      priority: 'medium',
      is_active: false,
      starts_at: new Date(now.getTime() - 50 * 24 * 60 * 60 * 1000).toISOString(),
      expires_at: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      created_by: profileIds.luminaLibrarian
    }
  ];

  await supabase.from('announcements').insert(announcements);
  console.info(`✅ Seeded ${announcements.length} announcements`);

  // 10. Seed Book Condition Reports
  console.info('🔧 Seeding book condition and shelf reports...');
  const reports = [
    {
      book_id: bookData[0].id,
      user_id: profileIds.godwynStudent,
      notes: 'Page 45-48 has minor margin pencil annotations; book remains readable.',
      status: 'pending'
    },
    {
      book_id: bookData[1].id,
      user_id: profileIds.calinogStudent,
      notes: 'Barcode sticker worn out from counter scanner friction, request replacement label.',
      status: 'pending'
    },
    {
      book_id: bookData[2].id,
      user_id: profileIds.kayleStudent,
      notes: 'Top edge corner binding cloth slightly separated.',
      status: 'pending'
    },
    {
      book_id: bookData[3].id,
      user_id: profileIds.jericoSA,
      notes: 'Repaired crease on front cover lamination with vinyl book tape.',
      status: 'resolved'
    },
    {
      book_id: bookData[4].id,
      user_id: profileIds.luminaSA,
      notes: 'Replaced torn protective plastic cover jacket.',
      status: 'resolved'
    },
    {
      book_id: bookData[5].id,
      user_id: profileIds.kennethStudent,
      notes: 'Misplaced book found on Shelf B2 and reshelved to Shelf A2.',
      status: 'resolved'
    },
    {
      book_id: bookData[6].id,
      user_id: profileIds.rhedStudent,
      notes: 'Spine stitching intact after inspection; no repair needed.',
      status: 'dismissed'
    },
    {
      book_id: bookData[7].id,
      user_id: profileIds.demoStudent,
      notes: 'Reported duplicate copy entry, verified copy is distinct.',
      status: 'dismissed'
    }
  ];

  await supabase.from('reports').insert(reports);
  console.info(`✅ Seeded ${reports.length} reports`);

  // 11. Seed Checklist Dropdowns & Items
  console.info('✅ Seeding operations checklist...');
  const checklistDropdowns = [
    { type: 'user_role', value: 'super_admin' },
    { type: 'user_role', value: 'librarian' },
    { type: 'user_role', value: 'student_assistant' },
    { type: 'user_role', value: 'student' },
    { type: 'module', value: 'Circulation' },
    { type: 'module', value: 'Catalog' },
    { type: 'module', value: 'Attendance' },
    { type: 'module', value: 'Security' },
    { type: 'module', value: 'Inventory' },
    { type: 'module', value: 'Analytics' },
  ];
  await supabase.from('checklist_dropdown_options').upsert(checklistDropdowns, { onConflict: 'type,value' });

  const checklistItems = [
    { problem: 'QR Barcode Scanner Verification', explanation: 'Verify that digital cards scan cleanly at the counter laser and camera kiosks.', user_role: 'librarian', module: 'Circulation', is_completed: true },
    { problem: 'Overdue Loan Penalty Calculation', explanation: 'Ensure that overdue loans highlight correctly in red across tables with calculated fine previews.', user_role: 'librarian', module: 'Circulation', is_completed: true },
    { problem: 'Hold Pickup Expiration Cron Trigger', explanation: 'Verify atomic reservation expiration frees copies automatically after hold days pass.', user_role: 'super_admin', module: 'Security', is_completed: true },
    { problem: 'Live Gate Attendance Tracker Monitor', explanation: 'Confirm active patrons display on the real-time attendance monitor widget.', user_role: 'student_assistant', module: 'Attendance', is_completed: true },
    { problem: 'Digital Library Card Pass Generation', explanation: 'Confirm patron student ID barcode and QR render crisply on mobile views.', user_role: 'student', module: 'Catalog', is_completed: true },
    { problem: 'Physical Copy Condition Classification', explanation: 'Verify copy conditions (New, Good, Fair, Worn, Damaged) filter properly in inventory.', user_role: 'librarian', module: 'Inventory', is_completed: true },
    { problem: 'Real-time Book Availability Counter Sync', explanation: 'Ensure available_copies and total_copies counters update automatically via database triggers.', user_role: 'librarian', module: 'Catalog', is_completed: true },
    { problem: 'Student Self-Service Book Condition Reporting', explanation: 'Validate that patrons can submit book damage reports directly from catalog cards.', user_role: 'student', module: 'Circulation', is_completed: true },
    { problem: 'Role-Based Access Control and Route Guards', explanation: 'Test navigation boundaries between students, assistants, librarians, and super admins.', user_role: 'super_admin', module: 'Security', is_completed: true },
    { problem: 'Monthly Circulation and Patron Traffic Analytics', explanation: 'Ensure charts aggregate borrow volume, top categories, and daily check-ins accurately.', user_role: 'super_admin', module: 'Analytics', is_completed: true }
  ];
  await supabase.from('checklist_items').insert(checklistItems);
  console.info(`✅ Seeded ${checklistItems.length} checklist items`);

  // 12. Seed Notifications
  console.info('🔔 Seeding user notifications...');
  const notifications: any[] = [];

  const notifUsers = [
    profileIds.godwynStudent,
    profileIds.calinogStudent,
    profileIds.kayleStudent,
    profileIds.jericoSA,
    profileIds.kennethStudent,
    profileIds.rhedStudent,
    profileIds.demoStudent,
  ];

  for (let i = 0; i < notifUsers.length; i++) {
    const u = notifUsers[i];
    // Circulation Checkout
    notifications.push({
      user_id: u,
      title: 'Book Borrowed Successfully',
      content: `You have checked out "${bookData[i].title}". Please return by the due date.`,
      type: 'CIRCULATION',
      priority: 'medium',
      is_read: true,
      metadata: { book_id: bookData[i].id, book_title: bookData[i].title }
    });

    // Due Soon
    notifications.push({
      user_id: u,
      title: 'Reminder: Book Due in 2 Days',
      content: `"${bookData[i + 5].title}" is due soon. You can renew online or at the circulation counter.`,
      type: 'DUE_SOON',
      priority: 'high',
      is_read: i % 2 === 0,
      metadata: { book_id: bookData[i + 5].id, book_title: bookData[i + 5].title }
    });

    // Reservation Ready
    notifications.push({
      user_id: u,
      title: 'Reservation Ready for Pickup',
      content: `Good news! Your reserved copy of "${bookData[i + 10].title}" is ready at the circulation desk.`,
      type: 'RESERVATION_READY',
      priority: 'high',
      is_read: false,
      metadata: { book_id: bookData[i + 10].id, book_title: bookData[i + 10].title }
    });

    // System announcement notice
    notifications.push({
      user_id: u,
      title: 'Extended Library Hours for Defense Week',
      content: 'The library will remain open until 9:00 PM throughout the defense period.',
      type: 'SYSTEM',
      priority: 'low',
      is_read: true,
      metadata: { announcement_id: 'extended-hours' }
    });
  }

  // Overdue notices for Kenneth and Rhed
  notifications.push({
    user_id: profileIds.kennethStudent,
    title: 'URGENT: Book Overdue',
    content: `Your loan for "${bookData[2].title}" is overdue. Please return immediately to avoid penalty points.`,
    type: 'OVERDUE',
    priority: 'critical',
    is_read: false,
    metadata: { book_id: bookData[2].id, days_overdue: 12 }
  });
  notifications.push({
    user_id: profileIds.rhedStudent,
    title: 'URGENT: Book Overdue',
    content: `Your loan for "${bookData[3].title}" is overdue. Please return to the circulation desk.`,
    type: 'OVERDUE',
    priority: 'critical',
    is_read: false,
    metadata: { book_id: bookData[3].id, days_overdue: 8 }
  });

  await supabase.from('notifications').insert(notifications);
  console.info(`✅ Seeded ${notifications.length} user notifications`);

  // 13. Seed Audit Logs
  console.info('📋 Seeding administrative audit logs...');
  const auditLogs = [
    {
      admin_id: profileIds.luminaAdmin,
      entity_type: 'system_settings',
      action: 'UPDATE',
      old_value: { max_borrow_limit: 3 },
      new_value: { max_borrow_limit: 5 },
      reason: 'Midterm defense preparation: raised borrowing limits for patrons',
      details: { ip: '192.168.1.10', client: 'Lumina Web Admin' }
    },
    {
      admin_id: profileIds.baybayLibrarian,
      entity_type: 'books',
      entity_id: bookData[0].id,
      action: 'INSERT',
      old_value: null,
      new_value: { title: bookData[0].title, total_copies: 5 },
      reason: 'New acquisition: Clean Code (Robert C. Martin)',
      details: { source: 'STI Learning Resource Center Acquisitions' }
    },
    {
      admin_id: profileIds.baybayLibrarian,
      entity_type: 'books',
      entity_id: bookData[1].id,
      action: 'INSERT',
      old_value: null,
      new_value: { title: bookData[1].title, total_copies: 4 },
      reason: 'New acquisition: The Pragmatic Programmer',
      details: { source: 'STI Learning Resource Center Acquisitions' }
    },
    {
      admin_id: profileIds.luminaLibrarian,
      entity_type: 'library_cards',
      action: 'ISSUANCE',
      old_value: null,
      new_value: { card_number: 'STU-376375', user: 'Godwyn Neri' },
      reason: 'Digital student library card activated for demo access',
      details: { status: 'ACTIVE' }
    },
    {
      admin_id: profileIds.luminaLibrarian,
      entity_type: 'library_cards',
      action: 'ISSUANCE',
      old_value: null,
      new_value: { card_number: 'STU-190782', user: 'Josh Raizen Calinog' },
      reason: 'Digital student assistant card activated',
      details: { status: 'ACTIVE' }
    },
    {
      admin_id: profileIds.luminaLibrarian,
      entity_type: 'borrowing_records',
      action: 'CHECKOUT',
      old_value: null,
      new_value: { patron: 'Godwyn Neri', book: bookData[0].title },
      reason: 'Manual counter checkout verified via QR scan',
      details: { counter: 'Desk-01' }
    },
    {
      admin_id: profileIds.jericoSA,
      entity_type: 'borrowing_records',
      action: 'RETURN',
      old_value: { status: 'ACTIVE' },
      new_value: { status: 'RETURNED' },
      reason: 'Patron return processed and copy shelved',
      details: { counter: 'Desk-02' }
    },
    {
      admin_id: profileIds.luminaSuperAdmin,
      entity_type: 'policy',
      action: 'UPDATE',
      old_value: { hold_expiry_days: 2 },
      new_value: { hold_expiry_days: 3 },
      reason: 'Adjusted hold pickup window to give patrons adequate collection time',
      details: { module: 'Policies' }
    }
  ];

  await supabase.from('audit_logs').insert(auditLogs);
  console.info(`✅ Seeded ${auditLogs.length} audit logs`);

  // 14. Seed UI Preferences
  console.info('🎨 Seeding UI preferences...');
  const uiPrefs = allPatrons.map(id => ({
    user_id: id,
    preferences: {
      theme: 'system',
      compact_tables: false,
      catalog_view: 'grid',
      email_notifications: true
    }
  }));
  await supabase.from('ui_preferences').upsert(uiPrefs, { onConflict: 'user_id' });
  console.info(`✅ Seeded UI preferences for ${uiPrefs.length} users`);

  // 15. Verify & Update System Settings
  console.info('⚙️ Ensuring system settings policies are set to official standards...');
  await supabase.from('system_settings').update({
    value: '["BS Information Technology", "BS Computer Science", "BS Computer Engineering", "BS Business Administration", "BS Hospitality Management", "BS Tourism Management", "BS Accounting Information System", "Bachelor of Multimedia Arts"]'
  }).eq('key', 'academic_programs');

  await supabase.from('system_settings').update({ value: '5' }).eq('key', 'max_borrow_limit');
  await supabase.from('system_settings').update({ value: '7' }).eq('key', 'loan_period_days');
  await supabase.from('system_settings').update({ value: '3' }).eq('key', 'renewal_period_days');
  await supabase.from('system_settings').update({ value: '2' }).eq('key', 'max_renewal_count');
  await supabase.from('system_settings').update({ value: '3' }).eq('key', 'hold_expiry_days');
  await supabase.from('system_settings').update({ value: '3' }).eq('key', 'max_reservations_per_student');
  await supabase.from('system_settings').update({ value: '1' }).eq('key', 'card_validity_years');

  console.info('✨ Seed process finished with 100% success! Database is fully organized.');
}

seed().catch(err => {
  console.error('Unexpected error during seeding:', err);
  process.exit(1);
});
