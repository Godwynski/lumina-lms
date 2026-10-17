import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import nextConfig from '../next.config';

describe('Milestone 1 Verification: Route Transitions, Router Cache & Loading States', () => {
  const rootDir = process.cwd();

  describe('1. Router Cache staleTimes in next.config.ts', () => {
    it('verifies experimental.staleTimes is explicitly configured with dynamic: 30 and static: 180', () => {
      const experimental = nextConfig.experimental as {
        staleTimes?: { dynamic: number; static: number };
        optimizePackageImports?: string[];
      };

      expect(experimental).toBeDefined();
      expect(experimental.staleTimes).toBeDefined();
      expect(experimental.staleTimes?.dynamic).toBe(30);
      expect(experimental.staleTimes?.static).toBe(180);
    });

    it('verifies experimental.optimizePackageImports is preserved', () => {
      const experimental = nextConfig.experimental as {
        optimizePackageImports?: string[];
      };
      expect(experimental.optimizePackageImports).toContain('lucide-react');
      expect(experimental.optimizePackageImports).toContain('recharts');
      expect(experimental.optimizePackageImports).toContain('framer-motion');
    });
  });

  describe('2. Unified Route Loading Architecture (loading.tsx presence and exports)', () => {
    const routeLoaders = [
      'app/(authenticated)/dashboard/loading.tsx',
      'app/(authenticated)/inventory/loading.tsx',
      'app/(authenticated)/circulation/loading.tsx',
      'app/(authenticated)/history/loading.tsx',
      'app/(authenticated)/attendance/loading.tsx',
      'app/(authenticated)/users/loading.tsx',
      'app/(authenticated)/audit/loading.tsx',
      'app/(authenticated)/student-catalog/loading.tsx',
      'app/(authenticated)/policies/loading.tsx',
      'app/(authenticated)/analytics/loading.tsx',
      'app/(authenticated)/profile/loading.tsx',
      'app/(authenticated)/security/loading.tsx',
    ];

    routeLoaders.forEach((loaderPath) => {
      it(`verifies route loading state exists: ${loaderPath}`, () => {
        const fullPath = path.join(rootDir, loaderPath);
        expect(fs.existsSync(fullPath)).toBe(true);
        const content = fs.readFileSync(fullPath, 'utf8');
        expect(content).toMatch(/export\s+default\s+function\s+Loading/);
      });
    });

    it('verifies subroute loaders exist for multi-tier routes', () => {
      const subrouteLoaders = [
        'app/(authenticated)/inventory/add/loading.tsx',
        'app/(authenticated)/users/[id]/loading.tsx',
        'app/(authenticated)/users/new/loading.tsx',
        'app/(authenticated)/student-catalog/[id]/loading.tsx',
      ];

      subrouteLoaders.forEach((loaderPath) => {
        const fullPath = path.join(rootDir, loaderPath);
        expect(fs.existsSync(fullPath)).toBe(true);
        const content = fs.readFileSync(fullPath, 'utf8');
        expect(content).toMatch(/export\s+default\s+function\s+Loading/);
      });
    });
  });

  describe('3. Elimination of Redundant Suspense & Fallback Cascades', () => {
    it('verifies app/(authenticated)/layout.tsx does not wrap StreamedNav, BreadcrumbNav, or MainHeader in Suspense', () => {
      const layoutPath = path.join(rootDir, 'app/(authenticated)/layout.tsx');
      const content = fs.readFileSync(layoutPath, 'utf8');

      // No Suspense import or tags wrapping these components
      expect(content).not.toMatch(/<Suspense[^>]*>\s*<StreamedNav/);
      expect(content).not.toMatch(/<Suspense[^>]*>\s*<BreadcrumbNav/);
      expect(content).not.toMatch(/<Suspense[^>]*>\s*<MainHeader/);
      expect(content).not.toMatch(/import\s*{\s*Suspense\s*}\s*from\s*["']react["']/);
    });

    it('verifies components/layout/MainHeader.tsx does not wrap BreadcrumbNav in Suspense', () => {
      const headerPath = path.join(rootDir, 'components/layout/MainHeader.tsx');
      const content = fs.readFileSync(headerPath, 'utf8');

      expect(content).not.toMatch(/<Suspense[^>]*>\s*<div[^>]*>\s*<BreadcrumbNav/);
      expect(content).not.toMatch(/import\s*{\s*Suspense\s*}\s*from\s*["']react["']/);
    });

    it('verifies circulation/layout.tsx and catalog/layout.tsx do not wrap guards in Suspense', () => {
      const circLayout = fs.readFileSync(path.join(rootDir, 'app/(authenticated)/circulation/layout.tsx'), 'utf8');
      expect(circLayout).not.toMatch(/<Suspense[^>]*>\s*<CirculationGuard/);
      expect(circLayout).not.toMatch(/import\s*{\s*Suspense\s*}\s*from\s*["']react["']/);

      const catLayout = fs.readFileSync(path.join(rootDir, 'app/(authenticated)/catalog/layout.tsx'), 'utf8');
      expect(catLayout).not.toMatch(/<Suspense[^>]*>\s*<CatalogGuard/);
      expect(catLayout).not.toMatch(/import\s*{\s*Suspense\s*}\s*from\s*["']react["']/);
    });

    it('verifies circulation/page.tsx does not wrap CirculationWizard in Suspense', () => {
      const circPage = fs.readFileSync(path.join(rootDir, 'app/(authenticated)/circulation/page.tsx'), 'utf8');
      expect(circPage).not.toMatch(/<Suspense[^>]*>\s*<CirculationWizard/);
      expect(circPage).not.toMatch(/import\s*{\s*Suspense\s*}\s*from\s*["']react["']/);
    });

    it('verifies CatalogContent.tsx imports ModernInventoryClient directly without ssr: false', () => {
      const catalogContent = fs.readFileSync(path.join(rootDir, 'app/(authenticated)/catalog/CatalogContent.tsx'), 'utf8');
      expect(catalogContent).not.toMatch(/ssr:\s*false/);
      expect(catalogContent).toMatch(/import\s+{\s*ModernInventoryClient\s*}\s+from\s+['"]@\/components\/inventory\/ModernInventoryClient['"]/);
    });
  });

  describe('4. Active Client Prefetching in ProtectedNav.tsx', () => {
    it('verifies ProtectedNav wires router.prefetch into handlePrefetch', () => {
      const navPath = path.join(rootDir, 'components/layout/ProtectedNav.tsx');
      const content = fs.readFileSync(navPath, 'utf8');

      expect(content).toMatch(/const\s+router\s*=\s*useRouter\(\)/);
      expect(content).toMatch(/router\.prefetch\(href\)/);
    });

    it('verifies navigation <Link> elements declare prefetch={true}', () => {
      const navPath = path.join(rootDir, 'components/layout/ProtectedNav.tsx');
      const content = fs.readFileSync(navPath, 'utf8');

      expect(content).toMatch(/<Link[^>]*href={item\.href}[^>]*prefetch={true}/);
      expect(content).toMatch(/<Link[^>]*href="\/dashboard"[^>]*prefetch={true}/);
    });
  });
});
