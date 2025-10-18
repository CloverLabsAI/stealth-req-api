# stealth-req-api

A high-performance proxy API and client library built with **TypeScript**, **Fastify**, **Axios**, and **tlsclientwrapper** for making stealthy HTTP requests with custom TLS fingerprints.

## Features

- ⚡ **High Performance**: Built on Fastify, one of the fastest Node.js frameworks
- 🔒 **TLS Fingerprinting**: Uses tlsclientwrapper to mimic browser TLS signatures
- 🌐 **CORS Enabled**: Ready for cross-origin requests
- 📝 **Flexible API**: Support for GET and POST proxy endpoints
- 🔄 **Full HTTP Support**: All HTTP methods (GET, POST, PUT, PATCH, DELETE, etc.)
- 💪 **TypeScript**: Fully typed for better developer experience
- 📦 **Dual Package**: Use as a server or import the axios-based client in your projects
- 🔌 **Easy Integration**: Install directly from Git

## Installation

### Install from Git

```bash
npm install git+https://github.com/yourusername/stealth-req-api.git
```

### For Development

```bash
git clone https://github.com/yourusername/stealth-req-api.git
cd stealth-req-api
npm install
```

## Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Edit `.env`:
```
PORT=3000
HOST=0.0.0.0

# Security: Set a random UUID to protect your proxy endpoint
PROXY_SECRET=your-random-uuid-here

# Default rotating proxy (optional)
DEFAULT_PROXY_URL=http://user:pass@proxy.example.com:port
```

Generate a secure UUID:
```bash
node -e "console.log(crypto.randomUUID())"
```

**Note:** If `DEFAULT_PROXY_URL` is set, all requests will be routed through this proxy by default. You can override it per-request by passing a different `proxyUrl` in the request body.

## Usage

### As a Module (Client)

After installing from Git, you can use the axios-based client in your project:

```typescript
import { createStealthClient } from 'stealth-req-api';

// Create a stealth client that connects to your proxy server
const client = createStealthClient({
  baseURL: 'http://localhost:3000', // Your proxy server URL
  tlsClientIdentifier: 'chrome_120',
  timeout: 30000
  // proxySecret automatically reads from process.env.PROXY_SECRET
});

// Use it like a normal axios instance
const response = await client.get('https://www.google.com/search?q=test');
console.log(response.data);

// POST request
const postResponse = await client.post('https://api.example.com/data', {
  key: 'value'
}, {
  headers: {
    'Content-Type': 'application/json'
  }
});
```

**Client Configuration Options:**
- `baseURL` - URL of the stealth-req-api server (default: 'http://localhost:3000')
- `timeout` - Request timeout in ms (default: 30000)
- `tlsClientIdentifier` - TLS client identifier (default: 'chrome_120')
- `proxyUrl` - Optional proxy URL to route requests through
- `followRedirects` - Follow redirects (default: true)
- `insecureSkipVerify` - Skip TLS verification (default: false)
- `proxySecret` - Authentication secret (default: auto-reads from `process.env.PROXY_SECRET`)

### As a Server

#### Run the server in this project

```bash
npm run server
```

#### Programmatic Server Usage

If you need to start the server programmatically in your code:

```typescript
import { startServer } from 'stealth-req-api/server';

await startServer();
```

**Note:** The server module is separate from the client to avoid loading heavy dependencies (`tlsclientwrapper`) when you only need the client.

#### Build and start (production)

```bash
npm run build
npm start
```

#### Development with auto-reload

```bash
npm run dev
```

#### Run server after installing as a module

If you installed this package in another project, you can start the server with:

```bash
npx stealth-req-server
```

Or add to your package.json scripts:
```json
{
  "scripts": {
    "proxy-server": "stealth-req-server"
  }
}
```

### Type checking

```bash
npm run type-check
```

### API Endpoints (Direct Server Usage)

#### Health Check
```bash
GET /health
```

#### Proxy Request (POST)

```bash
POST /proxy
Content-Type: application/json

{
  "url": "https://example.com",
  "method": "GET",
  "headers": {
    "User-Agent": "Custom User Agent"
  },
  "body": null,
  "clientIdentifier": "chrome_120",
  "followRedirects": true,
  "insecureSkipVerify": false,
  "timeout": 30000
}
```

**Parameters:**
- `url` (required): Target URL to proxy
- `method` (optional): HTTP method - GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS (default: "GET")
- `headers` (optional): Custom headers object
- `body` (optional): Request body for POST/PUT/PATCH
- `proxyUrl` (optional): Proxy URL to route requests through (e.g., "http://proxy:port")
- `clientIdentifier` (optional): TLS client identifier (default: "chrome_120")
- `followRedirects` (optional): Follow redirects (default: true)
- `insecureSkipVerify` (optional): Skip TLS verification (default: false)
- `timeout` (optional): Request timeout in ms (default: 30000)

#### Proxy Request (GET)

Simple GET proxy:
```bash
GET /proxy?url=https://example.com&clientIdentifier=chrome_120
```

### Example Requests

