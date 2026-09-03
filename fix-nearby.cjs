const fs = require('fs');
let file = fs.readFileSync('server/routes.ts', 'utf8');

const regex = /apiRouter\.get\("\/outlets\/nearby", authMiddleware, \(req: AuthenticatedRequest, res\) => \{[\s\S]*?res\.json\(\{ items: sorted, total: sorted\.length \}\);\n\}\);/;
const replacement = `apiRouter.get("/outlets/nearby", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const lat = parseFloat(req.query.lat as string);
  const lng = parseFloat(req.query.lng as string);
  const radius = parseFloat((req.query.radius_m as string) || "5000");

  if (isNaN(lat) || isNaN(lng)) {
    return res.status(400).json({ detail: "Koordinat lat dan lng wajib diisi." });
  }

  // If user is SALES, restrict nearby search strictly to their actively assigned outlets
  const assignedIds = req.user!.role === "SALES" ? new Set(getActiveAssignedOutletIds(req.user!._id)) : null;
  
  const conditions = [eq(pgOutlets.status, "ACTIVE")];
  if (assignedIds) {
    if (assignedIds.size === 0) conditions.push(sql\`FALSE\`);
    else conditions.push(inArray(pgOutlets.id, Array.from(assignedIds)));
  }

  const pgOuts = await sqlDb.query.outlets.findMany({ where: and(...conditions) });

  const nearby = pgOuts.map((pgO: any) => {
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
    const distance = haversineMeters(lat, lng, o.latitude || 0, o.longitude || 0);
    const lifeCfg = LIFECYCLE_CONFIG[o.lifecycle_status || "PROSPECT"] || LIFECYCLE_CONFIG.PROSPECT;
    return {
      ...o,
      distance_m: distance,
      channel_name: db.channels.find((c) => c._id === o.channel_id)?.name || "-",
      lifecycle_badge: lifeCfg.badge,
      lifecycle_color: lifeCfg.color,
    };
  }).filter(o => (o.distance_m || 0) <= radius);

  const sorted = nearby.sort((a, b) => (a.distance_m || 0) - (b.distance_m || 0));

  res.json({ items: sorted, total: sorted.length });
});`;

if (regex.test(file)) {
  file = file.replace(regex, replacement);
  fs.writeFileSync('server/routes.ts', file);
  console.log("Replaced /outlets/nearby");
} else {
  console.log("Failed to match /outlets/nearby");
}
