import { pool } from './src/db/index.js';
async function run() {
  try {
    await pool.query("INSERT INTO skus (id, sku_code, sku_name) VALUES ('test1', 'SKU-AUDIT-DUPE', 'test')");
  } catch(e: any) {
    console.log("CODE:", e.code);
    console.log("MESSAGE:", e.message);
  }
  process.exit(0);
}
run();
