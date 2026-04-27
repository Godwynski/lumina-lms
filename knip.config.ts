import type { KnipConfig } from 'knip';

const config: KnipConfig = {
  ignoreDependencies: [
    // emnapi is required by sharp/native modules at runtime — do not remove
    '@emnapi/core',
    '@emnapi/runtime',
  ],
  ignoreExportsUsedInFile: true,
  ignore: [
    // shadcn/ui barrel re-exports — intentionally exported for consumer use
    'components/ui/**',
  ],
};

export default config;
