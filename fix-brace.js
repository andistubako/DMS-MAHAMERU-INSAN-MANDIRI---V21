import fs from 'fs';
let content = fs.readFileSync('server/routes.ts', 'utf8');

const target = `        areaId: area_id || "area-1",
        status: "ACTIVE",
      });
  }
});

apiRouter.put("/users/:id"`;

const replacement = `        areaId: area_id || "area-1",
        status: "ACTIVE",
      });
      
      res.status(201).json(memItem);
  } catch (err: any) {
      if (err.code === "23505") return res.status(400).json({ detail: "Email sudah terdaftar." });
      res.status(500).json({ detail: err.message });
  }
});

apiRouter.put("/users/:id"`;

content = content.replace(target, replacement);
fs.writeFileSync('server/routes.ts', content);
