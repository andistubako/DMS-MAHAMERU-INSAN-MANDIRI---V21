import fs from 'fs';

let content = fs.readFileSync('server/routes.ts', 'utf8');

const getAreasIndex = content.indexOf('apiRouter.get("/areas"');
const endAreasIndex = content.indexOf('apiRouter.get("/routes"', getAreasIndex);

const newAreasChannelsRoutes = `
apiRouter.get("/channels", authMiddleware, async (req, res) => {
  try {
    const channels = await sqlDb.query.channels.findMany({
      orderBy: (channels, { asc }) => [asc(channels.channelName)],
    });
    const items = channels.map(c => ({
      _id: c.id,
      id: c.id,
      name: c.channelName,
      channel_code: c.channelCode,
      status: c.status,
      metadata: c.metadata,
    }));
    res.json({ items, total: items.length });
  } catch (err: any) {
    res.status(500).json({ detail: err.message });
  }
});

apiRouter.get("/areas", authMiddleware, async (req, res) => {
  try {
    const areas = await sqlDb.query.areas.findMany({
      orderBy: (areas, { asc }) => [asc(areas.areaName)],
      with: { office: true, regency: true },
    });
    const items = areas.map(a => ({
      _id: a.id,
      id: a.id,
      name: a.areaName,
      area_code: a.areaCode,
      office_id: a.officeId,
      regency_id: a.regencyId,
      status: a.status,
      created_at: a.createdAt?.toISOString(),
      metadata: a.metadata,
      office_name: a.office?.officeName,
      regency_name: a.regency?.name,
    }));
    res.json({ items, total: items.length });
  } catch (err: any) {
    res.status(500).json({ detail: err.message });
  }
});

`;

const getChannelsIndex = content.indexOf('apiRouter.get("/channels"');
content = content.substring(0, getChannelsIndex) + newAreasChannelsRoutes + content.substring(endAreasIndex);

fs.writeFileSync('server/routes.ts', content);
console.log('GET /areas and /channels endpoints patched');
