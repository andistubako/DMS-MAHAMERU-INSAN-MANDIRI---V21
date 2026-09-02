import { db } from "./server/data.js";
import { loadAllFromPostgres } from "./server/cloudsqlSync.js";

async function run() {
  await loadAllFromPostgres(db);
  console.log(db.skus.slice(0, 5));
  process.exit(0);
}
run();
