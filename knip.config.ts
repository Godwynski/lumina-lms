import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  ignoreDependencies: [],
  ignoreExportsUsedInFile: true,
  ignore: [
    // shadcn/ui barrel re-exports — intentionally exported for consumer use
    'components/ui/**',
    // Canonical Supabase database schema types
    'types/database.ts',
  ],
};

export default config;
