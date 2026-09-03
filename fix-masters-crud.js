import fs from 'fs';

let content = fs.readFileSync('server/routes.ts', 'utf8');

const injectionPoint = 'apiRouter.post("/masters/:entity", authMiddleware, requireRoles("ADMIN", "OWNER"), (req, res) => {';

const newMastersRoutes = `
// --- EXPLICIT AREAS CRUD ---
apiRouter.post("/masters/areas", authMiddleware, requireRoles("ADMIN", "OWNER"), async (req, res) => {
  try {
    const newId = \`area-\${Date.now()}\`;
    const newArea = {
      id: newId,
      areaName: req.body.name || "New Area",
      areaCode: req.body.area_code || null,
      officeId: req.body.office_id || null,
      regencyId: req.body.regency_id || null,
      status: req.body.status || "ACTIVE",
    };
    await sqlDb.insert(schema.areas).values(newArea);
    
    const memArea = {
      _id: newId,
      name: newArea.areaName,
      area_code: newArea.areaCode,
      office_id: newArea.officeId,
      regency_id: newArea.regencyId,
      status: newArea.status,
      created_at: new Date().toISOString()
    };
    db.areas.push(memArea);
    syncSingleDoc("areas", memArea._id, memArea).catch(() => {});
    
    res.status(201).json(memArea);
  } catch (err: any) {
    res.status(500).json({ detail: err.message });
  }
});

apiRouter.put("/masters/areas/:id", authMiddleware, requireRoles("ADMIN", "OWNER"), async (req, res) => {
  try {
    const areaId = req.params.id;
    const exists = await sqlDb.query.areas.findFirst({ where: eq(schema.areas.id, areaId) });
    if (!exists) return res.status(404).json({ detail: "Area tidak ditemukan." });
    
    const updates: any = {};
    if (req.body.name) updates.areaName = req.body.name;
    if (req.body.area_code !== undefined) updates.areaCode = req.body.area_code;
    if (req.body.office_id !== undefined) updates.officeId = req.body.office_id;
    if (req.body.regency_id !== undefined) updates.regencyId = req.body.regency_id;
    if (req.body.status !== undefined) updates.status = req.body.status;
    
    await sqlDb.update(schema.areas).set(updates).where(eq(schema.areas.id, areaId));
    
    const memArea = db.areas.find(a => a._id === areaId);
    if (memArea) {
      Object.assign(memArea, req.body);
      syncSingleDoc("areas", memArea._id, memArea).catch(() => {});
    }
    
    res.json({ ...memArea, ...req.body, _id: areaId });
  } catch (err: any) {
    res.status(500).json({ detail: err.message });
  }
});

apiRouter.post("/masters/areas/:id/toggle", authMiddleware, requireRoles("ADMIN", "OWNER"), async (req, res) => {
  try {
    const areaId = req.params.id;
    const exists = await sqlDb.query.areas.findFirst({ where: eq(schema.areas.id, areaId) });
    if (!exists) return res.status(404).json({ detail: "Area tidak ditemukan." });
    
    const newStatus = exists.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    await sqlDb.update(schema.areas).set({ status: newStatus }).where(eq(schema.areas.id, areaId));
    
    const memArea = db.areas.find(a => a._id === areaId);
    if (memArea) {
      memArea.status = newStatus as any;
      syncSingleDoc("areas", memArea._id, memArea).catch(() => {});
    }
    
    res.json(memArea || { _id: areaId, status: newStatus });
  } catch (err: any) {
    res.status(500).json({ detail: err.message });
  }
});

// --- EXPLICIT CHANNELS CRUD ---
apiRouter.post("/masters/channels", authMiddleware, requireRoles("ADMIN", "OWNER"), async (req, res) => {
  try {
    const newId = \`cha-\${Date.now()}\`;
    const newChannel = {
      id: newId,
      channelName: req.body.name || "New Channel",
      channelCode: req.body.channel_code || null,
      status: req.body.status || "ACTIVE",
    };
    await sqlDb.insert(schema.channels).values(newChannel);
    
    const memChannel = {
      _id: newId,
      name: newChannel.channelName,
      channel_code: newChannel.channelCode,
      status: newChannel.status,
      created_at: new Date().toISOString()
    };
    db.channels.push(memChannel);
    syncSingleDoc("channels", memChannel._id, memChannel).catch(() => {});
    
    res.status(201).json(memChannel);
  } catch (err: any) {
    res.status(500).json({ detail: err.message });
  }
});

apiRouter.put("/masters/channels/:id", authMiddleware, requireRoles("ADMIN", "OWNER"), async (req, res) => {
  try {
    const channelId = req.params.id;
    const exists = await sqlDb.query.channels.findFirst({ where: eq(schema.channels.id, channelId) });
    if (!exists) return res.status(404).json({ detail: "Channel tidak ditemukan." });
    
    const updates: any = {};
    if (req.body.name) updates.channelName = req.body.name;
    if (req.body.channel_code !== undefined) updates.channelCode = req.body.channel_code;
    if (req.body.status !== undefined) updates.status = req.body.status;
    
    await sqlDb.update(schema.channels).set(updates).where(eq(schema.channels.id, channelId));
    
    const memChannel = db.channels.find(c => c._id === channelId);
    if (memChannel) {
      Object.assign(memChannel, req.body);
      syncSingleDoc("channels", memChannel._id, memChannel).catch(() => {});
    }
    
    res.json({ ...memChannel, ...req.body, _id: channelId });
  } catch (err: any) {
    res.status(500).json({ detail: err.message });
  }
});

apiRouter.post("/masters/channels/:id/toggle", authMiddleware, requireRoles("ADMIN", "OWNER"), async (req, res) => {
  try {
    const channelId = req.params.id;
    const exists = await sqlDb.query.channels.findFirst({ where: eq(schema.channels.id, channelId) });
    if (!exists) return res.status(404).json({ detail: "Channel tidak ditemukan." });
    
    const newStatus = exists.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    await sqlDb.update(schema.channels).set({ status: newStatus }).where(eq(schema.channels.id, channelId));
    
    const memChannel = db.channels.find(c => c._id === channelId);
    if (memChannel) {
      memChannel.status = newStatus as any;
      syncSingleDoc("channels", memChannel._id, memChannel).catch(() => {});
    }
    
    res.json(memChannel || { _id: channelId, status: newStatus });
  } catch (err: any) {
    res.status(500).json({ detail: err.message });
  }
});

apiRouter.post("/masters/:entity", authMiddleware, requireRoles("ADMIN", "OWNER"), (req, res) => {`;

content = content.replace(injectionPoint, newMastersRoutes);
fs.writeFileSync('server/routes.ts', content);
console.log('masters CRUD endpoints patched');
