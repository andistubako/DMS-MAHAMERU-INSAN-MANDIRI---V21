const fs = require('fs');
let file = fs.readFileSync('server/routes.ts', 'utf8');

const regex = /apiRouter\.put\("\/outlets\/:id", authMiddleware, \(req: AuthenticatedRequest, res\) => \{[\s\S]*?res\.json\(outlet\);\n\}\);/;

const replacement = `apiRouter.put("/outlets/:id", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const outlet = db.outlets.find((o) => o._id === req.params.id);
  if (!outlet) return res.status(404).json({ detail: "Outlet tidak ditemukan." });

  if (req.user!.role === "SALES" && !isOutletAssignedToSales(req.user!._id, outlet._id)) {
    return res.status(403).json({ detail: "Akses ditolak. Outlet di luar penugasan Anda.", code: "OUTLET_ACCESS_DENIED" });
  }

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
    channel_id,
    area_id,
    route_id,
    status,
    credit_limit,
    payment_term_days,
    photo,
    photo_url,
    assigned_sales_id,
    sales_id,
  } = req.body || {};

  const rawPhoto = photo !== undefined ? photo : photo_url;
  if (rawPhoto) {
    try {
      validatePhotoPayload(rawPhoto, "Foto Outlet", {
        maxBytes: MAX_SERVER_PHOTO_BYTES,
        entityType: "outlets",
        entityId: outlet._id,
      });
    } catch (err: any) {
      return res.status(err.statusCode || 400).json({ detail: err.message, code: err.code || "INVALID_OUTLET_PHOTO" });
    }
  }

  const targetProvId = province_id !== undefined ? province_id : outlet.province_id;
  const targetRegId = regency_id !== undefined ? regency_id : outlet.regency_id;
  const targetDistId = district_id !== undefined ? district_id : outlet.district_id;
  const targetVilId = village_id !== undefined ? village_id : outlet.village_id;

  let provName = outlet.province_name || "", regName = outlet.regency_name || "", distName = outlet.district_name || "", vilName = outlet.village_name || "";
  if (targetVilId && targetVilId !== outlet.village_id) {
    const prov = Object.values(db.wilayah_hierarchy).find(p => p.id === targetProvId);
    if (prov) {
      provName = prov.name;
      const reg = prov.regencies.find(r => r.id === targetRegId);
      if (reg) {
        regName = reg.name;
        const dist = reg.districts.find(d => d.id === targetDistId);
        if (dist) {
          distName = dist.name;
          const vil = dist.villages.find(v => v.id === targetVilId);
          if (vil) vilName = vil.name;
        }
      }
    }
  }

  const targetBaseStreet = address_line !== undefined ? address_line : (street_address !== undefined ? street_address : outlet.address_line);
  const targetPostal = postal_code !== undefined ? postal_code : outlet.postal_code;
  const geoParts = [vilName, distName, regName, provName, targetPostal].filter(Boolean);
  const fullAddress = geoParts.length > 0 ? \`\${targetBaseStreet || outlet.address || ""}, \${geoParts.join(", ")}\` : (targetBaseStreet || outlet.address || "");
  
  const targetLat = latitude !== undefined ? Number(latitude) : outlet.latitude;
  const targetLng = longitude !== undefined ? Number(longitude) : outlet.longitude;

  if (targetLat == null || targetLng == null) {
    return res.status(400).json({ detail: "Koordinat GPS (latitude, longitude) tidak boleh kosong." });
  }

  // Update in Postgres first
  try {
    const pgRec = await sqlDb.query.outlets.findFirst({ where: eq(pgOutlets.id, outlet._id) });
    const meta = pgRec ? (pgRec.metadata || {}) : {};
    
    if (address_line !== undefined || street_address !== undefined) meta.address_line = targetBaseStreet;
    if (province_id !== undefined) { meta.province_id = province_id; meta.province_name = provName; }
    if (regency_id !== undefined) { meta.regency_id = regency_id; meta.regency_name = regName; }
    if (district_id !== undefined) { meta.district_id = district_id; meta.district_name = distName; }
    if (village_id !== undefined) { meta.village_id = village_id; meta.village_name = vilName; }
    if (postal_code !== undefined) meta.postal_code = postal_code;
    if (credit_limit !== undefined) meta.credit_limit = Number(credit_limit) || 0;
    if (payment_term_days !== undefined) meta.payment_term_days = Number(payment_term_days) || 0;
    
    await sqlDb.update(pgOutlets).set({
      outletName: outlet_name !== undefined ? outlet_name.trim() : outlet.outlet_name,
      ownerName: owner_name !== undefined ? owner_name.trim() : outlet.owner_name,
      phone: phone !== undefined ? phone.trim() : outlet.phone,
      address: fullAddress,
      latitude: targetLat,
      longitude: targetLng,
      channelId: channel_id !== undefined ? channel_id : outlet.channel_id,
      areaId: area_id !== undefined ? area_id : outlet.area_id,
      routeId: route_id !== undefined ? route_id : outlet.route_id,
      status: status !== undefined ? status : outlet.status,
      imageUrl: rawPhoto !== undefined ? rawPhoto : outlet.photo_url,
      notes: req.body.notes !== undefined ? req.body.notes.trim() : outlet.notes,
      metadata: meta
    }).where(eq(pgOutlets.id, outlet._id));

  } catch (err: any) {
    console.error("Error updating outlet in Postgres:", err.message);
    return res.status(500).json({ detail: "Terjadi kesalahan internal pada database." });
  }

  // Then update memory
  if (outlet_name !== undefined) outlet.outlet_name = outlet_name.trim();
  if (owner_name !== undefined) outlet.owner_name = owner_name.trim();
  if (phone !== undefined) outlet.phone = phone.trim();
  outlet.address = fullAddress;
  if (address_line !== undefined || street_address !== undefined) outlet.address_line = targetBaseStreet;
  if (province_id !== undefined) { outlet.province_id = province_id; outlet.province_name = provName; }
  if (regency_id !== undefined) { outlet.regency_id = regency_id; outlet.regency_name = regName; }
  if (district_id !== undefined) { outlet.district_id = district_id; outlet.district_name = distName; }
  if (village_id !== undefined) { outlet.village_id = village_id; outlet.village_name = vilName; }
  if (postal_code !== undefined) outlet.postal_code = postal_code;
  outlet.latitude = targetLat;
  outlet.longitude = targetLng;
  if (channel_id !== undefined) outlet.channel_id = channel_id;
  if (area_id !== undefined) outlet.area_id = area_id;
  if (route_id !== undefined) outlet.route_id = route_id;
  if (status !== undefined) outlet.status = status;
  if (credit_limit !== undefined) outlet.credit_limit = Number(credit_limit) || 0;
  if (payment_term_days !== undefined) outlet.payment_term_days = Number(payment_term_days) || 0;
  if (rawPhoto !== undefined) outlet.photo_url = rawPhoto;
  if (req.body.notes !== undefined) outlet.notes = req.body.notes.trim();

  syncSingleDoc("outlets", outlet._id, outlet).catch(() => {});

  // Handle sales re-assignment...
  let targetSalesId = req.user!.role === "SALES" ? null : (assigned_sales_id || sales_id);
  if (targetSalesId) {
    const existingActive = db.sales_outlets.find((so) => so.outlet_id === outlet._id && so.status === "ACTIVE");
    if (!existingActive || existingActive.sales_id !== targetSalesId) {
      if (existingActive) {
        existingActive.status = "INACTIVE";
        syncSingleDoc("sales_outlets", existingActive._id, existingActive).catch(() => {});
        try {
          await sqlDb.update(pgSalesOutlets).set({ status: "INACTIVE" }).where(eq(pgSalesOutlets.id, existingActive._id));
        } catch(e) {}
      }

      const salesUser = db.users.find((u) => u._id === targetSalesId);
      const newAssignment: SalesOutlet = {
        _id: \`so-\${Date.now()}-\${Math.floor(Math.random() * 1000)}\`,
        sales_id: targetSalesId,
        outlet_id: outlet._id,
        area_id: outlet.area_id,
        status: "ACTIVE",
        assigned_at: new Date().toISOString(),
        assigned_by: req.user!._id,
        notes: \`Penugasan ulang via edit outlet (\${salesUser?.name || targetSalesId})\`,
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

      recordAuditLog(req.user!._id, "REASSIGN_OUTLET", "sales_outlets", newAssignment._id, {
        old_sales_id: existingActive?.sales_id || null,
        new_sales_id: targetSalesId,
        outlet_id: outlet._id,
      });
    }
  }

  recordAuditLog(req.user!._id, "UPDATE_OUTLET", "outlets", outlet._id, { outlet_name: outlet.outlet_name });

  res.json(outlet);
});`;

if (regex.test(file)) {
  file = file.replace(regex, replacement);
  fs.writeFileSync('server/routes.ts', file);
  console.log("Replaced PUT /outlets successfully!");
} else {
  console.error("Regex did not match anything for PUT /outlets!");
}
