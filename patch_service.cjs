const fs = require('fs');
const file = './server/inventory.service.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  /  deductSalesStock: async \([\s\S]*?catch \(err: any\) \{[\s\S]*?return null;\n    \}\n  \},/,
  `  deductSalesStock: async (salesmanId: string, skuId: string, qty: number, referenceId: string, outletId: string, notes: string) => {
    InventoryRules.validateQuantity(qty);
    const today = new Date().toISOString().slice(0, 10);
    
    const runOperations = async (tx) => {
      const inv = await InventoryRepository.createOrUpdateInventory("SALES", salesmanId, skuId, -qty, tx);
      await InventoryRepository.insertMovement({
        id: \`mvt-\${Date.now()}-\${Math.floor(Math.random()*1000000)}\`,
        movementType: "SALES_OUT",
        sourceLocationType: "SALES",
        sourceLocationId: salesmanId,
        destLocationType: "OUTLET",
        destLocationId: outletId,
        skuId, quantity: qty, referenceId, performedBy: salesmanId, notes
      }, tx);
      await InventoryRepository.upsertSalesStockLedger(salesmanId, today, skuId, { soldStock: qty, finalStock: -qty }, tx);
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
      console.warn("[InventoryService] deductSalesStock Postgres notice:", err?.message || err);
      return null;
    }
  },`
);

code = code.replace(
  /  deductWarehouseStockForSales: async \([\s\S]*?catch \(err: any\) \{[\s\S]*?return null;\n    \}\n  \},/,
  `  deductWarehouseStockForSales: async (warehouseId: string, skuId: string, qty: number, referenceId: string, outletId: string, performedBy: string, notes: string) => {
    InventoryRules.validateQuantity(qty);
    const targetWhId = warehouseId || "off-1";
    
    const runOperations = async (tx) => {
      const inv = await InventoryRepository.createOrUpdateInventory("WAREHOUSE", targetWhId, skuId, -qty, tx);
      await InventoryRepository.insertMovement({
        id: \`mvt-\${Date.now()}-\${Math.floor(Math.random()*1000000)}\`,
        movementType: "SALES_OUT",
        sourceLocationType: "WAREHOUSE",
        sourceLocationId: targetWhId,
        destLocationType: "OUTLET",
        destLocationId: outletId,
        skuId, quantity: qty, referenceId, performedBy, notes
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
      console.warn("[InventoryService] deductWarehouseStockForSales Postgres notice:", err?.message || err);
      return null;
    }
  },`
);

fs.writeFileSync(file, code);
