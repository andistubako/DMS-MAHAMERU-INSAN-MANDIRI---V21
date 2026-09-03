import { pool } from './src/db/index.js';
async function run() {
  const res = await pool.query("SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_name = 'outlets'");
  console.log("COLUMNS:\n", res.rows);
  const idx = await pool.query("SELECT * FROM pg_indexes WHERE tablename = 'outlets'");
  console.log("INDEXES:\n", idx.rows);
  const constr = await pool.query("SELECT conname, contype, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'outlets'::regclass");
  console.log("CONSTRAINTS:\n", constr.rows);
  process.exit(0);
}
run();
