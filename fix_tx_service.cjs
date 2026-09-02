const fs = require('fs');
let file = './server/transaction.service.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  /actualUnitPrice = Number\(sku\.base_price \|\| sku\.basePrice \|\| sku\.price \|\| 0\);/g,
  `const prc = db.prices?.find((p) => (p.sku_id === sku._id || p.sku_id === sku.id) && p.status === "ACTIVE");
        actualUnitPrice = Number(sku.base_price || sku.basePrice || sku.price || prc?.price || prc?.price_value || prc?.priceValue || 0);`
);

fs.writeFileSync(file, code);
