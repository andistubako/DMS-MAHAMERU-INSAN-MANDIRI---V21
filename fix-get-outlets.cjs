const fs = require('fs');
let file = fs.readFileSync('server/routes.ts', 'utf8');

const lines = file.split('\n');
const replacement = fs.readFileSync('generate-outlets-get.js', 'utf8').replace('// This is a helper script to generate the code for GET /outlets\nconst code = `\n', '').replace('\n`;\n', '');

lines.splice(4247 - 1, 4397 - 4247 + 1, replacement);

fs.writeFileSync('server/routes.ts', lines.join('\n'));
