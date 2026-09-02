const fs = require('fs');
const file = './server/inventory.repository.ts';
let code = fs.readFileSync(file, 'utf8');

// I need to add syncDocToPostgres to createOrUpdateInventory
code = code.replace(
  /    if \(!isCloudSqlConnected\) {/,
  `    const targetInv = existingMem || db.inventory[db.inventory.length - 1];
    syncDocToPostgres("inventory", targetInv._id, targetInv).catch(e => console.error("Failed to sync inventory doc", e));

    if (!isCloudSqlConnected) {`
);

fs.writeFileSync(file, code);
