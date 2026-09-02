import { reloadInventoryDataFromPostgres } from "./cloudsqlSync.js";
import { isCloudSqlConnected } from "./cloudsqlSync.js";
import { sqlDb } from "../src/db/index.js";
import { transactions, visits, outlets, skus, salesOutlets } from "../src/db/schema.js";
import { transactionItems } from "./transaction-items.schema.js";
import { InventoryRepository } from "./inventory.repository.js";
import { eq, sql } from "drizzle-orm";
import { db } from "./data.js";
import { syncSingleDoc } from "./persistence.js";

export type SaleItemInput = { sku_id: string; quantity: number; unit_price?: number; discount_amount?: number };
function id(prefix: string) { return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000000)}`; }
const SALEABLE_OUTLET_STATUSES = new Set(["PROSPECT", "NOO", "REPEAT", "ACTIVE", "DORMANT", "PENDING"]);

/** Posts a sale, stock movement, transaction items and outlet lifecycle update atomically. */
export async function postSaleAtomic(input: {
  invoice_number: string; salesman_id: string; outlet_id: string; visit_id?: string; office_id?: string;
  transaction_type?: string; items: SaleItemInput[]; notes?: string; idempotency_key?: string;
}): Promise<{ transaction: any; replayed: boolean }> {
  if (!input.invoice_number?.trim()) throw new Error("Nomor invoice wajib diisi.");
  if (!input.salesman_id || !input.outlet_id) throw new Error("Salesman dan outlet wajib diisi.");
  if (!Array.isArray(input.items) || input.items.length === 0) throw new Error("Minimal satu item transaksi wajib diisi.");

  const cleanItems = input.items.map((item) => {
    const quantity = Number(item.quantity), unitPrice = Number(item.unit_price ?? 0), discount = Number(item.discount_amount ?? 0);
    if (!item.sku_id || !Number.isInteger(quantity) || quantity <= 0) throw new Error("Quantity setiap SKU harus bilangan bulat lebih dari 0.");
    if (!Number.isFinite(unitPrice) || unitPrice < 0 || !Number.isFinite(discount) || discount < 0) throw new Error("Harga/discount tidak valid.");
    return { ...item, quantity, unitPrice, discount };
  });

  try {
    return await sqlDb.transaction(async (tx) => {
    const existing = await tx.select().from(transactions).where(eq(transactions.invoiceNumber, input.invoice_number)).limit(1);
    if (existing[0]) return { transaction: existing[0], replayed: true };

    const outlet = await tx.select().from(outlets).where(eq(outlets.id, input.outlet_id)).limit(1);
    if (!outlet[0]) throw new Error("Outlet tidak ditemukan.");
    if (!SALEABLE_OUTLET_STATUSES.has(String(outlet[0].status || "").toUpperCase())) throw new Error("Outlet tidak dapat menerima transaksi pada status saat ini.");

    const assignments = await tx.select().from(salesOutlets).where(eq(salesOutlets.salesmanId, input.salesman_id));
    if (!assignments.some((row) => row.outletId === input.outlet_id && row.status === "ACTIVE")) throw new Error("Outlet tidak termasuk assignment Salesman ini.");

    let validVisit: typeof visits.$inferSelect | undefined;
    if (input.visit_id) {
      const visit = await tx.select().from(visits).where(eq(visits.id, input.visit_id)).limit(1);
      if (!visit[0]) throw new Error("Visit tidak ditemukan.");
      if (visit[0].salesmanId !== input.salesman_id || visit[0].outletId !== input.outlet_id) throw new Error("Visit tidak sesuai dengan Salesman dan Outlet transaksi.");
      if (visit[0].status === "CANCELLED") throw new Error("Visit dibatalkan dan tidak dapat menjadi Effective Call.");
      validVisit = visit[0];
    }

    let subtotal = 0, discountTotal = 0;
    const normalized: any[] = [];
    for (const item of cleanItems) {
      const sku = db.skus.find((s) => s._id === item.sku_id);
      if (!sku) throw new Error(`SKU ${item.sku_id} tidak ditemukan.`);
      if (sku.status !== "ACTIVE") throw new Error(`SKU ${item.sku_id} tidak aktif.`);
      let actualUnitPrice = Number(item.unitPrice);
      if (actualUnitPrice <= 0) {
        // Fallback to SKU base price if unit price is 0 or undefined
        const prc = db.prices?.find((p) => (p.sku_id === sku._id || p.sku_id === sku.id) && p.status === "ACTIVE");
        actualUnitPrice = Number(sku.base_price || sku.basePrice || sku.price || prc?.price || prc?.price_value || prc?.priceValue || 0);
      }
      
      const lineGross = item.quantity * actualUnitPrice;
      const lineSubtotal = Math.max(0, lineGross - item.discount);
      
      // Update the item so we push the correct price to normalized
      item.unitPrice = actualUnitPrice;
      subtotal += lineSubtotal; discountTotal += item.discount;
      normalized.push({ id: id("txi"), transactionId: "", skuId: item.sku_id, productId: sku.product_id || null, quantity: item.quantity, volume: item.quantity, unitPrice: item.unitPrice, discountAmount: item.discount, subtotal: lineSubtotal, metadata: { source: "ATOMIC_SALE_POST" } });
    }

    const transactionId = id("txn"), now = new Date(), totalAmount = subtotal;
    for (const item of cleanItems) {
      await InventoryRepository.createOrUpdateInventory("SALES", input.salesman_id, item.sku_id, -item.quantity, tx);
      await InventoryRepository.insertMovement({ id: id("mvt"), movementType: "SALES_OUT", sourceLocationType: "SALES", sourceLocationId: input.salesman_id, destLocationType: "OUTLET", destLocationId: input.outlet_id, skuId: item.sku_id, quantity: item.quantity, referenceId: transactionId, performedBy: input.salesman_id, notes: input.notes || "Penjualan" }, tx);
      await InventoryRepository.upsertSalesStockLedger(input.salesman_id, now.toISOString().slice(0, 10), item.sku_id, { soldStock: item.quantity, finalStock: -item.quantity }, tx);
    }

    const legacyItems = normalized.map((x) => ({ sku_id: x.skuId, product_id: x.productId, quantity: x.quantity, volume: x.volume, unit_price: x.unitPrice, discount: x.discountAmount, subtotal: x.subtotal }));
    const inserted = await tx.insert(transactions).values({ id: transactionId, invoiceNumber: input.invoice_number, salesmanId: input.salesman_id, outletId: input.outlet_id, visitId: input.visit_id || null, officeId: input.office_id || null, transactionType: input.transaction_type || "CASH", subtotal, discountAmount: discountTotal, taxAmount: 0, totalAmount, paidAmount: totalAmount, paymentStatus: "PAID", deliveryStatus: "DELIVERED", items: legacyItems, notes: input.notes || null, createdAt: now, metadata: { idempotency_key: input.idempotency_key || null, posted_atomically: true } }).returning();
    for (const item of normalized) { item.transactionId = transactionId; await tx.insert(transactionItems).values(item); }

    // Canonical lifecycle: first valid purchase = NOO, second = Repeat, third+ = Active.
    const purchaseCountResult = await tx.execute(sql`
      SELECT COUNT(*)::int AS count
      FROM transactions
      WHERE outlet_id = ${input.outlet_id}
        AND COALESCE(payment_status, 'UNPAID') <> 'CANCELLED'
    `);
    const purchaseCount = Number((purchaseCountResult.rows[0] as any)?.count || 0);
    const nextStatus = purchaseCount === 1 ? "NOO" : purchaseCount === 2 ? "REPEAT" : "ACTIVE";
    await tx.update(outlets).set({ status: nextStatus as any }).where(eq(outlets.id, input.outlet_id));

    // Effective Call requires a valid visit on the same local calendar date.
    if (validVisit) {
      const visitDate = new Date(validVisit.checkInTime);
      if (visitDate.getFullYear() === now.getFullYear() && visitDate.getMonth() === now.getMonth() && visitDate.getDate() === now.getDate()) {
        await tx.update(visits).set({ isEffectiveCall: true }).where(eq(visits.id, validVisit.id));
        
        const dbVisit = db.visits.find((v) => v._id === validVisit!.id);
        if (dbVisit) (dbVisit as any).is_effective_call = true;
      }
    }

    // Sync to in-memory db array so dashboards reflect the transaction instantly
    const newTxnLegacy = {
      _id: inserted[0].id,
      transaction_date: now.toISOString(),
      invoice_number: input.invoice_number,
      salesman_id: input.salesman_id,
      outlet_id: input.outlet_id,
      visit_id: input.visit_id || null,
      office_id: input.office_id || null,
      transaction_type: input.transaction_type || "CASH",
      status: "PAID",
      payment_status: "PAID",
      delivery_status: "DELIVERED",
      items: legacyItems,
      subtotal,
      discount_amount: discountTotal,
      tax_amount: 0,
      total_amount: totalAmount,
      total: totalAmount,
      paid_amount: totalAmount,
      notes: input.notes || null,
      created_at: now.toISOString(),
      metadata: { idempotency_key: input.idempotency_key || null, posted_atomically: true }
    };
    db.transactions.push(newTxnLegacy as any);
    syncSingleDoc("transactions", newTxnLegacy._id, newTxnLegacy).catch(() => {});

    const dbOutlet = db.outlets.find((o) => o._id === input.outlet_id);
    if (dbOutlet) {
      dbOutlet.lifecycle_status = nextStatus as any;
      if (dbOutlet.status !== "PENDING") {
        dbOutlet.status = "ACTIVE";
      }
      syncSingleDoc("outlets", dbOutlet._id, dbOutlet).catch(() => {});
    }
    
    if (validVisit) {
      const dbVisit = db.visits.find((v) => v._id === validVisit!.id);
      if (dbVisit) {
        (dbVisit as any).is_effective_call = true;
        syncSingleDoc("visits", dbVisit._id, dbVisit).catch(() => {});
      }
    }

    return { transaction: inserted[0], replayed: false };
    });
  } finally {
    await reloadInventoryDataFromPostgres(db);
  }
}
