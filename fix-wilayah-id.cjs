const fs = require('fs');
let file = fs.readFileSync('server/routes.ts', 'utf8');

file = file.replace(/const prov = db\.provinces\.find\(p => p\.id === /g, 'const prov = db.provinces.find(p => p._id === ');
file = file.replace(/const reg = db\.regencies\.find\(r => r\.id === /g, 'const reg = db.regencies.find(r => r._id === ');
file = file.replace(/const dist = db\.districts\.find\(d => d\.id === /g, 'const dist = db.districts.find(d => d._id === ');
file = file.replace(/const vil = db\.villages\.find\(v => v\.id === /g, 'const vil = db.villages.find(v => v._id === ');

fs.writeFileSync('server/routes.ts', file);
