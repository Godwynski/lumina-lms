import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { POST } from '@/app/api/test-email/route';
import { createClient } from '@/lib/supabase/server';
import { sendOverdueEmail, sendDueSoonEmail, sendTestEmail } from '@/lib/mail';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/mail', () => ({
  sendOverdueEmail: vi.fn(),
  sendDueSoonEmail: vi.fn(),
  sendTestEmail: vi.fn(),
}));

describe('POST /api/test-email', () => {
  let mockSupabase: {
    auth: { getUser: Mock };
    from: Mock;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockSupabase = {
      auth: {
        getUser: vi.fn(),
      },
      from: vi.fn(),
    };
    (createClient as Mock).mockResolvedValue(mockSupabase);
  });

  it('returns 401 Unauthorized if user is not authenticated', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });

    const req = new Request('http://localhost/api/test-email', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com' }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 403 Forbidden if user role is student', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { role: 'student', full_name: 'Student User', email: 'stu@example.com' },
          }),
        }),
      }),
    });

    const req = new Request('http://localhost/api/test-email', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com' }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toContain('Forbidden');
  });

  it('returns 403 Forbidden if admin profile is archived', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { role: 'super_admin', full_name: 'Admin', email: 'admin@example.com', status: 'ARCHIVED' },
          }),
        }),
      }),
    });

    const req = new Request('http://localhost/api/test-email', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com' }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toContain('archived');
  });

  it('handles null body gracefully without crashing', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { role: 'super_admin', full_name: 'Admin', email: 'admin@example.com', status: 'ACTIVE' },
          }),
        }),
      }),
    });
    (sendOverdueEmail as Mock).mockResolvedValue({ success: true, messageId: 'msg-123' });

    const req = new Request('http://localhost/api/test-email', {
      method: 'POST',
      body: 'null',
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(sendOverdueEmail).toHaveBeenCalled();
  });

  it('returns 400 Bad Request for invalid email format', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { role: 'librarian', full_name: 'Librarian', email: 'lib@example.com', status: 'ACTIVE' },
          }),
        }),
      }),
    });

    const req = new Request('http://localhost/api/test-email', {
      method: 'POST',
      body: JSON.stringify({ email: 'not-a-valid-email' }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe('Invalid recipient email address');
  });

  it('returns 400 Bad Request if no email is provided and profile email is empty', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { role: 'librarian', full_name: 'Librarian', email: null, status: 'ACTIVE' },
          }),
        }),
      }),
    });

    const req = new Request('http://localhost/api/test-email', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe('No recipient email found');
  });

  it('sends due soon email when type is due_soon', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { role: 'super_admin', full_name: 'Admin', email: 'admin@example.com', status: 'ACTIVE' },
          }),
        }),
      }),
    });
    (sendDueSoonEmail as Mock).mockResolvedValue({ success: true, messageId: 'msg-456' });

    const req = new Request('http://localhost/api/test-email', {
      method: 'POST',
      body: JSON.stringify({ email: 'target@example.com', type: 'due_soon' }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(sendDueSoonEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'target@example.com',
        userName: 'Admin',
      })
    );
  });

  it('sends test email when type is test', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { role: 'super_admin', full_name: 'Admin', email: 'admin@example.com', status: 'ACTIVE' },
          }),
        }),
      }),
    });
    (sendTestEmail as Mock).mockResolvedValue({ success: true, messageId: 'msg-789' });

    const req = new Request('http://localhost/api/test-email', {
      method: 'POST',
      body: JSON.stringify({ email: 'target@example.com', type: 'test' }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(sendTestEmail).toHaveBeenCalledWith('target@example.com', 'Admin');
  });

  it('returns 500 when email sending fails', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { role: 'super_admin', full_name: 'Admin', email: 'admin@example.com', status: 'ACTIVE' },
          }),
        }),
      }),
    });
    (sendOverdueEmail as Mock).mockResolvedValue({
      success: false,
      error: new Error('SMTP connection timed out'),
    });

    const req = new Request('http://localhost/api/test-email', {
      method: 'POST',
      body: JSON.stringify({ email: 'target@example.com', type: 'overdue' }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toBe('SMTP connection timed out');
  });
});
