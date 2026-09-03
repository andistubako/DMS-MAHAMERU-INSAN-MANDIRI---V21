import fs from 'fs';

let content = fs.readFileSync('server/cloudsqlSync.ts', 'utf8');

const injectionPoint = '      // OVERWRITE settings, companyProfile FROM POSTGRES RELATIONAL TABLES (Phase 1.5)';

const newSync = `
      // OVERWRITE products, skus FROM POSTGRES RELATIONAL TABLES (Phase 1.6)
      console.log("[Cloud SQL] Overwriting 'products', 'skus' from relational tables...");
      
      const productsRes = await client.query("SELECT * FROM products");
      targetDb.products = productsRes.rows.map((p: any) => ({
        _id: p.id,
        id: p.id,
        name: p.product_name,
        product_code: p.product_code,
        category: p.category,
        brand: p.brand,
        status: p.status,
        metadata: p.metadata,
        created_at: p.created_at ? new Date(p.created_at).toISOString() : new Date().toISOString()
      }));

      const skusRes = await client.query("SELECT * FROM skus");
      targetDb.skus = skusRes.rows.map((s: any) => ({
        _id: s.id,
        id: s.id,
        product_id: s.product_id,
        name: s.sku_name,
        sku_code: s.sku_code,
        barcode: s.barcode,
        uom: s.uom,
        pack_size: s.pack_size,
        base_price: s.base_price,
        status: s.status,
        image_url: s.image_url,
        metadata: s.metadata,
        created_at: s.created_at ? new Date(s.created_at).toISOString() : new Date().toISOString()
      }));
      
      console.log(\`[Cloud SQL] Overwritten \${targetDb.products.length} products, \${targetDb.skus.length} skus.\`);

`;

content = content.replace(injectionPoint, newSync + injectionPoint);

fs.writeFileSync('server/cloudsqlSync.ts', content);
console.log('Patched cloudsqlSync.ts');
