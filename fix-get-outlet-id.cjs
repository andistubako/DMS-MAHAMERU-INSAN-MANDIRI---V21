const fs = require('fs');
let file = fs.readFileSync('server/routes.ts', 'utf8');

const regex = /apiRouter\.get\("\/outlets\/:id", authMiddleware, \(req: AuthenticatedRequest, res\) => \{[\s\S]*?const outlet = db\.outlets\.find\(\(o\) => o\._id === req\.params\.id\);/;
const replacement = `apiRouter.get("/outlets/:id", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const pgRec = await sqlDb.query.outlets.findFirst({ where: eq(pgOutlets.id, req.params.id) });
  if (!pgRec) return res.status(404).json({ detail: "Outlet tidak ditemukan." });
  
  const meta = (pgRec.metadata as Record<string, any>) || {};
  const outlet: Outlet = {
    _id: pgRec.id,
    id: pgRec.id,
    outlet_code: pgRec.outletCode,
    outlet_name: pgRec.outletName,
    owner_name: pgRec.ownerName,
    phone: pgRec.phone,
    address: pgRec.address,
    latitude: pgRec.latitude,
    longitude: pgRec.longitude,
    area_id: pgRec.areaId,
    channel_id: pgRec.channelId,
    route_id: pgRec.routeId,
    status: pgRec.status,
    image_url: pgRec.imageUrl,
    notes: pgRec.notes,
    created_at: pgRec.createdAt?.toISOString(),
    ...meta
  };`;

if (regex.test(file)) {
  file = file.replace(regex, replacement);
  fs.writeFileSync('server/routes.ts', file);
  console.log("Replaced GET /outlets/:id");
} else {
  console.log("Failed to match GET /outlets/:id");
}
