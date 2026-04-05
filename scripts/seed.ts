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

async function seed() {
  console.info('🌱 Starting database seed...');

  // 1. Seed Categories
  const categories = [
    { name: 'Computer Science', description: 'Books about programming, algorithms, and systems.' },
    { name: 'Mathematics', description: 'Core math concepts and advanced theories.' },
    { name: 'Literature', description: 'Classic and modern fiction.' },
    { name: 'Science', description: 'Physics, Biology, and Chemistry.' }
  ];

  const { data: catData, error: catError } = await supabase
    .from('categories')
    .upsert(categories, { onConflict: 'name' })
    .select();

  if (catError) {
    console.error('Error seeding categories:', catError);
    return;
  }
  console.info(`✅ Seeded ${catData.length} categories`);

  const csCat = catData.find(c => c.name === 'Computer Science')?.id;

  // 2. Seed Books
  const books = [
    {
      title: 'Clean Code',
      author: 'Robert C. Martin',
      isbn: '9780132350884',
      category_id: csCat,
      tags: ['programming', 'software-design'],
      location: 'Shelf A1',
      section: 'Tech'
    },
    {
      title: 'The Pragmatic Programmer',
      author: 'Andrew Hunt & David Thomas',
      isbn: '9780135957059',
      category_id: csCat,
      tags: ['software-engineering', 'best-practices'],
      location: 'Shelf A1',
      section: 'Tech'
    }
  ];

  const { data: bookData, error: bookError } = await supabase
    .from('books')
    .upsert(books, { onConflict: 'isbn' })
    .select();

  if (bookError) {
    console.error('Error seeding books:', bookError);
    return;
  }
  console.info(`✅ Seeded ${bookData.length} books`);

  // 3. Seed Book Copies
  const copies = [];
  for (const book of bookData) {
    copies.push({ book_id: book.id, status: 'AVAILABLE', condition: 'New' });
    copies.push({ book_id: book.id, status: 'AVAILABLE', condition: 'Good' });
  }

  const { error: copyError } = await supabase
    .from('book_copies')
    .insert(copies);

  if (copyError) {
    console.warn('Note: Book copies might already exist (unique QR constraint)');
  } else {
    console.info('✅ Seeded book copies');
  }

  console.info('✨ Seeding completed successfully!');
}

seed().catch(err => {
  console.error('Unexpected error during seeding:', err);
  process.exit(1);
});
