export interface Category {
  id: string;
  name: string;
  description?: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  isbn?: string;
  cover_url?: string;
  section?: string;
  location?: string;
  total_copies?: number;
  available_copies: number;
  is_active?: boolean;
  categories?: {
    name: string;
  } | {
    name: string;
  }[];
  tags?: string[];
  created_at?: string;
}

export interface BookCopy {
  id: string;
  book_id: string;
  status: 'AVAILABLE' | 'BORROWED' | 'MAINTENANCE' | 'LOST';
  qr_string: string;
  condition?: string;
  created_at: string;
}
