import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockSupabaseClient } from '@/test/mocks/supabase';

const {
  mockCreateAdminClient,
  mockSendMail,
  mockAfter,
  mockLookup,
  mockSharpToBuffer,
  mockSharpResize,
  mockSharpWebp,
  mockQrToBuffer,
} = vi.hoisted(() => ({
  mockCreateAdminClient: vi.fn(),
  mockSendMail: vi.fn(),
  mockAfter: vi.fn((cb: () => unknown) => cb()),
  mockLookup: vi.fn(),
  mockSharpToBuffer: vi.fn().mockResolvedValue(Buffer.from('webp-bytes')),
  mockSharpResize: vi.fn(),
  mockSharpWebp: vi.fn(),
  mockQrToBuffer: vi.fn().mockResolvedValue(Buffer.from('png-qr-bytes')),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: (...args: unknown[]) => mockCreateAdminClient(...args),
}));

vi.mock('next/server', () => ({
  after: (cb: () => unknown) => mockAfter(cb),
}));

vi.mock('nodemailer', () => ({
  default: {
    createTransport: () => ({
      sendMail: mockSendMail,
    }),
  },
}));

vi.mock('node:dns/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:dns/promises')>();
  return {
    ...actual,
    default: {
      ...actual,
      lookup: (...args: unknown[]) => mockLookup(...args),
    },
    lookup: (...args: unknown[]) => mockLookup(...args),
  };
});

vi.mock('sharp', () => ({
  default: vi.fn(() => {
    const chain = {
      resize: mockSharpResize.mockImplementation(() => chain),
      webp: mockSharpWebp.mockImplementation(() => chain),
      toBuffer: mockSharpToBuffer,
    };
    return chain;
  }),
}));

vi.mock('qrcode', () => ({
  default: {
    toBuffer: (...args: unknown[]) => mockQrToBuffer(...args),
  },
}));

import { logAuditActivity } from '@/lib/audit';
import { getFromAddress, sendOverdueEmail, sendDueSoonEmail, sendTestEmail } from '@/lib/mail';
import { sendNotification, sendBulkNotifications, runMaintenanceTasks } from '@/lib/notifications';
import { fetchImage, ImageFetchError } from '@/lib/fetch-image';
import {
  CARD_ASSET_BUCKET,
  AVATAR_BUCKET,
  sanitizeStudentId,
  generateFacultyId,
  parseStudentIdFromEmail,
  fileNamesFor,
  cardPhotoPath,
  isDeterministicProfileUrl,
  resolveStudentId,
} from '@/lib/library-card-assets';
import { ensureStaticLibraryCardAssets } from '@/lib/library-card-assets.server';

describe('lib/audit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('persists an audit log entry inside next/server after()', async () => {
    const admin = createMockSupabaseClient();
    admin.setTableResponse('audit_logs', null, null);
    mockCreateAdminClient.mockReturnValueOnce(admin.client);

    const pendingCallbacks: Array<Promise<unknown>> = [];
    mockAfter.mockImplementationOnce((cb: () => unknown) => {
      pendingCallbacks.push(Promise.resolve(cb()));
    });

    await logAuditActivity(
      'admin-1',
      'book',
      'book-42',
      'updated',
      'Fixed ISBN',
      { field: 'isbn' },
      { isbn: 'old' },
      { isbn: 'new' }
    );

    await Promise.all(pendingCallbacks);

    expect(admin.from).toHaveBeenCalledWith('audit_logs');
    expect(admin.getTableBuilder('audit_logs').insert).toHaveBeenCalledWith({
      admin_id: 'admin-1',
      entity_type: 'book',
      entity_id: 'book-42',
      action: 'updated',
      reason: 'Fixed ISBN',
      details: { field: 'isbn' },
      old_value: { isbn: 'old' },
      new_value: { isbn: 'new' },
    });
  });

  it('handles DB errors and fatal initialization errors without throwing', async () => {
    const admin = createMockSupabaseClient();
    admin.setTableResponse('audit_logs', null, { message: 'insert failed' });
    mockCreateAdminClient.mockReturnValueOnce(admin.client);

    const pendingCallbacks: Array<Promise<unknown>> = [];
    mockAfter.mockImplementationOnce((cb: () => unknown) => {
      pendingCallbacks.push(Promise.resolve(cb()));
    });

    const consoleErrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await logAuditActivity(undefined, 'system', null, 'reset');
    await Promise.all(pendingCallbacks);
    expect(consoleErrSpy).toHaveBeenCalled();

    mockCreateAdminClient.mockImplementationOnce(() => {
      throw new Error('admin unavailable');
    });
    await expect(logAuditActivity('a1', 'policy', 'p1', 'update')).resolves.toBeUndefined();
    consoleErrSpy.mockRestore();
  });
});

