import fs from 'fs';
let content = fs.readFileSync('server/routes.ts', 'utf8');

content = content.replace(/await sqlDb\.update\(pgSalesmen\)\.set\(\{\s*name:\s*updates\.name,\s*phone:\s*updates\.phone,\s*officeId:\s*updates\.officeId,\s*areaId:\s*updates\.areaId,\s*status:\s*updates\.status,\s*\}\)/, 
  `await sqlDb.update(pgSalesmen).set({
        officeId: updates.officeId,
        areaId: updates.areaId,
        status: updates.status,
      })`);

fs.writeFileSync('server/routes.ts', content);
