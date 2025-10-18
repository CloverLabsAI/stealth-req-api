# Security Guide

## Proxy Secret Authentication

The stealth-req-api supports header-based authentication to protect your proxy server from unauthorized access.

### Setup

1. **Generate a secure UUID:**
   ```bash
   node -e "console.log(crypto.randomUUID())"
   # Example output: 550e8400-e29b-41d4-a716-446655440000
   ```

2. **Add to your `.env` file:**
   ```env
   PROXY_SECRET=550e8400-e29b-41d4-a716-446655440000
   ```

3. **Restart the server:**
   ```bash
   npm run server
   ```

### Client Configuration

The client automatically reads `PROXY_SECRET` from environment variables:

```typescript
import { createStealthClient } from 'stealth-req-api';

// Set PROXY_SECRET env var before running your app
const client = createStealthClient({
  baseURL: 'http://localhost:3000'
  // proxySecret automatically reads from process.env.PROXY_SECRET
});

// All requests now include X-Proxy-Secret header automatically
const response = await client.get('https://example.com');
```

**Override if needed:**
```typescript
const client = createStealthClient({
  baseURL: 'http://localhost:3000',
  proxySecret: 'custom-secret-override' // Optional override
});
```

### How It Works

1. **Server checks** for `X-Proxy-Secret` header on every `/proxy` request
2. **If PROXY_SECRET is set** in server's `.env`:
   - Missing header → `401 Unauthorized`
   - Wrong secret → `401 Unauthorized`
   - Correct secret → Request proceeds
3. **If PROXY_SECRET is empty** → No authentication (development only)

### Direct API Usage

If not using the client library:

```bash
curl -X POST http://localhost:3000/proxy \
  -H "Content-Type: application/json" \
  -H "X-Proxy-Secret: your-secret-here" \
  -d '{
    "url": "https://example.com",
    "method": "GET"
  }'
```

### Testing Security

Run the security test:

```bash
# Start server with PROXY_SECRET set
PROXY_SECRET=test-secret npm run server

# In another terminal, run security tests
PROXY_SECRET=test-secret tsx test-security.ts
```

Expected output:
- ✓ Request without secret blocked (401)
- ✓ Request with wrong secret blocked (401)
- ✓ Request with correct secret succeeds (200)

### Best Practices

1. **Always use PROXY_SECRET in production**
2. **Never commit `.env` file** (add to `.gitignore`)
3. **Use environment variables** for secrets
4. **Rotate secrets periodically**
5. **Use HTTPS** when exposing server publicly
6. **Consider rate limiting** for additional protection

### Disabling Authentication

To disable authentication (not recommended for production):

```env
# Leave PROXY_SECRET empty or remove it
PROXY_SECRET=
```

Or don't set it at all in your `.env` file.

### Error Responses

**401 Unauthorized:**
```json
{
  "error": "Unauthorized",
  "message": "Invalid or missing X-Proxy-Secret header"
}
```

**400 Bad Request:**
```json
{
  "error": "Missing required field: url"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Proxy request failed",
  "message": "Error details here"
}
```
