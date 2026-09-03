import fs from 'fs';

let content = fs.readFileSync('server/routes.ts', 'utf8');

const getSettingsIndex = content.indexOf('apiRouter.get("/settings"');
const endSettingsIndex = content.indexOf('apiRouter.post("/company-profile/logo"', getSettingsIndex);
// Need to find end of company-profile/logo route to safely replace the whole block
let endLogoRoute = content.indexOf('});', endSettingsIndex) + 3;

// Find next route after logo to be safe
const endBlockIndex = content.indexOf('apiRouter.post("/attendance/check-in"', endLogoRoute);


const newSettingsRoutes = `
// ================= SYSTEM SETTINGS =================
apiRouter.get("/settings", authMiddleware, async (req, res) => {
  try {
    const row = await sqlDb.query.systemSettings.findFirst({ where: eq(pgSystemSettings.id, "global") });
    const data = row?.settingsData || db.settings;
    res.json({ settings: data, ...data });
  } catch (err: any) {
    res.status(500).json({ detail: err.message });
  }
});

apiRouter.get("/settings/public", async (req, res) => {
  try {
    const profRow = await sqlDb.query.companyProfile.findFirst({ where: eq(pgCompanyProfile.id, "main") });
    const setRow = await sqlDb.query.systemSettings.findFirst({ where: eq(pgSystemSettings.id, "global") });
    
    const prof = profRow || db.company_profile;
    const settings = setRow?.settingsData || db.settings;
    
    res.json({
      company_name: prof.companyName || settings.company_name,
      company_legal_name: prof.companyLegalName,
      company_code: prof.companyCode,
      company_address: prof.address,
      company_phone: prof.phone,
      company_email: prof.email,
      company_website: prof.website,
      company_description: prof.description,
      logo_url: prof.logoUrl || prof.metadata?.companyLogo,
      currency_symbol: settings.currency_symbol || "Rp",
    });
  } catch (err: any) {
    res.status(500).json({ detail: err.message });
  }
});

apiRouter.put("/settings", authMiddleware, requireRoles("ADMIN", "OWNER"), async (req: AuthenticatedRequest, res) => {
  try {
    const newData = { ...db.settings, ...req.body };
    
    await sqlDb.insert(pgSystemSettings)
      .values({ id: "global", settingsData: newData, updatedBy: req.user!._id || req.user!.id!, updatedAt: new Date() })
      .onConflictDoUpdate({ target: pgSystemSettings.id, set: { settingsData: newData, updatedBy: req.user!._id || req.user!.id!, updatedAt: new Date() } });
      
    db.settings = newData;
    syncSingleDoc("system_settings", "global", newData).catch(() => {});
    
    recordAuditLog(req.user!._id || req.user!.id!, "UPDATE_SETTINGS", "system_settings", "global", { updated_keys: Object.keys(req.body) });
    res.json({ message: "Pengaturan berhasil diperbarui.", settings: newData });
  } catch (err: any) {
    res.status(500).json({ detail: err.message });
  }
});

apiRouter.post("/settings/reset-defaults", authMiddleware, requireRoles("ADMIN", "OWNER"), async (req: AuthenticatedRequest, res) => {
  try {
    const defaultSettings = {
      theme: "light",
      currency_symbol: "Rp",
      language: "id",
      app_name: "Mahameru DMS",
      sidebar_collapsed: false,
      enable_gps_tracking: true,
      require_photo_checkin: true,
      max_visit_distance_m: 500,
      auto_approve_orders: false,
      default_tax_rate: 11,
      allow_backdated_transactions: false,
      notify_on_new_order: true,
      inventory_warning_level: 20
    };
    
    await sqlDb.insert(pgSystemSettings)
      .values({ id: "global", settingsData: defaultSettings, updatedBy: req.user!._id || req.user!.id!, updatedAt: new Date() })
      .onConflictDoUpdate({ target: pgSystemSettings.id, set: { settingsData: defaultSettings, updatedBy: req.user!._id || req.user!.id!, updatedAt: new Date() } });
      
    db.settings = defaultSettings;
    syncSingleDoc("system_settings", "global", defaultSettings).catch(() => {});
    
    recordAuditLog(req.user!._id || req.user!.id!, "RESET_SETTINGS", "system_settings", "global", {});
    res.json({ message: "Pengaturan berhasil di-reset.", settings: defaultSettings });
  } catch (err: any) {
    res.status(500).json({ detail: err.message });
  }
});

// ================= COMPANY PROFILE & OWNER SETTINGS =================
apiRouter.get("/company-profile", async (req, res) => {
  try {
    const profRow = await sqlDb.query.companyProfile.findFirst({ where: eq(pgCompanyProfile.id, "main") });
    res.json(profRow || db.company_profile);
  } catch (err: any) {
    res.status(500).json({ detail: err.message });
  }
});

apiRouter.get("/settings/company", async (req, res) => {
  try {
    const profRow = await sqlDb.query.companyProfile.findFirst({ where: eq(pgCompanyProfile.id, "main") });
    res.json(profRow || db.company_profile);
  } catch (err: any) {
    res.status(500).json({ detail: err.message });
  }
});

apiRouter.put("/company-profile", authMiddleware, requireRoles("OWNER", "ADMIN"), async (req: AuthenticatedRequest, res) => {
  try {
    const payload = req.body;
    
    const profRow = await sqlDb.query.companyProfile.findFirst({ where: eq(pgCompanyProfile.id, "main") });
    const currentMeta = profRow?.metadata || db.company_profile?.metadata || {};
    
    const metaUpdates = {
      npwp: payload.npwp || payload.taxId || currentMeta.npwp,
      nib: payload.nib || currentMeta.nib,
      directorName: payload.directorName || currentMeta.directorName,
      bankName: payload.bankName || currentMeta.bankName,
      bankAccount: payload.bankAccount || currentMeta.bankAccount,
      bankAccountName: payload.bankAccountName || currentMeta.bankAccountName,
    };
    
    const updates = {
      companyName: payload.companyName || profRow?.companyName || "Mahameru Company",
      companyLegalName: payload.companyLegalName || profRow?.companyLegalName || null,
      companyCode: payload.companyCode || profRow?.companyCode || null,
      address: payload.companyAddress || payload.address || profRow?.address || null,
      phone: payload.companyPhone || payload.phone || profRow?.phone || null,
      email: payload.companyEmail || payload.email || profRow?.email || null,
      website: payload.companyWebsite || payload.website || profRow?.website || null,
      description: payload.companyDescription || payload.description || profRow?.description || null,
      metadata: metaUpdates,
      updatedAt: new Date()
    };
    
    await sqlDb.insert(pgCompanyProfile)
      .values({ id: "main", ...updates })
      .onConflictDoUpdate({ target: pgCompanyProfile.id, set: updates });
      
    // Sync memory
    Object.assign(db.company_profile, updates);
    syncSingleDoc("company_profile", "main", db.company_profile).catch(() => {});
    
    recordAuditLog(req.user!._id || req.user!.id!, "UPDATE_COMPANY_PROFILE", "company_profile", "main", { name: updates.companyName });
    res.json(updates);
  } catch (err: any) {
    res.status(500).json({ detail: err.message });
  }
});

// Logo stub
apiRouter.post("/company-profile/logo", authMiddleware, requireRoles("OWNER", "ADMIN"), async (req: AuthenticatedRequest, res) => {
  return res.json({ message: "Mock upload success", url: "/logo.png" });
});
`;

if (!content.includes('pgCompanyProfile')) {
  content = content.replace('areas as pgAreas,', 'areas as pgAreas,\n  systemSettings as pgSystemSettings,\n  companyProfile as pgCompanyProfile,');
}

content = content.substring(0, getSettingsIndex) + newSettingsRoutes + '\n' + content.substring(endBlockIndex);

fs.writeFileSync('server/routes.ts', content);
console.log('Settings endpoints patched');
