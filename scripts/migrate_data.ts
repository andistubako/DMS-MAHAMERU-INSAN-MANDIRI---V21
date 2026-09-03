import { pool } from '../src/db/index.js';
import * as schema from '../src/db/schema.js';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';

const db = drizzle(pool, { schema });

const DRY_RUN = process.argv.includes('--dry-run');

async function migrate() {
  console.log(`Starting Data Migration... DRY_RUN=${DRY_RUN}`);
  const client = await pool.connect();
  
  try {
    if (!DRY_RUN) {
      await client.query('BEGIN');
    }

    const rawDocs = await client.query('SELECT collection_name, doc_id, data FROM dms_document_store');
    const grouped = {};
    for (const row of rawDocs.rows) {
       if (!grouped[row.collection_name]) grouped[row.collection_name] = [];
       grouped[row.collection_name].push(row);
    }
    
    // 1. Company Profile
    console.log('Migrating Company Profile...');
    const companies = grouped['company_profile'] || [];
    for (const doc of companies) {
      const data = doc.data;
      const id = data._id || doc.doc_id || 'company-1';
      const payload = {
         id,
         companyName: data.company_name || 'PT Mahameru',
         companyLegalName: data.company_legal_name,
         companyCode: data.company_code,
         address: data.address,
         phone: data.phone,
         email: data.email,
         website: data.website,
         metadata: data
      };
      if (DRY_RUN) console.log(' -> (Dry) Insert Company Profile:', payload.id);
      else await db.insert(schema.companyProfile).values(payload).onConflictDoNothing();
    }

    // 2. System Settings
    console.log('Migrating System Settings...');
    const settings = grouped['system_settings'] || [];
    for (const doc of settings) {
      const data = doc.data;
      const id = doc.doc_id || data._id || 'default_settings';
      const payload = {
         id,
         settingsData: data
      };
      if (DRY_RUN) console.log(' -> (Dry) Insert System Settings:', payload.id);
      else await db.insert(schema.systemSettings).values(payload).onConflictDoNothing();
    }

    // 3. Channels
    console.log('Migrating Channels...');
    const channels = grouped['channels'] || [];
    for (const doc of channels) {
      const data = doc.data;
      const id = data._id || doc.doc_id;
      const payload = {
         id,
         channelName: data.name || data.channel_name,
         channelCode: data.code || data.channel_code,
         status: data.status || 'ACTIVE',
      };
      if (DRY_RUN) console.log(' -> (Dry) Insert Channel:', payload.id);
      else await db.insert(schema.channels).values(payload).onConflictDoNothing();
    }

    // 4. Offices (Must migrate before Areas because Area -> Office FK)
    console.log('Migrating Offices...');
    const offices = grouped['offices'] || [];
    for (const doc of offices) {
      const data = doc.data;
      const id = data._id || doc.doc_id;
      const payload = {
         id,
         officeName: data.office_name || data.name,
         officeCode: data.office_code || data.code,
         address: data.address,
         latitude: data.latitude,
         longitude: data.longitude,
         radiusMeters: data.radius_m,
         status: data.status || 'ACTIVE',
      };
      if (DRY_RUN) console.log(' -> (Dry) Insert Office:', payload.id);
      else await db.insert(schema.offices).values(payload).onConflictDoNothing();
    }

    // 5. Areas (Requires Office)
    console.log('Migrating Areas...');
    const areas = grouped['areas'] || [];
    for (const doc of areas) {
      const data = doc.data;
      const id = data._id || doc.doc_id;
      const payload = {
         id,
         areaName: data.name || data.area_name,
         areaCode: data.code || data.area_code,
         officeId: data.office_id,
         status: data.status || 'ACTIVE',
      };
      if (DRY_RUN) console.log(' -> (Dry) Insert Area:', payload.id);
      else await db.insert(schema.areas).values(payload).onConflictDoNothing();
    }

    // 6. Open Call Reasons
    console.log('Migrating Open Call Reasons...');
    const reasons = grouped['open_call_reasons'] || [];
    for (const doc of reasons) {
      const data = doc.data;
      const id = data._id || doc.doc_id;
      const payload = {
         id,
         reasonCode: data.code || data.reason_code,
         description: data.description || data.name,
         category: data.category,
         status: data.status || 'ACTIVE',
      };
      if (DRY_RUN) console.log(' -> (Dry) Insert Reason:', payload.id);
      else await db.insert(schema.openCallReasons).values(payload).onConflictDoNothing();
    }

    // 7. Users
    console.log('Migrating Users...');
    const users = grouped['users'] || [];
    for (const doc of users) {
      const data = doc.data;
      const id = data.email || data._id || doc.doc_id; // legacy used email as id sometimes
      const payload = {
         id: String(id), // ensure string
         name: data.name,
         email: data.email,
         role: data.role,
         status: data.status || 'ACTIVE',
         officeId: data.office_id,
         areaId: data.area_id
      };
      if (DRY_RUN) console.log(' -> (Dry) Insert User:', payload.id);
      else await db.insert(schema.users).values(payload).onConflictDoNothing();
    }

    if (!DRY_RUN) {
      await client.query('COMMIT');
      console.log('Migration committed successfully.');
    } else {
      console.log('Dry run completed. No data was modified.');
    }
    
  } catch (err) {
    if (!DRY_RUN) await client.query('ROLLBACK');
    console.error('Migration failed:', err);
  } finally {
    client.release();
    process.exit(0);
  }
}

migrate();
