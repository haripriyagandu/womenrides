const http = require('http');

const data = JSON.stringify({
  name: 'Trial User',
  phone: '0000000000',
  email: 'trial@example.com',
  password: 'password123',
  role: 'customer',
  aadharNumber: '123456789012'
});

const options = {
  hostname: 'localhost',
  port: 5001,
  path: '/api/auth/register',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (d) => body += d);
  res.on('end', () => {
    console.log('Status Code:', res.statusCode);
    console.log('Response Body:', body);
  });
});

req.on('error', (e) => {
  console.error('Problem with request:', e.message);
});

req.write(data);
req.end();
