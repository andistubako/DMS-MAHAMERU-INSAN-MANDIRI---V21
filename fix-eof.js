import fs from 'fs';
let content = fs.readFileSync('server/routes.ts', 'utf8');

if (!content.endsWith('}')) {
  content += '\n}';
}
fs.writeFileSync('server/routes.ts', content);
