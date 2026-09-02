fetch('http://localhost:3000/api/reports/outlets/out-1', {
  headers: { 'Authorization': 'Bearer ' + 'dummy_if_needed' }
}).then(r => r.json()).then(console.log).catch(console.error);
