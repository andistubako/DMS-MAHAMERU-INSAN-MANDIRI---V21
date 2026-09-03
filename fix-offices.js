import fs from 'fs';

let content = fs.readFileSync('server/routes.ts', 'utf8');

const getOfficesIndex = content.indexOf('apiRouter.get("/offices"');
const endOfficesIndex = content.indexOf('apiRouter.get("/users"', getOfficesIndex);

const newOfficesRoutes = `
// Offices
apiRouter.get("/offices", authMiddleware, async (req, res) => {
  try {
    const offices = await sqlDb.query.offices.findMany({
      orderBy: (offices, { asc }) => [asc(offices.officeName)],
    });
    const items = offices.map(o => ({
      _id: o.id,
      id: o.id,
      office_name: o.officeName,
      office_code: o.officeCode,
      address: o.address,
      phone: o.phone,
      latitude: o.latitude,
      longitude: o.longitude,
      radius_m: o.radiusMeters,
      status: o.status,
      created_at: o.createdAt?.toISOString(),
    }));
    res.json({ items, total: items.length });
  } catch (err: any) {
    res.status(500).json({ detail: err.message });
  }
});

apiRouter.post("/offices", authMiddleware, requireRoles("ADMIN", "OWNER"), async (req, res) => {
  try {
    const newId = \`off-\${Date.now()}\`;
    const newOffice = {
      id: newId,
      officeName: req.body.office_name || "New Office",
      officeCode: req.body.office_code || null,
      address: req.body.address || null,
      phone: req.body.phone || null,
      latitude: req.body.latitude || null,
      longitude: req.body.longitude || null,
      radiusMeters: req.body.radius_m || 200,
      status: req.body.status || "ACTIVE",
    };
    await sqlDb.insert(schema.offices).values(newOffice);
    
    // In-memory sync for backward compatibility
    const memOffice = {
      _id: newOffice.id,
      office_name: newOffice.officeName,
      office_code: newOffice.officeCode,
      address: newOffice.address,
      phone: newOffice.phone,
      latitude: newOffice.latitude,
      longitude: newOffice.longitude,
      radius_m: newOffice.radiusMeters,
      status: newOffice.status,
      created_at: new Date().toISOString()
    };
    db.offices.push(memOffice);
    syncSingleDoc("offices", memOffice._id, memOffice).catch(() => {});
    
    res.status(201).json(memOffice);
  } catch (err: any) {
    res.status(500).json({ detail: err.message });
  }
});

apiRouter.put("/offices/:id", authMiddleware, requireRoles("ADMIN", "OWNER"), async (req, res) => {
  try {
    const officeId = req.params.id;
    const exists = await sqlDb.query.offices.findFirst({ where: eq(schema.offices.id, officeId) });
    if (!exists) return res.status(404).json({ detail: "Kantor tidak ditemukan." });
    
    const updates: any = {};
    if (req.body.office_name) updates.officeName = req.body.office_name;
    if (req.body.office_code !== undefined) updates.officeCode = req.body.office_code;
    if (req.body.address !== undefined) updates.address = req.body.address;
    if (req.body.phone !== undefined) updates.phone = req.body.phone;
    if (req.body.latitude !== undefined) updates.latitude = req.body.latitude;
    if (req.body.longitude !== undefined) updates.longitude = req.body.longitude;
    if (req.body.radius_m !== undefined) updates.radiusMeters = req.body.radius_m;
    if (req.body.status !== undefined) updates.status = req.body.status;
    
    await sqlDb.update(schema.offices).set(updates).where(eq(schema.offices.id, officeId));
    
    // In-memory sync
    const memOffice = db.offices.find(o => o._id === officeId);
    if (memOffice) {
      Object.assign(memOffice, req.body);
      syncSingleDoc("offices", memOffice._id, memOffice).catch(() => {});
    }
    
    res.json({ ...memOffice, ...req.body, _id: officeId });
  } catch (err: any) {
    res.status(500).json({ detail: err.message });
  }
});

apiRouter.post("/offices/:id/toggle", authMiddleware, requireRoles("ADMIN", "OWNER"), async (req, res) => {
  try {
    const officeId = req.params.id;
    const office = await sqlDb.query.offices.findFirst({ where: eq(schema.offices.id, officeId) });
    if (!office) return res.status(404).json({ detail: "Kantor tidak ditemukan." });
    
    const newStatus = office.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    await sqlDb.update(schema.offices).set({ status: newStatus }).where(eq(schema.offices.id, officeId));
    
    const memOffice = db.offices.find(o => o._id === officeId);
    if (memOffice) {
      memOffice.status = newStatus as any;
      syncSingleDoc("offices", memOffice._id, memOffice).catch(() => {});
    }
    
    res.json(memOffice || { _id: officeId, status: newStatus });
  } catch (err: any) {
    res.status(500).json({ detail: err.message });
  }
});

apiRouter.delete("/offices/:id", authMiddleware, requireRoles("ADMIN", "OWNER"), async (req: AuthenticatedRequest, res) => {
  try {
    const officeId = req.params.id;
    const exists = await sqlDb.query.offices.findFirst({ where: eq(schema.offices.id, officeId) });
    if (!exists) return res.status(404).json({ detail: "Kantor tidak ditemukan." });
    
    try {
      await sqlDb.delete(schema.offices).where(eq(schema.offices.id, officeId));
    } catch (err: any) {
      if (err.code === '23503') {
        return res.status(400).json({ detail: "Kantor tidak dapat dihapus karena masih digunakan oleh entitas lain. Silakan nonaktifkan kantor ini." });
      }
      throw err;
    }
    
    const idx = db.offices.findIndex((o) => o._id === officeId);
    if (idx !== -1) db.offices.splice(idx, 1);
    deleteSingleDoc("offices", officeId).catch(() => {});
    
    recordAuditLog(
      req.user!._id || req.user!.id!,
      "DELETE_OFFICE",
      "offices",
      officeId,
      { name: exists.officeName }
    );
    
    res.json({ message: "Kantor berhasil dihapus.", _id: officeId });
  } catch (err: any) {
    res.status(500).json({ detail: err.message });
  }
});

`;

content = content.substring(0, getOfficesIndex) + newOfficesRoutes + content.substring(endOfficesIndex);
fs.writeFileSync('server/routes.ts', content);
console.log('Offices endpoints patched');

