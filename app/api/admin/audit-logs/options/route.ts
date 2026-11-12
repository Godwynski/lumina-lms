import { NextResponse } from 'next/server';
import { withAuthApi } from '@/lib/api-utils';
import { auditSearchPattern } from '@/lib/audit-log-query';
import { z } from 'zod';

export const GET = withAuthApi(async (request, { supabase }) => {
  const params = new URL(request.url).searchParams;
  const parsed = z.object({ kind: z.enum(['book', 'student', 'actor', 'copy']), id: z.string().uuid().optional(), bookId: z.string().uuid().optional() }).safeParse(Object.fromEntries(params));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid selection.' }, { status: 400 });
  const { kind, id, bookId } = parsed.data;
  const term = (params.get('query') || '').trim().slice(0, 100);
  const pattern = auditSearchPattern(term);
  if (kind === 'book') {
    let query = supabase.from('books').select('id,title,author,isbn').order('title').limit(20);
    if (id) query = query.eq('id', id);
    else if (term) {
      const { data: copies, error } = await supabase.from('book_copies').select('book_id').or(`qr_string.ilike.${pattern},accession_number.ilike.${pattern}`).limit(50);
      if (error) throw error;
      const ids = [...new Set((copies || []).map(c => c.book_id))];
      query = query.or(`title.ilike.${pattern},isbn.ilike.${pattern}${ids.length ? `,id.in.(${ids.join(',')})` : ''}`);
    }
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ options: (data || []).map(b => ({ id: b.id, label: b.title, description: [b.author, b.isbn].filter(Boolean).join(' · ') })) });
  }
  if (kind === 'copy') {
    if (!bookId) return NextResponse.json({ options: [] });
    let query = supabase.from('book_copies').select('id,qr_string,accession_number').eq('book_id', bookId).order('qr_string').limit(20);
    if (id) query = query.eq('id', id);
    else if (term) query = query.or(`qr_string.ilike.${pattern},accession_number.ilike.${pattern}`);
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ options: (data || []).map(c => ({ id: c.id, label: c.qr_string, description: c.accession_number || '' })) });
  }
  let query = supabase.from('profiles').select('id,full_name,email,student_id,role').order('full_name').limit(20);
  if (id) query = query.eq('id', id);
  else {
    query = query.in('role', kind === 'student' ? ['student', 'student_assistant'] : ['super_admin', 'librarian', 'student_assistant']);
    if (term) query = query.or(`full_name.ilike.${pattern},email.ilike.${pattern},student_id.ilike.${pattern}`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return NextResponse.json({ options: (data || []).map(p => ({ id: p.id, label: p.full_name || p.email, description: [p.student_id, p.email, kind === 'actor' ? p.role.replaceAll('_', ' ') : null].filter(Boolean).join(' · ') })) });
}, { allowedRoles: ['super_admin'] });
