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
      
      const payloadSettings = JSON.stringify({
        currency_symbol: '$',
        theme: 'dark'
      });
      
      const putReq = http.request({
        hostname: 'localhost', port: 3000, path: '/api/settings', method: 'PUT',
        headers: { 'Cookie': cookieHeader, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payloadSettings) }
      }, (res2) => {
        let resData2 = '';
        res2.on('data', (chunk) => resData2 += chunk);
        res2.on('end', () => {
          console.log('\nPUT /settings Response:', res2.statusCode);
          console.log(resData2);
        });
      });
      putReq.write(payloadSettings);
      putReq.end();
    }
  });
});
req.write(loginData);
req.end();
