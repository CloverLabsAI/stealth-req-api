import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import { ModuleClient, SessionClient } from 'tlsclientwrapper';
import dotenv from 'dotenv';

dotenv.config();

let fastify: FastifyInstance;
let tlsClient: ModuleClient;

// Initialize server (called lazily)
const initServer = async () => {
  if (fastify) return; // Already initialized
  
  fastify = Fastify({
    logger: true,
    trustProxy: true,
    requestIdLogLabel: 'reqId',
    disableRequestLogging: false,
    requestIdHeader: 'x-request-id'
  });

  // Register CORS
  await fastify.register(cors, {
    origin: true,
    credentials: true
  });

  // Initialize TLS Client
  tlsClient = new ModuleClient();
  
  setupRoutes();
};

const setupRoutes = () => {

// Types
interface ProxyRequestBody {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string | Record<string, any> | null;
  proxyUrl?: string | null;
  clientIdentifier?: string;
  followRedirects?: boolean;
  insecureSkipVerify?: boolean;
  timeout?: number;
}

interface ProxyQueryParams {
  url?: string;
  clientIdentifier?: string;
  proxyUrl?: string;
}

// Health check endpoint
fastify.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Proxy endpoint - POST request
fastify.post<{ Body: ProxyRequestBody }>('/proxy', async (request: FastifyRequest<{ Body: ProxyRequestBody }>, reply: FastifyReply) => {
  try {
    // Check proxy secret if configured
    const proxySecret = process.env.PROXY_SECRET;
    if (proxySecret) {
      const clientSecret = request.headers['x-proxy-secret'];
      if (!clientSecret || clientSecret !== proxySecret) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Invalid or missing X-Proxy-Secret header'
        });
      }
    }

    const {
      url,
      method = 'GET',
      headers = {},
      body = null,
      proxyUrl = process.env.DEFAULT_PROXY_URL || null, // Use default proxy if not specified
      clientIdentifier = 'chrome_120',
      followRedirects = true,
      insecureSkipVerify = false,
      timeout = 30000
    } = request.body;

    if (!url) {
      return reply.code(400).send({
        error: 'Missing required field: url'
      });
    }

    // Create session with options
    const sessionOptions: any = {
      tlsClientIdentifier: clientIdentifier,
      followRedirects,
      insecureSkipVerify,
      timeoutSeconds: Math.floor(timeout / 1000), // Convert ms to seconds
      ...(proxyUrl && { proxyUrl })
    };

    const session = new SessionClient(tlsClient, sessionOptions);

    // Make the request based on method
    let response;
    const upperMethod = method.toUpperCase();
    const requestBody = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined;

    if (upperMethod === 'GET') {
      response = await session.get(url, { headers });
    } else if (upperMethod === 'POST') {
      response = await session.post(url, requestBody, { headers });
    } else if (upperMethod === 'PUT') {
      response = await session.put(url, requestBody, { headers });
    } else if (upperMethod === 'PATCH') {
      response = await session.patch(url, requestBody, { headers });
    } else if (upperMethod === 'DELETE') {
      response = await session.delete(url, { headers });
    } else if (upperMethod === 'HEAD') {
      response = await session.head(url, { headers });
    } else {
      return reply.code(400).send({
        error: 'Unsupported HTTP method',
        message: `Method ${method} is not supported. Supported methods: GET, POST, PUT, PATCH, DELETE, HEAD`
      });
    }

    // Set response headers if they exist, excluding compression headers
    // tlsclientwrapper already decompresses the response
    const contentType = response.headers?.['content-type'] || response.headers?.['Content-Type'] || '';
    if (response.headers && typeof response.headers === 'object') {
      const compressionHeaders = ['content-encoding', 'content-length', 'transfer-encoding'];
      Object.entries(response.headers).forEach(([key, value]) => {
        if (!compressionHeaders.includes(key.toLowerCase())) {
          reply.header(key, value);
        }
      });
    }

    // Handle response body - if it's an object and content-type is JSON, stringify it
    let responseBody = response.body;
    if (typeof responseBody === 'object' && responseBody !== null && contentType.includes('application/json')) {
      responseBody = JSON.stringify(responseBody);
    }

    // Return the response body
    return reply
      .code(response.status || 200)
      .send(responseBody);

  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({
      error: 'Proxy request failed',
      message: error.message
    });
  }
});

// Proxy endpoint - GET request (for simple proxying)
fastify.get<{ Querystring: ProxyQueryParams }>('/proxy', async (request: FastifyRequest<{ Querystring: ProxyQueryParams }>, reply: FastifyReply) => {
  try {
    // Check proxy secret if configured
    const proxySecret = process.env.PROXY_SECRET;
    if (proxySecret) {
      const clientSecret = request.headers['x-proxy-secret'];
      if (!clientSecret || clientSecret !== proxySecret) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'Invalid or missing X-Proxy-Secret header'
        });
      }
    }

    const { 
      url, 
      clientIdentifier = 'chrome_120', 
      proxyUrl = process.env.DEFAULT_PROXY_URL 
    } = request.query;

    if (!url) {
      return reply.code(400).send({
        error: 'Missing required query parameter: url'
      });
    }

    const sessionOptions: any = {
      tlsClientIdentifier: clientIdentifier,
      followRedirects: true,
      ...(proxyUrl && { proxyUrl })
    };

    const session = new SessionClient(tlsClient, sessionOptions);
    const response = await session.get(url);

    // Set response headers if they exist, excluding compression headers
    // tlsclientwrapper already decompresses the response
    const contentType = response.headers?.['content-type'] || response.headers?.['Content-Type'] || '';
    if (response.headers && typeof response.headers === 'object') {
      const compressionHeaders = ['content-encoding', 'content-length', 'transfer-encoding'];
      Object.entries(response.headers).forEach(([key, value]) => {
        if (!compressionHeaders.includes(key.toLowerCase())) {
          reply.header(key, value);
        }
      });
    }

    // Handle response body - if it's an object and content-type is JSON, stringify it
    let responseBody = response.body;
    if (typeof responseBody === 'object' && responseBody !== null && contentType.includes('application/json')) {
      responseBody = JSON.stringify(responseBody);
    }

    // Return the response body
    return reply
      .code(response.status || 200)
      .send(responseBody);

  } catch (error: any) {
    request.log.error(error);
    return reply.code(500).send({
      error: 'Proxy request failed',
      message: error.message
    });
  }
});
}; // End of setupRoutes

// Start server function (exported for use as module)
export const startServer = async (): Promise<void> => {
  await initServer(); // Initialize server before starting
  
  try {
    const port = process.env.PORT || '3000';
    const host = process.env.HOST || '0.0.0.0';
    
    await fastify.listen({ port: parseInt(port), host });
    console.log(`🚀 Server running at http://${host}:${port}`);
    console.log(`📊 Health check: http://${host}:${port}/health`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

// Export fastify getter for testing or advanced usage
export const getFastify = () => fastify;
