const fs = require('fs');
let file = fs.readFileSync('server/routes.ts', 'utf8');

// Also fix GET /outlets for total count instead of doing it poorly
const regexGet = /apiRouter\.get\("\/outlets", authMiddleware, async \(req: AuthenticatedRequest, res\) => \{[\s\S]*?res\.json\(\{ items: paginated, total: filtered\.length, page, limit \}\);\n\}\);/g;

const replacementGet = `apiRouter.get("/outlets", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  
  const status = req.query.status as string;
  const channel_id = req.query.channel_id as string;
  const area_id = req.query.area_id as string;
  const q = req.query.q as string;
  const qLike = q ? \`%\${q}%\` : undefined;

  let allowedOutletIds: Set<string> | null = null;
  if (req.user!.role === "SALES") {
    allowedOutletIds = new Set(getActiveAssignedOutletIds(req.user!._id));
  }

  const conditions = [];
  
  if (allowedOutletIds) {
    if (allowedOutletIds.size === 0) conditions.push(sql\`FALSE\`);
    else conditions.push(inArray(pgOutlets.id, Array.from(allowedOutletIds)));
  }

  if (status) conditions.push(eq(pgOutlets.status, status));
  if (channel_id) conditions.push(eq(pgOutlets.channelId, channel_id));
  if (area_id) conditions.push(eq(pgOutlets.areaId, area_id));
  
  if (qLike) {
    conditions.push(or(
      ilike(pgOutlets.outletName, qLike),
      ilike(pgOutlets.outletCode, qLike),
      ilike(pgOutlets.phone, qLike),
      ilike(pgOutlets.address, qLike)
    ));
  }

  const finalWhere = conditions.length > 0 ? and(...conditions) : undefined;
  
  const totalCountData = await sqlDb.select({ count: sql\`count(*)\` }).from(pgOutlets).where(finalWhere);
  const totalCount = Number(totalCountData[0]?.count || 0);
  
  const pgRecs = await sqlDb.query.outlets.findMany({
    where: finalWhere,
    limit: limit,
    offset: (page - 1) * limit,
    orderBy: [desc(pgOutlets.createdAt)]
  });

  const enriched = pgRecs.map((pgRec: any) => {
    const meta = pgRec.metadata || {};
    const o = {
      _id: pgRec.id,
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
    };
    
    const channel = db.channels.find((c) => c._id === o.channel_id);
    const area = db.areas.find((a) => a._id === o.area_id);
    const assignedSales = getAssignedSalesForOutlet(o);
    const lifeCfg = LIFECYCLE_CONFIG[o.lifecycle_status || "PROSPECT"] || LIFECYCLE_CONFIG.PROSPECT;
    
    let daysSinceLast = null;
    if (o.last_completed_transaction_at) {
      daysSinceLast = Math.floor((Date.now() - new Date(o.last_completed_transaction_at).getTime()) / 86400000);
    }
    
    return {
      ...o,
      channel_name: channel?.name || "-",
      area_name: area?.name || "-",
      assigned_sales_id: assignedSales?.sales_id || null,
      assigned_sales_name: assignedSales?.sales_name || "-",
      assigned_sales_code: assignedSales?.sales_code || "-",
      assigned_sales_phone: assignedSales?.sales_phone || "-",
      assignment_type: assignedSales?.assignment_type || null,
      lifecycle_status: o.lifecycle_status || "PROSPECT",
      lifecycle_label: lifeCfg.label,
      lifecycle_description: lifeCfg.description,
      lifecycle_badge: lifeCfg.badge,
      lifecycle_color: lifeCfg.color,
      days_since_last_transaction: daysSinceLast,
    };
  });

  res.json({ items: enriched, total: totalCount, page, limit });
});`;

if (regexGet.test(file)) {
  file = file.replace(regexGet, replacementGet);
  console.log("Replaced GET /outlets list");
} else {
  console.log("Failed to match GET /outlets list");
}

fs.writeFileSync('server/routes.ts', file);
