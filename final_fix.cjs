const fs = require('fs');

// 1. Fix inventory.repository.ts
let file = './server/inventory.repository.ts';
let code = fs.readFileSync(file, 'utf8');

// Cast fullMvt to any when pushing
code = code.replace(/db\.stock_movements\.push\(fullMvt\);/, 'db.stock_movements.push(fullMvt as any);');

// Cast memLedger to any in upsertSalesStockLedger
code = code.replace(/if \(memLedger\) \{/g, 'if (memLedger) {\n        let ml = memLedger as any;');
code = code.replace(/memLedger\.loaded_stock/g, 'ml.loaded_stock');
code = code.replace(/memLedger\.sold_stock/g, 'ml.sold_stock');
code = code.replace(/memLedger\.returned_stock/g, 'ml.returned_stock');
code = code.replace(/memLedger\.final_stock/g, 'ml.final_stock');

// Fix initial_stock push
code = code.replace(/db\.sales_stock_ledgers\.push\(memLedger\);/, 'db.sales_stock_ledgers.push(memLedger as any);');

fs.writeFileSync(file, code);

// 2. Fix inventory.service.ts duplicate db import
file = './server/inventory.service.ts';
code = fs.readFileSync(file, 'utf8');
code = code.replace(/import \{ db \} from "\.\/data\.js";\nimport \{ db \} from "\.\/data\.js";/, 'import { db } from "./data.js";');
// Try to remove multiple db imports if they exist
let lines = code.split('\n');
let newLines = [];
let dbImported = false;
for (let line of lines) {
  if (line.includes('import { db } from "./data.js";') || line.includes('import {db} from "./data.js";')) {
    if (!dbImported) {
      newLines.push(line);
      dbImported = true;
    }
  } else {
    newLines.push(line);
  }
}
fs.writeFileSync(file, newLines.join('\n'));

// 3. Fix transaction.service.ts missing import
file = './server/transaction.service.ts';
code = fs.readFileSync(file, 'utf8');
if (!code.includes('import { isCloudSqlConnected, syncSingleDoc, reloadInventoryDataFromPostgres } from "./cloudsqlSync.js";') && !code.includes('reloadInventoryDataFromPostgres } from')) {
    code = code.replace(/import \{ isCloudSqlConnected, syncSingleDoc \} from "\.\/cloudsqlSync\.js";/, 'import { isCloudSqlConnected, syncSingleDoc, reloadInventoryDataFromPostgres } from "./cloudsqlSync.js";');
}
// Double check if import is added
if (!code.includes('reloadInventoryDataFromPostgres')) {
    code = 'import { reloadInventoryDataFromPostgres } from "./cloudsqlSync.js";\n' + code;
}
fs.writeFileSync(file, code);

