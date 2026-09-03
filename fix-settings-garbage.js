import fs from 'fs';
let content = fs.readFileSync('server/routes.ts', 'utf8');

content = content.replace(/mpany_profile,\s*\}\);\s*\}\);/g, '');

fs.writeFileSync('server/routes.ts', content);
