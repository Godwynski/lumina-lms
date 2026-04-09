/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');

const files = [
  'components/library/MyCardContainer.tsx',
  'components/hero.tsx',
  'components/inventory/ModernBookListItem.tsx',
  'components/digital-resources/ModernAssetCard.tsx',
  'components/digital-resources/AssetGrid.tsx',
  'components/circulation/CirculationWizard.tsx',
  'components/analytics/UtilizationChart.tsx',
  'components/analytics/OperationalPulseFeed.tsx',
  'components/analytics/InteractivePulseChart.tsx',
  'app/protected/users/page.tsx',
  'app/protected/settings/page-client.tsx'
];

for (const f of files) {
  if (!fs.existsSync(f)) continue;
  let c = fs.readFileSync(f, 'utf8');

  // We want to replace "motion" with "m" in the import from framer-motion, 
  // but keep AnimatePresence, etc.
  if (c.includes('import {') && c.includes('framer-motion')) {
    c = c.replace(/import\s*\{([^}]*)\}\s*from\s*['"]framer-motion['"]/g, (match, p1) => {
      const imports = p1.split(',').map(s => s.trim()).filter(s => s);
      const newImports = imports.map(i => i === 'motion' ? 'm' : i);
      // Wait but some files might already have 'm' exported or something, but usually it's safe
      return `import { ${newImports.join(', ')} } from "framer-motion"`;
    });

    c = c.replace(/<motion\./g, '<m.');
    c = c.replace(/<\/motion\./g, '</m.');
    c = c.replace(/useMotionValue/g, 'useMotionValue'); // unchanged
    c = c.replace(/motionValue/g, 'motionValue'); // unchanged
    c = c.replace(/ motion\./g, ' m.'); // e.g. variants
    c = c.replace(/\(motion\./g, '(m.'); // e.g. React.ComponentProps<typeof motion.div>
    c = c.replace(/typeof motion\./g, 'typeof m.');

    fs.writeFileSync(f, c, 'utf8');
    console.log(`Updated ${f}`);
  }
}
