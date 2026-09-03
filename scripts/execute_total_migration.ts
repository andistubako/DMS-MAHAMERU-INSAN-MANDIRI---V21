import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { sql } from 'drizzle-orm';
import { sqlDb, pool } from '../src/db/index.js';
import * as schema from '../src/db/schema.js';
import fs from 'fs';
import path from 'path';

async function getMigrationData() {
  const backupsDir = path.join(process.cwd(), 'backups');
  let data: any = null;

  // 1. Coba baca dari folder backups/ jika ada
  if (fs.existsSync(backupsDir)) {
    const files = fs.readdirSync(backupsDir)
      .filter(f => f.endsWith('.json'))
      .sort((a, b) => b.localeCompare(a)); // sort descending

    if (files.length > 0) {
      const latestBackup = files[0];
      const backupPath = path.join(backupsDir, latestBackup);
      console.log(`[DATA SOURCE] Menggunakan file backup terbaru: ${backupPath}`);
      try {
        const fileContent = fs.readFileSync(backupPath, 'utf8');
        data = JSON.parse(fileContent);
      } catch (e) {
        console.warn(`[DATA SOURCE] Gagal membaca JSON dari ${backupPath}, akan fallback ke in-memory.`, e);
      }
    }
  }

  // 2. Fallback ke server/data.js (in-memory)
  if (!data) {
    console.log(`[DATA SOURCE] Tidak ada JSON valid, fallback ke ../server/data.js`);
    try {
      // Kita pakai require atau import secara dinamis
      const legacyModule = await import('../server/data.js');
      data = legacyModule.db;
    } catch (e) {
      console.error(`[DATA SOURCE] Gagal memuat fallback dari server/data.js!`, e);
      throw e;
    }
  }

  // Normalisasi bentuk data (memastikan array ada)
  return {
    areas: data.areas || [],
    users: data.users || [],
    outlets: data.outlets || [],
    skus: data.skus || [],
    inventory: data.inventory || [],
    transactions: data.transactions || [],
    transaction_items: data.transaction_items || data.transactionItems || [],
  };
}