describe('lib/mail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('formats getFromAddress across empty, full, bare email, and bare name SMTP_FROM', () => {
    vi.stubEnv('SMTP_FROM', '');
    expect(getFromAddress()).toBe('"Lumina LMS" <no-reply@lumina-lms.com>');

    vi.stubEnv('SMTP_FROM', '"Library Desk" <desk@sti.edu.ph>');
    expect(getFromAddress()).toBe('"Library Desk" <desk@sti.edu.ph>');

    vi.stubEnv('SMTP_FROM', 'alerts@sti.edu.ph');
    expect(getFromAddress()).toBe('"Lumina LMS" <alerts@sti.edu.ph>');

    vi.stubEnv('SMTP_FROM', 'STI Alabang Library');
    expect(getFromAddress()).toBe('"STI Alabang Library" <no-reply@lumina-lms.com>');
  });

  it('sendOverdueEmail validates recipient, escapes HTML, and handles transporter success/error', async () => {
    expect(
      await sendOverdueEmail({ to: '', userName: 'Ana', bookTitle: 'Clean Code', dueDate: 'Jan 1', overdueDays: 1 })
    ).toEqual({ success: false, error: 'No email address' });
    expect(mockSendMail).not.toHaveBeenCalled();

    mockSendMail.mockResolvedValueOnce({ messageId: 'msg-1' });
    const res = await sendOverdueEmail({
      to: 'ana@sti.edu.ph',
      userName: '<script>Ana</script>',
      bookTitle: 'C++ & "Algorithms"',
      dueDate: '2026-01-10',
      overdueDays: 1,
    });
    expect(res).toEqual({ success: true, messageId: 'msg-1' });
    const mailArg = mockSendMail.mock.calls[0][0];
    expect(mailArg.subject).toBe('URGENT: Your borrowed book is 1 day overdue');
    expect(mailArg.html).toContain('&lt;script&gt;Ana&lt;/script&gt;');
    expect(mailArg.html).toContain('C++ &amp; &quot;Algorithms&quot;');

    mockSendMail.mockRejectedValueOnce(new Error('SMTP down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const fail = await sendOverdueEmail({
      to: 'ana@sti.edu.ph',
      userName: 'Ana',
      bookTitle: 'Book',
      dueDate: '2026-01-10',
      overdueDays: 3,
    });
    expect(fail.success).toBe(false);
    vi.restoreAllMocks();
  });

  it('sendDueSoonEmail and sendTestEmail send emails and handle missing recipients or errors', async () => {
    expect(
      await sendDueSoonEmail({ to: '', userName: 'Ana', bookTitle: 'Book', dueDate: 'Jan 5' })
    ).toEqual({ success: false, error: 'No email address' });

    mockSendMail.mockResolvedValueOnce({ messageId: 'due-1' });
    expect(
      await sendDueSoonEmail({
        to: 'ana@sti.edu.ph',
        userName: "O'Brien",
        bookTitle: 'SQL',
        dueDate: 'Jan 5',
      })
    ).toEqual({ success: true, messageId: 'due-1' });
    expect(mockSendMail.mock.calls[0][0].html).toContain('O&#39;Brien');

    expect(await sendTestEmail('', 'Admin')).toEqual({ success: false, error: 'No email address' });

    mockSendMail.mockResolvedValueOnce({ messageId: 'test-1' });
    expect(await sendTestEmail('admin@sti.edu.ph', 'Admin')).toEqual({ success: true, messageId: 'test-1' });

    mockSendMail.mockRejectedValueOnce(new Error('Auth failed'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await sendTestEmail('admin@sti.edu.ph', 'Admin')).toEqual({
      success: false,
      error: 'Auth failed',
    });
    vi.restoreAllMocks();
  });
});

