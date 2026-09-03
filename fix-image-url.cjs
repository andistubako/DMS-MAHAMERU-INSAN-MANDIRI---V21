const fs = require('fs');
let file = fs.readFileSync('server/routes.ts', 'utf8');

file = file.replace(/image_url: pgRec\.imageUrl,/g, 'photo_url: pgRec.imageUrl,');

fs.writeFileSync('server/routes.ts', file);
