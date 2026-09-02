const fs = require('fs');
const file = './server/inventory.repository.ts';
let code = fs.readFileSync(file, 'utf8');

// Replace the if(!isCloudSqlConnected) block with logic that ALWAYS updates db.inventory
code = code.replace(
  /    if \(\!isCloudSqlConnected\) \{([\s\S]*?)\}    try \{/g,
  `    let existingMem = db.inventory.find(i => (i.location_type === locType || (!i.location_type && locType === "WAREHOUSE")) && (i.location_id === locId || i.office_id === locId) && i.sku_id === skuId);
    if (existingMem) {
      existingMem.stock_on_hand += qtyDelta;
      existingMem.available_stock += qtyDelta;
    } else {
      const newInv = {
         _id: \`inv-\${Date.now()}-\${Math.floor(Math.random() * 1000000)}\`,
         id: \`inv-\${Date.now()}-\${Math.floor(Math.random() * 1000000)}\`,
         location_type: locType as "WAREHOUSE" | "SALES",
         location_id: locId,
         sku_id: skuId,
         stock_on_hand: qtyDelta,
         available_stock: qtyDelta,
         allocated_stock: 0,
         status: "ACTIVE"
      };
      db.inventory.push(newInv);
    }
    
    if (!isCloudSqlConnected) {
      if (existingMem) {
        return { id: existingMem._id, stockOnHand: existingMem.stock_on_hand, availableStock: existingMem.available_stock, allocatedStock: existingMem.allocated_stock, locationType: locType, locationId: locId, skuId };
      } else {
        const i = db.inventory[db.inventory.length - 1];
        return { id: i.id, stockOnHand: i.stock_on_hand, availableStock: i.available_stock, allocatedStock: i.allocated_stock, locationType: locType, locationId: locId, skuId };
      }
    }

    try {`
);

fs.writeFileSync(file, code);
