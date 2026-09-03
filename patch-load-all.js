import fs from 'fs';

let content = fs.readFileSync('server/cloudsqlSync.ts', 'utf8');

const injectionPoint = `      ensureDefaultUsers();`;

const overwriteLogic = `
      // OVERWRITE users FROM POSTGRES RELATIONAL TABLES (Phase 1.5)
      console.log("[Cloud SQL] Overwriting 'users' array from relational 'users' table...");
      const usersRes = await client.query("SELECT * FROM users");
      targetDb.users = usersRes.rows.map(u => ({
        _id: u.id,
        id: u.id,
        name: u.name,
        email: u.email,
        password_hash: u.password_hash,
        role: u.role,
        phone: u.phone,
        status: u.status,
        office_id: u.office_id,
        area_id: u.area_id,
        created_at: u.created_at ? new Date(u.created_at).toISOString() : new Date().toISOString()
      }));
      console.log(\`[Cloud SQL] Overwritten \${targetDb.users.length} users from relational table.\`);

      console.log("[Cloud SQL] Overwriting 'salesmen' array from relational tables...");
      const salesmenRes = await client.query(\`
        SELECT s.id as s_id, s.user_id, s.office_id as s_office, s.area_id as s_area, s.status as s_status, s.metadata, 
               u.name, u.email, u.phone 
        FROM salesmen s 
        JOIN users u ON s.user_id = u.id
      \`);
      targetDb.salesmen = salesmenRes.rows.map(r => ({
        _id: r.s_id,
        user_id: r.user_id,
        code: r.metadata?.code || \`SLS-\${r.s_id.substring(0,4)}\`,
        name: r.name,
        email: r.email,
        phone: r.phone,
        office_id: r.s_office,
        area_id: r.s_area,
        status: r.s_status,
        target_daily_calls: r.metadata?.target_daily_calls || 15,
        target_monthly_sales: r.metadata?.target_monthly_sales || 50000000,
        created_at: new Date().toISOString()
      }));
      console.log(\`[Cloud SQL] Overwritten \${targetDb.salesmen.length} salesmen from relational table.\`);

      ensureDefaultUsers();
`;

if (content.includes(injectionPoint)) {
  content = content.replace(injectionPoint, overwriteLogic);
  fs.writeFileSync('server/cloudsqlSync.ts', content);
  console.log('Patched cloudsqlSync.ts successfully');
} else {
  console.log('Injection point not found');
}
