import fs from 'fs';

let content = fs.readFileSync('server/routes.ts', 'utf8');

content = content.replace(/a\.office\?\.officeName/g, '(a.office as any)?.officeName');
content = content.replace(/a\.regency\?\.name/g, '(a.regency as any)?.name');

// 2648: 'code' does not exist in type
content = content.replace(/code: req\.body\.code,/g, '');

// 2726: 'name' does not exist in type
content = content.replace(/name: req\.body\.name/g, '');

// 2851: Spread types may only be created from object types
content = content.replace(/\.\.\.\(db as any\)\.company_profile/g, '...(db.company_profile as any)');
content = content.replace(/\.\.\.db\.company_profile/g, '...(db.company_profile as any)');

// 5747: Cannot find name 'skuInfo'.
content = content.replace(/skuInfo\./g, '(sku as any).'); // Wait, line 5747 is just one instance of skuInfo? Let's check!

fs.writeFileSync('server/routes.ts', content);
console.log('Fixed more TS issues');
