import fs from 'fs';
let content = fs.readFileSync('server/routes.ts', 'utf8');
content = content.replace(/schema\.users/g, 'pgUsers');
content = content.replace(/schema\.salesmen/g, 'pgSalesmen');
content = content.replace(/schema\.offices/g, 'pgOffices');
content = content.replace(/schema\.areas/g, 'pgAreas');

if (!content.includes('import bcrypt')) {
   content = 'import bcrypt from "bcryptjs";\n' + content;
}
if (!content.includes('import { eq, and } from "drizzle-orm"')) {
   content = 'import { eq, and } from "drizzle-orm";\n' + content;
}
if (!content.includes('pgSalesmen')) {
   content = content.replace('users as pgUsers,', 'users as pgUsers,\n  salesmen as pgSalesmen,\n  offices as pgOffices,\n  areas as pgAreas,');
}
fs.writeFileSync('server/routes.ts', content);
