import { createStealthClient } from './src/index.js';

const SERVER_URL = 'http://localhost:3000';

async function testSecurity() {
  console.log('🔒 Testing Proxy Secret Authentication\n');

  // Test 1: Without secret (should fail if PROXY_SECRET is set)
  console.log('Test 1: Request without secret...');
  try {
    const clientNoSecret = createStealthClient({
      baseURL: SERVER_URL,
      timeout: 5000
    });
    await clientNoSecret.get('https://httpbin.org/get');
    console.log('✓ Request succeeded (PROXY_SECRET not set on server)\n');
  } catch (error: any) {
    if (error.response?.status === 401) {
      console.log('✓ Request blocked with 401 Unauthorized (security working!)\n');
    } else {
      console.log(`✗ Unexpected error: ${error.message}\n`);
    }
  }

  // Test 2: With wrong secret (should fail)
  console.log('Test 2: Request with wrong secret...');
  try {
    const clientWrongSecret = createStealthClient({
      baseURL: SERVER_URL,
      proxySecret: 'wrong-secret-12345',
      timeout: 5000
    });
    await clientWrongSecret.get('https://httpbin.org/get');
    console.log('✗ Request succeeded with wrong secret (security issue!)\n');
  } catch (error: any) {
    if (error.response?.status === 401) {
      console.log('✓ Request blocked with 401 Unauthorized (security working!)\n');
    } else {
      console.log(`✗ Unexpected error: ${error.message}\n`);
    }
  }

  // Test 3: With correct secret (should succeed)
  console.log('Test 3: Request with correct secret...');
  try {
    const clientCorrectSecret = createStealthClient({
      baseURL: SERVER_URL,
      proxySecret: process.env.PROXY_SECRET,
      timeout: 5000
    });
    const response = await clientCorrectSecret.get('https://httpbin.org/get');
    if (response.status === 200) {
      console.log('✓ Request succeeded with correct secret!\n');
    }
  } catch (error: any) {
    if (error.response?.status === 401) {
      console.log('✗ Request blocked even with correct secret\n');
      console.log('   Make sure PROXY_SECRET env var matches server\n');
    } else {
      console.log(`✗ Error: ${error.message}\n`);
    }
  }

  console.log('🔒 Security test complete!');
  process.exit(0);
}

testSecurity().catch(console.error);
