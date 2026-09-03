const fs = require('fs');
let file = fs.readFileSync('server/routes.ts', 'utf8');

const regex = /apiRouter\.delete\("\/outlets\/:id"[\s\S]*?res\.json\(\{ message: "Outlet berhasil dihapus\." \}\);\n\}\);/;

const replacement = `apiRouter.delete("/outlets/:id", authMiddleware, requireRoles("ADMIN", "OWNER"), async (req: AuthenticatedRequest, res) => {
  const outlet = db.outlets.find((o) => o._id === req.params.id);
  if (!outlet) return res.status(404).json({ detail: "Outlet tidak ditemukan." });

  const hasTxns = db.transactions.some((t) => t.outlet_id === outlet._id);
  if (hasTxns) {
    try {
      await sqlDb.update(pgOutlets).set({ status: "ARCHIVED" }).where(eq(pgOutlets.id, outlet._id));
      outlet.status = "ARCHIVED";
      recordAuditLog(req.user!._id, "ARCHIVE_OUTLET", "outlets", outlet._id, { reason: "Outlet memiliki riwayat transaksi, diarsipkan." });
      syncSingleDoc("outlets", outlet._id, outlet).catch(() => {});
      return res.json({ message: "Outlet memiliki riwayat transaksi sehingga diarsipkan (ARCHIVED).", outlet });
    } catch(e) {
      return res.status(500).json({ detail: "Gagal arsip ke database" });
    }
  }

  try {
    await sqlDb.delete(pgSalesOutlets).where(eq(pgSalesOutlets.outletId, outlet._id));
    await sqlDb.delete(pgOutlets).where(eq(pgOutlets.id, outlet._id));
  } catch(e: any) {
    console.error("Error deleting outlet from postgres", e);
    return res.status(500).json({ detail: "Gagal menghapus outlet dari database." });
  }

  const idx = db.outlets.findIndex((o) => o._id === outlet._id);
  if (idx !== -1) {
    db.outlets.splice(idx, 1);
  }

  db.sales_outlets = db.sales_outlets.filter((so) => so.outlet_id !== outlet._id);

  recordAuditLog(req.user!._id, "DELETE_OUTLET", "outlets", outlet._id, { outlet_name: outlet.outlet_name });
  deleteSingleDoc("outlets", outlet._id).catch(() => {});

  res.json({ message: "Outlet berhasil dihapus." });
});`;

if (regex.test(file)) {
  file = file.replace(regex, replacement);
  fs.writeFileSync('server/routes.ts', file);
  console.log("Replaced DELETE /outlets/:id successfully!");
} else {
  console.error("Regex did not match anything for DELETE /outlets/:id!");
}
