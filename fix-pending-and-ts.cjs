const fs = require('fs');
let file = fs.readFileSync('server/routes.ts', 'utf8');

file = file.replace(/status: pgRec\.status,/g, 'status: (pgRec.status as "PENDING" | "ACTIVE" | "INACTIVE" | "ARCHIVED") || "ACTIVE",');

const regexPending = /apiRouter\.get\("\/outlets\/pending", authMiddleware, requireRoles\("ADMIN", "SUPERVISOR", "OWNER"\), \(req, res\) => \{[\s\S]*?res\.json\(\{ items: pending, total: pending\.length \}\);\n\}\);/;
const replacementPending = `apiRouter.get("/outlets/pending", authMiddleware, requireRoles("ADMIN", "SUPERVISOR", "OWNER"), async (req, res) => {
  const rawPending = await sqlDb.query.outlets.findMany({
    where: eq(pgOutlets.status, "PENDING"),
    orderBy: [desc(pgOutlets.createdAt)],
  });

  const pending = rawPending.map((pgO: any) => {
    const meta = pgO.metadata || {};
    const o = {
      _id: pgO.id,
      outlet_code: pgO.outletCode,
      outlet_name: pgO.outletName,
      owner_name: pgO.ownerName,
      phone: pgO.phone,
      address: pgO.address,
      latitude: pgO.latitude,
      longitude: pgO.longitude,
      area_id: pgO.areaId,
      channel_id: pgO.channelId,
      route_id: pgO.routeId,
      status: pgO.status,
      image_url: pgO.imageUrl,
      notes: pgO.notes,
      created_at: pgO.createdAt?.toISOString(),
      ...meta
    };
    const creator = db.users.find((u) => u._id === o.created_by);
    const area = db.areas.find((a) => a._id === o.area_id);
    const channel = db.channels.find((c) => c._id === o.channel_id);
    return {
      ...o,
      created_by_name: creator?.name || "-",
      area_name: area?.name || "-",
      channel_name: channel?.name || "-",
    };
  });
  res.json({ items: pending, total: pending.length });
});`;

if (regexPending.test(file)) {
  file = file.replace(regexPending, replacementPending);
  console.log("Replaced /outlets/pending");
} else {
  console.log("Failed to match /outlets/pending");
}

fs.writeFileSync('server/routes.ts', file);
