const fs = require('fs');
let file = './server/routes.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  /price: prc\?\.price \|\| 0,/g,
  `price: prc?.price_value || prc?.priceValue || prc?.price || s.base_price || s.basePrice || s.price || 0,`
);

fs.writeFileSync(file, code);
