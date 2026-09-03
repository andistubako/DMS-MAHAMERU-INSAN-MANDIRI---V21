import fs from 'fs';

let content = fs.readFileSync('server/routes.ts', 'utf8');

const injectionPoint = 'apiRouter.delete("/masters/:entity/:id", authMiddleware, requireRoles("ADMIN", "OWNER"), (req: AuthenticatedRequest, res) => {';

const newMastersDeleteRoutes = `
// --- EXPLICIT AREAS DELETE ---
apiRouter.delete("/masters/areas/:id", authMiddleware, requireRoles("ADMIN", "OWNER"), async (req: AuthenticatedRequest, res) => {
  try {
    const areaId = req.params.id;
    const exists = await sqlDb.query.areas.findFirst({ where: eq(pgAreas.id, areaId) });
    if (!exists) return res.status(404).json({ detail: "Area tidak ditemukan." });
    
    try {
      await sqlDb.delete(pgAreas).where(eq(pgAreas.id, areaId));
    } catch (err: any) {
      if (err.code === '23503') {
        return res.status(400).json({ detail: "Area tidak dapat dihapus karena masih digunakan oleh entitas lain (kantor/user/rute). Silakan nonaktifkan area ini." });
      }
      throw err;
    }
    
    const idx = db.areas.findIndex((a) => a._id === areaId);
    if (idx !== -1) db.areas.splice(idx, 1);
    deleteSingleDoc("areas", areaId).catch(() => {});
    
    recordAuditLog(
      req.user!._id || req.user!.id!,
      "DELETE_AREA",
      "areas",
      areaId,
      { name: exists.areaName }
    );
    
    res.json({ message: "Area berhasil dihapus.", _id: areaId });
  } catch (err: any) {
    res.status(500).json({ detail: err.message });
  }
});

// --- EXPLICIT CHANNELS DELETE ---
apiRouter.delete("/masters/channels/:id", authMiddleware, requireRoles("ADMIN", "OWNER"), async (req: AuthenticatedRequest, res) => {
  try {
    const channelId = req.params.id;
    const exists = await sqlDb.query.channels.findFirst({ where: eq(pgChannels.id, channelId) });
    if (!exists) return res.status(404).json({ detail: "Channel tidak ditemukan." });
    
    try {
      await sqlDb.delete(pgChannels).where(eq(pgChannels.id, channelId));
    } catch (err: any) {
      if (err.code === '23503') {
        return res.status(400).json({ detail: "Channel tidak dapat dihapus karena masih digunakan oleh entitas lain (outlet). Silakan nonaktifkan channel ini." });
      }
      throw err;
    }
    
    const idx = db.channels.findIndex((c) => c._id === channelId);
    if (idx !== -1) db.channels.splice(idx, 1);
    deleteSingleDoc("channels", channelId).catch(() => {});
    
    recordAuditLog(
      req.user!._id || req.user!.id!,
      "DELETE_CHANNEL",
      "channels",
      channelId,
      { name: exists.channelName }
    );
    
    res.json({ message: "Channel berhasil dihapus.", _id: channelId });
  } catch (err: any) {
    res.status(500).json({ detail: err.message });
  }
});

apiRouter.delete("/masters/:entity/:id", authMiddleware, requireRoles("ADMIN", "OWNER"), (req: AuthenticatedRequest, res) => {`;

content = content.replace(injectionPoint, newMastersDeleteRoutes);
fs.writeFileSync('server/routes.ts', content);
console.log('masters DELETE endpoints patched');
