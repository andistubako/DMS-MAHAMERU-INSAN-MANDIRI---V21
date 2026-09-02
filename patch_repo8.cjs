const fs = require('fs');
const file = './server/inventory.repository.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  /  createOrUpdateInventory: async \([\s\S]*?catch \(err: any\) \{\n      console.warn\("\[InventoryRepository\] Postgres operation warning:", err\?.message \|\| err\);\n      throw err;\n    \}\n  \},/,
  `  createOrUpdateInventory: async (locationType: string, locationId: string, skuId: string, qtyDelta: number, tx: any = sqlDb) => {
    const locType = locationType || "WAREHOUSE";
    const locId = locationId || "off-1";

    let existingMem = db.inventory.find(i => (i.location_type === locType || (!i.location_type && locType === "WAREHOUSE")) && (i.location_id === locId || i.office_id === locId) && i.sku_id === skuId);
    
    if (!isCloudSqlConnected) {
      if (existingMem) {
        existingMem.stock_on_hand += qtyDelta;
        existingMem.available_stock += qtyDelta;
      } else {
        const newInv = {
           _id: \`inv-\${Date.now()}-\${Math.floor(Math.random() * 1000000)}\`,
           id: \`inv-\${Date.now()}-\${Math.floor(Math.random() * 1000000)}\`,
           location_type: locType as "WAREHOUSE" | "SALES",
           location_id: locId,
           sku_id: skuId,
           stock_on_hand: qtyDelta,
           available_stock: qtyDelta,
           allocated_stock: 0,
           status: "ACTIVE"
        };
        db.inventory.push(newInv);
        existingMem = newInv;
      }
      syncDocToPostgres("inventory", existingMem._id, existingMem).catch(e => console.error("Failed to sync inventory doc", e));
      return { id: existingMem._id, stockOnHand: existingMem.stock_on_hand, availableStock: existingMem.available_stock, allocatedStock: existingMem.allocated_stock, locationType: locType, locationId: locId, skuId };
    }

    try {
      const existingList = await tx.select().from(inventory).where(
        and(
          eq(inventory.locationType, locType),
          eq(inventory.locationId, locId),
          eq(inventory.skuId, skuId)
        )
      ).limit(1);
      const existing = existingList?.[0];

      let resultInv;
      if (existing) {
        const newStock = Number(existing.stockOnHand || 0) + qtyDelta;
        const newAvailable = Number(existing.availableStock || 0) + qtyDelta;
        if (newStock < 0 || newAvailable < 0) throw new Error("Stok tidak mencukupi untuk transaksi ini.");

        const res = await tx.update(inventory).set({
          stockOnHand: newStock,
          availableStock: newAvailable,
          updatedAt: sql\`NOW()\`
        }).where(eq(inventory.id, existing.id)).returning();
        resultInv = res[0];
      } else {
        if (qtyDelta < 0) throw new Error("Stok tidak mencukupi untuk transaksi ini.");
        const res = await tx.insert(inventory).values({
          id: \`inv-\${Date.now()}-\${Math.floor(Math.random() * 1000000)}\`,
          locationType: locType as any,
          locationId: locId,
          skuId: skuId,
          stockOnHand: qtyDelta,
          availableStock: qtyDelta,
          allocatedStock: 0,
          status: "ACTIVE" as any
        }).returning();
        resultInv = res[0];
      }
      
      const docData = {
         _id: resultInv.id,
         id: resultInv.id,
         location_type: resultInv.locationType,
         location_id: resultInv.locationId,
         sku_id: resultInv.skuId,
         stock_on_hand: resultInv.stockOnHand,
         available_stock: resultInv.availableStock,
         allocated_stock: resultInv.allocatedStock,
         status: resultInv.status,
         created_at: resultInv.createdAt?.toISOString(),
         updated_at: resultInv.updatedAt?.toISOString()
      };
      
      await tx.execute(sql\`
        INSERT INTO dms_document_store (collection_name, doc_id, data, updated_at)
        VALUES ('inventory', \${docData._id}, \${JSON.stringify(docData)}, NOW())
        ON CONFLICT (collection_name, doc_id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
      \`);
      
      return resultInv;
    } catch (err: any) {
      console.warn("[InventoryRepository] Postgres operation warning:", err?.message || err);
      throw err;
    }
  },`
);

fs.writeFileSync(file, code);
