import http from 'http';

const loginData = JSON.stringify({ email: 'admin@mahameru.id', password: 'password' });
const loginOptions = {
  hostname: 'localhost', port: 3000, path: '/api/auth/login', method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(loginData) }
};

const req = http.request(loginOptions, (res) => {
  let resData = '';
  res.on('data', (chunk) => resData += chunk);
  res.on('end', () => {
    const setCookie = res.headers['set-cookie'];
    if (setCookie) {
      const cookieHeader = setCookie.join('; ');
      
      const payload = JSON.stringify({
        name: 'Test Salesman Updated',
        status: 'ACTIVE'
      });
      
      // PUT
      const putUser = http.request({
        hostname: 'localhost', port: 3000, path: '/api/users/usr-1788336090222', method: 'PUT',
        headers: { 'Cookie': cookieHeader, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
      }, (res2) => {
        let resData2 = '';
        res2.on('data', (chunk) => resData2 += chunk);
        res2.on('end', () => {
          console.log('\nPUT Response:', res2.statusCode);
          console.log(resData2);
          
          // TOGGLE
          const toggleUser = http.request({
            hostname: 'localhost', port: 3000, path: '/api/users/usr-1788336090222/toggle', method: 'POST',
            headers: { 'Cookie': cookieHeader, 'Content-Type': 'application/json', 'Content-Length': 0 }
          }, (res3) => {
            let resData3 = '';
            res3.on('data', (chunk) => resData3 += chunk);
            res3.on('end', () => {
              console.log('\nTOGGLE Response:', res3.statusCode);
              console.log(resData3);
              
              // DELETE
              const deleteUser = http.request({
                hostname: 'localhost', port: 3000, path: '/api/users/usr-1788336090222', method: 'DELETE',
                headers: { 'Cookie': cookieHeader, 'Content-Type': 'application/json', 'Content-Length': 0 }
              }, (res4) => {
                let resData4 = '';
                res4.on('data', (chunk) => resData4 += chunk);
                res4.on('end', () => {
                  console.log('\nDELETE Response:', res4.statusCode);
                  console.log(resData4);
                });
              });
              deleteUser.end();
            });
          });
          toggleUser.end();
        });
      });
      putUser.write(payload);
      putUser.end();
    }
  });
});
req.write(loginData);
req.end();
