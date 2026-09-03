import fs from 'fs';

let content = fs.readFileSync('server/routes.ts', 'utf8');

const injectionPoint = 'apiRouter.get("/masters/:entity", authMiddleware, (req, res) => {';

const newRoutes = `
// ================= PRODUCTS & SKUS =================
apiRouter.get("/masters/products", authMiddleware, async (req, res) => {
  try {
    const products = await sqlDb.query.products.findMany({
      orderBy: (products, { asc }) => [asc(products.productName)],
    });
    const items = products.map((p: any) => ({
      _id: p.id,
      id: p.id,
      name: p.productName,
      product_code: p.productCode,
      category: p.category,
      brand: p.brand,
      status: p.status,
      metadata: p.metadata,
      created_at: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString()
    }));
    res.json({ items, total: items.length });
  } catch (err: any) {
    res.status(500).json({ detail: err.message });
  }
});

apiRouter.post("/masters/products", authMiddleware, requireRoles("ADMIN", "OWNER"), async (req: AuthenticatedRequest, res) => {
  try {
    const newId = \`prd-\${Date.now()}\`;
    const newProduct = {
      id: newId,
      productName: req.body.name || "New Product",
      productCode: req.body.product_code || null,
      category: req.body.category || null,
      brand: req.body.brand || null,
      status: req.body.status || "ACTIVE",
      createdAt: new Date(),
      metadata: req.body.metadata || {}
    };

    await sqlDb.insert(pgProducts).values(newProduct);
    
    // Sync memory
    const memItem = {
      _id: newProduct.id,
      id: newProduct.id,
      name: newProduct.productName,
      product_code: newProduct.productCode,
      category: newProduct.category,
      brand: newProduct.brand,
      status: newProduct.status,
      metadata: newProduct.metadata,
      created_at: newProduct.createdAt.toISOString()
    };
    db.products.push(memItem);
    syncSingleDoc("products", newId, memItem).catch(() => {});
    
    recordAuditLog(req.user!._id || req.user!.id!, "CREATE_PRODUCT", "products", newId, { name: newProduct.productName });
    res.status(201).json(memItem);
  } catch (err: any) {
    res.status(500).json({ detail: err.message });
  }
});

apiRouter.put("/masters/products/:id", authMiddleware, requireRoles("ADMIN", "OWNER"), async (req: AuthenticatedRequest, res) => {
  try {
    const targetId = req.params.id;
    const updates = {
      productName: req.body.name,
      productCode: req.body.product_code,
      category: req.body.category,
      brand: req.body.brand,
      status: req.body.status,
      metadata: req.body.metadata
    };
    
    // Remove undefined
    Object.keys(updates).forEach(key => updates[key as keyof typeof updates] === undefined && delete updates[key as keyof typeof updates]);

    await sqlDb.update(pgProducts).set(updates).where(eq(pgProducts.id, targetId));
    
    // Sync memory
    const idx = db.products.findIndex((p) => p._id === targetId);
    if (idx !== -1) {
      db.products[idx] = { ...db.products[idx], ...req.body, _id: targetId, id: targetId };
      syncSingleDoc("products", targetId, db.products[idx]).catch(() => {});
    }
    
    recordAuditLog(req.user!._id || req.user!.id!, "UPDATE_PRODUCT", "products", targetId, updates);
    res.json({ message: "Produk diperbarui", _id: targetId });
  } catch (err: any) {
    res.status(500).json({ detail: err.message });
  }
});

apiRouter.post("/masters/products/:id/toggle", authMiddleware, requireRoles("ADMIN", "OWNER"), async (req: AuthenticatedRequest, res) => {
  try {
    const targetId = req.params.id;
    const product = await sqlDb.query.products.findFirst({ where: eq(pgProducts.id, targetId) });
    if (!product) return res.status(404).json({ detail: "Produk tidak ditemukan." });
    
    const newStatus = product.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    await sqlDb.update(pgProducts).set({ status: newStatus }).where(eq(pgProducts.id, targetId));
    
    // Sync memory
    const idx = db.products.findIndex((p) => p._id === targetId);
    if (idx !== -1) {
      db.products[idx].status = newStatus;
      syncSingleDoc("products", targetId, db.products[idx]).catch(() => {});
    }
    
    recordAuditLog(req.user!._id || req.user!.id!, "TOGGLE_PRODUCT_STATUS", "products", targetId, { status: newStatus });
    res.json({ message: "Status produk diubah", _id: targetId, status: newStatus });
  } catch (err: any) {
    res.status(500).json({ detail: err.message });
  }
});

apiRouter.delete("/masters/products/:id", authMiddleware, requireRoles("ADMIN", "OWNER"), async (req: AuthenticatedRequest, res) => {
  try {
    const targetId = req.params.id;
    await sqlDb.delete(pgProducts).where(eq(pgProducts.id, targetId));
    
    // Sync memory
    const idx = db.products.findIndex((p) => p._id === targetId);
    if (idx !== -1) {
      db.products.splice(idx, 1);
      deleteSingleDoc("products", targetId);
    }
    
    recordAuditLog(req.user!._id || req.user!.id!, "DELETE_PRODUCT", "products", targetId, {});
    res.json({ message: "Produk dihapus", _id: targetId });
  } catch (err: any) {
    if (err.code === "23503") {
      return res.status(400).json({ detail: "Produk tidak dapat dihapus karena masih digunakan (terhubung ke SKU). Silakan nonaktifkan (toggle status) produk ini." });
    }
    res.status(500).json({ detail: err.message });
  }
});

// -- SKUS
apiRouter.get("/masters/skus", authMiddleware, async (req, res) => {
  try {
    const skus = await sqlDb.query.skus.findMany({
      orderBy: (skus, { asc }) => [asc(skus.skuName)],
    });
    const items = skus.map((s: any) => ({
      _id: s.id,
      id: s.id,
      product_id: s.productId,
      name: s.skuName,
      sku_code: s.skuCode,
      barcode: s.barcode,
      uom: s.uom,
      pack_size: s.packSize,
      base_price: s.basePrice,
      status: s.status,
      image_url: s.imageUrl,
      metadata: s.metadata,
      created_at: s.createdAt ? new Date(s.createdAt).toISOString() : new Date().toISOString()
    }));
    res.json({ items, total: items.length });
  } catch (err: any) {
    res.status(500).json({ detail: err.message });
  }
});

apiRouter.post("/masters/skus", authMiddleware, requireRoles("ADMIN", "OWNER"), async (req: AuthenticatedRequest, res) => {
  try {
    const newId = \`sku-\${Date.now()}\`;
    const newSku = {
      id: newId,
      productId: req.body.product_id || null,
      skuName: req.body.name || "New SKU",
      skuCode: req.body.sku_code,
      barcode: req.body.barcode || null,
      uom: req.body.uom || "PCS",
      packSize: req.body.pack_size || 1,
      basePrice: req.body.base_price || 0,
      status: req.body.status || "ACTIVE",
      imageUrl: req.body.image_url || null,
      createdAt: new Date(),
      metadata: req.body.metadata || {}
    };

    if (!newSku.skuCode) {
      return res.status(400).json({ detail: "Kode SKU wajib diisi." });
    }

    await sqlDb.insert(pgSkus).values(newSku);
    
    // Sync memory
    const memItem = {
      _id: newSku.id,
      id: newSku.id,
      product_id: newSku.productId,
      name: newSku.skuName,
      sku_code: newSku.skuCode,
      barcode: newSku.barcode,
      uom: newSku.uom,
      pack_size: newSku.packSize,
      base_price: newSku.basePrice,
      status: newSku.status,
      image_url: newSku.imageUrl,
      metadata: newSku.metadata,
      created_at: newSku.createdAt.toISOString()
    };
    db.skus.push(memItem);
    syncSingleDoc("skus", newId, memItem).catch(() => {});
    
    recordAuditLog(req.user!._id || req.user!.id!, "CREATE_SKU", "skus", newId, { name: newSku.skuName });
    res.status(201).json(memItem);
  } catch (err: any) {
    if (err.code === "23505") { // unique violation
      return res.status(400).json({ detail: "Kode SKU sudah digunakan. Silakan gunakan kode unik." });
    }
    res.status(500).json({ detail: err.message });
  }
});

apiRouter.put("/masters/skus/:id", authMiddleware, requireRoles("ADMIN", "OWNER"), async (req: AuthenticatedRequest, res) => {
  try {
    const targetId = req.params.id;
    const updates = {
      productId: req.body.product_id,
      skuName: req.body.name,
      skuCode: req.body.sku_code,
      barcode: req.body.barcode,
      uom: req.body.uom,
      packSize: req.body.pack_size,
      basePrice: req.body.base_price,
      status: req.body.status,
      imageUrl: req.body.image_url,
      metadata: req.body.metadata
    };
    
    // Remove undefined
    Object.keys(updates).forEach(key => updates[key as keyof typeof updates] === undefined && delete updates[key as keyof typeof updates]);

    await sqlDb.update(pgSkus).set(updates).where(eq(pgSkus.id, targetId));
    
    // Sync memory
    const idx = db.skus.findIndex((s) => s._id === targetId);
    if (idx !== -1) {
      db.skus[idx] = { ...db.skus[idx], ...req.body, _id: targetId, id: targetId };
      syncSingleDoc("skus", targetId, db.skus[idx]).catch(() => {});
    }
    
    recordAuditLog(req.user!._id || req.user!.id!, "UPDATE_SKU", "skus", targetId, updates);
    res.json({ message: "SKU diperbarui", _id: targetId });
  } catch (err: any) {
    if (err.code === "23505") { // unique violation
      return res.status(400).json({ detail: "Kode SKU sudah digunakan. Silakan gunakan kode unik." });
    }
    res.status(500).json({ detail: err.message });
  }
});

apiRouter.post("/masters/skus/:id/toggle", authMiddleware, requireRoles("ADMIN", "OWNER"), async (req: AuthenticatedRequest, res) => {
  try {
    const targetId = req.params.id;
    const sku = await sqlDb.query.skus.findFirst({ where: eq(pgSkus.id, targetId) });
    if (!sku) return res.status(404).json({ detail: "SKU tidak ditemukan." });
    
    const newStatus = sku.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    await sqlDb.update(pgSkus).set({ status: newStatus }).where(eq(pgSkus.id, targetId));
    
    // Sync memory
    const idx = db.skus.findIndex((s) => s._id === targetId);
    if (idx !== -1) {
      db.skus[idx].status = newStatus;
      syncSingleDoc("skus", targetId, db.skus[idx]).catch(() => {});
    }
    
    recordAuditLog(req.user!._id || req.user!.id!, "TOGGLE_SKU_STATUS", "skus", targetId, { status: newStatus });
    res.json({ message: "Status SKU diubah", _id: targetId, status: newStatus });
  } catch (err: any) {
    res.status(500).json({ detail: err.message });
  }
});

apiRouter.delete("/masters/skus/:id", authMiddleware, requireRoles("ADMIN", "OWNER"), async (req: AuthenticatedRequest, res) => {
  try {
    const targetId = req.params.id;
    await sqlDb.delete(pgSkus).where(eq(pgSkus.id, targetId));
    
    // Sync memory
    const idx = db.skus.findIndex((s) => s._id === targetId);
    if (idx !== -1) {
      db.skus.splice(idx, 1);
      deleteSingleDoc("skus", targetId);
    }
    
    recordAuditLog(req.user!._id || req.user!.id!, "DELETE_SKU", "skus", targetId, {});
    res.json({ message: "SKU dihapus", _id: targetId });
  } catch (err: any) {
    if (err.code === "23503") {
      return res.status(400).json({ detail: "SKU tidak dapat dihapus karena masih memiliki data transaksi/inventory. Silakan nonaktifkan (toggle status) SKU ini." });
    }
    res.status(500).json({ detail: err.message });
  }
});

// Also overwrite the global ones
apiRouter.get("/products", authMiddleware, async (req, res) => {
  try {
    const products = await sqlDb.query.products.findMany({
      orderBy: (products, { asc }) => [asc(products.productName)],
    });
    const items = products.map((p: any) => ({
      _id: p.id, id: p.id, name: p.productName, product_code: p.productCode, category: p.category, brand: p.brand, status: p.status, metadata: p.metadata, created_at: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString()
    }));
    res.json({ items, total: items.length });
  } catch (err: any) {
    res.status(500).json({ detail: err.message });
  }
});

apiRouter.get("/skus", authMiddleware, async (req, res) => {
  try {
    const skus = await sqlDb.query.skus.findMany({
      orderBy: (skus, { asc }) => [asc(skus.skuName)],
    });
    const items = skus.map((s: any) => ({
      _id: s.id, id: s.id, product_id: s.productId, name: s.skuName, sku_code: s.skuCode, barcode: s.barcode, uom: s.uom, pack_size: s.packSize, base_price: s.basePrice, status: s.status, image_url: s.imageUrl, metadata: s.metadata, created_at: s.createdAt ? new Date(s.createdAt).toISOString() : new Date().toISOString()
    }));
    res.json({ items, total: items.length });
  } catch (err: any) {
    res.status(500).json({ detail: err.message });
  }
});

`;

content = content.replace(injectionPoint, newRoutes + injectionPoint);

// Add imports
if (!content.includes('pgProducts')) {
  content = content.replace('areas as pgAreas,', 'products as pgProducts,\n  skus as pgSkus,\n  areas as pgAreas,');
}

// Remove old generic /products and /skus overrides
content = content.replace(/apiRouter\.get\("\/products", authMiddleware, \(req, res\) => \{\s+res\.json\(\{ items: db\.products, total: db\.products\.length \}\);\s+\}\);/g, '');
content = content.replace(/apiRouter\.get\("\/skus", authMiddleware, \(req, res\) => \{\s+res\.json\(\{ items: db\.skus, total: db\.skus\.length \}\);\s+\}\);/g, '');


fs.writeFileSync('server/routes.ts', content);
console.log('Patched routes.ts');
