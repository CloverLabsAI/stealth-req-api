# Usage Guide

## Quick Start

### 1. Install from Git

```bash
npm install git+https://github.com/yourusername/stealth-req-api.git
```

### 2. Start the Proxy Server

**Option A: In this project**
```bash
npm run server
```

**Option B: After installing as a module**
```bash
npx stealth-req-server
```

**Option C: Programmatically**
```typescript
import { startServer } from 'stealth-req-api';
startServer();
```

### 3. Use the Client

```typescript
import { createStealthClient } from 'stealth-req-api';

// Create client
const client = createStealthClient({
  baseURL: 'http://localhost:3000',
  clientIdentifier: 'chrome_120'
});

// Make requests
const response = await client.get('https://example.com');
console.log(response.data);
```

## Installation Methods

### Method 1: Install from Git (Recommended for use as a library)

```bash
npm install git+https://github.com/yourusername/stealth-req-api.git
```

Then in your code:
```typescript
import { createStealthClient, startServer } from 'stealth-req-api';
```

### Method 2: Clone and Link Locally

```bash
git clone https://github.com/yourusername/stealth-req-api.git
cd stealth-req-api
npm install
npm run build
npm link
```

In your project:
```bash
npm link stealth-req-api
```

### Method 3: Clone and Run Standalone

```bash
git clone https://github.com/yourusername/stealth-req-api.git
cd stealth-req-api
npm install
npm run server
```

## Client Examples

### Basic GET Request

```typescript
import { createStealthClient } from 'stealth-req-api';

const client = createStealthClient({
  baseURL: 'http://localhost:3000'
});

const response = await client.get('https://api.example.com/data');
console.log(response.data);
```

### POST Request with Headers

```typescript
const response = await client.post(
  'https://api.example.com/submit',
  { name: 'John', email: 'john@example.com' },
  {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer token123'
    }
  }
);
```

### Using Different TLS Fingerprints

```typescript
const client = createStealthClient({
  baseURL: 'http://localhost:3000',
  clientIdentifier: 'firefox_120' // Mimic Firefox
});
```

### With Rotating Proxy

```typescript
const client = createStealthClient({
  baseURL: 'http://localhost:3000',
  proxyUrl: 'http://proxy.example.com:8080'
});
```

## Server Configuration

Create a `.env` file:

```env
PORT=3000
HOST=0.0.0.0
```

## Available TLS Client Identifiers

- Chrome: `chrome_103` through `chrome_120`
- Firefox: `firefox_102` through `firefox_120`
- Safari: `safari_15_6_1`, `safari_16_0`, `safari_ios_15_5`, etc.
- Opera: `opera_89`, `opera_90`, `opera_91`
- Mobile: `nike_ios_mobile`, `zalando_android_mobile`, etc.

## Troubleshooting

### Server not starting
- Check if port 3000 is already in use
- Verify all dependencies are installed: `npm install`
- Build the project: `npm run build`

### Client connection errors
- Ensure the server is running
- Check the `baseURL` in client configuration
- Verify network connectivity

### TypeScript errors
- Run `npm run type-check` to see all type errors
- Ensure you've built the project: `npm run build`
