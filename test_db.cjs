const { db } = require('./dist/server.cjs');
console.log(db.prices.slice(0, 2));
