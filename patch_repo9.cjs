const fs = require('fs');
const file = './server/inventory.repository.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  /  insertMovement: async \([\s\S]*?catch \(err: any\) \{\n      console.warn\("\[InventoryRepository\] insertMovement Postgres notice:", err\?.message \|\| err\);\n    \}\n  \},/,
  `  insertMovement: async (mvt: any, tx: any = sqlDb) => {
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
  },`
);

fs.writeFileSync(file, code);
