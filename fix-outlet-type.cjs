const fs = require('fs');
let file = fs.readFileSync('server/routes.ts', 'utf8');

file = file.replace(/const outlet: Outlet = \{/g, 'const outlet = {');
file = file.replace(/  \.\.\.meta\n  \};/g, '  ...meta\n  } as Outlet;');

fs.writeFileSync('server/routes.ts', file);
