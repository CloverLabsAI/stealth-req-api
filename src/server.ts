import Fastify, {
  FastifyInstance,
  FastifyRequest,
  FastifyReply,
} from "fastify";
import cors from "@fastify/cors";
import { ModuleClient, SessionClient } from "tlsclientwrapper";
import dotenv from "dotenv";

dotenv.config();

let fastify: FastifyInstance;

interface ProxyRequestBody {
  url?: unknown;
  method?: unknown;
  headers?: unknown;
  body?: unknown;
  bodyBase64?: unknown;
  proxyUrl?: unknown;
  clientIdentifier?: unknown;
  followRedirects?: unknown;
  insecureSkipVerify?: unknown;
  timeout?: unknown;
  isByteResponse?: unknown;
}

interface ProxyQueryParams {
  url?: string;
  clientIdentifier?: string;
  proxyUrl?: string;
}

interface ProxyResponse {
  status?: number;
  url?: unknown;
  target?: unknown;
  headers?: Record<string, unknown>;
  body?: unknown;
  bodyBase64?: unknown;
}

interface ProxyRequestOptions {
  headers?: Record<string, string>;
  isByteRequest?: boolean;
  isByteResponse?: boolean;
}

interface ProxySession {
  get(url: string, options?: ProxyRequestOptions): Promise<ProxyResponse>;
  post(
    url: string,
    body?: string,
    options?: ProxyRequestOptions,
  ): Promise<ProxyResponse>;
  put(
    url: string,
    body?: string,
    options?: ProxyRequestOptions,
  ): Promise<ProxyResponse>;
  patch(
    url: string,
    body?: string,
    options?: ProxyRequestOptions,
  ): Promise<ProxyResponse>;
  delete(url: string, options?: ProxyRequestOptions): Promise<ProxyResponse>;
  head(url: string, options?: ProxyRequestOptions): Promise<ProxyResponse>;
  options(url: string, options?: ProxyRequestOptions): Promise<ProxyResponse>;
}

export type ProxySessionFactory = (
  tlsClient: ModuleClient,
  options: Record<string, unknown>,
) => ProxySession;

interface CreateFastifyServerOptions {
  logger?: boolean;
  tlsClient?: ModuleClient;
  sessionFactory?: ProxySessionFactory;
}

