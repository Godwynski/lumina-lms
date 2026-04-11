const fs = require('fs');

const data = JSON.parse(fs.readFileSync('./lint.json', 'utf8'));
const issues = data.filter(d => d.errorCount > 0 || d.warningCount > 0);

issues.forEach(i => {
  console.log(i.filePath);
  i.messages.forEach(m => {
    console.log(`  Line ${m.line}: ${m.message} (${m.ruleId})`);
  });
});
