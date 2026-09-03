const fs = require('fs');
let file = fs.readFileSync('server/cloudsqlSync.ts', 'utf8');

const replacement = `
      console.log(\`[Cloud SQL] Overwritten \${targetDb.products.length} products, \${targetDb.skus.length} skus.\`);

      // OVERWRITE outlets FROM POSTGRES RELATIONAL TABLES (Phase 1.7)
      console.log("[Cloud SQL] Overwriting 'outlets' from relational tables...");
      const outletsRes = await client.query("SELECT * FROM outlets");
      targetDb.outlets = outletsRes.rows.map((o: any) => {
        const meta = o.metadata || {};
        return {
          _id: o.id,
          id: o.id,
          outlet_code: o.outlet_code,
          outlet_name: o.outlet_name,
          owner_name: o.owner_name || meta.owner_name,
          phone: o.phone || meta.phone,
          address: o.address || meta.address,
          address_line: meta.address_line,
          address_detail: meta.address_detail,
          province_id: meta.province_id,
          province_name: meta.province_name,
          regency_id: meta.regency_id,
          regency_name: meta.regency_name,
          district_id: meta.district_id,
          district_name: meta.district_name,
          village_id: meta.village_id,
          village_name: meta.village_name,
          postal_code: meta.postal_code,
          latitude: o.latitude,
          longitude: o.longitude,
          area_id: o.area_id,
          channel_id: o.channel_id,
          route_id: o.route_id,
          status: o.status,
          lifecycle_status: meta.lifecycle_status || "PROSPECT",
          completed_transaction_count: meta.completed_transaction_count || 0,
          total_volume: meta.total_volume || 0,
          total_revenue: meta.total_revenue || 0,
          credit_limit: meta.credit_limit || 0,
          payment_term_days: meta.payment_term_days || 0,
          photo_url: o.image_url,
          notes: o.notes,
          created_by: meta.created_by,
          created_at: o.created_at ? new Date(o.created_at).toISOString() : new Date().toISOString()
        };
      });
      console.log(\`[Cloud SQL] Overwritten \${targetDb.outlets.length} outlets.\`);
`;

file = file.replace(/console\.log\(\`\[Cloud SQL\] Overwritten \$\{targetDb\.products\.length\} products, \$\{targetDb\.skus\.length\} skus\.\`\);/, replacement);

fs.writeFileSync('server/cloudsqlSync.ts', file);
