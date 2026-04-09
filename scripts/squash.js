/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

const migrationsDir = path.join(__dirname, '../supabase/migrations');
const files = fs.readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql') && !f.includes('init_database'))
  .sort();

let content = '';

for (const file of files) {
  content += `-- Migration: ${file}\n`;
  content += fs.readFileSync(path.join(migrationsDir, file), 'utf8');
  content += '\n\n';
}

// 1. CREATE TABLE
content = content.replace(/CREATE TABLE\s+(?!IF NOT EXISTS)([\w\.]+)/gi, "CREATE TABLE IF NOT EXISTS $1");

// 2. CREATE INDEX and CREATE UNIQUE INDEX
content = content.replace(/CREATE\s+(UNIQUE\s+)?INDEX\s+(?!IF NOT EXISTS)([\w\."]+)\s+ON/gi, "CREATE $1INDEX IF NOT EXISTS $2 ON");

// 3. ALTER TABLE ADD COLUMN
// We need to match case variants
content = content.replace(/ALTER TABLE\s+([\w\.]+)\s+ADD COLUMN\s+(?!IF NOT EXISTS)/gi, "ALTER TABLE $1 ADD COLUMN IF NOT EXISTS ");
// Some might just say `ADD ` instead of `ADD COLUMN `
content = content.replace(/ALTER TABLE\s+([\w\.]+)\s+ADD\s+(?!COLUMN)(?!CONSTRAINT)(?!IF NOT EXISTS)([\w]+)\s/gi, "ALTER TABLE $1 ADD COLUMN IF NOT EXISTS $2 ");

// 4. CREATE POLICY
content = content.replace(/CREATE POLICY\s+("[^"]+"|\w+)\s+ON\s+([\w\.]+)/gi, "DROP POLICY IF EXISTS $1 ON $2;\nCREATE POLICY $1 ON $2");

// 5. CREATE TRIGGER
// e.g. CREATE TRIGGER on_auth_user_created AFTER INSERT...
content = content.replace(/CREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER\s+([\w\.]+)\s+(AFTER|BEFORE|INSTEAD OF)\s+([^O]+)\s+ON\s+([\w\.]+)/gi, "DROP TRIGGER IF EXISTS $1 ON $4;\nCREATE TRIGGER $1 $2 $3 ON $4");

// 6. CREATE TYPE AS ENUM
content = content.replace(/CREATE TYPE\s+([\w\.]+)\s+AS\s+ENUM\s+\(([^)]+)\);/gi, (match, typeName, enumVals) => {
    const objName = typeName.split('.').pop().replace(/"/g, '');
    return `DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '${objName}') THEN
    CREATE TYPE ${typeName} AS ENUM (${enumVals});
  END IF;
END
$$;`;
});

// 7. CREATE FUNCTION
content = content.replace(/CREATE\s+(?!OR REPLACE\s+)(?!EXTENSION)(?!POLICY)(?!TRIGGER)(?!INDEX)(?!UNIQUE)(?!TABLE)(?!TYPE)FUNCTION/gi, "CREATE OR REPLACE FUNCTION");

// 8. DROP FOREIGN KEY
// Postgres DROP CONSTRAINT doesn't support IF EXISTS easily inside basic ALTER TABLE dropping an unknown fk name if it was generated, 
// but most users define the name explicitly. 
content = content.replace(/DROP CONSTRAINT\s+(?!IF EXISTS)/gi, "DROP CONSTRAINT IF EXISTS ");


const outputFile = path.join(migrationsDir, '20260409000000_init_database.sql');
fs.writeFileSync(outputFile, content, 'utf8');

// Also remove old files
for (const file of files) {
  fs.unlinkSync(path.join(migrationsDir, file));
}

console.log('Squashed ' + files.length + ' files into ' + outputFile);
