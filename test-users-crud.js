import http from 'http';

const loginData = JSON.stringify({ email: 'admin@mahameru.id', password: 'password' });

const loginOptions = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(loginData),
  },
};

const req = http.request(loginOptions, (res) => {
  let resData = '';
  res.on('data', (chunk) => resData += chunk);
  res.on('end', () => {
    const setCookie = res.headers['set-cookie'];
    if (setCookie) {
      const cookieHeader = setCookie.join('; ');
      
      // Test GET /api/users
      const getUsers = http.request({
        hostname: 'localhost',
        port: 3000,
        path: '/api/users',
        method: 'GET',
        headers: { 'Cookie': cookieHeader }
      }, (res2) => {
        let resData2 = '';
        res2.on('data', (chunk) => resData2 += chunk);
        res2.on('end', () => {
          console.log('\nGET /api/users Response:', res2.statusCode);
          console.log(resData2.substring(0, 300) + '...');
        });
      });
      getUsers.end();
    }
  });
});

req.write(loginData);
req.end();
