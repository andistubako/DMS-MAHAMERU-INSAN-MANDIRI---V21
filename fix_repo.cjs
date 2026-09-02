const fs = require('fs');
const file = './server/inventory.repository.ts';
let code = fs.readFileSync(file, 'utf8');

// Fix getInventory which was corrupted by patch_repo5
code = code.replace(
  /    const targetInv = existingMem \|\| db\.inventory\[db\.inventory\.length \- 1\];\n    syncDocToPostgres\("inventory", targetInv\._id, targetInv\)\.catch\(e => console\.error\("Failed to sync inventory doc", e\)\);\n\n    if \(\!isCloudSqlConnected\) \{/,
  `    if (!isCloudSqlConnected) {`
);

// We will overwrite insertMovement completely.
const insertMovementStart = code.indexOf('  insertMovement: async');
const insertMovementEnd = code.indexOf('  upsertSalesStockLedger: async');
if (insertMovementStart !== -1 && insertMovementEnd !== -1) {
  const newInsertMovement = `  insertMovement: async (mvt: any, tx: any = sqlDb) => {
    const mvtId = mvt.id || \`mvt-\${Date.now()}-\${Math.floor(Math.random()*1000000)}\`;
    const fullMvt = {
      _id: mvtId,
      id: mvtId,
      movement_type: mvt.movementType,
      source_location_type: mvt.sourceLocationType,
      source_location_id: mvt.sourceLocationId,
      dest_location_type: mvt.destLocationType,
      dest_location_id: mvt.destLocationId,
      sku_id: mvt.skuId,
      quantity: mvt.quantity,
      reference_id: mvt.referenceId,
      performed_by: mvt.performedBy,
      notes: mvt.notes,
      created_at: new Date().toISOString()
    };

    if (!isCloudSqlConnected) {
      if (!db.stock_movements) db.stock_movements = [];
      db.stock_movements.push(fullMvt);
      syncDocToPostgres("stock_movements", fullMvt._id, fullMvt).catch(e => console.error("Failed to sync movement doc", e));
      return { id: mvtId };
    }

    try {
      const res = await tx.insert(stockMovements).values({
        id: mvtId,
        movementType: mvt.movementType,
        sourceLocationType: mvt.sourceLocationType,
        sourceLocationId: mvt.sourceLocationId,
        destLocationType: mvt.destLocationType,
        destLocationId: mvt.destLocationId,
        skuId: mvt.skuId,
        quantity: mvt.quantity,
        referenceId: mvt.referenceId,
        performedBy: mvt.performedBy,
        notes: mvt.notes
      }).returning();
      
      const docData = res[0];
      const legacyMvt = {
        _id: docData.id, id: docData.id, movement_type: docData.movementType, source_location_type: docData.sourceLocationType, source_location_id: docData.sourceLocationId, dest_location_type: docData.destLocationType, dest_location_id: docData.destLocationId, sku_id: docData.skuId, quantity: docData.quantity, reference_id: docData.referenceId, performed_by: docData.performedBy, notes: docData.notes, created_at: docData.createdAt?.toISOString()
      };
      
      await tx.execute(sql\`
        INSERT INTO dms_document_store (collection_name, doc_id, data, updated_at)
        VALUES ('stock_movements', \${legacyMvt._id}, \${JSON.stringify(legacyMvt)}, NOW())
        ON CONFLICT (collection_name, doc_id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
      \`);
      
      return res[0];
    } catch (err: any) {
      console.warn("[InventoryRepository] insertMovement Postgres notice:", err?.message || err);
      throw err;
    }
  },
`;
  code = code.substring(0, insertMovementStart) + newInsertMovement + code.substring(insertMovementEnd);
}

// We will overwrite upsertSalesStockLedger completely.
const upsertSalesStockLedgerStart = code.indexOf('  upsertSalesStockLedger: async');
const upsertSalesStockLedgerEnd = code.indexOf('};', upsertSalesStockLedgerStart);
if (upsertSalesStockLedgerStart !== -1 && upsertSalesStockLedgerEnd !== -1) {
  const newUpsertSalesStockLedger = `  upsertSalesStockLedger: async (salesmanId: string, businessDate: string, skuId: string, updates: any, tx: any = sqlDb) => {
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
`;
  code = code.substring(0, upsertSalesStockLedgerStart) + newUpsertSalesStockLedger + code.substring(upsertSalesStockLedgerEnd);
}

fs.writeFileSync(file, code);
