import fs from 'fs';

let content = fs.readFileSync('server/routes.ts', 'utf8');

// The original file error for 2976 was: 'code', 'email', 'phone' inside pgSalesmen insert
// The original file error for 3054 was: 'name' inside updates for pgSalesmen.

// Let's fix line 2976 cleanly. We find `await sqlDb.insert(pgSalesmen).values({` and replace the block until `})`
content = content.replace(/await sqlDb\.insert\(pgSalesmen\)\.values\(\{[\s\S]*?\}\);/, `await sqlDb.insert(pgSalesmen).values({
        id: userId,
        userId: userId,
        officeId: office_id || "off-1",
        areaId: area_id || "area-1",
        status: "ACTIVE",
      });`);

content = content.replace(/await sqlDb\.insert\(pgUsers\)\.values\(\{[\s\S]*?\}\);/, `await sqlDb.insert(pgUsers).values({
        id: userId,
        name: req.body.name,
        email: cleanEmail,
        passwordHash: hashedPassword,
        role: req.body.role || "SALESMAN",
        phone: phone || null,
        officeId: office_id || "off-1",
        areaId: area_id || "area-1",
        status: "ACTIVE",
      });`);

// Fix 3054
content = content.replace(/const updates = {\s*name:\s*req\.body\.name,\s*email:\s*cleanEmail,\s*phone:\s*req\.body\.phone \|\| null,\s*role:\s*req\.body\.role,\s*officeId:\s*req\.body\.office_id,\s*areaId:\s*req\.body\.area_id,\s*status:\s*req\.body\.status\s*};/g, 
  `const updates = { name: req.body.name, email: cleanEmail, phone: req.body.phone || null, role: req.body.role, officeId: req.body.office_id, areaId: req.body.area_id, status: req.body.status };`);

content = content.replace(/if\s*\(req\.body\.role === "SALESMAN"\)\s*\{\s*const smUpdates = \{\s*name:\s*req\.body\.name,\s*officeId:\s*req\.body\.office_id,\s*areaId:\s*req\.body\.area_id,\s*status:\s*req\.body\.status\s*\};\s*await sqlDb\.update\(pgSalesmen\)\.set\(smUpdates\)/g,
  `if (req.body.role === "SALESMAN") { const smUpdates = { officeId: req.body.office_id, areaId: req.body.area_id, status: req.body.status }; await sqlDb.update(pgSalesmen).set(smUpdates)`);

// 3179
content = content.replace(/\.\.\.db\.company_profile/g, '...(db as any).company_profile');
content = content.replace(/row\.company_name/g, '(row as any).company_name');
content = content.replace(/row\.currency_symbol/g, '(row as any).currency_symbol');

// 6075
content = content.replace(/skuInfo\./g, '(sku as any).');

fs.writeFileSync('server/routes.ts', content);
