import fs from 'fs';

let content = fs.readFileSync('server/routes.ts', 'utf8');

const newRoutes = `
apiRouter.get("/users", authMiddleware, requireRoles("ADMIN", "OWNER", "SUPERVISOR"), async (req, res) => {
  try {
    const allUsers = await sqlDb.query.users.findMany({
      with: {
        office: true,
        area: true,
      },
      orderBy: (users, { desc }) => [desc(users.createdAt)],
    });
    
    const safeUsers = allUsers.map((u) => {
      const copy = { ...u } as any;
      delete copy.passwordHash;
      return {
        ...copy,
        _id: u.id,
        office_id: u.officeId,
        area_id: u.areaId,
        created_at: u.createdAt,
        office_name: u.office?.officeName || "-",
        area_name: u.area?.areaName || "-",
      };
    });
    res.json({ items: safeUsers, total: safeUsers.length });
  } catch (err: any) {
    res.status(500).json({ detail: err.message });
  }
});

apiRouter.post("/users", authMiddleware, requireRoles("ADMIN", "OWNER"), async (req: AuthenticatedRequest, res) => {
  try {
    const { name, email, password, role, phone, office_id, area_id } = req.body || {};
    if (!email || !password || !name || !role) {
      return res.status(400).json({ detail: "Nama, email, password, dan role wajib diisi." });
    }
    const cleanEmail = email.trim().toLowerCase();
    
    const existing = await sqlDb.query.users.findFirst({
      where: eq(schema.users.email, cleanEmail)
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
    
    await sqlDb.insert(schema.users).values(newUser);
    
    // Fallback sync for compatibility
    db.users.push({
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
    });
    
    if (role === "SALES") {
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
      
      await sqlDb.insert(schema.salesmen).values({
        id: userId,
        userId: userId,
        name: name,
        code: smItem.code,
        email: cleanEmail,
        phone: phone || null,
        officeId: office_id || "off-1",
        areaId: area_id || "area-1",
        status: "ACTIVE",
      }).onConflictDoNothing();
    }
    
    recordAuditLog(
      req.user!._id || req.user!.id!,
      "CREATE_USER",
      "users",
      newUser.id,
      { name: newUser.name, email: newUser.email, role: newUser.role, office_id: newUser.officeId, area_id: newUser.areaId }
    );
    
    const safe = { ...newUser, _id: newUser.id };
    delete (safe as any).passwordHash;
    res.status(201).json(safe);
  } catch (err: any) {
    res.status(500).json({ detail: err.message });
  }
});

apiRouter.put("/users/:id", authMiddleware, requireRoles("ADMIN", "OWNER"), async (req: AuthenticatedRequest, res) => {
  try {
    const user = await sqlDb.query.users.findFirst({
      where: eq(schema.users.id, req.params.id)
    });
    if (!user) return res.status(404).json({ detail: "Pengguna tidak ditemukan." });
    
    const prevOfficeId = user.officeId;
    const prevAreaId = user.areaId;
    const prevRole = user.role;
    const prevStatus = user.status;
    
    const updates: any = { updatedAt: new Date() };
    if (req.body.password) updates.passwordHash = bcrypt.hashSync(req.body.password, 10);
    if (req.body.name) updates.name = req.body.name;
    if (req.body.phone !== undefined) updates.phone = req.body.phone || null;
    if (req.body.role) updates.role = req.body.role;
    if (req.body.office_id !== undefined) updates.officeId = req.body.office_id;
    if (req.body.area_id !== undefined) updates.areaId = req.body.area_id;
    if (req.body.status !== undefined) updates.status = req.body.status;
    
    await sqlDb.update(schema.users).set(updates).where(eq(schema.users.id, req.params.id));
    
    // Sync to in-memory compatibility array
    const memUser = db.users.find(u => u._id === req.params.id);
    if (memUser) {
       Object.assign(memUser, {
         name: updates.name || memUser.name,
         phone: updates.phone !== undefined ? updates.phone : memUser.phone,
         role: updates.role || memUser.role,
         office_id: updates.officeId || memUser.office_id,
         area_id: updates.areaId || memUser.area_id,
         status: updates.status || memUser.status,
       });
       if (updates.passwordHash) memUser.password_hash = updates.passwordHash;
    }
    
    if (user.role === "SALES" || updates.role === "SALES") {
      const salesman = db.salesmen.find((s) => s.user_id === req.params.id || s._id === req.params.id);
      if (salesman) {
        if (updates.name) salesman.name = updates.name;
        if (updates.phone !== undefined) salesman.phone = updates.phone;
        if (updates.officeId !== undefined) salesman.office_id = updates.officeId;
        if (updates.areaId !== undefined) salesman.area_id = updates.areaId;
        if (updates.status !== undefined) salesman.status = updates.status;
        syncSingleDoc("salesmen", salesman._id, salesman);
      }
      
      await sqlDb.update(schema.salesmen).set({
        name: updates.name,
        phone: updates.phone,
        officeId: updates.officeId,
        areaId: updates.areaId,
        status: updates.status,
      }).where(eq(schema.salesmen.userId, req.params.id)).catch(() => {});
    }
    
    const isAssignmentChanged = prevOfficeId !== updates.officeId || prevAreaId !== updates.areaId || prevRole !== updates.role;
    
    recordAuditLog(
      req.user!._id || req.user!.id!,
      isAssignmentChanged ? "UPDATE_USER_ASSIGNMENT" : "UPDATE_USER",
      "users",
      user.id,
      {
        user_name: updates.name || user.name,
        role: updates.role || user.role,
        is_assignment_changed: isAssignmentChanged,
      }
    );
    
    const safe = { ...user, ...updates, _id: user.id };
    delete safe.passwordHash;
    res.json(safe);
  } catch (err: any) {
    res.status(500).json({ detail: err.message });
  }
});

apiRouter.post("/users/:id/toggle", authMiddleware, requireRoles("ADMIN", "OWNER"), async (req: AuthenticatedRequest, res) => {
  try {
    const user = await sqlDb.query.users.findFirst({
      where: eq(schema.users.id, req.params.id)
    });
    if (!user) return res.status(404).json({ detail: "Pengguna tidak ditemukan." });
    
    const newStatus = user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    
    await sqlDb.update(schema.users)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(eq(schema.users.id, req.params.id));
      
    if (newStatus === "INACTIVE") {
      revokeAllUserSessions(user.id);
    }
    
    const memUser = db.users.find(u => u._id === req.params.id);
    if (memUser) memUser.status = newStatus as any;
    
    if (user.role === "SALES") {
      const salesman = db.salesmen.find((s) => s.user_id === user.id || s._id === user.id);
      if (salesman) {
        salesman.status = newStatus as any;
        syncSingleDoc("salesmen", salesman._id, salesman);
      }
      await sqlDb.update(schema.salesmen).set({ status: newStatus }).where(eq(schema.salesmen.userId, user.id)).catch(() => {});
    }
    
    recordAuditLog(
      req.user!._id || req.user!.id!,
      "TOGGLE_USER_STATUS",
      "users",
      user.id,
      { user_name: user.name, email: user.email, new_status: newStatus }
    );
    
    res.json({ _id: user.id, status: newStatus });
  } catch (err: any) {
    res.status(500).json({ detail: err.message });
  }
});

apiRouter.delete("/users/:id", authMiddleware, requireRoles("ADMIN", "OWNER"), async (req: AuthenticatedRequest, res) => {
  try {
    const targetId = req.params.id;
    if ((req.user!._id || req.user!.id!) === targetId) {
      return res.status(400).json({ detail: "Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif." });
    }
    
    const user = await sqlDb.query.users.findFirst({
      where: eq(schema.users.id, targetId)
    });
    
    if (!user) return res.status(404).json({ detail: "Pengguna tidak ditemukan." });
    
    try {
      // Try deleting from database, if it fails due to foreign key (e.g., they have transactions), 
      // PostgreSQL will throw a constraint error.
      await sqlDb.delete(schema.users).where(eq(schema.users.id, targetId));
    } catch (err: any) {
      if (err.code === '23503') { // PostgreSQL foreign_key_violation
        return res.status(400).json({ detail: "Pengguna tidak dapat dihapus karena memiliki data transaksi/riwayat. Silakan nonaktifkan (toggle status) pengguna ini." });
      }
      throw err;
    }
    
    revokeAllUserSessions(targetId);
    
    const idx = db.users.findIndex((u) => u._id === targetId);
    if (idx !== -1) db.users.splice(idx, 1);
    
    const smIdx = db.salesmen.findIndex((s) => s.user_id === targetId || s._id === targetId);
    if (smIdx !== -1) {
      db.salesmen.splice(smIdx, 1);
      deleteSingleDoc("salesmen", targetId);
      await sqlDb.delete(schema.salesmen).where(eq(schema.salesmen.userId, targetId)).catch(() => {});
    }
    
    recordAuditLog(
      req.user!._id || req.user!.id!,
      "DELETE_USER",
      "users",
      targetId,
      { name: user.name, email: user.email, role: user.role }
    );
    
    return res.json({ message: "Pengguna berhasil dihapus.", _id: targetId });
  } catch (err: any) {
    res.status(500).json({ detail: err.message });
  }
});
`;

const startIndex = content.indexOf('apiRouter.get("/users"');
const endIndex = content.indexOf('apiRouter.get("/settings"', startIndex);

// We need to add Drizzle imports if they don't exist
let finalContent = content.substring(0, startIndex) + newRoutes + '\n' + content.substring(endIndex);

if (!finalContent.includes("import { sqlDb }")) {
  finalContent = finalContent.replace('import { db', 'import { sqlDb } from "../src/db/index.js";\nimport * as schema from "../src/db/schema.js";\nimport { eq, and } from "drizzle-orm";\nimport { db');
}

fs.writeFileSync('server/routes.ts', finalContent);
console.log('Updated server/routes.ts');