async function runMigration() {
  console.log("===========================================");
  console.log("🚀 MEMULAI TOTAL MIGRATION (SCHEMA & DATA)");
  console.log("===========================================");

  try {
    // 1. Eksekusi DDL Migration (Table Creation)
    console.log("\n[1] Menjalankan Drizzle Migrations...");
    const migrationFolder = path.join(process.cwd(), 'drizzle');
    await migrate(sqlDb, { migrationsFolder: migrationFolder });
    console.log("✅ DDL Migration sukses!");

    // Ambil Data Sumber
    const legacyDb = await getMigrationData();

    // 2. Data Migration: Wilayah (Areas)
    console.log("\n[2] Migrasi Master Wilayah (Areas)...");
    await sqlDb.transaction(async (tx) => {
      for (const area of legacyDb.areas) {
        if (!area._id) continue;
        await tx.insert(schema.areas).values({
          id: String(area._id),
          name: String(area.name || 'Unknown'),
          regionId: area.region_id ? String(area.region_id) : null,
          createdAt: area.created_at || new Date().toISOString()
        }).onConflictDoUpdate({
          target: schema.areas.id,
          set: { 
            name: String(area.name || 'Unknown'), 
            regionId: area.region_id ? String(area.region_id) : null 
          }
        });
      }
    });

    // 3. Data Migration: Users (Salesmen & Admin)
    console.log("\n[3] Migrasi Master Users...");
    await sqlDb.transaction(async (tx) => {
      for (const user of legacyDb.users) {
        if (!user._id) continue;
        await tx.insert(schema.users).values({
          id: String(user._id),
          username: String(user.username || user._id),
          password: String(user.password || 'default_hash'), 
          name: String(user.name || 'Unknown'),
          role: (user.role as any) || 'SALES',
          phone: user.phone ? String(user.phone) : null,
          areaId: user.area_id ? String(user.area_id) : null,
          status: (user.status as any) || 'ACTIVE',
          createdAt: user.created_at || new Date().toISOString()
        }).onConflictDoUpdate({
          target: schema.users.id,
          set: { 
            name: String(user.name || 'Unknown'), 
            role: (user.role as any) || 'SALES', 
            phone: user.phone ? String(user.phone) : null, 
            status: (user.status as any) || 'ACTIVE' 
          }
        });
      }
    });

    // 4. Data Migration: Outlets
    console.log("\n[4] Migrasi Master Outlets...");
    await sqlDb.transaction(async (tx) => {
      for (const outlet of legacyDb.outlets) {
        if (!outlet._id) continue;
        await tx.insert(schema.outlets).values({
          id: String(outlet._id),
          outletCode: String(outlet.outlet_code || outlet._id),
          outletName: String(outlet.outlet_name || 'Unknown Outlet'),
          ownerName: outlet.owner_name ? String(outlet.owner_name) : null,
          phone: outlet.phone ? String(outlet.phone) : null,
          address: outlet.address ? String(outlet.address) : null,
          latitude: outlet.latitude != null ? String(outlet.latitude) : null,
          longitude: outlet.longitude != null ? String(outlet.longitude) : null,
          areaId: outlet.area_id ? String(outlet.area_id) : null,
          channelId: outlet.channel_id ? String(outlet.channel_id) : null,
          routeId: outlet.route_id ? String(outlet.route_id) : null,
          status: (outlet.status as any) || 'ACTIVE',
          imageUrl: outlet.image_url ? String(outlet.image_url) : null,
          metadata: { 
            lifecycle_status: outlet.lifecycle_status,
            total_revenue: outlet.total_revenue,
            total_volume: outlet.total_volume,
            completed_transaction_count: outlet.completed_transaction_count
          },
          createdAt: outlet.created_at || new Date().toISOString()
        }).onConflictDoUpdate({
          target: schema.outlets.id,
          set: {
            outletCode: String(outlet.outlet_code || outlet._id),
            outletName: String(outlet.outlet_name || 'Unknown Outlet'),
            status: (outlet.status as any) || 'ACTIVE',
            metadata: { 
              lifecycle_status: outlet.lifecycle_status,
              total_revenue: outlet.total_revenue,
              total_volume: outlet.total_volume,
              completed_transaction_count: outlet.completed_transaction_count
            }
          }
        });
      }
    });

    // 5. Data Migration: SKUs / Products
    console.log("\n[5] Migrasi Master SKU & Inventory...");
    await sqlDb.transaction(async (tx) => {
      for (const sku of legacyDb.skus) {
        if (!sku._id) continue;
        await tx.insert(schema.skus).values({
          id: String(sku._id),
          code: String(sku.code || sku._id),
          name: String(sku.name || 'Unknown SKU'),
          categoryId: sku.category_id ? String(sku.category_id) : null,
          brandId: sku.brand_id ? String(sku.brand_id) : null,
          price: Number(sku.price) || 0,
          unit: sku.unit ? String(sku.unit) : 'pcs',
          status: (sku.status as any) || 'ACTIVE'
        }).onConflictDoUpdate({
          target: schema.skus.id,
          set: { name: String(sku.name || 'Unknown SKU'), price: Number(sku.price) || 0, status: (sku.status as any) || 'ACTIVE' }
        });
      }
      
      // Stock Awal
      for (const inv of legacyDb.inventory) {
        if (!inv._id) continue;
        await tx.insert(schema.inventory).values({
          id: String(inv._id),
          skuId: String(inv.sku_id),
          locationType: 'WAREHOUSE',
          locationId: String(inv.warehouse_id || 'WH-MAIN'),
          stockOnHand: Number(inv.quantity) || 0,
          availableStock: Number(inv.quantity) || 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        } as any).onConflictDoUpdate({
          target: schema.inventory.id,
          set: { stockOnHand: Number(inv.quantity) || 0, availableStock: Number(inv.quantity) || 0, updatedAt: new Date().toISOString() }
        } as any);
      }
    });

    // 6. Sinkronisasi PostgreSQL Sequence
    console.log("\n[6] Sinkronisasi Sequences (Auto-increment PK)...");
    try {
      const syncSequenceSql = sql`
        DO $$
        DECLARE
            seq_record record;
            max_val bigint;
        BEGIN
            FOR seq_record IN 
                SELECT 
                    t.oid::regclass AS table_name,
                    a.attname AS column_name,
                    s.relname AS sequence_name
                FROM pg_class s
                JOIN pg_depend d ON d.objid = s.oid
                JOIN pg_class t ON d.refobjid = t.oid
                JOIN pg_attribute a ON a.attnum = d.refobjsubid AND a.attrelid = t.oid
                WHERE s.relkind = 'S'
            LOOP
                EXECUTE format('SELECT MAX(%I) FROM %I', seq_record.column_name, seq_record.table_name) INTO max_val;
                IF max_val IS NOT NULL THEN
                    EXECUTE format('SELECT setval(%L, %s)', seq_record.sequence_name, max_val);
                ELSE
                    EXECUTE format('SELECT setval(%L, 1, false)', seq_record.sequence_name);
                END IF;
            END LOOP;
        END;
        $$ LANGUAGE plpgsql;
      `;
      await sqlDb.execute(syncSequenceSql);
      console.log("✅ Sequence berhasil direset/sinkronisasi!");
    } catch (seqErr: any) {
      console.log("⚠️ Peringatan saat sinkronisasi sequence (Bisa diabaikan jika tabel tidak memakai tipe serial):", seqErr.message);
    }

    // 7. Integrity Check
    console.log("\n===========================================");
    console.log("📊 INTEGRITY CHECK (HASIL MIGRASI)");
    console.log("===========================================");
    const [areasCount] = await sqlDb.execute(sql`SELECT count(*) FROM areas`);
    const [usersCount] = await sqlDb.execute(sql`SELECT count(*) FROM users`);
    const [outletsCount] = await sqlDb.execute(sql`SELECT count(*) FROM outlets`);
    const [skusCount] = await sqlDb.execute(sql`SELECT count(*) FROM skus`);
    const [inventoryCount] = await sqlDb.execute(sql`SELECT count(*) FROM inventory`);
    
    console.log(`- Areas       : ${areasCount.count}`);
    console.log(`- Users       : ${usersCount.count}`);
    console.log(`- Outlets     : ${outletsCount.count}`);
    console.log(`- SKUs        : ${skusCount.count}`);
    console.log(`- Inventory   : ${inventoryCount.count}`);
    
    console.log("\n✅ SEMUA TAHAP MIGRASI BERHASIL!");
  } catch (err) {
    console.error("\n❌ MIGRASI GAGAL:", err);
  } finally {
    await pool.end();
  }
}

runMigration();
