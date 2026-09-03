const fs = require('fs');
let file = fs.readFileSync('server/routes.ts', 'utf8');

const regex = /apiRouter\.post\("\/outlets\/check-duplicate", authMiddleware, \(req, res\) => \{[\s\S]*?res\.json\(\{ duplicates, is_duplicate: duplicates\.length > 0 \}\);\n\}\);/;
const replacement = `apiRouter.post("/outlets/check-duplicate", authMiddleware, async (req, res) => {
  const { outlet_name, phone, latitude, longitude, radius_m = 100 } = req.body || {};
  const duplicates: any[] = [];
  
  const pgOuts = await sqlDb.query.outlets.findMany();

  for (const o of pgOuts) {
    let reason = "";
    if (phone && o.phone && o.phone.trim() === phone.trim()) {
      reason = "Nomor telepon sama";
    } else if (outlet_name && o.outletName.toLowerCase().trim() === outlet_name.toLowerCase().trim()) {
      reason = "Nama outlet persis sama";
    } else if (latitude != null && longitude != null && o.latitude != null && o.longitude != null) {
      const dist = haversineMeters(latitude, longitude, o.latitude, o.longitude);
      if (dist <= radius_m) {
        reason = \`Berjarak \${dist}m dari titik lokasi\`;
      }
    }

    if (reason) {
      duplicates.push({
        outlet_id: o.id,
        outlet_code: o.outletCode,
        outlet_name: o.outletName,
        phone: o.phone,
        address: o.address,
        distance_m: latitude && longitude && o.latitude && o.longitude ? haversineMeters(latitude, longitude, o.latitude, o.longitude) : null,
        reason,
      });
    }
  }

  res.json({ duplicates, is_duplicate: duplicates.length > 0 });
});`;

if (regex.test(file)) {
  file = file.replace(regex, replacement);
  fs.writeFileSync('server/routes.ts', file);
  console.log("Replaced check-duplicate");
} else {
  console.log("Failed to match check-duplicate");
}
