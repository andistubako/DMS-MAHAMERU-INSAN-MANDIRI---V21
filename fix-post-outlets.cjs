const fs = require('fs');
let file = fs.readFileSync('server/routes.ts', 'utf8');

const regex = /apiRouter\.post\("\/outlets", authMiddleware, async \(req: AuthenticatedRequest, res\) => \{[\s\S]*?res\.status\(201\)\.json\(newOutlet\);\n\}\);/;

const replacement = `apiRouter.post("/outlets", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const {
    outlet_name,
    owner_name,
    phone,
    address,
    address_line,
    street_address,
    province_id,
    regency_id,
    district_id,
    village_id,
    postal_code,
    latitude,
    longitude,
    area_id,
    channel_id,
    route_id,
    outlet_code,
    credit_limit,
    payment_term_days,
    photo,
    assigned_sales_id,
    sales_id,
  } = req.body || {};

  if (!outlet_name || latitude == null || longitude == null) {
    return res.status(400).json({ detail: "Nama outlet dan koordinat GPS (latitude, longitude) wajib diisi." });
  }

  // Validate photo if provided
  const rawOutletPhoto = photo || req.body?.photo_url;
  if (rawOutletPhoto) {
    try {
      validatePhotoPayload(rawOutletPhoto, "Foto Outlet", {
        maxBytes: MAX_SERVER_PHOTO_BYTES,
        entityType: "outlets",
      });
    } catch (err: any) {
      return res.status(err.statusCode || 400).json({ detail: err.message, code: err.code || "INVALID_OUTLET_PHOTO" });
    }
  }

  // Master Wilayah update validation
  let provName = "", regName = "", distName = "", vilName = "";
  if (village_id) {
    const prov = Object.values(db.wilayah_hierarchy).find(p => p.id === province_id);
    if (prov) {
      provName = prov.name;
      const reg = prov.regencies.find(r => r.id === regency_id);
      if (reg) {
        regName = reg.name;
        const dist = reg.districts.find(d => d.id === district_id);
        if (dist) {
          distName = dist.name;
          const vil = dist.villages.find(v => v.id === village_id);
          if (vil) vilName = vil.name;
        }
      }
    }
  }

  const baseStreet = address_line || street_address || address || "";
  const finalPostalCode = postal_code || "00000";
  const geoParts = [vilName, distName, regName, provName, finalPostalCode].filter(Boolean);
  const fullAddress = geoParts.length > 0 ? \`\${baseStreet}, \${geoParts.join(", ")}\` : baseStreet;

  let finalCode = outlet_code;
  if (!finalCode) {
    const channelCode = channel_id ? (db.channels.find(c => c._id === channel_id)?.code || "OT") : "OT";
    const userArea = req.user!.role === "SALES" ? req.user!.area_id : area_id;
    const areaCode = userArea ? (db.areas.find(a => a._id === userArea)?.code || "XXX") : "XXX";
    const timestamp = Date.now().toString().slice(-4);
    const random = Math.floor(Math.random() * 100).toString().padStart(2, "0");
    finalCode = \`\${channelCode}-\${areaCode}-\${timestamp}\${random}\`;
  }

  const userArea = req.user!.role === "SALES" ? req.user!.area_id : area_id;
  const newOutletId = \`out-\${Date.now()}\`;

  // NOO approval workflow
  const isSalesCreator = req.user!.role === "SALES";
  const requiresApproval = db.settings.new_outlet_approval !== false && !db.settings.auto_approve_outlets;
  const outletStatus: Outlet["status"] = isSalesCreator && requiresApproval ? "PENDING" : "ACTIVE";

  const newOutlet: Outlet = {
    _id: newOutletId,
    outlet_code: finalCode,
    outlet_name: outlet_name.trim(),
    owner_name: (owner_name || "").trim(),
    phone: (phone || "").trim(),
    address: fullAddress,
    address_line: baseStreet,
    province_id: province_id || undefined,
    province_name: provName || undefined,
    regency_id: regency_id || undefined,
    regency_name: regName || undefined,
    district_id: district_id || undefined,
    district_name: distName || undefined,
    village_id: village_id || undefined,
    village_name: vilName || undefined,
    postal_code: finalPostalCode || undefined,
    latitude: Number(latitude),
    longitude: Number(longitude),
    area_id: userArea,
    channel_id: channel_id || "ch-1",
    route_id: route_id || "rt-1",
    credit_limit: Number(credit_limit) || 0,
    payment_term_days: Number(payment_term_days) || 0,
    status: outletStatus,
    lifecycle_status: "PROSPECT",
    completed_transaction_count: 0,
    total_volume: 0,
    total_revenue: 0,
    photo_url: rawOutletPhoto || undefined,
    notes: (req.body.notes || "").trim(),
    created_by: req.user!._id,
    created_at: new Date().toISOString(),
  };

  try {
    await sqlDb.insert(pgOutlets).values({
      id: newOutlet._id,
      outletCode: newOutlet.outlet_code,
      outletName: newOutlet.outlet_name,
      ownerName: newOutlet.owner_name,
      phone: newOutlet.phone,
      address: newOutlet.address,
      latitude: newOutlet.latitude,
      longitude: newOutlet.longitude,
      areaId: newOutlet.area_id,
      channelId: newOutlet.channel_id,
      routeId: newOutlet.route_id,
      status: newOutlet.status,
      imageUrl: newOutlet.photo_url,
      notes: newOutlet.notes,
      createdAt: new Date(newOutlet.created_at!),
      metadata: {
        address_line: newOutlet.address_line,
        address_detail: newOutlet.address_detail,
        province_id: newOutlet.province_id,
        province_name: newOutlet.province_name,
        regency_id: newOutlet.regency_id,
        regency_name: newOutlet.regency_name,
        district_id: newOutlet.district_id,
        district_name: newOutlet.district_name,
        village_id: newOutlet.village_id,
        village_name: newOutlet.village_name,
        postal_code: newOutlet.postal_code,
        lifecycle_status: newOutlet.lifecycle_status,
        completed_transaction_count: newOutlet.completed_transaction_count,
        total_volume: newOutlet.total_volume,
        total_revenue: newOutlet.total_revenue,
        credit_limit: newOutlet.credit_limit,
        payment_term_days: newOutlet.payment_term_days,
        created_by: newOutlet.created_by
      }
    });
    
    // Sync memory AFTER Postgres succeeds
    db.outlets.push(newOutlet);
    syncSingleDoc("outlets", newOutlet._id, newOutlet).catch(() => {});
    
  } catch (err: any) {
    console.error("Error inserting outlet to Postgres:", err.message);
    if (err.code === "23505" || err.cause?.code === "23505") {
      return res.status(400).json({ detail: "Kode Outlet sudah digunakan." });
    }
    return res.status(500).json({ detail: "Terjadi kesalahan internal pada database." });
  }

  // Auto-assign new outlet
  let targetSalesId = req.user!.role === "SALES" ? req.user!._id : (assigned_sales_id || sales_id);
  if (!targetSalesId && userArea) {
    const areaSalesUser = db.users.find((u) => u.role === "SALES" && u.area_id === userArea && u.status === "ACTIVE");
    if (areaSalesUser) {
      targetSalesId = areaSalesUser._id;
    } else {
      const sm = db.salesmen.find((s) => s.area_id === userArea && s.status === "ACTIVE");
      if (sm) targetSalesId = sm.user_id || sm._id;
    }
  }

  if (targetSalesId) {
    const salesUser = db.users.find((u) => u._id === targetSalesId);
    const newAssignment: SalesOutlet = {
      _id: \`so-\${Date.now()}-\${Math.floor(Math.random() * 1000)}\`,
      sales_id: targetSalesId,
      outlet_id: newOutlet._id,
      area_id: userArea,
      status: "ACTIVE",
      assigned_at: new Date().toISOString(),
      assigned_by: req.user!._id,
      notes: req.user!.role === "SALES"
        ? "Penugasan otomatis saat pendaftaran outlet baru (NOO/Prospect)"
        : \`Penugasan otomatis ke Salesman Wilayah oleh sistem (\${salesUser?.name || targetSalesId})\`,
    };
    db.sales_outlets.push(newAssignment);
    syncSingleDoc("sales_outlets", newAssignment._id, newAssignment).catch(() => {});

    try {
      await sqlDb.insert(pgSalesOutlets).values({
        id: newAssignment._id,
        salesmanId: newAssignment.sales_id,
        outletId: newAssignment.outlet_id,
        status: newAssignment.status,
        metadata: { notes: newAssignment.notes, assigned_by: newAssignment.assigned_by }
      });
    } catch (err: any) {
      console.error("Error inserting salesOutlet assignment to Postgres:", err.message);
    }

    recordAuditLog(
      req.user!._id,
      req.user!.role === "SALES" ? "AUTO_ASSIGN_NOO" : "AUTO_ASSIGN_AREA_SALES",
      "sales_outlets",
      newAssignment._id,
      {
        sales_id: targetSalesId,
        sales_name: salesUser?.name || targetSalesId,
        outlet_id: newOutlet._id,
        outlet_code: newOutlet.outlet_code,
        outlet_name: newOutlet.outlet_name,
      }
    );
  }

  recordAuditLog(req.user!._id, "CREATE_OUTLET", "outlets", newOutlet._id, { outlet_name: newOutlet.outlet_name });

  res.status(201).json(newOutlet);
});`;

if (regex.test(file)) {
  file = file.replace(regex, replacement);
  fs.writeFileSync('server/routes.ts', file);
  console.log("Replaced successfully!");
} else {
  console.error("Regex did not match anything!");
}
