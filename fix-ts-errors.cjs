const fs = require('fs');
let file = fs.readFileSync('server/routes.ts', 'utf8');

// Fix metadata cast in recalculate
file = file.replace(/const meta = pgRec\.metadata \|\| \{\};/g, 'const meta = (pgRec.metadata as Record<string, any>) || {};');
file = file.replace(/const meta = pgRec \? \(pgRec\.metadata \|\| \{\}\) : \{\};/g, 'const meta = pgRec ? ((pgRec.metadata as Record<string, any>) || {}) : {};');

// Fix wilayah in POST and PUT
const wilayahReplaceRegex = /const prov = Object\.values\(db\.wilayah_hierarchy\)\.find\(p => p\.id === [a-zA-Z_]+\);\s+if \(prov\) \{\s+provName = prov\.name;\s+const reg = prov\.regencies\.find\(r => r\.id === [a-zA-Z_]+\);\s+if \(reg\) \{\s+regName = reg\.name;\s+const dist = reg\.districts\.find\(d => d\.id === [a-zA-Z_]+\);\s+if \(dist\) \{\s+distName = dist\.name;\s+const vil = dist\.villages\.find\(v => v\.id === [a-zA-Z_]+\);\s+if \(vil\) vilName = vil\.name;\s+\}\s+\}\s+\}/g;

const newWilayahLogic = `const prov = db.provinces.find(p => p.id === province_id);
    if (prov) {
      provName = prov.name;
      const reg = db.regencies.find(r => r.id === regency_id);
      if (reg) {
        regName = reg.name;
        const dist = db.districts.find(d => d.id === district_id);
        if (dist) {
          distName = dist.name;
          const vil = db.villages.find(v => v.id === village_id);
          if (vil) vilName = vil.name;
        }
      }
    }`;

// Since the variables are slightly different in POST and PUT, I will just do exact replacements
file = file.replace(/const prov = Object\.values\(db\.wilayah_hierarchy\)\.find\(p => p\.id === province_id\);[\s\S]*?vilName = vil\.name;\n\s+\}\n\s+\}\n\s+\}/, newWilayahLogic);

const newWilayahLogicPut = `const prov = db.provinces.find(p => p.id === targetProvId);
    if (prov) {
      provName = prov.name;
      const reg = db.regencies.find(r => r.id === targetRegId);
      if (reg) {
        regName = reg.name;
        const dist = db.districts.find(d => d.id === targetDistId);
        if (dist) {
          distName = dist.name;
          const vil = db.villages.find(v => v.id === targetVilId);
          if (vil) vilName = vil.name;
        }
      }
    }`;
file = file.replace(/const prov = Object\.values\(db\.wilayah_hierarchy\)\.find\(p => p\.id === targetProvId\);[\s\S]*?vilName = vil\.name;\n\s+\}\n\s+\}\n\s+\}/, newWilayahLogicPut);

fs.writeFileSync('server/routes.ts', file);
