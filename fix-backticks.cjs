const fs = require('fs');
let file = fs.readFileSync('server/routes.ts', 'utf8');

file = file.replace(/sql\\`/g, 'sql`');
file = file.replace(/\\`\)/g, '`)');
file = file.replace(/\\`/g, '`');

fs.writeFileSync('server/routes.ts', file);
