import { sqlDb } from './src/db/index.js';
import { skus as pgSkus } from './src/db/schema.js';

async function run() {
  try {
    await sqlDb.insert(pgSkus).values({
        id: 'test3',
        skuCode: 'SKU-AUDIT-DUPE',
        skuName: 'test3'
    });
  } catch(e: any) {
    console.log("CAUSE CODE:", e.cause?.code);
  }
  process.exit(0);
}
run();
