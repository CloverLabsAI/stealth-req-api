import assert from "node:assert/strict";
import http from "node:http";
import { afterEach, describe, it } from "node:test";

import { AxiosError } from "axios";
import { createStealthClient } from "../src/client.ts";
import { createFastifyServer, getFastify } from "../src/server.ts";

interface RecordedSession {
  options: Record<string, unknown>;
  calls: Array<{
    method: string;
    url: string;
    body?: unknown;
    options?: Record<string, unknown>;
  }>;
}

const originalDefaultProxyUrl = process.env.DEFAULT_PROXY_URL;

afterEach(() => {
  if (originalDefaultProxyUrl === undefined) {
    delete process.env.DEFAULT_PROXY_URL;
  } else {
    process.env.DEFAULT_PROXY_URL = originalDefaultProxyUrl;
  }
});

async function createTestApp() {
  const sessions: RecordedSession[] = [];
  const app = await createFastifyServer({
    logger: false,
    tlsClient: {} as never,
    sessionFactory: (_tlsClient, options) => {
      const session: RecordedSession = {
        options: options as Record<string, unknown>,
        calls: [],
      };
      sessions.push(session);

      const response = {
        status: 200,
        url: "https://resolved.example.com/final",
        headers: {},
        body: "ok",
      };

      return {
        get: async (url: string, options?: Record<string, unknown>) => {
          session.calls.push({ method: "GET", url, options });
          return response;
        },
        post: async (
          url: string,
          body: unknown,
          options?: Record<string, unknown>,
        ) => {
          session.calls.push({ method: "POST", url, body, options });
          return response;
        },
        put: async (
          url: string,
          body: unknown,
          options?: Record<string, unknown>,
        ) => {
          session.calls.push({ method: "PUT", url, body, options });
          return response;
        },
        patch: async (
          url: string,
          body: unknown,
          options?: Record<string, unknown>,
        ) => {
          session.calls.push({ method: "PATCH", url, body, options });
          return response;
        },
        delete: async (url: string, options?: Record<string, unknown>) => {
          session.calls.push({ method: "DELETE", url, options });
          return response;
        },
        head: async (url: string, options?: Record<string, unknown>) => {
          session.calls.push({ method: "HEAD", url, options });
          return response;
        },
        options: async (url: string, options?: Record<string, unknown>) => {
          session.calls.push({ method: "OPTIONS", url, options });
          return response;
        },
      };
    },
  });

  return { app, sessions };
}

