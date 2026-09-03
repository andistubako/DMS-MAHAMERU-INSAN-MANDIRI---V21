import { eq, sql, and } from 'drizzle-orm';
import { sqlDb } from '../src/db/index.js';
import { transactions, inventory, stockMovements } from '../src/db/schema.js';
import { transactionItems } from './transaction-items.schema.js';
import { randomUUID } from 'crypto';

export interface SalesItemPayload {
  skuId: string;
  warehouseId: string;
  quantity: number;
  price: number;
}

export async function processAtomicSales(
  outletId: string,
  salesmanId: string,
  items: SalesItemPayload[]
) {
  return await sqlDb.transaction(async (tx) => {
    const txnId = randomUUID();
    let totalAmount = 0;
    const now = new Date();

    // 1. Catat Header Transaksi
    await tx.insert(transactions).values({
      id: txnId,
      invoiceNumber: `INV-${Date.now()}`,
      outletId,
      salesmanId,
      status: 'COMPLETED',
      subtotal: 0,
      totalAmount: 0,
      transactionDate: now.toISOString(),
      items: items, // required field
      createdAt: now,
    } as any);

    for (const item of items) {
      const currentStockResult = await tx
        .select()
        .from(inventory)
        .where(and(
          eq(inventory.skuId, item.skuId), 
          eq(inventory.locationId, item.warehouseId)
        ))
        .for('update'); 

      const currentStock = currentStockResult[0];

      if (!currentStock || (currentStock.stockOnHand || 0) < item.quantity) {
        throw new Error(`STOK TIDAK CUKUP: SKU ${item.skuId} di Gudang ${item.warehouseId}. Sisa: ${currentStock?.stockOnHand || 0}`);
      }

      await tx.update(inventory)
        .set({ 
          stockOnHand: sql`${inventory.stockOnHand} - ${item.quantity}`,
          availableStock: sql`${inventory.availableStock} - ${item.quantity}`,
          updatedAt: now
        })
        .where(eq(inventory.id, currentStock.id));

      await tx.insert(stockMovements).values({
        id: randomUUID(),
        skuId: item.skuId,
        sourceLocationId: item.warehouseId,
        sourceLocationType: 'WAREHOUSE',
        movementType: 'OUT',
        quantity: item.quantity,
        referenceId: txnId,
        createdAt: now
      });

      const subtotal = item.quantity * item.price;
      totalAmount += subtotal;

      await tx.insert(transactionItems).values({
        id: randomUUID(),
        transactionId: txnId,
        skuId: item.skuId,
        quantity: item.quantity,
        volume: item.quantity,
        unitPrice: item.price,
        subtotal
      });
    }

    await tx.update(transactions)
      .set({ 
        subtotal: totalAmount,
        totalAmount: totalAmount 
      })
      .where(eq(transactions.id, txnId));

    return { 
      success: true, 
      message: 'Transaksi berhasil. Stok terpotong.', 
      transactionId: txnId 
    };
  });
}
