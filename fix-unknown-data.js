import fs from 'fs';
let content = fs.readFileSync('server/routes.ts', 'utf8');

// 3167
content = content.replace(/\.\.\.data/g, '...(data as any)');

// 3182
content = content.replace(/prof\.metadata\?\.companyLogo/g, '(prof.metadata as any)?.companyLogo');

// find where row.company_name and row.currency_symbol are
content = content.replace(/const row = await sqlDb\.query\.systemSettings\.findFirst\(\{ where: eq\(pgSystemSettings\.id, "global"\) \}\);/g, 'const row = (await sqlDb.query.systemSettings.findFirst({ where: eq(pgSystemSettings.id, "global") })) as any;');

// 6063
content = content.replace(/skuInfo\./g, '(sku as any).');

fs.writeFileSync('server/routes.ts', content);
