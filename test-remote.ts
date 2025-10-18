import { createStealthClient } from './src/index.js';

const REMOTE_SERVER = 'http://3.138.141.82:3000';

async function testRemoteServer() {
  console.log('🌐 Testing Remote Server\n');
  console.log(`Server: ${REMOTE_SERVER}`);
  console.log(`Proxy Secret: ${process.env.PROXY_SECRET ? '✓ Set' : '✗ Not set'}\n`);

  const client = createStealthClient({
    baseURL: REMOTE_SERVER,
    tlsClientIdentifier: 'chrome_120',
    timeout: 30000
    // proxySecret auto-reads from process.env.PROXY_SECRET
  });

  // Test 1: Health check
  console.log('Test 1: Health Check');
  try {
    const healthResponse = await fetch(`${REMOTE_SERVER}/health`);
    const healthData = await healthResponse.json();
    console.log(`✓ Health check: ${JSON.stringify(healthData)}\n`);
  } catch (error: any) {
    console.log(`✗ Health check failed: ${error.message}\n`);
  }

  // Test 2: Simple GET request
  console.log('Test 2: GET Request (httpbin.org)');
  try {
    const response = await client.get('https://httpbin.org/get');
    console.log(`✓ Status: ${response.status}`);
    console.log(`✓ Response length: ${JSON.stringify(response.data).length} bytes\n`);
  } catch (error: any) {
    console.log(`✗ GET request failed: ${error.message}`);
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Data: ${JSON.stringify(error.response.data)}\n`);
    }
  }

  // Test 3: POST request
  console.log('Test 3: POST Request (httpbin.org)');
  try {
    const postData = {
      message: 'Test from stealth-req-api',
      timestamp: Date.now()
    };
    const response = await client.post('https://httpbin.org/post', postData);
    console.log(`✓ Status: ${response.status}`);
    console.log(`✓ Response length: ${JSON.stringify(response.data).length} bytes\n`);
  } catch (error: any) {
    console.log(`✗ POST request failed: ${error.message}\n`);
  }

  // Test 4: TLS Fingerprint check
  console.log('Test 4: TLS Fingerprint (tls.peet.ws)');
  try {
    const response = await client.get('https://tls.peet.ws/api/all');
    const dataStr = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
    
    if (dataStr.includes('TLS_GREASE') || dataStr.includes('tls_grease')) {
      console.log('✓ TLS_GREASE detected in fingerprint!');
      
      // Try to parse and show JA3
      try {
        const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
        if (data.tls?.ja3) {
          console.log(`✓ JA3: ${data.tls.ja3.substring(0, 30)}...\n`);
        }
      } catch (e) {
        console.log('✓ TLS fingerprinting working\n');
      }
    } else {
      console.log('✗ TLS_GREASE not found\n');
    }
  } catch (error: any) {
    console.log(`✗ TLS fingerprint test failed: ${error.message}\n`);
  }

  // Test 5: Real-world request
  console.log('Test 5: Real-world Request (httpbin user-agent)');
  try {
    const response = await client.get('https://httpbin.org/user-agent');
    console.log(`✓ Status: ${response.status}`);
    console.log(`✓ Response: ${JSON.stringify(response.data).substring(0, 100)}\n`);
  } catch (error: any) {
    console.log(`✗ Real-world request failed: ${error.message}\n`);
  }

  console.log('🎉 Remote server test complete!');
  process.exit(0);
}

testRemoteServer().catch(error => {
  console.error(`\n❌ Fatal error: ${error.message}`);
  process.exit(1);
});
