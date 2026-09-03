const fs = require('fs');
let file = fs.readFileSync('server/routes.ts', 'utf8');

const regexSummary = /apiRouter\.get\("\/outlets\/summary", authMiddleware, \(req: AuthenticatedRequest, res\) => \{[\s\S]*?res\.json\(summary\);\n\}\);/;
const replacementSummary = `apiRouter.get("/outlets/summary", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const filterSalesmanId = req.query.salesman_id as string;
  const targetSalesId = req.user!.role === "SALES" ? req.user!._id : filterSalesmanId;

  let allowedOutletIds: Set<string> | null = null;
  if (targetSalesId) {
    allowedOutletIds = new Set(getActiveAssignedOutletIds(targetSalesId));
  }

  await recalculateAllOutletStatusesAsync();

  const conditions = [];
  if (allowedOutletIds) {
    if (allowedOutletIds.size === 0) conditions.push(sql\`FALSE\`);
    else conditions.push(inArray(pgOutlets.id, Array.from(allowedOutletIds)));
  }

  const finalWhere = conditions.length > 0 ? and(...conditions) : undefined;
  const allOutlets = await sqlDb.query.outlets.findMany({ where: finalWhere });

  const summary = {
    total: allOutlets.length,
    total_outlets: allOutlets.length,
    prospect: allOutlets.filter((o) => (o.metadata as any)?.lifecycle_status === "PROSPECT").length,
    prospect_count: allOutlets.filter((o) => (o.metadata as any)?.lifecycle_status === "PROSPECT").length,
    noo: allOutlets.filter((o) => (o.metadata as any)?.lifecycle_status === "NOO").length,
    noo_count: allOutlets.filter((o) => (o.metadata as any)?.lifecycle_status === "NOO").length,
    repeat: allOutlets.filter((o) => (o.metadata as any)?.lifecycle_status === "REPEAT").length,
    repeat_count: allOutlets.filter((o) => (o.metadata as any)?.lifecycle_status === "REPEAT").length,
    active: allOutlets.filter((o) => (o.metadata as any)?.lifecycle_status === "ACTIVE").length,
    active_count: allOutlets.filter((o) => (o.metadata as any)?.lifecycle_status === "ACTIVE").length,
    dormant: allOutlets.filter((o) => (o.metadata as any)?.lifecycle_status === "DORMANT").length,
    dormant_count: allOutlets.filter((o) => (o.metadata as any)?.lifecycle_status === "DORMANT").length,
    inactive: allOutlets.filter((o) => o.status === "INACTIVE" || o.status === "ARCHIVED").length,
    inactive_count: allOutlets.filter((o) => o.status === "INACTIVE" || o.status === "ARCHIVED").length,
  };
  res.json(summary);
});`;

if (regexSummary.test(file)) {
  file = file.replace(regexSummary, replacementSummary);
  console.log("Replaced /outlets/summary");
} else {
  console.log("Failed to match /outlets/summary");
}

const regexKpi = /apiRouter\.get\("\/outlets\/kpi", authMiddleware, \(req: AuthenticatedRequest, res\) => \{[\s\S]*?res\.json\(summary\);\n\}\);/;
const replacementKpi = `apiRouter.get("/outlets/kpi", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const filterSalesmanId = req.query.salesman_id as string;
  const targetSalesId = req.user!.role === "SALES" ? req.user!._id : filterSalesmanId;

  let allowedOutletIds: Set<string> | null = null;
  if (targetSalesId) {
    allowedOutletIds = new Set(getActiveAssignedOutletIds(targetSalesId));
  }

  await recalculateAllOutletStatusesAsync();

  const conditions = [];
  if (allowedOutletIds) {
    if (allowedOutletIds.size === 0) conditions.push(sql\`FALSE\`);
    else conditions.push(inArray(pgOutlets.id, Array.from(allowedOutletIds)));
  }

  const finalWhere = conditions.length > 0 ? and(...conditions) : undefined;
  const allOutlets = await sqlDb.query.outlets.findMany({ where: finalWhere });

  const summary = {
    total_outlets: allOutlets.length,
    prospect_count: allOutlets.filter((o) => (o.metadata as any)?.lifecycle_status === "PROSPECT").length,
    noo_count: allOutlets.filter((o) => (o.metadata as any)?.lifecycle_status === "NOO").length,
    repeat_count: allOutlets.filter((o) => (o.metadata as any)?.lifecycle_status === "REPEAT").length,
    active_count: allOutlets.filter((o) => (o.metadata as any)?.lifecycle_status === "ACTIVE").length,
    dormant_count: allOutlets.filter((o) => (o.metadata as any)?.lifecycle_status === "DORMANT").length,
  };
  res.json(summary);
});`;

if (regexKpi.test(file)) {
  file = file.replace(regexKpi, replacementKpi);
  console.log("Replaced /outlets/kpi");
} else {
  console.log("Failed to match /outlets/kpi");
}

fs.writeFileSync('server/routes.ts', file);
