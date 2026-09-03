import fs from 'fs';
let content = fs.readFileSync('server/routes.ts', 'utf8');

content = content.replace(/email: cleanEmail,/g, '');
content = content.replace(/phone: phone \|\| null,/g, '');
content = content.replace(/name: smItem\.name,/g, ''); // just in case

// Fix other things
content = content.replace(/name: req\.body\.name,/g, '');
content = content.replace(/\.\.\.db\.company_profile/g, '...(db as any).company_profile');
content = content.replace(/row\.company_name/g, '(row as any).company_name');
content = content.replace(/row\.currency_symbol/g, '(row as any).currency_symbol');
content = content.replace(/skuInfo\./g, '(sku as any).');

fs.writeFileSync('server/routes.ts', content);
