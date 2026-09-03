import fs from 'fs';
let content = fs.readFileSync('server/routes.ts', 'utf8');

// replace (sku as any)?.base_price with (skuInfo as any)?.base_price around 5798 and 5873
// We will just do it globally, it's safer if 'skuInfo' is the variable there. Wait, 'sku' might be defined in 6063.
// Let's just do a smart replace where 'const skuInfo =' is in the scope, change 'sku' to 'skuInfo'
content = content.replace(/\(sku as any\)\?/g, '(skuInfo as any)?');
content = content.replace(/\(sku as any\)/g, '(skuInfo as any)');

// At line 6063 we DO have 'const sku = db.skus.find(...)'. So if we blindly change 'sku' to 'skuInfo' we might break it. Let's make sure it's correct.
// In 6063 we had: const sku = db.skus.find... then price = Number(it.price ?? (skuInfo as any)?.base_price ?? 0)
// If we change it to skuInfo we will get TS error Cannot find name 'skuInfo'.
// Let's manually restore 6063 to use 'sku'
content = content.replace(/const price = Number\(it\.unit_price \?\? it\.price \?\? \(skuInfo as any\)\?\.base_price \?\? 0\);/g, 
  'const price = Number(it.unit_price ?? it.price ?? (sku as any)?.base_price ?? 0);');

fs.writeFileSync('server/routes.ts', content);
