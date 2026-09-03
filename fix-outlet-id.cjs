const fs = require('fs');
let file = fs.readFileSync('server/routes.ts', 'utf8');

file = file.replace(/const outlet: Outlet = \{\n    _id: pgRec\.id,\n    id: pgRec\.id,/g, 'const outlet: Outlet = {\n    _id: pgRec.id,');

fs.writeFileSync('server/routes.ts', file);
