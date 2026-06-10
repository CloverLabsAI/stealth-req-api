# stealth-req-api

High-performance proxy API and client for making stealthy HTTP requests with custom TLS fingerprints. Built with TypeScript, Fastify, Axios, and tlsclientwrapper.

## Features

- 🔒 **TLS Fingerprinting** - Mimic real browser signatures (Chrome, Safari, Firefox)
- ⚡ **High Performance** - Built on Fastify
- 🌐 **Full HTTP Support** - All methods (GET, POST, PUT, PATCH, DELETE, etc.)
- 🔄 **Proxy Support** - Pass per-request proxies while keeping a legacy server fallback
- 💪 **TypeScript** - Fully typed
- 📦 **Dual Package** - Use as server or import client library

## Quick Start

### Installation

```bash
npm install github:CloverLabsAI/stealth-req-api
```

This package is ESM-first. CommonJS `require` only works on Node versions with
synchronous ESM loading support; use `import` for the broadest compatibility.

### Client Usage

Create a `.env` file in your project:

```env
STEALTH_REQ_HOST=http://your-server:3000
STEALTH_REQ_SECRET=your-secret-here
```

Use the client:

```typescript
import { createStealthClient } from "stealth-req-api";

// Auto-reads from STEALTH_REQ_HOST and STEALTH_REQ_SECRET
const client = createStealthClient();

// Use like axios
const response = await client.get("https://httpbin.org/ip");
console.log(response.data);
```

### Server Setup

1. **Clone and install:**

```bash
git clone https://github.com/CloverLabsAI/stealth-req-api.git
cd stealth-req-api
npm install
```

2. **Configure `.env`:**

```env
PORT=3000
HOST=0.0.0.0
PROXY_SECRET=your-random-uuid-here
# Optional legacy fallback. Prefer passing proxyUrl per request.
DEFAULT_PROXY_URL=
```

3. **Run:**

```bash
npm run dev        # Development with auto-reload
npm run build      # Build for production
npm start          # Production
```

## Configuration

### Client Options

```typescript
const client = createStealthClient({
  baseURL: "http://localhost:3000", // Server URL (default: STEALTH_REQ_HOST)
  proxySecret: "secret", // Auth secret (default: STEALTH_REQ_SECRET)
  tlsClientIdentifier: "chrome_120", // TLS fingerprint (default: chrome_120)
  timeout: 30000, // Request timeout in ms
  proxyUrl: "http://proxy.com:port", // Optional default proxy
  followRedirects: true, // Follow redirects
  insecureSkipVerify: false, // Skip TLS verification
});
```

For tracked Clover proxy usage, select a proxy through Roverfox Manager in the
calling service, then pass that URL into this client:

```typescript
await client.get("https://api.example.com", {
  proxyUrl: roverfoxProxy.proxyUrl,
});
```

`stealth-req-api` does not choose Roverfox service routes itself. Clover
services should select proxies through Roverfox Manager and pass the returned
`proxyUrl` to this client so usage stays attributed to the correct service.

For public compatibility, the server still supports `DEFAULT_PROXY_URL` as a
deprecated fallback when a request omits `proxyUrl`. A caller-provided `proxyUrl`
always wins. Use `proxyUrl: null` on a request when you need to force a direct
request even if a client default or server fallback exists. Empty-string
`proxyUrl` values are treated the same way for backwards compatibility.

Multipart `FormData`, `Blob`, and stream request bodies are not supported by the
proxy transport. Use `Buffer`, `ArrayBuffer`, `URLSearchParams`, strings, or
JSON-serializable data.

### Environment Variables

**Client:**

- `STEALTH_REQ_HOST` - Server URL
- `STEALTH_REQ_SECRET` - Authentication secret

**Server:**

- `PORT` - Server port (default: 3000)
- `HOST` - Server host (default: 0.0.0.0)
- `PROXY_SECRET` - Authentication secret (generate with `node -e "console.log(crypto.randomUUID())"`)
- `DEFAULT_PROXY_URL` - Deprecated fallback proxy for requests that omit `proxyUrl`

## API Reference

### Client Methods

```typescript
// GET request
await client.get(url, config?)

// POST request
await client.post(url, data?, config?)

// PUT request
await client.put(url, data?, config?)

// PATCH request
await client.patch(url, data?, config?)

// DELETE request
await client.delete(url, config?)
```

### Server Endpoints

**Health Check:**

```bash
GET /health
```

**Proxy Request:**

```bash
POST /proxy
Content-Type: application/json
X-Proxy-Secret: your-secret

{
  "url": "https://example.com",
  "method": "GET",
  "headers": {},
  "body": null,
  "proxyUrl": "http://proxy.example.com:8000",
  "clientIdentifier": "chrome_120",
  "timeout": 30000
}
```

## TLS Fingerprints

Available browser fingerprints:

**Chrome:** `chrome_103` - `chrome_120`  
**Safari:** `safari_15_6_1`, `safari_16_0`, `safari_ios_16_0`  
**Firefox:** `firefox_102` - `firefox_120`  
**Opera:** `opera_89` - `opera_91`  
**Mobile:** `nike_ios_mobile`, `zalando_android_mobile`, etc.

## Examples

### Basic Request

```typescript
const client = createStealthClient();
const response = await client.get("https://api.example.com/data");
```

### POST with JSON

```typescript
const response = await client.post("https://api.example.com/create", {
  name: "Test",
  value: 123,
});
```

### Custom Headers

```typescript
const response = await client.get("https://api.example.com", {
  headers: { "X-Custom": "value" },
});
```

### Different Browser Fingerprint

```typescript
const client = createStealthClient({
  tlsClientIdentifier: "safari_ios_16_0",
});
```

### Programmatic Server

```typescript
import { startServer } from "stealth-req-api/server";
await startServer();
```

## Architecture

```
Your App → stealth-req-api client → stealth-req-api server → Target Site
           (axios)                   (tlsclientwrapper)
```

The client sends requests to your proxy server, which uses tlsclientwrapper to make requests with custom TLS fingerprints that mimic real browsers.

## Security

- Always set `PROXY_SECRET` in production
- Use HTTPS in production
- Keep proxy credentials secure
- Rotate secrets regularly

## License

MIT
