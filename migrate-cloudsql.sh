#!/bin/bash
# Script untuk menjalankan Cloud SQL Auth Proxy lokal dan men-trigger skrip migrasi TypeScript.

# 1. Load .env file jika ada
if [ -f .env ]; then
  export $(cat .env | sed 's/#.*//g' | xargs)
fi

# 2. Assign default values
INSTANCE_CONNECTION_NAME="${INSTANCE_CONNECTION_NAME:-PROJECT_ID:asia-southeast1:mahameru-db}"
DB_USER="${DB_USER:-postgres}"
DB_PASS="${DB_PASS:-postgres}"
DB_NAME="${DB_NAME:-mahameru_db}"
DB_PORT="${DB_PORT:-5432}"

echo "=========================================================="
echo "🚀 MEMULAI CLOUD SQL AUTH PROXY & DATABASE MIGRATION"
echo "=========================================================="

# 3. Pre-flight validasi: Cek apakah cloud-sql-proxy terpasang
if ! command -v cloud-sql-proxy &> /dev/null; then
    echo "❌ ERROR: 'cloud-sql-proxy' tidak ditemukan di sistem."
    echo "Silakan install terlebih dahulu. Instruksi instalasi:"
    echo "https://cloud.google.com/sql/docs/postgres/sql-proxy#install"
    exit 1
fi

# 4. Start Cloud SQL Proxy
echo "[1] Menjalankan Cloud SQL Proxy untuk instance: $INSTANCE_CONNECTION_NAME"
cloud-sql-proxy $INSTANCE_CONNECTION_NAME --port $DB_PORT &
PROXY_PID=$!

# Trap untuk memastikan Proxy selalu dimatikan saat script exit atau error
trap "echo 'Mematikan Cloud SQL Proxy (PID: $PROXY_PID)...'; kill $PROXY_PID 2>/dev/null" EXIT

# 5. Polling menunggu Proxy siap (dengan timeout max 30 detik)
echo "[2] Menunggu Proxy siap di port $DB_PORT (max 30 detik)..."
TIMEOUT=30
ELAPSED=0
while ! nc -z 127.0.0.1 $DB_PORT; do
    sleep 1
    ((ELAPSED++))
    if [ $ELAPSED -ge $TIMEOUT ]; then
        echo "❌ ERROR: Timeout. Port $DB_PORT tidak kunjung terbuka setelah $TIMEOUT detik."
        exit 1
    fi
done
echo "✅ Cloud SQL Proxy telah aktif di port $DB_PORT!"

# 6. Jalankan Migrasi TypeScript menggunakan tsx
export DATABASE_URL="postgres://${DB_USER}:${DB_PASS}@127.0.0.1:${DB_PORT}/${DB_NAME}"
echo "[3] Menjalankan Skrip Migrasi Drizzle (TypeScript)..."

npx tsx scripts/execute_total_migration.ts
MIGRATE_STATUS=$?

# 7. Evaluasi Status
if [ $MIGRATE_STATUS -eq 0 ]; then
  echo -e "\n✅ MIGRASI SELESAI DENGAN SUKSES."
else
  echo -e "\n❌ MIGRASI GAGAL. Periksa log error di atas."
  exit $MIGRATE_STATUS
fi
