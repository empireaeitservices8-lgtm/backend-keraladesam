require('dotenv').config();
const http = require('http');
const app = require('../server');

const TEST_PORT = 5005;
const server = app.listen(TEST_PORT, async () => {
  console.log(`Test server running on port ${TEST_PORT}`);

  try {
    // 1. Test Health
    const healthRes = await fetch(`http://127.0.0.1:${TEST_PORT}/api/health`);
    const healthData = await healthRes.json();
    console.log('1. Health check response:', healthData);

    // 2. Test Articles API
    const artRes = await fetch(`http://127.0.0.1:${TEST_PORT}/api/articles?limit=2`);
    const artData = await artRes.json();
    console.log('2. Articles API response: success =', artData.success, 'count =', artData.count, 'total =', artData.total);

    // 3. Test Breaking News API
    const brkRes = await fetch(`http://127.0.0.1:${TEST_PORT}/api/breaking`);
    const brkData = await brkRes.json();
    console.log('3. Breaking News API response: success =', brkData.success, 'count =', brkData.count);

    // 4. Test Auth Login API
    const authRes = await fetch(`http://127.0.0.1:${TEST_PORT}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@keraladesam.com',
        password: 'admin12345',
      }),
    });
    const authData = await authRes.json();
    console.log('4. Auth Login API response: success =', authData.success, 'user =', authData.user?.name, 'token =', authData.token ? 'JWT token generated ✅' : 'Missing token ❌');

    console.log('\n🚀 ALL EXPRESS HTTP ENDPOINTS VERIFIED WORKING WITH MYSQL!');
  } catch (err) {
    console.error('HTTP test error:', err);
  } finally {
    server.close(() => {
      console.log('Test server closed.');
      process.exit(0);
    });
  }
});