**Using curl:**
```bash
# Simple GET request
curl "http://localhost:3000/proxy?url=https://www.google.com/search?q=test"

# POST request with custom headers
curl -X POST http://localhost:3000/proxy \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://api.example.com/data",
    "method": "POST",
    "headers": {
      "Authorization": "Bearer token123",
      "Content-Type": "application/json"
    },
    "body": {
      "key": "value"
    }
  }'

# With rotating proxy
curl -X POST http://localhost:3000/proxy \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.google.com",
    "method": "GET",
    "proxyUrl": "http://proxy.example.com:8080",
    "clientIdentifier": "chrome_120"
  }'
```

**Using JavaScript/fetch:**
```javascript
const response = await fetch('http://localhost:3000/proxy', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    url: 'https://api.example.com',
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0'
    },
    clientIdentifier: 'chrome_120'
  })
});

const data = await response.json();
console.log(data);
```

## Available TLS Client Identifiers

- `chrome_103`, `chrome_104`, `chrome_105`, `chrome_106`, `chrome_107`, `chrome_108`, `chrome_109`, `chrome_110`, `chrome_111`, `chrome_112`, `chrome_116_PSK`, `chrome_116_PSK_PQ`, `chrome_117`, `chrome_120`
- `safari_15_6_1`, `safari_16_0`, `safari_ipad_15_6`, `safari_ios_15_5`, `safari_ios_15_6`, `safari_ios_16_0`
- `firefox_102`, `firefox_104`, `firefox_105`, `firefox_106`, `firefox_108`, `firefox_110`, `firefox_117`, `firefox_120`
- `opera_89`, `opera_90`, `opera_91`
- `zalando_android_mobile`, `zalando_ios_mobile`
- `nike_ios_mobile`, `nike_android_mobile`
- `cloudscraper`, `mms_ios`, `mesh_ios`, `mesh_ios_1`, `mesh_ios_2`, `mesh_android`, `mesh_android_1`, `mesh_android_2`
- `confirmed_ios`, `confirmed_android`
- `okhttp4_android_7`, `okhttp4_android_8`, `okhttp4_android_9`, `okhttp4_android_10`, `okhttp4_android_11`, `okhttp4_android_12`, `okhttp4_android_13`

## Complete Example

Here's a complete example showing both server and client usage:

```typescript
// server.ts - Start the proxy server
import { startServer } from 'stealth-req-api';

startServer();
```

```typescript
// client.ts - Use the client in your application
import { createStealthClient } from 'stealth-req-api';

const client = createStealthClient({
  baseURL: 'http://localhost:3000',
  tlsClientIdentifier: 'chrome_120'
  // proxySecret auto-reads from process.env.PROXY_SECRET
});

async function fetchData() {
  // GET request
  const response = await client.get('https://api.example.com/data');
  console.log(response.data);

  // POST request with headers
  const postResponse = await client.post(
    'https://api.example.com/submit',
    { name: 'John', email: 'john@example.com' },
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer token123'
      }
    }
  );
  console.log(postResponse.data);
}

fetchData();
```

## Architecture

This package provides two main components:

1. **Server**: A Fastify-based proxy server that uses `tlsclientwrapper` to make requests with custom TLS fingerprints
2. **Client**: An axios-based client that automatically routes all requests through the proxy server

```
Your App → Axios Client → Proxy Server → tlsclientwrapper → Target Website
```

## Default Rotating Proxy

You can configure a default rotating proxy that will be used for all requests:

```env
# .env
DEFAULT_PROXY_URL=http://username:password@proxy.example.com:port
```

**Benefits:**
- All requests automatically route through the proxy
- No need to specify `proxyUrl` in each request
- Can be overridden per-request if needed
- Supports rotating proxies for better anonymity

**Override per request:**
```typescript
// This request will use a different proxy
const response = await client.post('https://example.com', {
  url: 'https://example.com',
  proxyUrl: 'http://different-proxy.com:8080' // Override default
});
```

## Security

### Proxy Secret Authentication

Protect your proxy server with a secret token to prevent unauthorized access:

1. **Set `PROXY_SECRET` in your `.env` file:**
   ```bash
   PROXY_SECRET=$(node -e "console.log(crypto.randomUUID())")
   ```

2. **Client automatically reads from environment:**
   ```typescript
   // Just set PROXY_SECRET env var before running your app
   const client = createStealthClient({
     baseURL: 'http://localhost:3000'
     // proxySecret auto-reads from process.env.PROXY_SECRET
   });
   ```

3. **All requests require `X-Proxy-Secret` header:**
   - Client automatically adds the header from `process.env.PROXY_SECRET`
   - Server returns `401 Unauthorized` if secret is missing or invalid
   - Leave `PROXY_SECRET` empty to disable authentication (not recommended for production)
   - You can override by passing `proxySecret` explicitly in config

### Direct API Usage with Secret

If using the API directly (not through the client):

```bash
curl -X POST http://localhost:3000/proxy \
  -H "Content-Type: application/json" \
  -H "X-Proxy-Secret: your-secret-uuid" \
  -d '{"url": "https://example.com"}'
```

## Performance

Fastify is capable of handling **30,000+ requests per second** on modern hardware, making this proxy API suitable for high-throughput applications.

## Project Structure

```
stealth-req-api/
├── src/
│   ├── index.ts          # Main exports
│   ├── client.ts         # Axios-based client
│   ├── server.ts         # Fastify proxy server
│   └── bin/
│       └── server.ts     # CLI entry point
├── dist/                 # Compiled output
├── package.json
├── tsconfig.json
└── README.md
```

## License

MIT