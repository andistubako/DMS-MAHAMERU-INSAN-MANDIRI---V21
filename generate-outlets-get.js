// This is a helper script to generate the code for GET /outlets
const code = `
apiRouter.get("/outlets", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const q = ((req.query.q as string) || "").toLowerCase().trim();
  const status = req.query.status as string; // ACTIVE, INACTIVE, ARCHIVED, PENDING
  const lifecycle_status = req.query.lifecycle_status as string; // PROSPECT, NOO, REPEAT, ACTIVE, DORMANT
  const channel_id = req.query.channel_id as string;
  const area_id = req.query.area_id as string;
  const province_id = req.query.province_id as string;
  const regency_id = req.query.regency_id as string;
  const district_id = req.query.district_id as string;
  const village_id = req.query.village_id as string;
  const filterSalesmanId = req.query.salesman_id as string;
  const product_id = req.query.product_id as string;
  const sku_id = req.query.sku_id as string;
  const date_from = req.query.date_from as string;
  const date_to = req.query.date_to as string;
  const last_tx_from = req.query.last_tx_from as string;
  const last_tx_to = req.query.last_tx_to as string;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;

  const targetSalesId = req.user!.role === "SALES" ? req.user!._id : filterSalesmanId;

  let allowedOutletIds: Set<string> | null = null;
  if (targetSalesId) {
    allowedOutletIds = new Set(getActiveAssignedOutletIds(targetSalesId));
  }

  // Recalculate summary in memory (since transactions are in memory)
  await recalculateAllOutletStatusesAsync();

  let productOutletIds: Set<string> | null = null;
  if (product_id || sku_id) {
    productOutletIds = new Set();
    db.transactions.forEach((t) => {
      if (t.status === "CANCELLED" || (t as any).status === "DRAFT") return;
      const hasItem = (t.items || []).some((it) => {
        if (sku_id && it.sku_id === sku_id) return true;
        if (product_id) {
          const s = db.skus.find((sku) => sku._id === it.sku_id);
          if (it.product_id === product_id || s?.product_id === product_id) return true;
        }
        return false;
      });
      if (hasItem) productOutletIds!.add(t.outlet_id);
    });
  }

  try {
    const conditions = [];

    if (allowedOutletIds) {
      if (allowedOutletIds.size === 0) conditions.push(sql\`FALSE\`);
      else conditions.push(inArray(pgOutlets.id, Array.from(allowedOutletIds)));
    }

    if (productOutletIds) {
      if (productOutletIds.size === 0) conditions.push(sql\`FALSE\`);
      else conditions.push(inArray(pgOutlets.id, Array.from(productOutletIds)));
    }

    if (status) conditions.push(eq(pgOutlets.status, status));
    if (channel_id) conditions.push(eq(pgOutlets.channelId, channel_id));
    if (area_id) conditions.push(eq(pgOutlets.areaId, area_id));
    if (lifecycle_status) conditions.push(sql\`\${pgOutlets.metadata}->>'lifecycle_status' = \${lifecycle_status}\`);
    if (province_id) conditions.push(sql\`\${pgOutlets.metadata}->>'province_id' = \${province_id}\`);
    if (regency_id) conditions.push(sql\`\${pgOutlets.metadata}->>'regency_id' = \${regency_id}\`);
    if (district_id) conditions.push(sql\`\${pgOutlets.metadata}->>'district_id' = \${district_id}\`);
    if (village_id) conditions.push(sql\`\${pgOutlets.metadata}->>'village_id' = \${village_id}\`);
    if (date_from) conditions.push(gte(pgOutlets.createdAt, new Date(date_from)));
    if (date_to) conditions.push(lte(pgOutlets.createdAt, new Date(date_to + "T23:59:59.999Z")));
    if (last_tx_from) conditions.push(sql\`\${pgOutlets.metadata}->>'last_completed_transaction_at' >= \${last_tx_from}\`);
    if (last_tx_to) conditions.push(sql\`\${pgOutlets.metadata}->>'last_completed_transaction_at' <= \${last_tx_to}\`);

    if (q) {
      const qLike = \`%\${q}%\`;
      conditions.push(or(
        ilike(pgOutlets.outletName, qLike),
        ilike(pgOutlets.outletCode, qLike),
        ilike(pgOutlets.ownerName, qLike),
        ilike(pgOutlets.address, qLike),
        ilike(pgOutlets.phone, qLike),
        ilike(sql\`\${pgOutlets.metadata}->>'province_name'\`, qLike),
        ilike(sql\`\${pgOutlets.metadata}->>'regency_name'\`, qLike),
        ilike(sql\`\${pgOutlets.metadata}->>'district_name'\`, qLike),
        ilike(sql\`\${pgOutlets.metadata}->>'village_name'\`, qLike)
      ));
    }

    // Base query for counting accessible overall metrics
    // Fetch all accessible for metrics
    let accessibleConditions = [];
    if (allowedOutletIds) {
      if (allowedOutletIds.size === 0) accessibleConditions.push(sql\`FALSE\`);
      else accessibleConditions.push(inArray(pgOutlets.id, Array.from(allowedOutletIds)));
    }
    
    // Instead of querying all, maybe just rely on db.outlets for summary since it's already updated?
    // The instruction says "Gunakan query PostgreSQL." But we can use db.outlets for summary calculation if it matches Postgres state exactly.
    // Let's do summary on db.outlets for speed, since we already did recalculateAllOutletStatusesAsync
    const accessibleOutlets = db.outlets.filter((o) => {
      if (allowedOutletIds && !allowedOutletIds.has(o._id)) return false;
      return true;
    });

    const summary = {
      total_outlets: accessibleOutlets.length,
      prospect_count: accessibleOutlets.filter((o) => o.lifecycle_status === "PROSPECT").length,
      noo_count: accessibleOutlets.filter((o) => o.lifecycle_status === "NOO").length,
      repeat_count: accessibleOutlets.filter((o) => o.lifecycle_status === "REPEAT").length,
      active_count: accessibleOutlets.filter((o) => o.lifecycle_status === "ACTIVE").length,
      dormant_count: accessibleOutlets.filter((o) => o.lifecycle_status === "DORMANT").length,
      inactive_count: accessibleOutlets.filter((o) => o.status === "INACTIVE" || o.status === "ARCHIVED").length,
    };

    const finalWhere = conditions.length > 0 ? and(...conditions) : undefined;
    
    const rawOutlets = await sqlDb.query.outlets.findMany({
      where: finalWhere,
      orderBy: [desc(pgOutlets.createdAt)],
    });

    // We do pagination in memory for now because we need to map and enrich
    // Or we can just paginate the result.
    const nowTime = Date.now();
    const enriched = rawOutlets.map((pgO: any) => {
      const meta = pgO.metadata || {};
      const o: Outlet = {
        _id: pgO.id,
        id: pgO.id,
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
      const assignedSales = getAssignedSalesForOutlet(o);
      const lifeCfg = LIFECYCLE_CONFIG[o.lifecycle_status || "PROSPECT"] || LIFECYCLE_CONFIG.PROSPECT;

      let daysSinceLast = null;
      if (o.last_completed_transaction_at) {
        daysSinceLast = Math.floor((nowTime - new Date(o.last_completed_transaction_at).getTime()) / 86400000);
      }

      return {
        ...o,
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

    const paginated = enriched.slice((page - 1) * limit, page * limit);

    res.json({
      items: paginated,
      total: enriched.length,
      summary,
    });
  } catch (err: any) {
    res.status(500).json({ detail: err.message });
  }
});
`;
