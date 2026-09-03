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
        name: 'Test Salesman',
        email: 'testsales@mahameru.id',
        password: 'password123',
        role: 'SALES',
        phone: '081234567890',
        office_id: 'off-1',
        area_id: 'area-1'
      });
      
      const postUser = http.request({
        hostname: 'localhost', port: 3000, path: '/api/users', method: 'POST',
        headers: { 'Cookie': cookieHeader, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
      }, (res2) => {
        let resData2 = '';
        res2.on('data', (chunk) => resData2 += chunk);
        res2.on('end', () => {
          console.log('\nPOST /api/users Response:', res2.statusCode);
          console.log(resData2);
        });
      });
      postUser.write(payload);
      postUser.end();
    }
  });
});
req.write(loginData);
req.end();
