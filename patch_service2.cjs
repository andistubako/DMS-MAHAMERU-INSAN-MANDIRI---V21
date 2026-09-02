const fs = require('fs');
const file = './server/inventory.service.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  /  processHandover: async \([\s\S]*?catch \(err: any\) \{[\s\S]*?\}\n  \},/,
  `  processHandover: async (handover: any, items: any[], performedBy: string) => {
    const targetWhId = handover.warehouse_id || handover.office_id || "off-1";
    const today = handover.handover_date || handover.business_date || new Date().toISOString().slice(0, 10);
    
    const runOperations = async (tx) => {
      for (const item of items) {
        const qty = parseInt(item.quantity) || 0;
        if (qty <= 0) continue;
        InventoryRules.validateQuantity(qty);
        
        await InventoryRepository.createOrUpdateInventory("WAREHOUSE", targetWhId, item.sku_id, -qty, tx);
        await InventoryRepository.createOrUpdateInventory("SALES", handover.salesman_id, item.sku_id, qty, tx);
        
        await InventoryRepository.upsertSalesStockLedger(handover.salesman_id, today, item.sku_id, {
          loadedStock: qty,
          finalStock: qty
        }, tx);
        
        await InventoryRepository.insertMovement({
          id: \`mvt-\${Date.now()}-\${Math.floor(Math.random()*1000000)}\`,
          movementType: "TRANSFER_OUT",
          sourceLocationType: "WAREHOUSE",
          sourceLocationId: targetWhId,
          destLocationType: "SALES",
          destLocationId: handover.salesman_id,
          skuId: item.sku_id,
          quantity: qty,
          referenceId: handover._id,
          performedBy,
          notes: \`Handover ke Sales \${handover.salesman_id}\`
        }, tx);
        
        await InventoryRepository.insertMovement({
          id: \`mvt-\${Date.now()}-\${Math.floor(Math.random()*1000000)}\`,
          movementType: "TRANSFER_IN",
          sourceLocationType: "WAREHOUSE",
          sourceLocationId: targetWhId,
          destLocationType: "SALES",
          destLocationId: handover.salesman_id,
          skuId: item.sku_id,
          quantity: qty,
          referenceId: handover._id,
          performedBy,
          notes: \`Penerimaan Handover dari Gudang \${targetWhId}\`
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
      console.warn("[InventoryService] processHandover Postgres notice:", err?.message || err);
    }
  },`
);

fs.writeFileSync(file, code);
