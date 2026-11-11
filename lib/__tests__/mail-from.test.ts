import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('nodemailer', () => ({ default: { createTransport: () => ({ sendMail: vi.fn() }) } }));

import { getFromAddress } from '../mail';

describe('getFromAddress', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('defaults to the system no-reply address, never the SMTP login', () => {
    vi.stubEnv('SMTP_FROM', '');
    vi.stubEnv('SMTP_USER', 'someone.personal@gmail.com');
    expect(getFromAddress()).toBe('"Lumina LMS" <no-reply@lumina-lms.com>');
  });

  it('uses a display name with the no-reply address', () => {
    vi.stubEnv('SMTP_FROM', 'STI Library');
    vi.stubEnv('SMTP_USER', 'someone.personal@gmail.com');
    expect(getFromAddress()).toBe('"STI Library" <no-reply@lumina-lms.com>');
  });

  it('accepts a bare address or a full sender as given', () => {
    vi.stubEnv('SMTP_FROM', 'no-reply@sti.edu.ph');
    expect(getFromAddress()).toBe('"Lumina LMS" <no-reply@sti.edu.ph>');
    vi.stubEnv('SMTP_FROM', '"Library" <no-reply@sti.edu.ph>');
    expect(getFromAddress()).toBe('"Library" <no-reply@sti.edu.ph>');
  });
});
