import { pool } from './src/db/index.js';

async function validateLegacyData() {
  const client = await pool.connect();
  const docsResult = await client.query('SELECT collection_name, data FROM dms_document_store');
  const docs = docsResult.rows;
  
  const report = {};
  
  // Aggregate by collection
  for (const doc of docs) {
    const coll = doc.collection_name;
    if (!report[coll]) {
      report[coll] = { total: 0, valid: 0, duplicate: 0, orphan: 0, invalid: 0, incomplete: 0, needsReview: 0, conflicts: [] };
    }
    report[coll].total++;
  }
  
  // Simple validation logic per document type
  const ids = {};
  for (const doc of docs) {
    const coll = doc.collection_name;
    const data = doc.data;
    
    // Check ID
    const id = data._id || data.id || data.companyId || (data.email); // email for users
    
    if (!id) {
       report[coll].invalid++;
       report[coll].conflicts.push(`Missing ID: ${JSON.stringify(data)}`);
       continue;
    }
    
    if (ids[id]) {
       report[coll].duplicate++;
       report[coll].conflicts.push(`Duplicate ID: ${id}`);
       continue;
    }
    ids[id] = coll;
    
    // Check specific required fields
    if (coll === 'users' && (!data.email || !data.name || !data.role)) {
       report[coll].incomplete++;
       report[coll].conflicts.push(`Incomplete User: ${id}`);
       continue;
    }
    
    if (coll === 'areas' && (!data.areaCode || !data.areaName)) {
       report[coll].incomplete++;
       report[coll].conflicts.push(`Incomplete Area: ${id}`);
       continue;
    }
    
    report[coll].valid++;
  }
  
  console.log('--- LEGACY DATA VALIDATION REPORT ---');
  for (const coll in report) {
    console.log(`\nCollection: ${coll}`);
    console.log(`- Total: ${report[coll].total}`);
    console.log(`- Valid: ${report[coll].valid}`);
    console.log(`- Duplicate: ${report[coll].duplicate}`);
    console.log(`- Orphan: ${report[coll].orphan}`);
    console.log(`- Invalid: ${report[coll].invalid}`);
    console.log(`- Incomplete: ${report[coll].incomplete}`);
    console.log(`- Needs Review: ${report[coll].needsReview}`);
    if (report[coll].conflicts.length > 0) {
      console.log(`- Conflicts/Issues:`, report[coll].conflicts);
    }
  }

  client.release();
  process.exit(0);
}
validateLegacyData();
