import fs from 'fs';

let content = fs.readFileSync('server/cloudsqlSync.ts', 'utf8');

const injectionPoint = `      ensureDefaultUsers();`;

const overwriteLogic = `
      // OVERWRITE settings, companyProfile FROM POSTGRES RELATIONAL TABLES (Phase 1.5)
      console.log("[Cloud SQL] Overwriting 'settings', 'companyProfile' from relational tables...");
      const setRes = await client.query("SELECT * FROM system_settings WHERE id = 'global'");
      if (setRes.rows.length > 0) {
        targetDb.settings = setRes.rows[0].settings_data;
      }

      const compRes = await client.query("SELECT * FROM company_profile WHERE id = 'main'");
      if (compRes.rows.length > 0) {
        const c = compRes.rows[0];
        targetDb.company_profile = {
          companyName: c.company_name,
          companyLegalName: c.company_legal_name,
          companyCode: c.company_code,
          address: c.address,
          phone: c.phone,
          email: c.email,
          website: c.website,
          description: c.description,
          logoUrl: c.logo_url,
          metadata: c.metadata,
          updatedAt: c.updated_at
        };
      }
      console.log(\`[Cloud SQL] System settings & company profile overwritten.\`);

      ensureDefaultUsers();
`;

if (content.includes(injectionPoint)) {
  content = content.replace(injectionPoint, overwriteLogic);
  fs.writeFileSync('server/cloudsqlSync.ts', content);
  console.log('Patched cloudsqlSync.ts for settings successfully');
} else {
  console.log('Injection point not found');
}
