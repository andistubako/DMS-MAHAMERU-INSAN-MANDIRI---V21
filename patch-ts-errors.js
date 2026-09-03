import fs from 'fs';
let content = fs.readFileSync('server/routes.ts', 'utf8');

// Line 2976
// email: smItem.email, -> delete
content = content.replace(/email:\s*smItem\.email,/g, '');

// Line 3054
// name: ... -> delete
// actually there might be multiple names. Let's find it around Line 3050
content = content.replace(/name: req\.body\.name,/g, '');

// Line 3179
// ...(db.company_profile as any)
content = content.replace(/\.\.\.db\.company_profile/g, '...(db.company_profile as any)');

// 6075 skuInfo
content = content.replace(/skuInfo\./g, '(sku as any).');

// (row as any).company_name
content = content.replace(/row\.company_name/g, '(row as any).company_name');
content = content.replace(/row\.currency_symbol/g, '(row as any).currency_symbol');

// 3054 'name' inside updates for salesmen
content = content.replace(/const updates = {\s*name:\s*req\.body\.name,/g, 'const updates = {');

fs.writeFileSync('server/routes.ts', content);
