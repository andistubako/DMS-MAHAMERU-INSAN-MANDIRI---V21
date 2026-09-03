import fs from 'fs';

const file = fs.readFileSync('server/auth.ts', 'utf8');
const lines = file.split('\n');
console.log('auth.ts length:', lines.length);
