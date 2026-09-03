import fs from 'fs';
let content = fs.readFileSync('server/routes.ts', 'utf8');

content = content.replace(/if\s*\(err\.code === "23505"\)/g, 'if (err.code === "23505" || err.cause?.code === "23505")');
content = content.replace(/if\s*\(err\.code === "23503"\)/g, 'if (err.code === "23503" || err.cause?.code === "23503")');

fs.writeFileSync('server/routes.ts', content);