const METHODS_WITHOUT_BODY_FORWARDING = new Set([
  "GET",
  "DELETE",
  "HEAD",
  "OPTIONS",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function normalizeHeaders(value: unknown): Record<string, string> | null {
  if (value === undefined) return {};
  if (!isRecord(value)) return null;

  const headers: Record<string, string> = {};
  for (const [key, headerValue] of Object.entries(value)) {
    if (
      typeof headerValue !== "string" &&
      typeof headerValue !== "number" &&
      typeof headerValue !== "boolean"
    ) {
      return null;
    }
    headers[key] = String(headerValue);
  }
  return headers;
}

function resolveProxyUrl(
  source: Record<string, unknown>,
): { proxyUrl?: string; error?: string } {
  if (hasOwn(source, "proxyUrl")) {
    const proxyUrl = source.proxyUrl;
    if (proxyUrl === null || proxyUrl === "") return {};
    if (typeof proxyUrl !== "string") {
      return { error: "proxyUrl must be a string or null" };
    }
    return { proxyUrl };
  }

  return process.env.DEFAULT_PROXY_URL
    ? { proxyUrl: process.env.DEFAULT_PROXY_URL }
    : {};
}

function serializeRequestBody(
  body: unknown,
  bodyBase64: unknown,
): { body?: string; isByteRequest?: boolean; error?: string } {
  if (bodyBase64 !== undefined) {
    if (typeof bodyBase64 !== "string") {
      return { error: "bodyBase64 must be a string" };
    }
    return { body: bodyBase64, isByteRequest: true };
  }
  if (body === undefined || body === null) return { body: "" };
  if (typeof body === "string") return { body };
  if (typeof body === "number" || typeof body === "boolean") {
    return { body: String(body) };
  }
  return { body: JSON.stringify(body) };
}

function toTimeoutSeconds(timeoutMs: number): number {
  return Math.max(1, Math.ceil(timeoutMs / 1000));
}

function resolveRequestTimeout(
  value: unknown,
): { timeoutMs: number | null; error?: string } {
  if (value === undefined || value === null || value === 0) {
    return { timeoutMs: null };
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return {
      timeoutMs: null,
      error: "timeout must be a non-negative number or null",
    };
  }
  return { timeoutMs: value };
}

function decodeBase64ResponseBody(body: string): Buffer {
  const dataUriMatch = body.match(/^data:[^,]*;base64,(.*)$/s);
  return Buffer.from(dataUriMatch ? dataUriMatch[1] : body, "base64");
}

function normalizeResponseBody(
  response: ProxyResponse,
  isByteResponse = false,
): string | Buffer {
  if (typeof response.bodyBase64 === "string") {
    return decodeBase64ResponseBody(response.bodyBase64);
  }

  const { body } = response;
  if (body === undefined || body === null) return "";
  if (isByteResponse && typeof body === "string") {
    return decodeBase64ResponseBody(body);
  }
  if (typeof body === "string") return body;
  if (Buffer.isBuffer(body)) return body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  return JSON.stringify(body);
}

function setProxyResponseHeaders(
  reply: FastifyReply,
  response: ProxyResponse,
) {
  const { headers } = response;

  const compressionHeaders = [
    "content-encoding",
    "content-length",
    "transfer-encoding",
  ];

  if (headers && typeof headers === "object") {
    Object.entries(headers).forEach(([key, value]) => {
      if (!compressionHeaders.includes(key.toLowerCase())) {
        reply.header(key, value as string);
      }
    });
  }

  const resolvedUrl =
    typeof response.url === "string" && response.url
      ? response.url
      : typeof response.target === "string" && response.target
        ? response.target
        : null;
  if (resolvedUrl) {
    reply.header("x-url-resolved", resolvedUrl);
    reply.header("x-final-url", resolvedUrl);
  }
}

function defaultSessionFactory(
  activeTlsClient: ModuleClient,
  sessionOptions: Record<string, unknown>,
): ProxySession {
  return new SessionClient(activeTlsClient, sessionOptions) as unknown as ProxySession;
}

// Initialize server (called lazily)
const initServer = async () => {
  if (fastify) return; // Already initialized

  fastify = await createFastifyServer();
};

export const createFastifyServer = async (
  options: CreateFastifyServerOptions = {},
): Promise<FastifyInstance> => {
  const app = Fastify({
    logger: options.logger ?? true,
    trustProxy: true,
    requestIdLogLabel: "reqId",
    disableRequestLogging: false,
    requestIdHeader: "x-request-id",
  });

  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  setupRoutes(
    app,
    options.tlsClient ?? new ModuleClient(),
    options.sessionFactory ?? defaultSessionFactory,
  );

  fastify = app;
  return fastify;
};

const setupRoutes = (
  app: FastifyInstance,
  activeTlsClient: ModuleClient,
  sessionFactory: ProxySessionFactory,
) => {
  // Health check endpoint
  app.get("/health", async () => {
    return { status: "ok", timestamp: new Date().toISOString() };
  });

  // Proxy endpoint - POST request
  app.post<{ Body: ProxyRequestBody }>(
    "/proxy",
    async (
      request: FastifyRequest<{ Body: ProxyRequestBody }>,
      reply: FastifyReply,
    ) => {
      try {
        // Check proxy secret if configured
        const proxySecret = process.env.PROXY_SECRET;
        if (proxySecret) {
          const clientSecret = request.headers["x-proxy-secret"];
          if (!clientSecret || clientSecret !== proxySecret) {
            return reply.code(401).send({
              error: "Unauthorized",
              message: "Invalid or missing X-Proxy-Secret header",
            });
          }
        }

        if (!isRecord(request.body)) {
          return reply.code(400).send({
            error: "Request body must be a JSON object",
          });
        }

        const url = request.body.url;
        if (typeof url !== "string" || !url) {
          return reply.code(400).send({
            error: "Missing required field: url",
          });
        }

        const method =
          request.body.method === undefined ? "GET" : request.body.method;
        if (typeof method !== "string" || !method) {
          return reply.code(400).send({
            error: "method must be a string",
          });
        }

        const headers = normalizeHeaders(request.body.headers);
        if (!headers) {
          return reply.code(400).send({
            error: "headers must be an object with scalar values",
          });
        }

        const clientIdentifier =
          request.body.clientIdentifier === undefined
            ? "chrome_120"
            : request.body.clientIdentifier;
        if (typeof clientIdentifier !== "string" || !clientIdentifier) {
          return reply.code(400).send({
            error: "clientIdentifier must be a string",
          });
        }

        const followRedirects =
          request.body.followRedirects === undefined
            ? true
            : request.body.followRedirects;
        if (typeof followRedirects !== "boolean") {
          return reply.code(400).send({
            error: "followRedirects must be a boolean",
          });
        }

        const insecureSkipVerify =
          request.body.insecureSkipVerify === undefined
            ? false
            : request.body.insecureSkipVerify;
        if (typeof insecureSkipVerify !== "boolean") {
          return reply.code(400).send({
            error: "insecureSkipVerify must be a boolean",
          });
        }

        const isByteResponse = request.body.isByteResponse ?? false;
        if (typeof isByteResponse !== "boolean") {
          return reply.code(400).send({
            error: "isByteResponse must be a boolean",
          });
        }

        const timeout = resolveRequestTimeout(request.body.timeout);
        if (timeout.error) {
          return reply.code(400).send({ error: timeout.error });
        }

        const resolvedProxy = resolveProxyUrl(request.body);
        if (resolvedProxy.error) {
          return reply.code(400).send({ error: resolvedProxy.error });
        }

        // Create session with options
        const sessionOptions: Record<string, unknown> = {
          tlsClientIdentifier: clientIdentifier,
          followRedirects,
          insecureSkipVerify,
          ...(timeout.timeoutMs === null
            ? { timeoutMilliseconds: 0 }
            : { timeoutSeconds: toTimeoutSeconds(timeout.timeoutMs) }),
          ...(resolvedProxy.proxyUrl ? { proxyUrl: resolvedProxy.proxyUrl } : {}),
        };

        const session = sessionFactory(activeTlsClient, sessionOptions);

        // Make the request based on method
        let response;
        const upperMethod = method.toUpperCase();
        const serializedBody = serializeRequestBody(
          request.body.body,
          request.body.bodyBase64,
        );
        if (serializedBody?.error) {
          return reply.code(400).send({ error: serializedBody.error });
        }
        const requestBody = serializedBody?.body;
        const requestOptions: ProxyRequestOptions = {
          headers,
          ...(serializedBody.isByteRequest ? { isByteRequest: true } : {}),
          ...(isByteResponse ? { isByteResponse: true } : {}),
        };
        const hasRequestBody =
          hasOwn(request.body, "body") || hasOwn(request.body, "bodyBase64");
        if (
          hasRequestBody &&
          METHODS_WITHOUT_BODY_FORWARDING.has(upperMethod)
        ) {
          return reply.code(400).send({
            error: `${upperMethod} requests with a body are not supported`,
          });
        }

        if (upperMethod === "GET") {
          response = await session.get(url, requestOptions);
        } else if (upperMethod === "POST") {
          response = await session.post(url, requestBody, requestOptions);
        } else if (upperMethod === "PUT") {
          response = await session.put(url, requestBody, requestOptions);
        } else if (upperMethod === "PATCH") {
          response = await session.patch(url, requestBody, requestOptions);
        } else if (upperMethod === "DELETE") {
          response = await session.delete(url, requestOptions);
        } else if (upperMethod === "HEAD") {
          response = await session.head(url, requestOptions);
        } else if (upperMethod === "OPTIONS") {
          response = await session.options(url, requestOptions);
        } else {
          return reply.code(400).send({
            error: "Unsupported HTTP method",
            message: `Method ${method} is not supported. Supported methods: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS`,
          });
        }

        setProxyResponseHeaders(reply, response);

        const responseBody = normalizeResponseBody(response, isByteResponse);
        request.log.info(
          `Response body type: ${typeof responseBody}, isBuffer: ${Buffer.isBuffer(responseBody)}`,
        );
        request.log.info(
          `Final response body length: ${
            typeof responseBody === "string"
              ? responseBody.length
              : responseBody.byteLength
          }`,
        );

        // Return the response body
        return reply.code(response.status || 200).send(responseBody);
      } catch (error: any) {
        request.log.error(error);
        return reply.code(500).send({
          error: "Proxy request failed",
          message: error.message,
        });
      }
    },
  );

  // Proxy endpoint - GET request (for simple proxying)
  app.get<{ Querystring: ProxyQueryParams }>(
    "/proxy",
    async (
      request: FastifyRequest<{ Querystring: ProxyQueryParams }>,
      reply: FastifyReply,
    ) => {
      try {
        // Check proxy secret if configured
        const proxySecret = process.env.PROXY_SECRET;
        if (proxySecret) {
          const clientSecret = request.headers["x-proxy-secret"];
          if (!clientSecret || clientSecret !== proxySecret) {
            return reply.code(401).send({
              error: "Unauthorized",
              message: "Invalid or missing X-Proxy-Secret header",
            });
          }
        }

        const clientIdentifier =
          request.query.clientIdentifier === undefined
            ? "chrome_120"
            : request.query.clientIdentifier;
        const { url } = request.query;

        if (typeof url !== "string" || !url) {
          return reply.code(400).send({
            error: "Missing required query parameter: url",
          });
        }

        if (typeof clientIdentifier !== "string" || !clientIdentifier) {
          return reply.code(400).send({
            error: "clientIdentifier must be a string",
          });
        }

        const resolvedProxy = resolveProxyUrl(
          request.query as Record<string, unknown>,
        );
        if (resolvedProxy.error) {
          return reply.code(400).send({ error: resolvedProxy.error });
        }

        const sessionOptions: Record<string, unknown> = {
          tlsClientIdentifier: clientIdentifier,
          followRedirects: true,
          ...(resolvedProxy.proxyUrl ? { proxyUrl: resolvedProxy.proxyUrl } : {}),
        };

        const session = sessionFactory(activeTlsClient, sessionOptions);
        const response = await session.get(url);

        setProxyResponseHeaders(reply, response);

        const responseBody = normalizeResponseBody(response);

        // Return the response body
        return reply.code(response.status || 200).send(responseBody);
      } catch (error: any) {
        request.log.error(error);
        return reply.code(500).send({
          error: "Proxy request failed",
          message: error.message,
        });
      }
    },
  );
}; // End of setupRoutes

// Start server function (exported for use as module)
export const startServer = async (): Promise<void> => {
  await initServer(); // Initialize server before starting

  const rawPort = process.env.PORT || "3000";
  if (!/^\d+$/.test(rawPort)) {
    throw new Error("PORT must be a number");
  }
  const port = Number(rawPort);
  const host = process.env.HOST || "0.0.0.0";

  await fastify.listen({ port, host });
  console.log(`🚀 Server running at http://${host}:${port}`);
  console.log(`📊 Health check: http://${host}:${port}/health`);
};

// Export fastify getter for testing or advanced usage
export const getFastify = () => fastify;
