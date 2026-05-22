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

// Define profiles/users in the DB
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
  console.info('🌱 Starting database seed with expanded and varied dataset...');

  // --- Clean-up Phase ---
  console.info('🧹 Cleaning up existing data in dependency order...');
  
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
  
  // Preserve library cards that belong to the demo profiles
  await supabase.from('library_cards').delete().not('user_id', 'in', `(${Object.values(profileIds).join(',')})`);
  await supabase.from('book_copies').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('books').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('categories').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  console.info('🧹 Clean-up completed.');

  // 1. Seed Categories
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

  // Helper to get category ID
  const getCatId = (slug: string) => catMap.get(slug);

  // 2. Define 100 Books (10 per category)
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

  // Simple deterministic string hashing helper for distribution
  const getSimpleHash = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash);
  };

  for (const book of bookData) {
    bookCopiesMap[book.title] = [];
    
    // Choose number of copies dynamically (between 2 and 5)
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
      } else {
        condition = 'Damaged';
      }

      // Add variety for maintenance or lost books (unrelated to borrows)
      if ((hashVal + i) % 17 === 0) {
        status = 'MAINTENANCE';
      } else if ((hashVal + i) % 31 === 0) {
        status = 'LOST';
      }

      copies.push({ book_id: book.id, condition, status });
    }
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
    .upsert(libraryCards, { onConflict: 'user_id' });

  if (cardError) {
    console.error('Error seeding library cards:', cardError);
    return;
  }
  console.info('✅ Seeded library cards');

  // 5. Seed Borrowing Records (160 records total: 120 returned, 25 active, 15 overdue)
  const now = new Date();
  const borrowsToSeed: any[] = [];
  
  // Categorize our users who borrow books
  const borrowers = [
    profileIds.godwynStudent,
    profileIds.kayleStudent,
    profileIds.jericoSA,
    profileIds.luminaSA,
  ];

  // Pool of copy IDs and helper tracking
  const allCopies = [...insertedCopies].filter(c => c.status === 'AVAILABLE');
  
  // Deterministic selector function to assign copies to borrows
  let copyIndex = 0;
  const selectCopy = () => {
    if (allCopies.length === 0) return null;
    const copy = allCopies[copyIndex % allCopies.length];
    copyIndex++;
    return copy;
  };

  // --- Returned Borrows (120 records) ---
  // Spread over 180 days to 15 days ago
  console.info('🌱 Generating 120 completed borrows (RETURNED)...');
  for (let i = 1; i <= 120; i++) {
    const borrowDayOffset = 15 + (i * 1.35); // 15 to ~177 days ago
    const borrowDate = new Date(now.getTime() - borrowDayOffset * 24 * 60 * 60 * 1000);
    const dueDate = new Date(borrowDate.getTime() + 14 * 24 * 60 * 60 * 1000);
    
    // Most returned within 1-13 days, some overdue and returned in 15-20 days
    const returnedDays = (i % 8 === 0) ? 17 : (i % 3 === 0) ? 10 : 6;
    const returnedDate = new Date(borrowDate.getTime() + returnedDays * 24 * 60 * 60 * 1000);
    
    const borrowerId = borrowers[i % borrowers.length];
    const copy = selectCopy();
    
    if (copy) {
      borrowsToSeed.push({
        user_id: borrowerId,
        book_copy_id: copy.id,
        processed_by: profileIds.rhedLibrarian,
        borrowed_at: borrowDate.toISOString(),
        due_date: dueDate.toISOString(),
        returned_at: returnedDate.toISOString(),
        returned_by: profileIds.luminaLibrarian,
        status: 'RETURNED'
      });
    }
  }

  
  
  
  const { data: borrowData, error: borrowError } = await supabase
    .from('borrowing_records')
    .insert(borrowsToSeed)
    .select();

  if (borrowError) {
    console.error('Error seeding borrowing records:', borrowError);
    return;
  }
  console.info(`✅ Seeded ${borrowData.length} borrowing records`);

  
  
  // 7. Seed Attendance (155 records total: 150 historical, 5 active today)
  console.info('🌱 Generating 150 historical attendance records over 50 days...');
  const attendanceToSeed: any[] = [];
  const attendees = [
    profileIds.godwynStudent,
    profileIds.kayleStudent,
    profileIds.jericoSA,
    profileIds.luminaSA,
    profileIds.rhedLibrarian
  ];

  const attendanceNotes = [
    'Study session', 'Research work', 'Group meeting', 'Studying calculus', 
    'Library assistant duty', 'Consulting librarian', 'Reading novel', 'Web design team project'
  ];

  // 150 Historical records
  for (let d = 1; d <= 50; d++) {
    // Generate checkins for weekdays mostly
    const dayDate = new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
    const isWeekend = dayDate.getDay() === 0 || dayDate.getDay() === 6;
    const visitsCount = isWeekend ? 1 : (d % 3 === 0) ? 4 : (d % 3 === 1) ? 3 : 2;

    for (let v = 0; v < visitsCount; v++) {
      const attendeeId = attendees[(d * 7 + v) % attendees.length];
      const checkInHour = 8 + (v * 3) + (d % 3);
      const checkInMinutes = (d * 11 + v * 13) % 60;
      const checkInTime = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), checkInHour, checkInMinutes);
      
      const durationHours = 2 + (v % 3) + (d % 2);
      const checkOutTime = new Date(checkInTime.getTime() + durationHours * 60 * 60 * 1000);
      
      attendanceToSeed.push({
        user_id: attendeeId,
        check_in_at: checkInTime.toISOString(),
        check_out_at: checkOutTime.toISOString(),
        notes: attendanceNotes[(d + v) % attendanceNotes.length]
      });
    }
  }

  
  const { error: attendanceError } = await supabase
    .from('attendance')
    .insert(attendanceToSeed);

  if (attendanceError) {
    console.error('Error seeding attendance:', attendanceError);
  } else {
    console.info('✅ Seeded completed and active attendance records');
  }

  console.info('✨ Seeding completed successfully!');
}

seed().catch(err => {
  console.error('Unexpected error during seeding:', err);
  process.exit(1);
});
