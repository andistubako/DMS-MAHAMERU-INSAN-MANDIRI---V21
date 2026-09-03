const fs = require('fs');
let file = fs.readFileSync('server/routes.ts', 'utf8');

const regexApprove = /apiRouter\.post\("\/outlets\/:id\/approve", authMiddleware, requireRoles\("SUPERVISOR", "ADMIN", "OWNER"\), async \(req: AuthenticatedRequest, res\) => \{[\s\S]*?res\.json\(\{ message: \`Outlet "\$\{outlet\.outlet_name\}" \(\$\{outlet\.outlet_code\}\) berhasil disetujui\.\`, outlet \}\);\n  \} catch\(e\) \{\n    res\.status\(500\)\.json\(\{ detail: "Gagal menyetujui outlet\." \}\);\n  \}\n\}\);/;

const replacementApprove = `apiRouter.post("/outlets/:id/approve", authMiddleware, requireRoles("SUPERVISOR", "ADMIN", "OWNER"), async (req: AuthenticatedRequest, res) => {
  try {
    const pgRec = await sqlDb.query.outlets.findFirst({ where: eq(pgOutlets.id, req.params.id) });
    if (!pgRec) return res.status(404).json({ detail: "Outlet tidak ditemukan." });

    const meta = (pgRec.metadata as Record<string, any>) || {};
    meta.lifecycle_status = "NOO";
    meta.approved_by = req.user!._id;
    meta.approved_at = new Date().toISOString();
    
    await sqlDb.update(pgOutlets).set({ status: "ACTIVE", metadata: meta }).where(eq(pgOutlets.id, pgRec.id));
    
    const outlet = {
      _id: pgRec.id,
      outlet_code: pgRec.outletCode,
      outlet_name: pgRec.outletName,
      status: "ACTIVE",
      lifecycle_status: "NOO",
      ...meta
    };
    
    recordAuditLog(req.user!._id, "APPROVE_OUTLET_NOO", "outlets", pgRec.id, { notes: "Outlet disetujui dan aktif (NOO)." });
    syncSingleDoc("outlets", pgRec.id, outlet).catch(() => {});
    
    res.json({ message: \`Outlet "\${pgRec.outletName}" (\${pgRec.outletCode}) berhasil disetujui.\`, outlet });
  } catch(e) {
    res.status(500).json({ detail: "Gagal menyetujui outlet." });
  }
});`;

if (regexApprove.test(file)) {
  file = file.replace(regexApprove, replacementApprove);
  console.log("Replaced /outlets/:id/approve");
} else {
  console.log("Failed to match /outlets/:id/approve");
}

const regexReject = /apiRouter\.post\("\/outlets\/:id\/reject", authMiddleware, requireRoles\("SUPERVISOR", "ADMIN", "OWNER"\), async \(req: AuthenticatedRequest, res\) => \{[\s\S]*?res\.status\(500\)\.json\(\{ detail: "Gagal menolak pengajuan outlet\." \}\);\n  \}\n\}\);/;
const replacementReject = `apiRouter.post("/outlets/:id/reject", authMiddleware, requireRoles("SUPERVISOR", "ADMIN", "OWNER"), async (req: AuthenticatedRequest, res) => {
  const reason = (req.body.reason || "Ditolak oleh supervisor/admin").trim();

  try {
    const pgRec = await sqlDb.query.outlets.findFirst({ where: eq(pgOutlets.id, req.params.id) });
    if (!pgRec) return res.status(404).json({ detail: "Outlet tidak ditemukan." });

    await sqlDb.update(pgOutlets).set({ status: "ARCHIVED" }).where(eq(pgOutlets.id, pgRec.id));
    
    const outlet = {
      _id: pgRec.id,
      outlet_code: pgRec.outletCode,
      outlet_name: pgRec.outletName,
      status: "ARCHIVED",
      ...(pgRec.metadata as Record<string, any> || {})
    };
    
    recordAuditLog(req.user!._id, "REJECT_OUTLET", "outlets", pgRec.id, { reason });
    syncSingleDoc("outlets", pgRec.id, outlet).catch(() => {});
    
    res.json({ message: \`Pengajuan outlet "\${pgRec.outletName}" (\${pgRec.outletCode}) ditolak.\`, outlet });
  } catch(e) {
    res.status(500).json({ detail: "Gagal menolak pengajuan outlet." });
  }
});`;

if (regexReject.test(file)) {
  file = file.replace(regexReject, replacementReject);
  console.log("Replaced /outlets/:id/reject");
} else {
  console.log("Failed to match /outlets/:id/reject");
}

fs.writeFileSync('server/routes.ts', file);
