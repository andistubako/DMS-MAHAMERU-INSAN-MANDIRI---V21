const fs = require('fs');
const file = './server/inventory.service.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  /  processReturn: async \([\s\S]*?catch \(err: any\) \{[\s\S]*?\}\n  \},/,
  `  processReturn: async (stockReturn: any, items: any[], performedBy: string) => {
    const targetWhId = stockReturn.warehouse_id || stockReturn.office_id || "off-1";
    const today = stockReturn.return_date || stockReturn.business_date || new Date().toISOString().slice(0, 10);
    
    const runOperations = async (tx) => {
      for (const item of items) {
        const qty = parseInt(item.quantity) || 0;
        if (qty <= 0) continue;
        InventoryRules.validateQuantity(qty);
        
        await InventoryRepository.createOrUpdateInventory("SALES", stockReturn.salesman_id, item.sku_id, -qty, tx);
        await InventoryRepository.createOrUpdateInventory("WAREHOUSE", targetWhId, item.sku_id, qty, tx);
        
        await InventoryRepository.upsertSalesStockLedger(stockReturn.salesman_id, today, item.sku_id, {
          returnedStock: qty,
          finalStock: -qty
        }, tx);
        
        await InventoryRepository.insertMovement({
          id: \`mvt-\${Date.now()}-\${Math.floor(Math.random()*1000000)}\`,
          movementType: "RETURN_IN",
          sourceLocationType: "SALES",
          sourceLocationId: stockReturn.salesman_id,
          destLocationType: "WAREHOUSE",
          destLocationId: targetWhId,
          skuId: item.sku_id,
          quantity: qty,
          referenceId: stockReturn._id,
          performedBy,
          notes: \`Return dari Sales \${stockReturn.salesman_id}\`
        }, tx);
      }
    };

    if (!isCloudSqlConnected) {
      return await runOperations();
    }

    try {
      await sqlDb.transaction(async (tx) => {
        await runOperations(tx);
      });
    } catch (err) {
      console.warn("[InventoryService] processReturn Postgres notice:", err?.message || err);
    }
  },`
);

code = code.replace(
  /  processReceiving: async \([\s\S]*?catch \(err: any\) \{[\s\S]*?\}\n  \},/,
  `  processReceiving: async (receiving: any, items: any[], performedBy: string) => {
    const targetWhId = receiving.warehouse_id || receiving.office_id || "off-1";
    
    const runOperations = async (tx) => {
      for (const item of items) {
        const qty = parseInt(item.quantity) || 0;
        if (qty <= 0) continue;
        InventoryRules.validateQuantity(qty);
        
        await InventoryRepository.createOrUpdateInventory("WAREHOUSE", targetWhId, item.sku_id, qty, tx);
        
        await InventoryRepository.insertMovement({
          id: \`mvt-\${Date.now()}-\${Math.floor(Math.random()*1000000)}\`,
          movementType: "PURCHASE_IN",
          sourceLocationType: "SUPPLIER",
          sourceLocationId: receiving.supplier_name || "SUPPLIER",
          destLocationType: "WAREHOUSE",
          destLocationId: targetWhId,
          skuId: item.sku_id,
          quantity: qty,
          referenceId: receiving._id,
          performedBy,
          notes: \`Penerimaan Barang Supplier \${receiving.supplier_name || ""}\`
        }, tx);
      }
    };

    if (!isCloudSqlConnected) {
      return await runOperations();
    }

    try {
      await sqlDb.transaction(async (tx) => {
        await runOperations(tx);
      });
    } catch (err) {
      console.warn("[InventoryService] Postgres transaction notice in processReceiving:", err?.message || err);
    }
  },`
);

fs.writeFileSync(file, code);
