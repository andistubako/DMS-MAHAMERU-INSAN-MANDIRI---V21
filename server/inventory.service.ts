import { sqlDb } from "../src/db/index.js";
import { InventoryRepository } from "./inventory.repository.js";
import { InventoryRules } from "./inventory.rules.js";
import { db } from "./data.js";

import { isCloudSqlConnected, reloadInventoryDataFromPostgres } from "./cloudsqlSync.js";
export const InventoryService = {
  deductSalesStock: async (salesmanId: string, skuId: string, qty: number, referenceId: string, outletId: string, notes: string) => {
    InventoryRules.validateQuantity(qty);
    const today = new Date().toISOString().slice(0, 10);
    
    const runOperations = async (tx?: any) => {
      const inv = await InventoryRepository.createOrUpdateInventory("SALES", salesmanId, skuId, -qty, tx);
      await InventoryRepository.insertMovement({
        id: `mvt-${Date.now()}-${Math.floor(Math.random()*1000000)}`,
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
    } catch (err: any) {
      console.warn("[InventoryService] deductSalesStock Postgres notice:", err?.message || err);
      return null;
    } finally {
      await reloadInventoryDataFromPostgres(db);
    }
  },

  deductWarehouseStockForSales: async (warehouseId: string, skuId: string, qty: number, referenceId: string, outletId: string, performedBy: string, notes: string) => {
    InventoryRules.validateQuantity(qty);
    const targetWhId = warehouseId || "off-1";
    
    const runOperations = async (tx?: any) => {
      const inv = await InventoryRepository.createOrUpdateInventory("WAREHOUSE", targetWhId, skuId, -qty, tx);
      await InventoryRepository.insertMovement({
        id: `mvt-${Date.now()}-${Math.floor(Math.random()*1000000)}`,
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
    } catch (err: any) {
      console.warn("[InventoryService] deductWarehouseStockForSales Postgres notice:", err?.message || err);
      return null;
    } finally {
      await reloadInventoryDataFromPostgres(db);
    }
  },
  
  processHandover: async (handover: any, items: any[], performedBy: string) => {
    const targetWhId = handover.warehouse_id || handover.office_id || "off-1";
    const today = handover.handover_date || handover.business_date || new Date().toISOString().slice(0, 10);
    
    const runOperations = async (tx?: any) => {
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
          id: `mvt-${Date.now()}-${Math.floor(Math.random()*1000000)}`,
          movementType: "TRANSFER_OUT",
          sourceLocationType: "WAREHOUSE",
          sourceLocationId: targetWhId,
          destLocationType: "SALES",
          destLocationId: handover.salesman_id,
          skuId: item.sku_id,
          quantity: qty,
          referenceId: handover._id,
          performedBy,
          notes: `Handover ke Sales ${handover.salesman_id}`
        }, tx);
        
        await InventoryRepository.insertMovement({
          id: `mvt-${Date.now()}-${Math.floor(Math.random()*1000000)}`,
          movementType: "TRANSFER_IN",
          sourceLocationType: "WAREHOUSE",
          sourceLocationId: targetWhId,
          destLocationType: "SALES",
          destLocationId: handover.salesman_id,
          skuId: item.sku_id,
          quantity: qty,
          referenceId: handover._id,
          performedBy,
          notes: `Penerimaan Handover dari Gudang ${targetWhId}`
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
    } catch (err: any) {
      console.warn("[InventoryService] processHandover Postgres notice:", err?.message || err);
    } finally {
      await reloadInventoryDataFromPostgres(db);
    }
  },

  processReturn: async (stockReturn: any, items: any[], performedBy: string) => {
    const targetWhId = stockReturn.warehouse_id || stockReturn.office_id || "off-1";
    const today = stockReturn.return_date || stockReturn.business_date || new Date().toISOString().slice(0, 10);
    
    const runOperations = async (tx?: any) => {
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
          id: `mvt-${Date.now()}-${Math.floor(Math.random()*1000000)}`,
          movementType: "RETURN_IN",
          sourceLocationType: "SALES",
          sourceLocationId: stockReturn.salesman_id,
          destLocationType: "WAREHOUSE",
          destLocationId: targetWhId,
          skuId: item.sku_id,
          quantity: qty,
          referenceId: stockReturn._id,
          performedBy,
          notes: `Return dari Sales ${stockReturn.salesman_id}`
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
    } catch (err: any) {
      console.warn("[InventoryService] processReturn Postgres notice:", err?.message || err);
    } finally {
      await reloadInventoryDataFromPostgres(db);
    }
  },
  processReceiving: async (receiving: any, items: any[], performedBy: string) => {
    const targetWhId = receiving.warehouse_id || receiving.office_id || "off-1";
    
    const runOperations = async (tx?: any) => {
      for (const item of items) {
        const qty = parseInt(item.quantity) || 0;
        if (qty <= 0) continue;
        InventoryRules.validateQuantity(qty);
        
        await InventoryRepository.createOrUpdateInventory("WAREHOUSE", targetWhId, item.sku_id, qty, tx);
        
        await InventoryRepository.insertMovement({
          id: `mvt-${Date.now()}-${Math.floor(Math.random()*1000000)}`,
          movementType: "PURCHASE_IN",
          sourceLocationType: "SUPPLIER",
          sourceLocationId: receiving.supplier_name || "SUPPLIER",
          destLocationType: "WAREHOUSE",
          destLocationId: targetWhId,
          skuId: item.sku_id,
          quantity: qty,
          referenceId: receiving._id,
          performedBy,
          notes: `Penerimaan Barang Supplier ${receiving.supplier_name || ""}`
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
    } catch (err: any) {
      console.warn("[InventoryService] Postgres transaction notice in processReceiving:", err?.message || err);
    } finally {
      await reloadInventoryDataFromPostgres(db);
    }
  },
  reverseSalesStock: async (salesmanId: string, skuId: string, qty: number, referenceId: string, outletId: string, notes: string) => {
    InventoryRules.validateQuantity(qty);
    const today = new Date().toISOString().slice(0, 10);
    
    const runOperations = async (tx?: any) => {
      const inv = await InventoryRepository.createOrUpdateInventory("SALES", salesmanId, skuId, qty, tx);
      await InventoryRepository.insertMovement({
        id: `mvt-rev-${Date.now()}-${Math.floor(Math.random()*1000000)}`,
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
    } catch (err: any) {
      console.warn("[InventoryService] reverseSalesStock Postgres notice:", err?.message || err);
      return null;
    } finally {
      await reloadInventoryDataFromPostgres(db);
    }
  },
  processOpname: async (warehouseId: string, skuId: string, diff: number, performedBy: string, notes: string, txArg?: any) => {
    if (diff === 0) return;
    const targetWhId = warehouseId || "off-1";
    
    const runOperations = async (tx?: any) => {
      await InventoryRepository.createOrUpdateInventory("WAREHOUSE", targetWhId, skuId, diff, tx);
      await InventoryRepository.insertMovement({
        id: `mvt-${Date.now()}-${Math.floor(Math.random()*1000000)}`,
        movementType: diff > 0 ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT",
        sourceLocationType: diff > 0 ? "NONE" : "WAREHOUSE",
        sourceLocationId: diff > 0 ? "" : targetWhId,
        destLocationType: diff > 0 ? "WAREHOUSE" : "NONE",
        destLocationId: diff > 0 ? targetWhId : "",
        skuId,
        quantity: Math.abs(diff),
        referenceId: `adj-${Date.now()}`,
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
    } catch (err: any) {
      console.warn("[InventoryService] processOpname Postgres notice:", err?.message || err);
    } finally {
      if (!txArg) await reloadInventoryDataFromPostgres(db);
    }
  }
};
