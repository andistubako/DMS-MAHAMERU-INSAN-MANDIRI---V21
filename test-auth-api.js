import http from 'http';

const data = JSON.stringify({ email: 'admin@mahameru.id', password: 'password' });

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
  },
};

const req = http.request(options, (res) => {
  let resData = '';
  res.on('data', (chunk) => resData += chunk);
  res.on('end', () => {
    console.log('Login Response:', res.statusCode);
    console.log(resData);
    
    // Attempt /me if we got cookies
    const setCookie = res.headers['set-cookie'];
    if (setCookie) {
      const getMe = http.request({
        hostname: 'localhost',
        port: 3000,
        path: '/api/auth/me',
        method: 'GET',
        headers: { 'Cookie': setCookie.join('; ') }
      }, (res2) => {
        let resData2 = '';
        res2.on('data', (chunk) => resData2 += chunk);
        res2.on('end', () => {
          console.log('\nMe Response:', res2.statusCode);
          console.log(resData2);
        });
      });
      getMe.end();
    }
  });
});

req.write(data);
req.end();
