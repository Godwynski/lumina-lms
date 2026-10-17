import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Milestone 2 Challenger: Row-Level Security (RLS) & Multi-Role Isolation Hardening Verification', () => {
  const schemaPath = path.resolve(process.cwd(), 'supabase/schema_clean_install.sql');
  const auditPath = path.resolve(process.cwd(), 'DATABASE_AUDIT.md');
  let schemaSql: string;
  let auditMd: string;

  beforeAll(() => {
    expect(fs.existsSync(schemaPath), 'schema_clean_install.sql must exist').toBe(true);
    expect(fs.existsSync(auditPath), 'DATABASE_AUDIT.md must exist').toBe(true);
    schemaSql = fs.readFileSync(schemaPath, 'utf8');
    auditMd = fs.readFileSync(auditPath, 'utf8');
  });

  describe('1. Fatal Enum Cast Elimination', () => {
    it('verifies ZERO occurrences of invalid enum cast "staff"::public.user_role exist in schema', () => {
      const invalidMatches = schemaSql.match(/'staff'::public\.user_role/g);
      expect(invalidMatches).toBeNull();
    });

    it('verifies attendance policies use public.is_staff() instead of invalid enum casts', () => {
      expect(schemaSql).toMatch(/CREATE POLICY "Staff can insert attendance" ON public\.attendance[\s\S]*?WITH CHECK \(public\.is_staff\(\)\);/);
      expect(schemaSql).toMatch(/CREATE POLICY "Staff can view all attendance" ON public\.attendance[\s\S]*?USING \(public\.is_staff\(\)\);/);
      expect(schemaSql).toMatch(/CREATE POLICY "Staff can update attendance" ON public\.attendance[\s\S]*?USING \(public\.is_staff\(\)\)[\s\S]*?WITH CHECK \(public\.is_staff\(\)\);/);
    });

    it('verifies library_cards policies use public.is_staff() instead of invalid enum casts', () => {
      expect(schemaSql).toMatch(/CREATE POLICY "Staff can view all library cards" ON public\.library_cards[\s\S]*?USING \(public\.is_staff\(\)\);/);
    });
  });

  describe('2. Query Planner Performance & Subquery Caching (SELECT auth.uid())', () => {
    it('verifies all references to auth.uid() in policies and functions are wrapped as (SELECT auth.uid())', () => {
      const lines = schemaSql.split('\n');
      const unwrappedLines: { lineNum: number; content: string }[] = [];

      lines.forEach((line, idx) => {
        if (line.includes('auth.uid()') && !line.includes('(SELECT auth.uid())')) {
          unwrappedLines.push({ lineNum: idx + 1, content: line.trim() });
        }
      });

      expect(unwrappedLines).toEqual([]);
    });
  });

  describe('3. Database Helper & RPC Functions Hardening', () => {
    it('verifies public.is_staff() is marked STABLE with search_path = public, pg_temp and checks status = ACTIVE', () => {
      expect(schemaSql).toMatch(
        /CREATE OR REPLACE FUNCTION public\.is_staff\(\)[\s\S]*?RETURNS boolean[\s\S]*?LANGUAGE plpgsql[\s\S]*?STABLE[\s\S]*?SECURITY DEFINER[\s\S]*?SET search_path = public, pg_temp/
      );
      expect(schemaSql).toMatch(/status = 'ACTIVE'/);
      expect(schemaSql).toMatch(/REVOKE EXECUTE ON FUNCTION public\.is_staff\(\) FROM PUBLIC;/);
      expect(schemaSql).toMatch(/GRANT EXECUTE ON FUNCTION public\.is_staff\(\) TO authenticated, anon;/);
    });

    it('verifies transfer_super_admin_ownership enforces caller authentication and service_role compatibility', () => {
      expect(schemaSql).toMatch(
        /CREATE OR REPLACE FUNCTION public\.transfer_super_admin_ownership\(p_current_admin_id uuid, p_new_admin_id uuid\)[\s\S]*?SET search_path = public, pg_temp/
      );
      expect(schemaSql).toMatch(/\(SELECT auth\.uid\(\)\) IS NULL OR \(SELECT auth\.uid\(\)\) <> p_current_admin_id/);
      expect(schemaSql).toMatch(/REVOKE EXECUTE ON FUNCTION public\.transfer_super_admin_ownership\(uuid, uuid\) FROM PUBLIC, anon;/);
      expect(schemaSql).toMatch(/GRANT EXECUTE ON FUNCTION public\.transfer_super_admin_ownership\(uuid, uuid\) TO authenticated, service_role;/);
    });

    it('verifies create_reservation_atomic rejects unauthenticated callers and verifies proxy reservation role', () => {
      expect(schemaSql).toMatch(
        /CREATE OR REPLACE FUNCTION public\.create_reservation_atomic\(p_actor_id uuid, p_book_id uuid, p_target_user_id uuid DEFAULT NULL::uuid\)[\s\S]*?SET search_path = public, pg_temp/
      );
      expect(schemaSql).toMatch(/\(SELECT auth\.uid\(\)\) IS NULL/);
      expect(schemaSql).toMatch(/p_actor_id <> \(SELECT auth\.uid\(\)\)/);
      expect(schemaSql).toMatch(/v_target_id <> p_actor_id/);
      expect(schemaSql).toMatch(/REVOKE EXECUTE ON FUNCTION public\.create_reservation_atomic\(uuid, uuid, uuid\) FROM PUBLIC, anon;/);
      expect(schemaSql).toMatch(/GRANT EXECUTE ON FUNCTION public\.create_reservation_atomic\(uuid, uuid, uuid\) TO authenticated, service_role;/);
    });

    it('verifies all 11 database functions standardize on SET search_path = public, pg_temp', () => {
      const functionMatches = schemaSql.match(/CREATE OR REPLACE FUNCTION public\.\w+\(/g);
      expect(functionMatches).not.toBeNull();
      expect(functionMatches!.length).toBeGreaterThanOrEqual(10);

      // Verify each function declares SET search_path = public, pg_temp
      const requiredFunctions = [
        'is_staff',
        'transfer_super_admin_ownership',
        'auto_set_student_id',
        'fn_sync_book_counts',
        'auto_checkout_forgotten_attendance',
        'handle_new_user',
        'fn_guard_profile_updates',
        'compress_reservation_queue',
        'create_reservation_atomic',
        'process_qr_checkout',
        'process_qr_return',
      ];

      for (const fn of requiredFunctions) {
        const regex = new RegExp(`CREATE OR REPLACE FUNCTION public\\.${fn}\\([\\s\\S]*?SET search_path = public, pg_temp`);
        expect(schemaSql, `Function public.${fn} must have search_path = public, pg_temp`).toMatch(regex);
      }
    });

    it('verifies internal triggers and maintenance routines have execution revoked from PUBLIC, anon, authenticated', () => {
      expect(schemaSql).toMatch(/REVOKE EXECUTE ON FUNCTION public\.auto_set_student_id\(\) FROM PUBLIC, anon, authenticated;/);
      expect(schemaSql).toMatch(/REVOKE EXECUTE ON FUNCTION public\.fn_sync_book_counts\(\) FROM PUBLIC, anon, authenticated;/);
      expect(schemaSql).toMatch(/REVOKE EXECUTE ON FUNCTION public\.handle_new_user\(\) FROM PUBLIC, anon, authenticated;/);
      expect(schemaSql).toMatch(/REVOKE EXECUTE ON FUNCTION public\.fn_guard_profile_updates\(\) FROM PUBLIC, anon, authenticated;/);
      expect(schemaSql).toMatch(/REVOKE EXECUTE ON FUNCTION public\.compress_reservation_queue\(uuid\) FROM PUBLIC, anon, authenticated;/);
      expect(schemaSql).toMatch(/REVOKE EXECUTE ON FUNCTION public\.auto_checkout_forgotten_attendance\(\) FROM PUBLIC, anon, authenticated;/);
      expect(schemaSql).toMatch(/REVOKE EXECUTE ON FUNCTION public\.process_qr_checkout\(uuid, text, text, text, boolean\) FROM PUBLIC, anon, authenticated;/);
      expect(schemaSql).toMatch(/REVOKE EXECUTE ON FUNCTION public\.process_qr_return\(uuid, text, text, boolean\) FROM PUBLIC, anon, authenticated;/);
    });
  });

  describe('4. Profiles Table Security, PII Leakage & Self-Promotion Prevention', () => {
    it('verifies profiles SELECT policy restricts queries to authenticated users to prevent public PII scraping', () => {
      expect(schemaSql).toMatch(/CREATE POLICY "Authenticated users can view profiles" ON public\.profiles\s+FOR SELECT TO authenticated\s+USING \(true\);/);
      expect(schemaSql).not.toMatch(/CREATE POLICY "Public profiles are viewable by everyone" ON public\.profiles/);
    });

    it('verifies Users can update own profile contains WITH CHECK locking role, status, and permissions', () => {
      expect(schemaSql).toMatch(/CREATE POLICY "Users can update own profile" ON public\.profiles[\s\S]*?FOR UPDATE TO authenticated[\s\S]*?WITH CHECK \([\s\S]*?role = \(SELECT p\.role FROM public\.profiles p WHERE p\.id = \(SELECT auth\.uid\(\)\)\)[\s\S]*?status = \(SELECT p\.status FROM public\.profiles p WHERE p\.id = \(SELECT auth\.uid\(\)\)\)[\s\S]*?permissions IS NOT DISTINCT FROM/);
    });

    it('verifies Admins can update profiles policy exists for super_admin and librarian roles', () => {
      expect(schemaSql).toMatch(/CREATE POLICY "Admins can update profiles" ON public\.profiles[\s\S]*?FOR UPDATE TO authenticated[\s\S]*?USING \([\s\S]*?role IN \('super_admin'::public\.user_role, 'librarian'::public\.user_role\)[\s\S]*?WITH CHECK \([\s\S]*?role IN \('super_admin'::public\.user_role, 'librarian'::public\.user_role\)/);
    });

    it('verifies trg_guard_profile_updates trigger guards against self-promotion and status escalation', () => {
      expect(schemaSql).toMatch(/CREATE (?:OR REPLACE )?TRIGGER trg_guard_profile_updates\s+BEFORE UPDATE ON public\.profiles\s+FOR EACH ROW\s+EXECUTE FUNCTION public\.fn_guard_profile_updates\(\);/);
      expect(schemaSql).toMatch(/Cannot modify role: unauthorized self-promotion/);
      expect(schemaSql).toMatch(/Cannot modify status: unauthorized status escalation/);
    });
  });

  describe('5. Multi-Role Boundary Isolation across 5 Roles', () => {
    it('restricts catalog deletion on books, book_copies, and categories to super_admin and librarian (excluding student_assistant)', () => {
      expect(schemaSql).toMatch(/CREATE POLICY "Librarians can delete book_copies" ON public\.book_copies[\s\S]*?FOR DELETE TO authenticated[\s\S]*?role IN \('super_admin'::public\.user_role, 'librarian'::public\.user_role\)/);
      expect(schemaSql).toMatch(/CREATE POLICY "Librarians can delete books" ON public\.books[\s\S]*?FOR DELETE TO authenticated[\s\S]*?role IN \('super_admin'::public\.user_role, 'librarian'::public\.user_role\)/);
      expect(schemaSql).toMatch(/CREATE POLICY "Librarians can delete categories" ON public\.categories[\s\S]*?FOR DELETE TO authenticated[\s\S]*?role IN \('super_admin'::public\.user_role, 'librarian'::public\.user_role\)/);
      
      // Ensure student_assistant cannot delete books, copies, or categories
      expect(schemaSql).not.toMatch(/CREATE POLICY "Staff can delete book_copies"/);
      expect(schemaSql).not.toMatch(/CREATE POLICY "Staff can delete books"/);
      expect(schemaSql).not.toMatch(/CREATE POLICY "Staff can delete categories"/);
    });

    it('restricts system_settings mutations to super_admin and librarian', () => {
      expect(schemaSql).toMatch(/CREATE POLICY "Admins can manage system settings" ON public\.system_settings[\s\S]*?FOR ALL TO authenticated[\s\S]*?role IN \('super_admin'::public\.user_role, 'librarian'::public\.user_role\)/);
      expect(schemaSql).not.toMatch(/CREATE POLICY "Staff can manage system settings"/);
    });

    it('locks down developer sandbox tables checklist_dropdown_options and checklist_items', () => {
      // Must not have public wildcard writes
      expect(schemaSql).not.toMatch(/CREATE POLICY "Allow public insert" ON public\.checklist_dropdown_options/);
      expect(schemaSql).not.toMatch(/CREATE POLICY "Allow public update" ON public\.checklist_dropdown_options/);
      expect(schemaSql).not.toMatch(/CREATE POLICY "Allow public delete" ON public\.checklist_dropdown_options/);
      expect(schemaSql).not.toMatch(/CREATE POLICY "Allow public insert" ON public\.checklist_items/);
      expect(schemaSql).not.toMatch(/CREATE POLICY "Allow public update" ON public\.checklist_items/);
      expect(schemaSql).not.toMatch(/CREATE POLICY "Allow public delete" ON public\.checklist_items/);

      // Must have authenticated read and staff management
      expect(schemaSql).toMatch(/CREATE POLICY "Allow authenticated read checklist dropdowns" ON public\.checklist_dropdown_options/);
      expect(schemaSql).toMatch(/CREATE POLICY "Staff manage checklist dropdown options" ON public\.checklist_dropdown_options[\s\S]*?WITH CHECK \(public\.is_staff\(\)\);/);
      expect(schemaSql).toMatch(/CREATE POLICY "Allow authenticated read checklist items" ON public\.checklist_items/);
      expect(schemaSql).toMatch(/CREATE POLICY "Staff manage checklist items" ON public\.checklist_items[\s\S]*?WITH CHECK \(public\.is_staff\(\)\);/);
    });
  });

  describe('6. Storage Bucket Privacy & Object Policies', () => {
    it('restricts book cover modifications to staff', () => {
      expect(schemaSql).toMatch(/CREATE POLICY "Staff insert book covers" ON storage\.objects[\s\S]*?bucket_id = 'book-covers'::text AND public\.is_staff\(\)/);
      expect(schemaSql).toMatch(/CREATE POLICY "Staff update book covers" ON storage\.objects[\s\S]*?bucket_id = 'book-covers'::text AND public\.is_staff\(\)/);
      expect(schemaSql).toMatch(/CREATE POLICY "Staff delete book covers" ON storage\.objects[\s\S]*?bucket_id = 'book-covers'::text AND public\.is_staff\(\)/);
      expect(schemaSql).not.toMatch(/CREATE POLICY "Book Covers Authenticated Insert"/);
    });

    it('excludes library-cards from public read policy to protect student PII', () => {
      expect(schemaSql).toMatch(/CREATE POLICY "Public Read" ON storage\.objects[\s\S]*?bucket_id IN \('avatars', 'book-covers'\)/);
      expect(schemaSql).toMatch(/CREATE POLICY "Authorized view library cards" ON storage\.objects/);
      expect(schemaSql).toMatch(/CREATE POLICY "Staff manage library card assets" ON storage\.objects/);
    });
  });

  describe('7. DATABASE_AUDIT.md Synchronization', () => {
    it('verifies DATABASE_AUDIT.md reflects Milestone 2 completion across executive summary and sections 4 & 7', () => {
      expect(auditMd).toMatch(/Row-Level Security \(RLS\) Isolation[\s\S]*?100% \(Hardened\)[\s\S]*?RESOLVED/);
      expect(auditMd).toMatch(/## Section 4: Row-Level Security \(RLS\) & Multi-Role Isolation Architecture/);
      expect(auditMd).toMatch(/### 4\.1 Remediated RLS Defects & Verification Catalog/);
      expect(auditMd).toMatch(/### 4\.2 Multi-Role Boundary Isolation Matrix/);
      expect(auditMd).toMatch(/### 4\.3 Function Security & Execution Privilege Architecture/);
      expect(auditMd).toMatch(/### 4\.4 Storage Bucket Privacy & Object RLS/);
      expect(auditMd).toMatch(/Phase 2[\s\S]*?M2[\s\S]*?COMPLETED/);
    });
  });
});