describe('lib/notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sendNotification inserts row and returns success or DB error', async () => {
    const admin = createMockSupabaseClient();
    admin.setTableResponse('notifications', null, null);
    mockCreateAdminClient.mockReturnValue(admin.client);

    const ok = await sendNotification({
      userId: 'u1',
      title: 'Hello',
      content: 'World',
    });
    expect(ok).toEqual({ success: true });
    expect(admin.getTableBuilder('notifications').insert).toHaveBeenCalledWith({
      user_id: 'u1',
      title: 'Hello',
      content: 'World',
      type: 'SYSTEM',
      priority: 'medium',
      metadata: {},
    });

    vi.spyOn(console, 'error').mockImplementation(() => {});
    admin.setTableResponse('notifications', null, { message: 'RLS error' });
    expect(await sendNotification({ userId: 'u1', title: 'X', content: 'Y' })).toEqual({
      success: false,
      error: 'RLS error',
    });

    mockCreateAdminClient.mockImplementationOnce(() => {
      throw new Error('No admin client');
    });
    expect(await sendNotification({ userId: 'u1', title: 'X', content: 'Y' })).toEqual({
      success: false,
      error: 'No admin client',
    });
    vi.restoreAllMocks();
  });

  it('sendBulkNotifications inserts one row per user and handles failures', async () => {
    const admin = createMockSupabaseClient();
    admin.setTableResponse('notifications', null, null);
    mockCreateAdminClient.mockReturnValue(admin.client);

    const res = await sendBulkNotifications(['u1', 'u2'], {
      title: 'Alert',
      content: 'Holiday closure',
      type: 'SYSTEM',
      priority: 'high',
    });
    expect(res).toEqual({ success: true });
    expect(admin.getTableBuilder('notifications').insert).toHaveBeenCalledWith([
      { user_id: 'u1', title: 'Alert', content: 'Holiday closure', type: 'SYSTEM', priority: 'high', metadata: {} },
      { user_id: 'u2', title: 'Alert', content: 'Holiday closure', type: 'SYSTEM', priority: 'high', metadata: {} },
    ]);

    vi.spyOn(console, 'error').mockImplementation(() => {});
    admin.setTableResponse('notifications', null, { message: 'Bulk failed' });
    expect(await sendBulkNotifications(['u1'], { title: 'A', content: 'B' })).toEqual({
      success: false,
      error: 'Bulk failed',
    });
    vi.restoreAllMocks();
  });

  it('runMaintenanceTasks processes due-soon reminders, overdue claims, expired reservations, and attendance RPC', async () => {
    const dueSoonRow = {
      id: 'br-due-1',
      user_id: 'u-due',
      due_date: new Date(Date.now() + 12 * 3600 * 1000).toISOString(),
      status: 'ACTIVE',
      reminder_sent: false,
      profiles: { full_name: 'Student One', email: 's1@sti.edu.ph' },
      book_copy: { book_id: 'b1', book: { title: 'Clean Code', author: 'Robert Martin', cover_url: null } },
    };

    const overdueRow = {
      id: 'br-ov-1',
      user_id: 'u-ov',
      due_date: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
      status: 'ACTIVE',
      reminder_sent: true,
      overdue_notified: false,
      profiles: { full_name: 'Student Two', email: 's2@sti.edu.ph' },
      book_copy: { book_id: 'b2', book: { title: 'Dune', author: 'Frank Herbert', cover_url: null } },
    };

    const expiredReservation = {
      id: 'res-1',
      user_id: 'u-res',
      copy_id: 'copy-9',
      status: 'READY',
      books: { title: 'Designing Data-Intensive Applications' },
    };

    let borrowingSelectCall = 0;
    const borrowingBuilder: Record<string, unknown> = {
      select: vi.fn().mockImplementation(() => borrowingBuilder),
      update: vi.fn().mockImplementation(() => borrowingBuilder),
      eq: vi.fn().mockImplementation(() => borrowingBuilder),
      in: vi.fn().mockImplementation(() => borrowingBuilder),
      lte: vi.fn().mockImplementation(() => borrowingBuilder),
      gt: vi.fn().mockImplementation(() => borrowingBuilder),
      lt: vi.fn().mockImplementation(() => borrowingBuilder),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'br-ov-1' }, error: null }),
      then: (onfulfilled: (v: { data: unknown; error: unknown }) => unknown) => {
        borrowingSelectCall++;
        if (borrowingSelectCall === 1) {
          return Promise.resolve({ data: [dueSoonRow], error: null }).then(onfulfilled);
        }
        if (borrowingSelectCall === 2) {
          return Promise.resolve({ data: null, error: null }).then(onfulfilled);
        }
        if (borrowingSelectCall === 3) {
          return Promise.resolve({ data: [overdueRow], error: null }).then(onfulfilled);
        }
        return Promise.resolve({ data: null, error: null }).then(onfulfilled);
      },
    };

    const settingsBuilder = createMockSupabaseClient().getTableBuilder('system_settings');
    settingsBuilder.setResolveValue([{ key: 'due_soon_reminder_days', value: '2' }]);

    const reservationsBuilder = createMockSupabaseClient().getTableBuilder('reservations');
    reservationsBuilder.setResolveValue([expiredReservation]);

    const notificationsBuilder = createMockSupabaseClient().getTableBuilder('notifications');
    notificationsBuilder.setResolveValue(null, null);

    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const adminClient = {
      from: vi.fn((table: string) => {
        if (table === 'system_settings') return settingsBuilder;
        if (table === 'borrowing_records') return borrowingBuilder;
        if (table === 'reservations') return reservationsBuilder;
        if (table === 'notifications') return notificationsBuilder;
        return createMockSupabaseClient().getTableBuilder(table);
      }),
      rpc,
    };

    mockCreateAdminClient.mockReturnValue(adminClient);
    mockSendMail.mockResolvedValue({ messageId: 'mail-ok' });

    const summary = await runMaintenanceTasks();

    expect(summary).toEqual({
      remindersSent: 1,
      overdueTagged: 1,
      reservationsExpired: 1,
      errors: [],
    });
    expect(rpc).toHaveBeenCalledWith('release_copy', { p_copy_id: 'copy-9' });
    expect(rpc).toHaveBeenCalledWith('auto_checkout_forgotten_attendance');
    expect(mockSendMail).toHaveBeenCalledTimes(2);
  });

  it('runMaintenanceTasks records per-phase errors without aborting subsequent phases', async () => {
    const admin = createMockSupabaseClient();
    admin.setTableResponse('system_settings', []);
    admin.setTableResponse('borrowing_records', null, { message: 'borrowings unavailable' });
    admin.setTableResponse('reservations', null, { message: 'reservations unavailable' });
    admin.rpc.mockRejectedValue(new Error('attendance rpc failed'));
    mockCreateAdminClient.mockReturnValue(admin.client);

    const summary = await runMaintenanceTasks();
    expect(summary.remindersSent).toBe(0);
    expect(summary.overdueTagged).toBe(0);
    expect(summary.reservationsExpired).toBe(0);
    expect(summary.errors.length).toBe(4);
    expect(summary.errors[3]).toContain('attendance rpc failed');
  });
});

