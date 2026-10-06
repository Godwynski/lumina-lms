import { describe, it, expect, vi } from 'vitest';
import { sanitizeFilterInput } from '@/lib/utils';

describe('Adversarial Challenge Suite: sanitizeFilterInput', () => {
  // =========================================================================
  // Challenge 1: PostgREST Filter Breakout Vectors
  // =========================================================================
  describe('Challenge 1: PostgREST Filter Breakout Vectors', () => {
    it('strips all dot operators preventing PostgREST operator injection', () => {
      const operators = [
        '.eq.',
        '.neq.',
        '.gt.',
        '.gte.',
        '.lt.',
        '.lte.',
        '.like.',
        '.ilike.',
        '.is.',
        '.in.',
        '.cs.',
        '.cd.',
        '.ov.',
        '.sl.',
        '.sr.',
        '.nxr.',
        '.nxl.',
        '.adj.',
        '.wfts.',
        '.fts.',
        '.plfts.',
        '.phfts.',
        '.not.',
      ];

      for (const op of operators) {
        const input = `col${op}value`;
        const expected = `col${op.replace(/\./g, '')}value`;
        expect(sanitizeFilterInput(input)).toBe(expected);
      }
    });

    it('neutralizes comma-separated clause injection in .or() filters', () => {
      // Attacker attempts: search=test,is_admin.eq.true
      const payload = 'test,is_admin.eq.true';
      expect(sanitizeFilterInput(payload)).toBe('testis_admineqtrue');

      // Attacker attempts: search=Harry,deleted_at.is.null,role.eq.super_admin
      const payload2 = 'Harry,deleted_at.is.null,role.eq.super_admin';
      expect(sanitizeFilterInput(payload2)).toBe('Harrydeleted_atisnullroleeqsuper_admin');
    });

    it('neutralizes nested logical tree breakouts using parentheses', () => {
      // Attacker attempts: ) or (role.eq.super_admin)
      expect(sanitizeFilterInput(') or (role.eq.super_admin)')).toBe('or roleeqsuper_admin');

      // Attacker attempts: and(user_id.eq.1,secret.eq.true)
      expect(sanitizeFilterInput('and(user_id.eq.1,secret.eq.true)')).toBe('anduser_ideq1secreteqtrue');

      // Deeply nested parentheses
      expect(sanitizeFilterInput('((((((admin))))))')).toBe('admin');
      expect(sanitizeFilterInput(')(())((')).toBe('');
    });

    it('strips colon separators preventing resource/relation and casting traversal', () => {
      // PostgREST relation syntax: users:id.eq.1 or schema:table
      expect(sanitizeFilterInput('users:id.eq.1')).toBe('usersideq1');

      // JSON traversal or typecast: data->>key:text
      expect(sanitizeFilterInput('data->>field:text.eq.val')).toBe('data->>fieldtexteqval');
      expect(sanitizeFilterInput(':::jsonb')).toBe('jsonb');
    });

    it('strips backslash escape sequences and double quotes', () => {
      // Escaping commas or quotes in PostgREST
      expect(sanitizeFilterInput('test\\,admin.eq.true')).toBe('testadmineqtrue');
      expect(sanitizeFilterInput('test\\" or 1=1')).toBe('test or 1=1');
      expect(sanitizeFilterInput('\\\\\\')).toBe('');
      expect(sanitizeFilterInput('"""')).toBe('');
      expect(sanitizeFilterInput('"quoted_filter_value"')).toBe('quoted_filter_value');
    });

    it('strips asterisks (PostgREST full wildcards)', () => {
      expect(sanitizeFilterInput('*')).toBe('');
      expect(sanitizeFilterInput('***')).toBe('');
      expect(sanitizeFilterInput('*admin*')).toBe('admin');
      expect(sanitizeFilterInput('prefix*suffix')).toBe('prefixsuffix');
    });
  });

  // =========================================================================
  // Challenge 2: SQL Wildcard Handling (% and _)
  // =========================================================================
  describe('Challenge 2: SQL Wildcard Handling (% and _)', () => {
    it('preserves SQL percent wildcard (%) when intentional', () => {
      expect(sanitizeFilterInput('%')).toBe('%');
      expect(sanitizeFilterInput('%%%')).toBe('%%%');
      expect(sanitizeFilterInput('%harry%')).toBe('%harry%');
      expect(sanitizeFilterInput('100% genuine')).toBe('100% genuine');
    });

    it('preserves SQL underscore wildcard (_) when intentional', () => {
      expect(sanitizeFilterInput('_')).toBe('_');
      expect(sanitizeFilterInput('___')).toBe('___');
      expect(sanitizeFilterInput('book_title_2')).toBe('book_title_2');
      expect(sanitizeFilterInput('_pattern_')).toBe('_pattern_');
    });

    it('preserves combined SQL wildcards while stripping forbidden characters', () => {
      expect(sanitizeFilterInput('%(book_name.*)%')).toBe('%book_name%');
      expect(sanitizeFilterInput('%,_:*\\"%')).toBe('%_%');
    });
  });

  // =========================================================================
  // Challenge 3: Real-World Penetration Testing Filter Payloads
  // =========================================================================
  describe('Challenge 3: Complex Multi-Vector Injection Payloads', () => {
    const attackPayloads: { payload: string; expectedSanitized: string; desc: string }[] = [
      {
        desc: 'Clause breakout with SQL comment',
        payload: 'test") or 1=1 --',
        expectedSanitized: 'test or 1=1 --',
      },
      {
        desc: 'Negated NULL check injection',
        payload: ') or not (admin_id.is.null',
        expectedSanitized: 'or not admin_idisnull',
      },
      {
        desc: 'PostgREST FTS operator injection',
        payload: 'search.wfts(english).secret_data',
        expectedSanitized: 'searchwftsenglishsecret_data',
      },
      {
        desc: 'Subquery-like structure attempt',
        payload: 'id.in.(select id from passwords)',
        expectedSanitized: 'idinselect id from passwords',
      },
      {
        desc: 'Mixed quotes, backslashes, colons, and commas',
        payload: '\\":test,role.eq."super_admin"\\',
        expectedSanitized: 'testroleeqsuper_admin',
      },
      {
        desc: 'JSON path injection with operator',
        payload: 'payload->>"role".eq."admin"',
        expectedSanitized: 'payload->>roleeqadmin',
      },
      {
        desc: 'Interleaved operators and wildcards',
        payload: '%%%*(admin.eq.1)*%%%',
        expectedSanitized: '%%%admineq1%%%',
      },
    ];

    attackPayloads.forEach(({ desc, payload, expectedSanitized }) => {
      it(`neutralizes: ${desc}`, () => {
        const result = sanitizeFilterInput(payload);
        expect(result).toBe(expectedSanitized);
        // Assert that none of the dangerous characters remain
        expect(result).not.toMatch(/[(),.:*\\"]/);
      });
    });
  });

  // =========================================================================
  // Challenge 4: Whitespace and Boundary Conditions
  // =========================================================================
  describe('Challenge 4: Whitespace and Boundary Conditions', () => {
    it('handles empty strings and whitespace-only strings', () => {
      expect(sanitizeFilterInput('')).toBe('');
      expect(sanitizeFilterInput('   ')).toBe('');
      expect(sanitizeFilterInput('\t\t')).toBe('');
      expect(sanitizeFilterInput('\n\r\n')).toBe('');
      expect(sanitizeFilterInput(' \t\r\n ')).toBe('');
    });

    it('trims outer whitespace but preserves internal spacing', () => {
      expect(sanitizeFilterInput('   The   Great   Gatsby   ')).toBe('The   Great   Gatsby');
      expect(sanitizeFilterInput('\tTitle With Tabs\t')).toBe('Title With Tabs');
    });

    it('handles strings made entirely of stripped characters', () => {
      expect(sanitizeFilterInput('(),.:*\\"')).toBe('');
      expect(sanitizeFilterInput('  ( . : * \\ " , )  ')).toBe('');
      expect(sanitizeFilterInput('.')).toBe('');
      expect(sanitizeFilterInput(':')).toBe('');
      expect(sanitizeFilterInput(',')).toBe('');
    });

    it('preserves legitimate safe symbols and punctuation', () => {
      // Hyphens, brackets, braces, slashes, single quotes, plus, equals, ampersand
      const safeSymbols = "Science-Fiction [Vol 1] {2026} / Novel 'Special' + Edition = #1 & Co; $100 ~ 50%";
      expect(sanitizeFilterInput(safeSymbols)).toBe(safeSymbols);
    });
  });

  // =========================================================================
  // Challenge 5: Unicode, Multi-Byte, and Non-ASCII Encodings
  // =========================================================================
  describe('Challenge 5: Internationalization and Unicode Characters', () => {
    it('preserves multi-byte Unicode scripts intact', () => {
      expect(sanitizeFilterInput('日本語のタイトル')).toBe('日本語のタイトル');
      expect(sanitizeFilterInput('العربية')).toBe('العربية');
      expect(sanitizeFilterInput('Русский текст')).toBe('Русский текст');
      expect(sanitizeFilterInput('Tagalog: Ang Alamat')).toBe('Tagalog Ang Alamat'); // colon removed
    });

    it('handles emojis and symbols cleanly', () => {
      expect(sanitizeFilterInput('📚 Book: "Magic" 🪄')).toBe('📚 Book Magic 🪄');
      expect(sanitizeFilterInput('🛡️🔒🔑')).toBe('🛡️🔒🔑');
    });

    it('handles full-width punctuation without regex collision', () => {
      // Full-width characters are distinct Unicode code points
      const fullWidth = '（full-width）．：＊＼＂，';
      const result = sanitizeFilterInput(fullWidth);
      expect(typeof result).toBe('string');
    });
  });

  // =========================================================================
  // Challenge 6: Stress Testing and ReDoS Resistance
  // =========================================================================
  describe('Challenge 6: Stress Testing & Performance', () => {
    it('processes 100,000 stripped characters in linear time without ReDoS', () => {
      const strippedPattern = '(),.:*\\"'.repeat(12500); // 100,000 chars
      const start = performance.now();
      const sanitized = sanitizeFilterInput(strippedPattern);
      const duration = performance.now() - start;

      expect(sanitized).toBe('');
      // Single-pass regex character class should execute well under 100ms
      expect(duration).toBeLessThan(100);
    });

    it('processes 100,000 mixed characters rapidly', () => {
      const mixedPattern = 'book(1).test:foo,bar*\\" '.repeat(4000); // ~100,000 chars
      const start = performance.now();
      const sanitized = sanitizeFilterInput(mixedPattern);
      const duration = performance.now() - start;

      expect(sanitized).not.toMatch(/[(),.:*\\"]/);
      expect(duration).toBeLessThan(150);
    });
  });

  // =========================================================================
  // Challenge 7: Additional Penetration Testing Vectors & SQL Injection Probes
  // =========================================================================
  describe('Challenge 7: Advanced Penetration Vectors and SQL Wildcard Injections', () => {
    it('neutralizes URL encoded patterns and prevents breakout', () => {
      // URL-encoded percent signs (%2C is comma, %28 is (, %29 is ))
      const urlEncoded = 'title%2Crole.eq.admin%28secret%29';
      const sanitized = sanitizeFilterInput(urlEncoded);
      expect(sanitized).toBe('title%2Croleeqadmin%28secret%29');
      // All actual dots and parens are stripped, leaving percent characters intact
      expect(sanitized).not.toMatch(/[(),.:*\\"]/);
    });

    it('neutralizes null bytes in attack strings', () => {
      const nullBytePayload = 'admin\0.eq.true';
      const sanitized = sanitizeFilterInput(nullBytePayload);
      expect(sanitized).toBe('admin\0eqtrue');
      expect(sanitized).not.toMatch(/[(),.:*\\"]/);
    });

    it('neutralizes SQL comments while stripping operators', () => {
      // Block comments /* ... */ - asterisk is stripped
      expect(sanitizeFilterInput('/* inline comment */ value')).toBe('/ inline comment / value');
      // Inline comments --
      expect(sanitizeFilterInput('-- comment\nval.eq.1')).toBe('-- comment\nvaleq1');
    });

    it('neutralizes JSON traversal operators combined with PostgREST syntax', () => {
      expect(sanitizeFilterInput('metadata->key.eq.1')).toBe('metadata->keyeq1');
      expect(sanitizeFilterInput('metadata->>role.ilike."admin"')).toBe('metadata->>roleilikeadmin');
      expect(sanitizeFilterInput('metadata#>>{a,b}.eq.1')).toBe('metadata#>>{ab}eq1');
    });

    it('neutralizes PostgREST array containment and range operators', () => {
      // Array containment: tags.cs.{admin,librarian}
      expect(sanitizeFilterInput('tags.cs.{admin,librarian}')).toBe('tagscs{adminlibrarian}');
      // Range: id.ov.[1,10]
      expect(sanitizeFilterInput('id.ov.[1,10]')).toBe('idov[110]');
      // Full text search: text.fts(english).test
      expect(sanitizeFilterInput('text.fts(english).test')).toBe('textftsenglishtest');
    });
  });

  // =========================================================================
  // Challenge 8: Hermetic Isolation Verification
  // =========================================================================
  describe('Challenge 8: Hermetic Execution Guarantee for Security Utilities', () => {
    it('executes all security and utility functions without network access', () => {
      // Setup a strictly hostile network environment: fetch throws immediately
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
        throw new Error('HERMETIC_VIOLATION: network access is prohibited');
      });

      try {
        // 1. Sanitize filter input
        const safe = sanitizeFilterInput('adversarial.filter,payload:1*');
        expect(safe).toBe('adversarialfilterpayload1');

        // 2. Wildcard preservation
        const wildcard = sanitizeFilterInput('%test_%');
        expect(wildcard).toBe('%test_%');

        // Verify that zero network requests were attempted
        expect(fetchSpy).not.toHaveBeenCalled();
      } finally {
        fetchSpy.mockRestore();
      }
    });
  });
});

