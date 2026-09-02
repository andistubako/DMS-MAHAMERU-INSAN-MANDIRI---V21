const fs = require('fs');
let file = './server/transaction.service.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  /const lineGross = item\.quantity \* item\.unitPrice, lineSubtotal = Math\.max\(0, lineGross \- item\.discount\);/g,
  `let actualUnitPrice = Number(item.unitPrice);
      if (actualUnitPrice <= 0) {
        // Fallback to SKU base price if unit price is 0 or undefined
        actualUnitPrice = Number(sku.base_price || sku.basePrice || sku.price || 0);
      }
      
      const lineGross = item.quantity * actualUnitPrice;
      const lineSubtotal = Math.max(0, lineGross - item.discount);
      
      // Update the item so we push the correct price to normalized
      item.unitPrice = actualUnitPrice;`
);

fs.writeFileSync(file, code);