describe("proxy server behavior", () => {
  it("uses DEFAULT_PROXY_URL as a deprecated fallback when proxyUrl is omitted", async (t) => {
    process.env.DEFAULT_PROXY_URL = "http://legacy.proxy:8000";
    const { app, sessions } = await createTestApp();
    t.after(() => app.close());

    const response = await app.inject({
      method: "POST",
      url: "/proxy",
      payload: { url: "https://example.com" },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(sessions[0]?.options.proxyUrl, "http://legacy.proxy:8000");
  });

  it("prefers explicit proxyUrl and lets null or empty disable the fallback", async (t) => {
    process.env.DEFAULT_PROXY_URL = "http://legacy.proxy:8000";
    const { app, sessions } = await createTestApp();
    t.after(() => app.close());

    await app.inject({
      method: "POST",
      url: "/proxy",
      payload: {
        url: "https://example.com/explicit",
        proxyUrl: "http://explicit.proxy:9000",
      },
    });
    await app.inject({
      method: "POST",
      url: "/proxy",
      payload: {
        url: "https://example.com/direct",
        proxyUrl: null,
      },
    });
    await app.inject({
      method: "POST",
      url: "/proxy",
      payload: {
        url: "https://example.com/empty",
        proxyUrl: "",
      },
    });

    assert.equal(sessions[0]?.options.proxyUrl, "http://explicit.proxy:9000");
    assert.equal("proxyUrl" in (sessions[1]?.options ?? {}), false);
    assert.equal("proxyUrl" in (sessions[2]?.options ?? {}), false);
  });

  it("returns 400 for missing or invalid POST bodies", async (t) => {
    const { app } = await createTestApp();
    t.after(() => app.close());

    const noBody = await app.inject({ method: "POST", url: "/proxy" });
    const nullBody = await app.inject({
      method: "POST",
      url: "/proxy",
      headers: { "content-type": "application/json" },
      payload: "null",
    });
    const nullMethod = await app.inject({
      method: "POST",
      url: "/proxy",
      payload: { url: "https://example.com", method: null },
    });

    assert.equal(noBody.statusCode, 400);
    assert.equal(nullBody.statusCode, 400);
    assert.equal(nullMethod.statusCode, 400);
  });

  it("forwards falsy POST bodies instead of dropping them", async (t) => {
    const { app, sessions } = await createTestApp();
    t.after(() => app.close());

    await app.inject({
      method: "POST",
      url: "/proxy",
      payload: { url: "https://example.com/empty", method: "POST", body: "" },
    });
    await app.inject({
      method: "POST",
      url: "/proxy",
      payload: { url: "https://example.com/zero", method: "POST", body: 0 },
    });
    await app.inject({
      method: "POST",
      url: "/proxy",
      payload: { url: "https://example.com/false", method: "POST", body: false },
    });

    assert.equal(sessions[0]?.calls[0]?.body, "");
    assert.equal(sessions[1]?.calls[0]?.body, "0");
    assert.equal(sessions[2]?.calls[0]?.body, "false");
  });

  it("forwards bodyBase64 as byte-request data for the wrapper", async (t) => {
    const { app, sessions } = await createTestApp();
    t.after(() => app.close());

    const response = await app.inject({
      method: "POST",
      url: "/proxy",
      payload: {
        url: "https://example.com/upload",
        method: "POST",
        bodyBase64: Buffer.from("abc").toString("base64"),
      },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(
      sessions[0]?.calls[0]?.body,
      Buffer.from("abc").toString("base64"),
    );
    assert.equal(sessions[0]?.calls[0]?.options?.isByteRequest, true);
  });

  it("supports OPTIONS requests", async (t) => {
    const { app, sessions } = await createTestApp();
    t.after(() => app.close());

    const response = await app.inject({
      method: "POST",
      url: "/proxy",
      payload: { url: "https://example.com", method: "OPTIONS" },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(sessions[0]?.calls[0]?.method, "OPTIONS");
  });

  it("validates GET clientIdentifier", async (t) => {
    const { app } = await createTestApp();
    t.after(() => app.close());

    const response = await app.inject({
      method: "GET",
      url: "/proxy?url=https://example.com&clientIdentifier=",
    });

    assert.equal(response.statusCode, 400);
  });

  it("validates GET url is a single string", async (t) => {
    const { app } = await createTestApp();
    t.after(() => app.close());

    const response = await app.inject({
      method: "GET",
      url: "/proxy?url=https://one.example&url=https://two.example",
    });

    assert.equal(response.statusCode, 400);
  });

  it("decodes wrapper-style base64 binary target responses", async (t) => {
    const app = await createFastifyServer({
      logger: false,
      tlsClient: {} as never,
      sessionFactory: () => ({
        get: async () => ({
          status: 200,
          headers: { "content-type": "application/octet-stream" },
          body: Buffer.from([0, 1, 2]).toString("base64"),
        }),
        post: async () => ({ status: 200, headers: {}, body: "ok" }),
        put: async () => ({ status: 200, headers: {}, body: "ok" }),
        patch: async () => ({ status: 200, headers: {}, body: "ok" }),
        delete: async () => ({ status: 200, headers: {}, body: "ok" }),
        head: async () => ({ status: 200, headers: {}, body: "ok" }),
        options: async () => ({ status: 200, headers: {}, body: "ok" }),
      }),
    });
    t.after(() => app.close());

    const response = await app.inject({
      method: "POST",
      url: "/proxy",
      payload: { url: "https://example.com/file", isByteResponse: true },
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.rawPayload, Buffer.from([0, 1, 2]));
  });

  it("decodes wrapper data-uri binary target responses", async (t) => {
    const app = await createFastifyServer({
      logger: false,
      tlsClient: {} as never,
      sessionFactory: () => ({
        get: async () => ({
          status: 200,
          headers: { "content-type": "application/octet-stream" },
          body: `data:text/plain; charset=utf-8;base64,${Buffer.from([
            0,
            1,
            2,
          ]).toString("base64")}`,
        }),
        post: async () => ({ status: 200, headers: {}, body: "ok" }),
        put: async () => ({ status: 200, headers: {}, body: "ok" }),
        patch: async () => ({ status: 200, headers: {}, body: "ok" }),
        delete: async () => ({ status: 200, headers: {}, body: "ok" }),
        head: async () => ({ status: 200, headers: {}, body: "ok" }),
        options: async () => ({ status: 200, headers: {}, body: "ok" }),
      }),
    });
    t.after(() => app.close());

    const response = await app.inject({
      method: "POST",
      url: "/proxy",
      payload: { url: "https://example.com/file", isByteResponse: true },
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.rawPayload, Buffer.from([0, 1, 2]));
  });

  it("echoes final resolved URL metadata in response headers", async (t) => {
    const { app } = await createTestApp();
    t.after(() => app.close());

    const response = await app.inject({
      method: "POST",
      url: "/proxy",
      payload: { url: "https://example.com/redirect", method: "GET" },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(
      response.headers["x-url-resolved"],
      "https://resolved.example.com/final",
    );
    assert.equal(
      response.headers["x-final-url"],
      "https://resolved.example.com/final",
    );
  });

  it("uses wrapper target as resolved URL metadata when url is absent", async (t) => {
    const app = await createFastifyServer({
      logger: false,
      tlsClient: {} as never,
      sessionFactory: () => ({
        get: async () => ({
          status: 200,
          target: "https://resolved.example.com/from-target",
          headers: {},
          body: "ok",
        }),
        post: async () => ({ status: 200, headers: {}, body: "ok" }),
        put: async () => ({ status: 200, headers: {}, body: "ok" }),
        patch: async () => ({ status: 200, headers: {}, body: "ok" }),
        delete: async () => ({ status: 200, headers: {}, body: "ok" }),
        head: async () => ({ status: 200, headers: {}, body: "ok" }),
        options: async () => ({ status: 200, headers: {}, body: "ok" }),
      }),
    });
    t.after(() => app.close());

    const response = await app.inject({
      method: "POST",
      url: "/proxy",
      payload: { url: "https://example.com/redirect", method: "GET" },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(
      response.headers["x-url-resolved"],
      "https://resolved.example.com/from-target",
    );
    assert.equal(
      response.headers["x-final-url"],
      "https://resolved.example.com/from-target",
    );
  });

  it("rounds positive millisecond timeouts up to at least one second", async (t) => {
    const { app, sessions } = await createTestApp();
    t.after(() => app.close());

    const response = await app.inject({
      method: "POST",
      url: "/proxy",
      payload: { url: "https://example.com", timeout: 1 },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(sessions[0]?.options.timeoutSeconds, 1);
  });

  it("accepts omitted, null, or zero timeout as no timeout", async (t) => {
    const { app, sessions } = await createTestApp();
    t.after(() => app.close());

    const omittedTimeout = await app.inject({
      method: "POST",
      url: "/proxy",
      payload: { url: "https://example.com/omitted-timeout" },
    });
    const nullTimeout = await app.inject({
      method: "POST",
      url: "/proxy",
      payload: { url: "https://example.com/null-timeout", timeout: null },
    });
    const zeroTimeout = await app.inject({
      method: "POST",
      url: "/proxy",
      payload: { url: "https://example.com/zero-timeout", timeout: 0 },
    });

    assert.equal(omittedTimeout.statusCode, 200);
    assert.equal(nullTimeout.statusCode, 200);
    assert.equal(zeroTimeout.statusCode, 200);
    assert.equal("timeoutSeconds" in (sessions[0]?.options ?? {}), false);
    assert.equal(sessions[0]?.options.timeoutMilliseconds, 0);
    assert.equal("timeoutSeconds" in (sessions[1]?.options ?? {}), false);
    assert.equal(sessions[1]?.options.timeoutMilliseconds, 0);
    assert.equal("timeoutSeconds" in (sessions[2]?.options ?? {}), false);
    assert.equal(sessions[2]?.options.timeoutMilliseconds, 0);
  });

  it("rejects negative timeouts", async (t) => {
    const { app } = await createTestApp();
    t.after(() => app.close());

    const response = await app.inject({
      method: "POST",
      url: "/proxy",
      payload: { url: "https://example.com", timeout: -1 },
    });

    assert.equal(response.statusCode, 400);
  });

  it("sets createFastifyServer result as the exported singleton", async (t) => {
    const { app } = await createTestApp();
    t.after(() => app.close());

    assert.equal(getFastify(), app);
  });

  it("rejects bodies for methods the tls wrapper cannot forward", async (t) => {
    const { app } = await createTestApp();
    t.after(() => app.close());

    for (const method of ["GET", "DELETE", "HEAD", "OPTIONS"]) {
      const response = await app.inject({
        method: "POST",
        url: "/proxy",
        payload: {
          url: `https://example.com/${method.toLowerCase()}`,
          method,
          body: "payload",
        },
      });

      assert.equal(response.statusCode, 400);
    }
  });

  it("rejects bodyBase64 for GET requests", async (t) => {
    const { app } = await createTestApp();
    t.after(() => app.close());

    const response = await app.inject({
      method: "POST",
      url: "/proxy",
      payload: {
        url: "https://example.com/get-bytes",
        method: "GET",
        bodyBase64: Buffer.from("payload").toString("base64"),
      },
    });

    assert.equal(response.statusCode, 400);
  });
});

describe("stealth client proxyUrl behavior", () => {
  it("sends explicit proxyUrl null so callers can disable server fallback", async () => {
    let capturedPayload: unknown;
    const server = http.createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on("data", (chunk) => chunks.push(chunk));
      request.on("end", () => {
        capturedPayload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        response.writeHead(200, { "content-type": "text/plain" });
        response.end("ok");
      });
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const address = server.address();
      assert(address && typeof address === "object");
      const client = createStealthClient({
        baseURL: `http://127.0.0.1:${address.port}`,
        proxyUrl: "http://client-default.proxy:7000",
      });

      await client.get("https://example.com", { proxyUrl: null });

      assert.deepEqual(
        (capturedPayload as { proxyUrl?: string | null }).proxyUrl,
        null,
      );
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it("sends timeout null when Axios timeout is zero", async () => {
    let capturedPayload: unknown;
    const server = http.createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on("data", (chunk) => chunks.push(chunk));
      request.on("end", () => {
        capturedPayload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        response.writeHead(200, { "content-type": "text/plain" });
        response.end("ok");
      });
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const address = server.address();
      assert(address && typeof address === "object");
      const client = createStealthClient({
        baseURL: `http://127.0.0.1:${address.port}`,
      });

      await client.get("https://example.com/no-timeout", { timeout: 0 });

      assert.equal((capturedPayload as { timeout?: number | null }).timeout, null);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it("builds the final target URL with request baseURL and params", async () => {
    const capturedPayloads: unknown[] = [];
    const server = http.createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on("data", (chunk) => chunks.push(chunk));
      request.on("end", () => {
        capturedPayloads.push(
          JSON.parse(Buffer.concat(chunks).toString("utf8")),
        );
        response.writeHead(200, { "content-type": "text/plain" });
        response.end("ok");
      });
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const address = server.address();
      assert(address && typeof address === "object");
      const client = createStealthClient({
        baseURL: `http://127.0.0.1:${address.port}`,
      });

      await client.get("/items", {
        baseURL: "https://example.com/api",
        params: { page: 2, q: "a b" },
      });

      assert.equal(
        (capturedPayloads[0] as { url: string }).url,
        "https://example.com/api/items?page=2&q=a+b",
      );
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it("serializes common Axios body types before sending to the proxy server", async () => {
    const capturedPayloads: unknown[] = [];
    const server = http.createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on("data", (chunk) => chunks.push(chunk));
      request.on("end", () => {
        capturedPayloads.push(
          JSON.parse(Buffer.concat(chunks).toString("utf8")),
        );
        response.writeHead(200, { "content-type": "text/plain" });
        response.end("ok");
      });
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const address = server.address();
      assert(address && typeof address === "object");
      const client = createStealthClient({
        baseURL: `http://127.0.0.1:${address.port}`,
      });

      await client.post("https://example.com/json", { ok: true });
      await client.post(
        "https://example.com/form",
        new URLSearchParams({ q: "a b" }),
      );
      await client.post("https://example.com/binary", Buffer.from("abc"));

      const jsonPayload = capturedPayloads[0] as {
        body: string;
        headers: Record<string, string>;
      };
      const formPayload = capturedPayloads[1] as {
        body: string;
        headers: Record<string, string>;
      };
      const binaryPayload = capturedPayloads[2] as { bodyBase64: string };

      assert.equal(jsonPayload.body, '{"ok":true}');
      assert.equal(jsonPayload.headers["Content-Type"], "application/json");
      assert.equal(formPayload.body, "q=a+b");
      assert.equal(
        formPayload.headers["Content-Type"],
        "application/x-www-form-urlencoded;charset=utf-8",
      );
      assert.equal(binaryPayload.bodyBase64, Buffer.from("abc").toString("base64"));
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it("rejects unsupported FormData bodies instead of corrupting multipart data", async () => {
    const FormDataCtor = (globalThis as { FormData?: typeof FormData }).FormData;
    if (typeof FormDataCtor !== "function") return;

    let requestReachedProxy = false;
    const server = http.createServer((request, response) => {
      requestReachedProxy = true;
      request.resume();
      response.writeHead(200, { "content-type": "text/plain" });
      response.end("ok");
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const address = server.address();
      assert(address && typeof address === "object");
      const client = createStealthClient({
        baseURL: `http://127.0.0.1:${address.port}`,
      });
      const formData = new FormDataCtor();
      formData.append("file", "contents");

      await assert.rejects(
        () => client.post("https://example.com/upload", formData),
        /Unsupported request body type/,
      );
      assert.equal(requestReachedProxy, false);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it("applies transformRequest before sending to the proxy server", async () => {
    let capturedPayload: unknown;
    const server = http.createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on("data", (chunk) => chunks.push(chunk));
      request.on("end", () => {
        capturedPayload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        response.writeHead(200, { "content-type": "text/plain" });
        response.end("ok");
      });
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const address = server.address();
      assert(address && typeof address === "object");
      const client = createStealthClient({
        baseURL: `http://127.0.0.1:${address.port}`,
      });

      await client.post("https://example.com/transform", { ok: true }, {
        transformRequest: [
          (data, headers) => {
            headers.set("X-Transformed", "yes");
            return JSON.stringify({ transformed: data.ok });
          },
        ],
      });

      const payload = capturedPayload as {
        body: string;
        headers: Record<string, string>;
      };
      assert.equal(payload.body, '{"transformed":true}');
      assert.equal(payload.headers["X-Transformed"], "yes");
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it("honors responseType text for JSON-looking target responses", async () => {
    const server = http.createServer((request, response) => {
      request.resume();
      response.writeHead(200, { "content-type": "application/json" });
      response.end('{"ok":true}');
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const address = server.address();
      assert(address && typeof address === "object");
      const client = createStealthClient({
        baseURL: `http://127.0.0.1:${address.port}`,
      });

      const textResponse = await client.get("https://example.com/json", {
        responseType: "text",
      });
      assert.equal(textResponse.data, '{"ok":true}');

      const defaultResponse = await client.get("https://example.com/json");
      assert.deepEqual(defaultResponse.data, { ok: true });
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it("respects validateStatus for target response statuses", async () => {
    const server = http.createServer((request, response) => {
      request.resume();
      response.writeHead(404, { "content-type": "text/plain" });
      response.end("missing");
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const address = server.address();
      assert(address && typeof address === "object");
      const client = createStealthClient({
        baseURL: `http://127.0.0.1:${address.port}`,
      });

      await assert.rejects(
        () => client.get("https://example.com/missing"),
        (error) => {
          assert(error instanceof AxiosError);
          assert.equal(error.code, AxiosError.ERR_BAD_REQUEST);
          return true;
        },
      );
      const response = await client.get("https://example.com/missing", {
        validateStatus: () => true,
      });
      assert.equal(response.status, 404);
      assert.equal(response.data, "missing");

      const nullValidateResponse = await client.get("https://example.com/missing", {
        validateStatus: null,
      });
      assert.equal(nullValidateResponse.status, 404);
      assert.equal(nullValidateResponse.data, "missing");
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });
});
