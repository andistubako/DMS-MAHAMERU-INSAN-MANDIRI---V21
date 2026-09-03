import fs from 'fs';
let content = fs.readFileSync('server/routes.ts', 'utf8');

// 3167 spread types db.company_profile
content = content.replace(/\.\.\.\(db as any\)\.company_profile/g, '...(db as any).company_profile || {}');

// 3182, 3191 row.company_name
// let's just do a generic replace
content = content.replace(/row\.company_name/g, '(row as any).company_name');
content = content.replace(/row\.currency_symbol/g, '(row as any).currency_symbol');

// 6063 skuInfo
content = content.replace(/skuInfo\./g, '(sku as any).');

fs.writeFileSync('server/routes.ts', content);
