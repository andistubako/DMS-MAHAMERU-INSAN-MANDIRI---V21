const fs = require('fs');
let file = './server/inventory.service.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(/import \{ db \} from "\.\/data\.js";\nimport \{ db \} from "\.\/data\.js";/, 'import { db } from "./data.js";');
fs.writeFileSync(file, code);

file = './server/transaction.service.ts';
code = fs.readFileSync(file, 'utf8');
if (!code.includes('reloadInventoryDataFromPostgres')) {
  code = code.replace(/import \{ isCloudSqlConnected, syncSingleDoc \} from "\.\/cloudsqlSync\.js";/, 'import { isCloudSqlConnected, syncSingleDoc, reloadInventoryDataFromPostgres } from "./cloudsqlSync.js";');
}
fs.writeFileSync(file, code);
