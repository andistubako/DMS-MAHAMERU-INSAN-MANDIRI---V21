const fs = require('fs');
const file = './server/cloudsqlSync.ts';
let code = fs.readFileSync(file, 'utf8');

if (!code.includes('reloadInventoryDataFromPostgres')) {
  code = code.replace(
    /export async function loadAllFromPostgres/,
    `export async function reloadInventoryDataFromPostgres(targetDb: any): Promise<void> {
  if (!isCloudSqlConnected) return;
  try {
    const client = await pool.connect();
    try {
      const res = await client.query("SELECT collection_name, doc_id, data FROM dms_document_store WHERE collection_name IN ('inventory', 'stock_movements', 'sales_stock_ledgers')");
      
      targetDb.inventory = [];
      targetDb.stock_movements = [];
      targetDb.sales_stock_ledgers = [];
      
      for (const row of res.rows) {
        const data = row.data;
        if (!data._id) data._id = row.doc_id;
        
        if (row.collection_name === "inventory") targetDb.inventory.push(data);
        else if (row.collection_name === "stock_movements") targetDb.stock_movements.push(data);
        else if (row.collection_name === "sales_stock_ledgers") targetDb.sales_stock_ledgers.push(data);
      }
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("[Cloud SQL] Failed to reload inventory data:", err);
  }
}

export async function loadAllFromPostgres`
  );
  fs.writeFileSync(file, code);
}
