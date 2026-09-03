import fs from 'fs';

let content = fs.readFileSync('server/cloudsqlSync.ts', 'utf8');

const injectionPoint = `      ensureDefaultUsers();`;

const overwriteLogic = `
      // OVERWRITE offices, areas, channels FROM POSTGRES RELATIONAL TABLES (Phase 1.5)
      console.log("[Cloud SQL] Overwriting 'offices', 'areas', 'channels' from relational tables...");
      const officesRes = await client.query("SELECT * FROM offices");
      targetDb.offices = officesRes.rows.map(o => ({
        _id: o.id,
        office_name: o.office_name,
        office_code: o.office_code,
        address: o.address,
        phone: o.phone,
        latitude: o.latitude,
        longitude: o.longitude,
        radius_m: o.radius_meters,
        status: o.status,
        created_at: o.created_at ? new Date(o.created_at).toISOString() : new Date().toISOString()
      }));

      const areasRes = await client.query("SELECT * FROM areas");
      targetDb.areas = areasRes.rows.map(a => ({
        _id: a.id,
        name: a.area_name,
        area_code: a.area_code,
        office_id: a.office_id,
        regency_id: a.regency_id,
        status: a.status,
        created_at: a.created_at ? new Date(a.created_at).toISOString() : new Date().toISOString(),
        metadata: a.metadata
      }));

      const channelsRes = await client.query("SELECT * FROM channels");
      targetDb.channels = channelsRes.rows.map(c => ({
        _id: c.id,
        name: c.channel_name,
        channel_code: c.channel_code,
        status: c.status,
        metadata: c.metadata
      }));
      console.log(\`[Cloud SQL] Overwritten \${targetDb.offices.length} offices, \${targetDb.areas.length} areas, \${targetDb.channels.length} channels.\`);

      ensureDefaultUsers();
`;

if (content.includes(injectionPoint)) {
  content = content.replace(injectionPoint, overwriteLogic);
  fs.writeFileSync('server/cloudsqlSync.ts', content);
  console.log('Patched cloudsqlSync.ts successfully');
} else {
  console.log('Injection point not found');
}
