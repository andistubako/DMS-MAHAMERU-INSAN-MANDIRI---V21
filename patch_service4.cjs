const fs = require('fs');
const file = './server/inventory.service.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  /  reverseSalesStock: async \([\s\S]*?catch \(err: any\) \{[\s\S]*?return null;\n    \}\n  \},/,
  `  reverseSalesStock: async (salesmanId: string, skuId: string, qty: number, referenceId: string, outletId: string, notes: string) => {
    InventoryRules.validateQuantity(qty);
    const today = new Date().toISOString().slice(0, 10);
    
    const runOperations = async (tx) => {
      const inv = await InventoryRepository.createOrUpdateInventory("SALES", salesmanId, skuId, qty, tx);
      await InventoryRepository.insertMovement({
        id: \`mvt-rev-\${Date.now()}-\${Math.floor(Math.random()*1000000)}\`,
        movementType: "REVERSAL",
        sourceLocationType: "OUTLET",
        sourceLocationId: outletId,
        destLocationType: "SALES",
        destLocationId: salesmanId,
        skuId: skuId,
        quantity: qty,
        salesmanId: salesmanId,
        outletId: outletId,
        referenceId: referenceId,
        businessDate: today,
        status: "COMPLETED",
        notes: notes
      }, tx);
      
      await InventoryRepository.upsertSalesStockLedger(salesmanId, today, skuId, {
        returnedStock: 0,
        finalStock: qty
      }, tx);
      return inv;
    };

    if (!isCloudSqlConnected) {
      return await runOperations();
    }

    try {
      return await sqlDb.transaction(async (tx) => {
        return await runOperations(tx);
      });
    } catch (err) {
      console.warn("[InventoryService] reverseSalesStock Postgres notice:", err?.message || err);
      return null;
    }
  },`
);

code = code.replace(
  /  processOpname: async \([\s\S]*?catch \(err: any\) \{[\s\S]*?\}\n  \}\n\};/,
  `  processOpname: async (warehouseId: string, skuId: string, diff: number, performedBy: string, notes: string, txArg?: any) => {
    if (diff === 0) return;
    const targetWhId = warehouseId || "off-1";
    
    const runOperations = async (tx) => {
      await InventoryRepository.createOrUpdateInventory("WAREHOUSE", targetWhId, skuId, diff, tx);
      await InventoryRepository.insertMovement({
        id: \`mvt-\${Date.now()}-\${Math.floor(Math.random()*1000000)}\`,
        movementType: diff > 0 ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT",
        sourceLocationType: diff > 0 ? "NONE" : "WAREHOUSE",
        sourceLocationId: diff > 0 ? "" : targetWhId,
        destLocationType: diff > 0 ? "WAREHOUSE" : "NONE",
        destLocationId: diff > 0 ? targetWhId : "",
        skuId,
        quantity: Math.abs(diff),
        referenceId: \`adj-\${Date.now()}\`,
        performedBy,
        notes,
      }, tx);
    };

    if (!isCloudSqlConnected) {
      return await runOperations();
    }

    try {
      const runner = txArg || sqlDb;
      await runOperations(runner);
    } catch (err) {
      console.warn("[InventoryService] processOpname Postgres notice:", err?.message || err);
    }
  }
};`
);

fs.writeFileSync(file, code);
