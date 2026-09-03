const fs = require('fs');
let file = fs.readFileSync('server/routes.ts', 'utf8');

const replacement = `
export async function recalculateAllOutletStatusesAsync(currentDate: Date = new Date()) {
  const completedTxns = db.transactions.filter(
    (t) => t.status !== "CANCELLED" && (t as any).status !== "DRAFT"
  );
  
  const aggregation = new Map<string, any[]>();
  for (const t of completedTxns) {
    if (!aggregation.has(t.outlet_id)) aggregation.set(t.outlet_id, []);
    aggregation.get(t.outlet_id).push(t);
  }
  
  const updates = [];
  
  for (const o of db.outlets) {
    const txns = aggregation.get(o._id) || [];
    txns.sort((a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime());
    
    const count = txns.length;
    const firstTxn = txns[0];
    const lastTxn = txns[txns.length - 1];
    
    const firstAt = firstTxn ? firstTxn.transaction_date : null;
    const lastAt = lastTxn ? lastTxn.transaction_date : null;
    
    const totalVolume = txns.reduce(
      (sum, t) => sum + (t.total_volume ?? (t.items || []).reduce((is, i) => is + (Number(i.quantity ?? i.volume) || 0), 0)),
      0
    );
    const totalRevenue = txns.reduce((sum, t) => sum + (Number(t.total) || Number(t.total_amount) || 0), 0);
    
    const newStatus = calculateOutletStatus(count, lastAt, currentDate);
    
    if (
      o.completed_transaction_count !== count ||
      o.first_completed_transaction_at !== firstAt ||
      o.last_completed_transaction_at !== lastAt ||
      o.lifecycle_status !== newStatus ||
      o.total_volume !== totalVolume ||
      o.total_revenue !== totalRevenue
    ) {
      o.completed_transaction_count = count;
      o.first_completed_transaction_at = firstAt;
      o.last_completed_transaction_at = lastAt;
      o.lifecycle_status = newStatus;
      o.total_volume = totalVolume;
      o.total_revenue = totalRevenue;
      
      updates.push(o);
      syncSingleDoc("outlets", o._id, o).catch(() => {});
    }
  }
  
  // Bulk update postgres metadata
  if (updates.length > 0) {
    try {
      for (const o of updates) {
        // preserve existing metadata
        const pgRec = await sqlDb.query.outlets.findFirst({ where: eq(pgOutlets.id, o._id) });
        if (pgRec) {
          const meta = pgRec.metadata || {};
          meta.completed_transaction_count = o.completed_transaction_count;
          meta.first_completed_transaction_at = o.first_completed_transaction_at;
          meta.last_completed_transaction_at = o.last_completed_transaction_at;
          meta.lifecycle_status = o.lifecycle_status;
          meta.total_volume = o.total_volume;
          meta.total_revenue = o.total_revenue;
          await sqlDb.update(pgOutlets).set({ metadata: meta }).where(eq(pgOutlets.id, o._id));
        }
      }
    } catch(e) {
      console.error("Error bulk updating postgres outlet statuses:", e);
    }
  }
}

export function recalculateAllOutletStatuses(currentDate: Date = new Date()) {
  recalculateAllOutletStatusesAsync(currentDate).catch(() => {});
}
`;

file = file.replace(/export function recalculateAllOutletStatuses[\s\S]*?recalculateAllOutletStatuses\(\);/, replacement + "\n\n// Initial calculation at server startup\nrecalculateAllOutletStatuses();");

fs.writeFileSync('server/routes.ts', file);
