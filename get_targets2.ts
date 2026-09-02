import { db } from "./server/data.js";
import { loadAllFromPostgres } from "./server/cloudsqlSync.js";

async function run() {
  await loadAllFromPostgres(db);
  console.log(JSON.stringify(db.targets, null, 2));
  process.exit(0);
}
run();
