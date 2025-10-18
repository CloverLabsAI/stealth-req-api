# Installation from Git

## Quick Start

### 1. Install from GitHub

```bash
npm install git+https://github.com/CloverLabsAI/stealth-req-api.git
```

### 2. Set Environment Variables

Create a `.env` file or export variables:

```bash
export PROXY_SECRET=your-secret-here
```

### 3. Use in Your Project

```typescript
import { createStealthClient } from 'stealth-req-api';

// Create client (automatically reads PROXY_SECRET from env)
const client = createStealthClient({
  baseURL: 'http://3.138.141.82:3000', // Your proxy server URL
  tlsClientIdentifier: 'chrome_120',
  timeout: 30000
});

// Make requests
const response = await client.get('https://api.example.com/data');
console.log(response.data);
```

## Complete Example

```typescript
import { createStealthClient } from 'stealth-req-api';

async function main() {
  // Initialize client
  const client = createStealthClient({
    baseURL: 'http://3.138.141.82:3000'
  });

  // GET request
  const getResponse = await client.get('https://httpbin.org/get');
  console.log('GET:', getResponse.data);

  // POST request
  const postResponse = await client.post(
    'https://httpbin.org/post',
    { key: 'value' },
    {
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );
  console.log('POST:', postResponse.data);

  // PUT request
  const putResponse = await client.put(
    'https://httpbin.org/put',
    { updated: true }
  );
  console.log('PUT:', putResponse.data);

  // DELETE request
  const deleteResponse = await client.delete('https://httpbin.org/delete');
  console.log('DELETE:', deleteResponse.data);
}

main().catch(console.error);
```

## Configuration Options

```typescript
const client = createStealthClient({
  baseURL: 'http://3.138.141.82:3000',     // Required: Your proxy server URL
  tlsClientIdentifier: 'chrome_120',       // Optional: Browser fingerprint
  timeout: 30000,                          // Optional: Request timeout (ms)
  proxySecret: process.env.PROXY_SECRET    // Optional: Override env variable
});
```

### Available TLS Client Identifiers

- **Chrome**: `chrome_103` through `chrome_120`
- **Firefox**: `firefox_102` through `firefox_120`
- **Safari**: `safari_15_6_1`, `safari_16_0`, `safari_ios_15_5`, etc.
- **Edge**: `edge_101`, `edge_122`

## Features

✅ **TLS Fingerprinting** - Mimics real browser TLS signatures  
✅ **Rotating Proxies** - Built-in support for proxy rotation  
✅ **All HTTP Methods** - GET, POST, PUT, PATCH, DELETE, HEAD  
✅ **Custom Headers** - Full header control  
✅ **Axios Compatible** - Drop-in replacement for axios  
✅ **TypeScript** - Full type safety  

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PROXY_SECRET` | Authentication secret for proxy server | Yes |

## Troubleshooting

### 401 Unauthorized

```
Error: Request failed with status code 401
```

**Solution:** Check that `PROXY_SECRET` environment variable is set correctly.

```bash
export PROXY_SECRET=your-secret-here
```

### Connection Refused

```
Error: connect ECONNREFUSED
```

**Solution:** Verify the proxy server is running and accessible:

```bash
curl http://3.138.141.82:3000/health
```

### Timeout Errors

```
Error: timeout of 30000ms exceeded
```

**Solution:** Increase timeout or check network connectivity:

```typescript
const client = createStealthClient({
  baseURL: 'http://3.138.141.82:3000',
  timeout: 60000 // Increase to 60 seconds
});
```

## Testing Your Installation

Run the included test:

```bash
# Clone the repo first
git clone https://github.com/CloverLabsAI/stealth-req-api.git
cd stealth-req-api

# Install dependencies
npm install

# Set your proxy secret
export PROXY_SECRET=your-secret-here

# Run the test
npx tsx test-npm-install.ts
```

Expected output:
```
📦 Testing stealth-req-api as NPM Package
✓ Server is running
✓ Proxy routing working
✓ TLS_GREASE detected
✓ All HTTP methods working
🎉 All tests passed!
```

## Support

For issues or questions:
- GitHub Issues: https://github.com/CloverLabsAI/stealth-req-api/issues
- Documentation: https://github.com/CloverLabsAI/stealth-req-api#readme

## License

MIT
