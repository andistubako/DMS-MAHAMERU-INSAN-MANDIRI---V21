import fs from 'fs';

let content = fs.readFileSync('server/routes.ts', 'utf8');
content = content.replace(
`    const allUsers = await sqlDb.query.users.findMany({
      with: {
        office: true,
        area: true,
      },
      orderBy: (users, { desc }) => [desc(users.createdAt)],
    });`,
`    const allUsers = await sqlDb.query.users.findMany({
      orderBy: (users, { desc }) => [desc(users.createdAt)],
    });
    
    // Fetch areas and offices for mapping
    const allOffices = await sqlDb.query.offices.findMany();
    const allAreas = await sqlDb.query.areas.findMany();
    const officeMap = new Map(allOffices.map(o => [o.id, o.officeName]));
    const areaMap = new Map(allAreas.map(a => [a.id, a.areaName]));`
);

content = content.replace(
`        office_name: u.office?.officeName || "-",
        area_name: u.area?.areaName || "-",`,
`        office_name: u.officeId ? officeMap.get(u.officeId) || "-" : "-",
        area_name: u.areaId ? areaMap.get(u.areaId) || "-" : "-",`
);

fs.writeFileSync('server/routes.ts', content);
console.log('Fixed GET /users query in routes.ts');
