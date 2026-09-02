const fs = require('fs');
const file = './server/inventory.repository.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  /  upsertSalesStockLedger: async \([\s\S]*?catch \(err: any\) \{\n      console.warn\("\[InventoryRepository\] upsertSalesStockLedger Postgres notice:", err\?.message \|\| err\);\n    \}\n  \}\n\};/,
  `  upsertSalesStockLedger: async (salesmanId: string, businessDate: string, skuId: string, updates: any, tx: any = sqlDb) => {
    let memLedger = db.sales_stock_ledgers.find(l => l.salesman_id === salesmanId && l.business_date === businessDate && l.sku_id === skuId);
    
    if (!isCloudSqlConnected) {
      if (memLedger) {
        if (updates.loadedStock) memLedger.loaded_stock = (memLedger.loaded_stock || 0) + updates.loadedStock;
        if (updates.soldStock) memLedger.sold_stock = (memLedger.sold_stock || 0) + updates.soldStock;
        if (updates.returnedStock) memLedger.returned_stock = (memLedger.returned_stock || 0) + updates.returnedStock;
        if (updates.finalStock) memLedger.final_stock = (memLedger.final_stock || 0) + updates.finalStock;
      } else {
        memLedger = {
          _id: \`ssl-\${Date.now()}-\${Math.floor(Math.random() * 100000)}\`,
          salesman_id: salesmanId,
          business_date: businessDate,
          sku_id: skuId,
          initial_stock: 0,
          loaded_stock: updates.loadedStock || 0,
          sold_stock: updates.soldStock || 0,
          returned_stock: updates.returnedStock || 0,
          final_stock: updates.finalStock || 0
        };
        db.sales_stock_ledgers.push(memLedger);
      }
      syncDocToPostgres("sales_stock_ledgers", memLedger._id, memLedger).catch(e => console.error("Failed to sync sales ledger doc", e));
      return memLedger;
    }

    try {
      const existingList = await tx.execute(sql\`
        SELECT * FROM sales_stock_ledgers 
        WHERE salesman_id = \${salesmanId} 
          AND business_date = \${businessDate} 
          AND sku_id = \${skuId} 
        LIMIT 1 FOR UPDATE
      \`);
      const existing = existingList.rows?.[0];

      let resLedger;
      if (existing) {
        resLedger = await tx.update(salesStockLedgers).set({
          loadedStock: Number(existing.loaded_stock || 0) + (updates.loadedStock || 0),
          soldStock: Number(existing.sold_stock || 0) + (updates.soldStock || 0),
          returnedStock: Number(existing.returned_stock || 0) + (updates.returnedStock || 0),
          finalStock: Number(existing.final_stock || 0) + (updates.finalStock || 0),
          updatedAt: sql\`NOW()\`
        }).where(eq(salesStockLedgers.id, existing.id as string)).returning();
      } else {
        resLedger = await tx.insert(salesStockLedgers).values({
          id: \`ssl-\${Date.now()}-\${Math.floor(Math.random() * 100000)}\`,
          salesmanId,
          businessDate,
          skuId,
          initialStock: 0,
          loadedStock: updates.loadedStock || 0,
          soldStock: updates.soldStock || 0,
          returnedStock: updates.returnedStock || 0,
          finalStock: updates.finalStock || 0
        }).returning();
      }
      
      const docData = resLedger[0];
      const legacyLedger = {
         _id: docData.id, salesman_id: docData.salesmanId, business_date: docData.businessDate, sku_id: docData.skuId, initial_stock: docData.initialStock, loaded_stock: docData.loadedStock, sold_stock: docData.soldStock, returned_stock: docData.returnedStock, final_stock: docData.finalStock
      };
      
      await tx.execute(sql\`
        INSERT INTO dms_document_store (collection_name, doc_id, data, updated_at)
        VALUES ('sales_stock_ledgers', \${legacyLedger._id}, \${JSON.stringify(legacyLedger)}, NOW())
        ON CONFLICT (collection_name, doc_id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
      \`);
      
      return resLedger[0];
    } catch (err: any) {
      console.warn("[InventoryRepository] upsertSalesStockLedger Postgres notice:", err?.message || err);
      throw err;
    }
  }
};`
);

fs.writeFileSync(file, code);
