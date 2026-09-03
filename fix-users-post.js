import fs from 'fs';
let content = fs.readFileSync('server/routes.ts', 'utf8');

const regex = /apiRouter\.post\("\/users", authMiddleware, requireRoles\("ADMIN", "OWNER"\), async \(req: AuthenticatedRequest, res\) => \{[\s\S]*?apiRouter\.put\("\/users\/:id"/;

const replacement = `apiRouter.post("/users", authMiddleware, requireRoles("ADMIN", "OWNER"), async (req: AuthenticatedRequest, res) => {
  try {
    const { name, email, password, role, phone, office_id, area_id } = req.body || {};
    if (!email || !password || !name || !role) {
      return res.status(400).json({ detail: "Nama, email, password, dan role wajib diisi." });
    }
    const cleanEmail = email.trim().toLowerCase();
    
    const existing = await sqlDb.query.users.findFirst({
      where: eq(pgUsers.email, cleanEmail)
    });
    
    if (existing) return res.status(400).json({ detail: "Email sudah digunakan pengguna lain." });
    
    const userId = \`usr-\${Date.now()}\`;
    
    const newUser = {
      id: userId,
      name,
      email: cleanEmail,
      passwordHash: bcrypt.hashSync(password, 10),
      role,
      phone: phone || null,
      officeId: office_id || "off-1",
      areaId: area_id || "area-1",
      status: "ACTIVE",
    };
    
    await sqlDb.insert(pgUsers).values(newUser);
    
    // Fallback sync for compatibility
    const memItem = {
      _id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      password_hash: newUser.passwordHash,
      role: newUser.role as any,
      phone: newUser.phone || "",
      status: newUser.status as any,
      office_id: newUser.officeId,
      area_id: newUser.areaId,
      created_at: new Date().toISOString()
    };
    db.users.push(memItem);
    syncSingleDoc("users", userId, memItem);
    
    if (role === "SALESMAN") {
      const smItem = {
        _id: userId,
        user_id: userId,
        code: \`SLS-\${db.salesmen.length + 1}\`,
        name,
        email: cleanEmail,
        phone: phone || "",
        office_id: office_id || "off-1",
        area_id: area_id || "area-1",
        target_daily_calls: 15,
        target_monthly_sales: 50000000,
        status: "ACTIVE" as const,
        created_at: new Date().toISOString(),
      };
      db.salesmen.push(smItem);
      syncSingleDoc("salesmen", smItem._id, smItem);
      
      await sqlDb.insert(pgSalesmen).values({
        id: userId,
        userId: userId,
        officeId: office_id || "off-1",
        areaId: area_id || "area-1",
        status: "ACTIVE",
      });
    }
    
    recordAuditLog(req.user!._id || req.user!.id!, "CREATE_USER", "users", userId, { email: cleanEmail, role: req.body.role });
    res.status(201).json(memItem);
  } catch (err: any) {
    if (err.code === "23505") return res.status(400).json({ detail: "Email sudah terdaftar." });
    res.status(500).json({ detail: err.message });
  }
});

apiRouter.put("/users/:id"`;

content = content.replace(regex, replacement);
fs.writeFileSync('server/routes.ts', content);
