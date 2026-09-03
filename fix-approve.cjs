const fs = require('fs');
let file = fs.readFileSync('server/routes.ts', 'utf8');

const regexApprove = /apiRouter\.post\("\/outlets\/:id\/approve", authMiddleware, requireRoles\("SUPERVISOR", "ADMIN", "OWNER"\), \(req: AuthenticatedRequest, res\) => \{[\s\S]*?res\.json\(\{[\s\S]*?\}\);\n\}\);/;
const replacementApprove = `apiRouter.post("/outlets/:id/approve", authMiddleware, requireRoles("SUPERVISOR", "ADMIN", "OWNER"), async (req: AuthenticatedRequest, res) => {
  const outlet = db.outlets.find((o) => o._id === req.params.id);
  if (!outlet) return res.status(404).json({ detail: "Outlet tidak ditemukan." });

  try {
    const pgRec = await sqlDb.query.outlets.findFirst({ where: eq(pgOutlets.id, outlet._id) });
    const meta = pgRec ? ((pgRec.metadata as Record<string, any>) || {}) : {};
    meta.lifecycle_status = "NOO";
    meta.approved_by = req.user!._id;
    meta.approved_at = new Date().toISOString();
    
    await sqlDb.update(pgOutlets).set({ status: "ACTIVE", metadata: meta }).where(eq(pgOutlets.id, outlet._id));
    
    outlet.status = "ACTIVE";
    outlet.lifecycle_status = "NOO";
    (outlet as any).approved_by = req.user!._id;
    (outlet as any).approved_at = new Date().toISOString();
    
    recordAuditLog(req.user!._id, "APPROVE_OUTLET_NOO", "outlets", outlet._id, { notes: "Outlet disetujui dan aktif (NOO)." });
    syncSingleDoc("outlets", outlet._id, outlet).catch(() => {});
    
    res.json({ message: \`Outlet "\${outlet.outlet_name}" (\${outlet.outlet_code}) berhasil disetujui.\`, outlet });
  } catch(e) {
    res.status(500).json({ detail: "Gagal menyetujui outlet." });
  }
});`;

if (regexApprove.test(file)) {
  file = file.replace(regexApprove, replacementApprove);
  console.log("Replaced /outlets/:id/approve");
}

const regexReject = /apiRouter\.post\("\/outlets\/:id\/reject", authMiddleware, requireRoles\("SUPERVISOR", "ADMIN", "OWNER"\), \(req: AuthenticatedRequest, res\) => \{[\s\S]*?res\.json\(\{[\s\S]*?\}\);\n\}\);/g;
const replacementReject = `apiRouter.post("/outlets/:id/reject", authMiddleware, requireRoles("SUPERVISOR", "ADMIN", "OWNER"), async (req: AuthenticatedRequest, res) => {
  const outlet = db.outlets.find((o) => o._id === req.params.id);
  if (!outlet) return res.status(404).json({ detail: "Outlet tidak ditemukan." });

  const reason = (req.body.reason || "Ditolak oleh supervisor/admin").trim();

  try {
    await sqlDb.update(pgOutlets).set({ status: "ARCHIVED" }).where(eq(pgOutlets.id, outlet._id));
    
    outlet.status = "ARCHIVED";
    
    recordAuditLog(req.user!._id, "REJECT_OUTLET", "outlets", outlet._id, { reason });
    syncSingleDoc("outlets", outlet._id, outlet).catch(() => {});
    
    res.json({ message: \`Pengajuan outlet "\${outlet.outlet_name}" (\${outlet.outlet_code}) ditolak.\`, outlet });
  } catch(e) {
    res.status(500).json({ detail: "Gagal menolak pengajuan outlet." });
  }
});`;

if (regexReject.test(file)) {
  file = file.replace(regexReject, replacementReject);
  console.log("Replaced /outlets/:id/reject");
}

fs.writeFileSync('server/routes.ts', file);
