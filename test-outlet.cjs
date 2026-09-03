const { eq } = require('drizzle-orm');
const { db } = require('./server/db');
const { outlets } = require('./server/db/schema');

async function test() {
  const result = await db.query.outlets.findMany();
  console.log("Total outlets in postgres:", result.length);
}
test().catch(console.error);
