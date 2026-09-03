import fs from 'fs';
let content = fs.readFileSync('server/routes.ts', 'utf8');

// 3182
content = content.replace(/settings\.company_name/g, '(settings as any).company_name');
content = content.replace(/settings\.currency_symbol/g, '(settings as any).currency_symbol');

// 6063
content = content.replace(/\(skuInfo as any\)\.base_price/g, '(sku as any)?.base_price');

fs.writeFileSync('server/routes.ts', content);
