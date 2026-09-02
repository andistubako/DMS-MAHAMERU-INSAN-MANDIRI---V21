import fetch from 'node-fetch';
fetch('http://localhost:3000/api/dashboard/owner', {
  headers: { 'Authorization': 'Bearer test' }
}).then(r => r.json()).then(console.log).catch(console.error);