describe('lib/fetch-image', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('rejects invalid URLs, non-HTTPS protocols, and unresolvable hosts', async () => {
    await expect(fetchImage('not a url')).rejects.toThrow(ImageFetchError);
    await expect(fetchImage('http://example.com/a.png')).rejects.toThrow('Only HTTPS image URLs are allowed.');
    await expect(fetchImage('file:///etc/passwd')).rejects.toThrow('Only HTTPS image URLs are allowed.');

    mockLookup.mockResolvedValueOnce([]);
    await expect(fetchImage('https://nonexistent.example/a.png')).rejects.toThrow('Image host could not be found.');
  });

  it.each([
    'https://127.0.0.1/a.png',
    'https://10.0.0.5/a.png',
    'https://172.16.1.1/a.png',
    'https://192.168.1.10/a.png',
    'https://169.254.169.254/latest/meta-data',
    'https://100.64.0.1/a.png',
    'https://[::1]/a.png',
    'https://[fc00::1]/a.png',
    'https://[fe80::1]/a.png',
    'https://[::ffff:127.0.0.1]/a.png',
  ])('blocks SSRF IP literal %s', async (url) => {
    await expect(fetchImage(url)).rejects.toThrow('Restricted remote image host.');
  });

  it('blocks DNS names resolving to private IP addresses', async () => {
    mockLookup.mockResolvedValueOnce([{ address: '93.184.216.34' }, { address: '10.1.2.3' }]);
    await expect(fetchImage('https://rebind.example.com/pic.png')).rejects.toThrow('Restricted remote image host.');
  });

  it('rejects fetch failures, non-OK HTTP status, SVG/non-image types, and oversized payloads', async () => {
    mockLookup.mockResolvedValue([{ address: '93.184.216.34' }]);

    globalThis.fetch = vi.fn().mockRejectedValueOnce(new Error('AbortError'));
    await expect(fetchImage('https://cdn.example.com/pic.png')).rejects.toThrow(
      'Could not download the image. The image host may be unavailable or timed out.'
    );

    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response('not found', { status: 404, headers: { 'retry-after': '30' } })
    );
    await expect(fetchImage('https://cdn.example.com/pic.png')).rejects.toMatchObject({
      message: 'Could not download the image (HTTP 404).',
      status: 404,
      retryAfterMs: 30_000,
    });

    // Validated redirects up to 3 hops, rejecting private redirect targets and >3 redirects
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(null, { status: 302, headers: { location: 'https://127.0.0.1/secret.png' } })
    );
    await expect(fetchImage('https://cdn.example.com/redirect.png')).rejects.toThrow(
      'Restricted remote image host.'
    );

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(null, { status: 302, headers: { location: 'https://cdn.example.com/next.png' } })
    );
    await expect(fetchImage('https://cdn.example.com/loop.png')).rejects.toThrow(
      'Image has too many redirects.'
    );

    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response('<svg></svg>', { status: 200, headers: { 'content-type': 'image/svg+xml' } })
    );
    await expect(fetchImage('https://cdn.example.com/pic.svg')).rejects.toThrow(
      'The URL does not point to a supported image.'
    );

    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response('<html></html>', { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } })
    );
    await expect(fetchImage('https://cdn.example.com/page.html')).rejects.toThrow(
      'The URL does not point to a supported image.'
    );

    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response('ok', {
        status: 200,
        headers: { 'content-type': 'image/png', 'content-length': String(6 * 1024 * 1024) },
      })
    );
    await expect(fetchImage('https://cdn.example.com/huge.png')).rejects.toThrow('Image is larger than 5 MB.');

    // Streaming > 5MB without content-length header
    const bigStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(3 * 1024 * 1024));
        controller.enqueue(new Uint8Array(3 * 1024 * 1024));
        controller.close();
      },
    });
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(bigStream, { status: 200, headers: { 'content-type': 'image/jpeg' } })
    );
    await expect(fetchImage('https://cdn.example.com/stream-huge.jpg')).rejects.toThrow('Image is larger than 5 MB.');
  });

  it('downloads valid public HTTPS raster images and strips content-type parameters', async () => {
    mockLookup.mockResolvedValueOnce([{ address: '93.184.216.34' }]);
    const bytes = new Uint8Array([137, 80, 78, 71]);
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(bytes, { status: 200, headers: { 'content-type': 'image/png; charset=binary' } })
    );

    const res = await fetchImage('https://cdn.example.com/cover.png');
    expect(res.contentType).toBe('image/png');
    expect(Buffer.isBuffer(res.buffer)).toBe(true);
    expect(Array.from(res.buffer)).toEqual([137, 80, 78, 71]);
  });
});

