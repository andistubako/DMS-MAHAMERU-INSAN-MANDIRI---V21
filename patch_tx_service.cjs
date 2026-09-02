const fs = require('fs');
const file = './server/transaction.service.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  /import \{ isCloudSqlConnected, syncSingleDoc \} from "\.\/cloudsqlSync\.js";/,
  `import { isCloudSqlConnected, syncSingleDoc, reloadInventoryDataFromPostgres } from "./cloudsqlSync.js";`
);

code = code.replace(
  /  return await sqlDb\.transaction\(async \(tx\) => \{/,
  `  try {\n    return await sqlDb.transaction(async (tx) => {`
);

code = code.replace(
  /    return \{ transaction: inserted\[0\], replayed: false \};\n  \}\);\n\}/,
  `    return { transaction: inserted[0], replayed: false };\n    });\n  } finally {\n    await reloadInventoryDataFromPostgres(db);\n  }\n}`
);

fs.writeFileSync(file, code);
