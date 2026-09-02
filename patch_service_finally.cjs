const fs = require('fs');
const file = './server/inventory.service.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  /import \{ isCloudSqlConnected \} from "\.\/cloudsqlSync\.js";/,
  `import { isCloudSqlConnected, reloadInventoryDataFromPostgres } from "./cloudsqlSync.js";\nimport { db } from "./data.js";`
);

// Add finally blocks
code = code.replace(/    \} catch \(err: any\) \{\n      console.warn\("\[InventoryService\] deductSalesStock Postgres notice:", err\?.message \|\| err\);\n      return null;\n    \}/g,
`    } catch (err: any) {
      console.warn("[InventoryService] deductSalesStock Postgres notice:", err?.message || err);
      return null;
    } finally {
      await reloadInventoryDataFromPostgres(db);
    }`);

code = code.replace(/    \} catch \(err: any\) \{\n      console.warn\("\[InventoryService\] deductWarehouseStockForSales Postgres notice:", err\?.message \|\| err\);\n      return null;\n    \}/g,
`    } catch (err: any) {
      console.warn("[InventoryService] deductWarehouseStockForSales Postgres notice:", err?.message || err);
      return null;
    } finally {
      await reloadInventoryDataFromPostgres(db);
    }`);

code = code.replace(/    \} catch \(err: any\) \{\n      console.warn\("\[InventoryService\] processHandover Postgres notice:", err\?.message \|\| err\);\n    \}/g,
`    } catch (err: any) {
      console.warn("[InventoryService] processHandover Postgres notice:", err?.message || err);
    } finally {
      await reloadInventoryDataFromPostgres(db);
    }`);

code = code.replace(/    \} catch \(err: any\) \{\n      console.warn\("\[InventoryService\] processReturn Postgres notice:", err\?.message \|\| err\);\n    \}/g,
`    } catch (err: any) {
      console.warn("[InventoryService] processReturn Postgres notice:", err?.message || err);
    } finally {
      await reloadInventoryDataFromPostgres(db);
    }`);

code = code.replace(/    \} catch \(err: any\) \{\n      console.warn\("\[InventoryService\] Postgres transaction notice in processReceiving:", err\?.message \|\| err\);\n    \}/g,
`    } catch (err: any) {
      console.warn("[InventoryService] Postgres transaction notice in processReceiving:", err?.message || err);
    } finally {
      await reloadInventoryDataFromPostgres(db);
    }`);

code = code.replace(/    \} catch \(err: any\) \{\n      console.warn\("\[InventoryService\] reverseSalesStock Postgres notice:", err\?.message \|\| err\);\n      return null;\n    \}/g,
`    } catch (err: any) {
      console.warn("[InventoryService] reverseSalesStock Postgres notice:", err?.message || err);
      return null;
    } finally {
      await reloadInventoryDataFromPostgres(db);
    }`);

code = code.replace(/    \} catch \(err: any\) \{\n      console.warn\("\[InventoryService\] processOpname Postgres notice:", err\?.message \|\| err\);\n    \}/g,
`    } catch (err: any) {
      console.warn("[InventoryService] processOpname Postgres notice:", err?.message || err);
    } finally {
      if (!txArg) await reloadInventoryDataFromPostgres(db);
    }`);

fs.writeFileSync(file, code);
