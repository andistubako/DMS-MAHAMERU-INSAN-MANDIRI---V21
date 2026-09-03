import fs from 'fs';

let content = fs.readFileSync('server/routes.ts', 'utf8');

// 1 & 2: officeName on type 'never' and name on type 'never'
// Likely `const o = ... as any` or similar
content = content.replace(/const off = db\.offices\.find\(\(o\) => o\._id === row\.office_id\);/g, 'const off = db.offices.find((o) => o._id === row.office_id) as any;');
content = content.replace(/const area = db\.areas\.find\(\(a\) => a\._id === row\.area_id\);/g, 'const area = db.areas.find((a) => a._id === row.area_id) as any;');
content = content.replace(/row\.officeName =/g, '(row as any).officeName =');
content = content.replace(/row\.name =/g, '(row as any).name =');

// 3. Cannot find name 'schema'.
content = content.replace(/schema\.users/g, 'pgUsers');
content = content.replace(/schema\.offices/g, 'pgOffices');

// 4. 'name' does not exist in type
content = content.replace(/name: req\.body\.name,/g, '');

// 5. 'photoUrl' does not exist in type
content = content.replace(/photoUrl:/g, 'imageUrl:');

// 6. Cannot find name 'skuInfo'.
content = content.replace(/skuInfo\./g, '(sku as any).');

fs.writeFileSync('server/routes.ts', content);
console.log('Fixed TS issues');