describe('lib/library-card-assets and lib/library-card-assets.server', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sanitizes student IDs, generates faculty IDs, and builds storage paths', () => {
    expect(CARD_ASSET_BUCKET).toBe('library-cards');
    expect(AVATAR_BUCKET).toBe('avatars');
    expect(sanitizeStudentId(' stu/2023 0148 ')).toBe('STU_2023_0148');
    expect(generateFacultyId()).toMatch(/^FAC-\d{6}$/);
    expect(fileNamesFor('lib-2026-abc')).toEqual({ qr: 'qr_LIB-2026-ABC.png' });
    expect(cardPhotoPath('user-1')).toBe('user-1/card.webp');
    expect(isDeterministicProfileUrl('https://proj.supabase.co/storage/v1/object/public/avatars/u1/card.webp?v=1')).toBe(
      true
    );
    expect(isDeterministicProfileUrl('https://lh3.googleusercontent.com/photo.jpg')).toBe(false);
    expect(isDeterministicProfileUrl(null)).toBe(false);
  });

  it('parses student and faculty IDs from STI and external emails', () => {
    expect(parseStudentIdFromEmail('bautista.20220271@alabang.sti.edu.ph')).toBe('STU-20220271');
    expect(parseStudentIdFromEmail('teresita.aquino@alabang.sti.edu.ph')).toBe('FAC-teresita.aquino');
    expect(parseStudentIdFromEmail('___.___@alabang.sti.edu.ph')).toMatch(/^FAC-\d{6}$/);
    expect(parseStudentIdFromEmail('student.20249999@gmail.com')).toBe('STU-20249999');
    expect(parseStudentIdFromEmail('someone@gmail.com')).toBeNull();
    expect(parseStudentIdFromEmail(null)).toBeNull();
  });

  it('resolves studentId from stored ID, role, email, or userId fallback', () => {
    expect(resolveStudentId({ studentId: '20230148', role: 'student' })).toBe('STU-20230148');
    expect(resolveStudentId({ studentId: 'galang', role: 'librarian' })).toBe('FAC-GALANG');
    expect(resolveStudentId({ studentId: 'STU-123456', role: 'student' })).toBe('STU-123456');
    expect(resolveStudentId({ studentId: null, email: 'cruz.20250001@alabang.sti.edu.ph' })).toBe('STU-20250001');
    expect(resolveStudentId({ studentId: null, email: null, fallbackEmail: 'a.20251111@gmail.com' })).toBe(
      'STU-20251111'
    );
    expect(resolveStudentId({ studentId: null, userId: '12345678-aaaa-bbbb' })).toBe('FAC-12345678-AAA');
    expect(resolveStudentId({ studentId: 'FAC-___________.______' })).toMatch(/^FAC-\d{6}$/);
  });

  it('ensureStaticLibraryCardAssets creates bucket/card/QR/photo and returns signed URLs', async () => {
    const admin = createMockSupabaseClient();
    admin.setTableResponse('profiles', {
      id: 'user-1',
      email: 'juan.20241234@alabang.sti.edu.ph',
      student_id: '20241234',
      avatar_url: null,
      role: 'student',
      status: 'ACTIVE',
    });
    admin.setTableResponse('library_cards', null, null);

    const bucketMock = {
      list: vi.fn().mockResolvedValue({ data: [], error: null }),
      upload: vi.fn().mockResolvedValue({ data: { path: 'ok' }, error: null }),
      getPublicUrl: vi.fn().mockReturnValue({
        data: { publicUrl: 'https://placeholder.supabase.co/storage/v1/object/public/avatars/user-1/card.webp' },
      }),
      createSignedUrl: vi.fn().mockResolvedValue({
        data: { signedUrl: 'https://placeholder.supabase.co/signed/qr.png' },
        error: null,
      }),
      download: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    const storageMock = {
      getBucket: vi.fn().mockResolvedValue({ data: null, error: { statusCode: 404, message: 'Bucket not found' } }),
      createBucket: vi.fn().mockResolvedValue({ data: { name: 'library-cards' }, error: null }),
      from: vi.fn().mockReturnValue(bucketMock),
    };
    admin.client.storage = storageMock;
    mockCreateAdminClient.mockReturnValue(admin.client);

    const res = await ensureStaticLibraryCardAssets({
      userId: 'user-1',
      uploadedProfileBuffer: Buffer.from('raw-image'),
    });

    expect(storageMock.createBucket).toHaveBeenCalledWith('library-cards', expect.objectContaining({ public: false }));
    expect(res.studentId).toBe('STU-20241234');
    expect(res.qrUrl).toBe('https://placeholder.supabase.co/signed/qr.png');
    expect(res.profileUrl).toContain('/storage/v1/object/public/avatars/user-1/card.webp?v=');
    expect(res.qrExists).toBe(true);
    expect(res.profileExists).toBe(true);
    expect(mockQrToBuffer).toHaveBeenCalledTimes(1);
    expect(mockSharpResize).toHaveBeenCalledWith(300, 300, { fit: 'cover', position: 'centre' });
    expect(admin.getTableBuilder('library_cards').insert).toHaveBeenCalled();
  });

  it('ensureStaticLibraryCardAssets reuses existing QR and throws when profile is missing', async () => {
    const admin = createMockSupabaseClient();
    admin.setTableResponse('profiles', {
      id: 'user-2',
      email: 'lib@alabang.sti.edu.ph',
      student_id: 'FAC-LIB',
      avatar_url: 'https://placeholder.supabase.co/storage/v1/object/public/avatars/user-2/card.webp?v=100',
      role: 'librarian',
      status: 'ACTIVE',
    });
    admin.setTableResponse('library_cards', { card_number: 'LIB-2026-EXISTING' });

    const bucketMock = {
      list: vi.fn().mockResolvedValue({ data: [{ name: 'qr_LIB-2026-EXISTING.png' }], error: null }),
      upload: vi.fn().mockResolvedValue({ data: { path: 'ok' }, error: null }),
      getPublicUrl: vi.fn(),
      createSignedUrl: vi.fn().mockResolvedValue({
        data: { signedUrl: 'https://placeholder.supabase.co/signed/existing.png' },
        error: null,
      }),
    };
    admin.client.storage = {
      getBucket: vi.fn().mockResolvedValue({ data: { name: 'library-cards' }, error: null }),
      from: vi.fn().mockReturnValue(bucketMock),
    };
    mockCreateAdminClient.mockReturnValue(admin.client);

    const res = await ensureStaticLibraryCardAssets({ userId: 'user-2' });
    expect(res.qrUrl).toBe('https://placeholder.supabase.co/signed/existing.png');
    expect(mockQrToBuffer).not.toHaveBeenCalled();

    // Missing profile throws
    const missingAdmin = createMockSupabaseClient();
    missingAdmin.setTableResponse('profiles', null, null);
    missingAdmin.client.storage = admin.client.storage;
    mockCreateAdminClient.mockReturnValue(missingAdmin.client);

    await expect(ensureStaticLibraryCardAssets({ userId: 'missing' })).rejects.toThrow('Profile not found');
  });
});
