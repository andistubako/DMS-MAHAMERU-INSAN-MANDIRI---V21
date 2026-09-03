import { Pool, PoolConfig } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema.js';
import * as dotenv from 'dotenv';

dotenv.config();

const poolConfig: PoolConfig = {
  // Connection Pooling Settings
  max: parseInt(process.env.DB_MAX_CONNECTIONS || '20', 10), // Maksimal koneksi ke Postgres
  idleTimeoutMillis: 30000, // Bebaskan koneksi setelah idle 30 detik
  connectionTimeoutMillis: 5000, // Timeout dalam 5 detik jika DB tidak merespons
};

// Deteksi Mode Deployment
if (process.env.INSTANCE_CONNECTION_NAME) {
  // PRODUCTION: Cloud Run via Unix Domain Socket
  // Format: PROJECT:REGION:INSTANCE
  poolConfig.host = `/cloudsql/${process.env.INSTANCE_CONNECTION_NAME}`;
  poolConfig.user = process.env.DB_USER;
  poolConfig.password = process.env.DB_PASS;
  poolConfig.database = process.env.DB_NAME;
  console.log(`[DB] Terhubung ke Cloud SQL instance: ${process.env.INSTANCE_CONNECTION_NAME}`);
} else if (process.env.DATABASE_URL) {
  // DEVELOPMENT: Local / Cloud SQL Auth Proxy via TCP
  poolConfig.connectionString = process.env.DATABASE_URL;
  console.log(`[DB] Terhubung ke Database via DATABASE_URL TCP.`);
} else {
  // FALLBACK LOKAL STANDAR
  console.warn("[DB] WARNING: DATABASE_URL & INSTANCE_CONNECTION_NAME kosong. Mencoba fallback ke PostgreSQL lokal...");
  poolConfig.connectionString = "postgres://postgres:postgres@localhost:5432/mahameru_db";
}

export const pool = new Pool(poolConfig);

// Error handler agar Node.js process tidak crash diam-diam ketika idle connection terputus
pool.on('error', (err, client) => {
  console.error('[DB] Unexpected error on idle client:', err.message);
  process.exit(-1); // Restart instance untuk memulihkan pool
});

export const sqlDb = drizzle(pool, { schema });
export type DbClient = typeof sqlDb;
