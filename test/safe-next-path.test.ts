import { describe, it, expect } from 'vitest';
import { safeNextPath } from '@/lib/utils';

describe('safeNextPath (C7 open redirect)', () => {
  it('keeps same-site paths', () => {
    expect(safeNextPath('/catalog?x=1')).toBe('/catalog?x=1');
  });

  it.each([null, '', 'https://evil.com', '//evil.com', '/\\evil.com', '/@evil.com', 'evil.com'])('sends %s to /dashboard', (next) => {
    expect(safeNextPath(next)).toBe('/dashboard');
  });
});
