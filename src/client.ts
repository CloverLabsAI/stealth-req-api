import axios, {
  AxiosHeaders,
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosRequestTransformer,
  ResponseType,
} from "axios";
import "dotenv/config";

export interface StealthClientConfig {
  baseURL?: string;
  timeout?: number;
  tlsClientIdentifier?: string;
  proxyUrl?: string | null;
  followRedirects?: boolean;
  insecureSkipVerify?: boolean;
  proxySecret?: string;
}

export interface ProxyRequestPayload {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  bodyBase64?: string;
  proxyUrl?: string | null;
  clientIdentifier?: string;
  followRedirects?: boolean;
  insecureSkipVerify?: boolean;
  timeout?: number;
  isByteResponse?: boolean;
}

export interface StealthAxiosRequestConfig<
  D = any,
> extends AxiosRequestConfig<D> {
  proxyUrl?: string | null;
}

export interface StealthAxiosInstance extends AxiosInstance {
  <T = any, R = AxiosResponse<T>, D = any>(
    config: StealthAxiosRequestConfig<D>,
  ): Promise<R>;
  <T = any, R = AxiosResponse<T>, D = any>(
    url: string,
    config?: StealthAxiosRequestConfig<D>,
  ): Promise<R>;
  defaults: AxiosInstance["defaults"] & {
    proxyUrl?: string | null;
  };
  request<T = any, R = AxiosResponse<T>, D = any>(
    config: StealthAxiosRequestConfig<D>,
  ): Promise<R>;
  get<T = any, R = AxiosResponse<T>, D = any>(
    url: string,
    config?: StealthAxiosRequestConfig<D>,
  ): Promise<R>;
  delete<T = any, R = AxiosResponse<T>, D = any>(
    url: string,
    config?: StealthAxiosRequestConfig<D>,
  ): Promise<R>;
  head<T = any, R = AxiosResponse<T>, D = any>(
    url: string,
    config?: StealthAxiosRequestConfig<D>,
  ): Promise<R>;
  options<T = any, R = AxiosResponse<T>, D = any>(
    url: string,
    config?: StealthAxiosRequestConfig<D>,
  ): Promise<R>;
  post<T = any, R = AxiosResponse<T>, D = any>(
    url: string,
    data?: D,
    config?: StealthAxiosRequestConfig<D>,
  ): Promise<R>;
  put<T = any, R = AxiosResponse<T>, D = any>(
    url: string,
    data?: D,
    config?: StealthAxiosRequestConfig<D>,
  ): Promise<R>;
  patch<T = any, R = AxiosResponse<T>, D = any>(
    url: string,
    data?: D,
    config?: StealthAxiosRequestConfig<D>,
  ): Promise<R>;
  postForm<T = any, R = AxiosResponse<T>, D = any>(
    url: string,
    data?: D,
    config?: StealthAxiosRequestConfig<D>,
  ): Promise<R>;
  putForm<T = any, R = AxiosResponse<T>, D = any>(
    url: string,
    data?: D,
    config?: StealthAxiosRequestConfig<D>,
  ): Promise<R>;
  patchForm<T = any, R = AxiosResponse<T>, D = any>(
    url: string,
    data?: D,
    config?: StealthAxiosRequestConfig<D>,
  ): Promise<R>;
}

export interface ProxyResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: any;
  url: string;
}

function isArrayBuffer(value: unknown): value is ArrayBuffer {
  return value instanceof ArrayBuffer;
}

function toBodyBuffer(value: unknown): Buffer | null {
  if (Buffer.isBuffer(value)) return value;
  if (isArrayBuffer(value)) return Buffer.from(value);
  if (ArrayBuffer.isView(value)) {
    return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  }
  return null;
}

function isFormDataLike(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;

  const FormDataCtor = (globalThis as { FormData?: unknown }).FormData;
  if (typeof FormDataCtor === "function" && value instanceof FormDataCtor) {
    return true;
  }

  return Object.prototype.toString.call(value) === "[object FormData]";
}

function isBlobLike(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;

  const BlobCtor = (globalThis as { Blob?: unknown }).Blob;
  if (typeof BlobCtor === "function" && value instanceof BlobCtor) {
    return true;
  }

  return Object.prototype.toString.call(value) === "[object Blob]";
}

function isStreamLike(value: unknown): boolean {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as { pipe?: unknown }).pipe === "function"
  );
}

function hasHeader(headers: Record<string, string>, name: string): boolean {
  const lowerName = name.toLowerCase();
  return Object.keys(headers).some((header) => header.toLowerCase() === lowerName);
}

function setHeaderIfMissing(
  headers: Record<string, string>,
  name: string,
  value: string,
) {
  if (!hasHeader(headers, name)) {
    headers[name] = value;
  }
}

function normalizeHeaders(headers: AxiosHeaders): Record<string, string> {
  return headers.toJSON(true) as Record<string, string>;
}

function applyTransformRequest(
  data: unknown,
  headers: AxiosHeaders,
  transformRequest: AxiosRequestConfig["transformRequest"],
  context: StealthAxiosRequestConfig,
): unknown {
  const transforms = Array.isArray(transformRequest)
    ? transformRequest
    : transformRequest
      ? [transformRequest]
      : [];

  return transforms.reduce(
    (currentData, transform) =>
      (transform as AxiosRequestTransformer).call(
        context as any,
        currentData,
        headers,
      ),
    data,
  );
}

function serializeRequestData(
  data: unknown,
  headers: Record<string, string>,
  config: StealthAxiosRequestConfig,
): Pick<ProxyRequestPayload, "body" | "bodyBase64"> {
  if (data === undefined) return {};
  if (data === null) return { body: null };

  const buffer = toBodyBuffer(data);
  if (buffer) {
    return { bodyBase64: buffer.toString("base64") };
  }

  if (data instanceof URLSearchParams) {
    setHeaderIfMissing(
      headers,
      "Content-Type",
      "application/x-www-form-urlencoded;charset=utf-8",
    );
    return { body: data.toString() };
  }

  if (isFormDataLike(data) || isBlobLike(data) || isStreamLike(data)) {
    throw new AxiosError(
      "Unsupported request body type for stealth proxy transport. Use Buffer, ArrayBuffer, URLSearchParams, string, or JSON-serializable data.",
      AxiosError.ERR_BAD_REQUEST,
      config as any,
    );
  }

  if (typeof data === "string") return { body: data };
  if (typeof data === "number" || typeof data === "boolean") {
    return { body: String(data) };
  }

  setHeaderIfMissing(headers, "Content-Type", "application/json");
  return { body: JSON.stringify(data) };
}

function resolveProxyResponseType(
  responseType: ResponseType | undefined,
): ResponseType | undefined {
  if (
    responseType === "arraybuffer" ||
    responseType === "text" ||
    responseType === "json"
  ) {
    return responseType;
  }

  return undefined;
}

function getStatusErrorCode(status: number): string | undefined {
  if (status >= 400 && status < 500) return AxiosError.ERR_BAD_REQUEST;
  if (status >= 500 && status < 600) return AxiosError.ERR_BAD_RESPONSE;
  return undefined;
}

function resolveRequestProxyUrl(
  axiosConfig: StealthAxiosRequestConfig,
  defaults: StealthAxiosInstance["defaults"],
  configuredProxyUrl: string | null | undefined,
): { shouldSend: boolean; proxyUrl?: string | null } {
  const candidates: unknown[] = [];

  if (
    Object.prototype.hasOwnProperty.call(axiosConfig, "proxyUrl") &&
    axiosConfig.proxyUrl !== undefined
  ) {
    candidates.push(axiosConfig.proxyUrl);
  } else if (
    Object.prototype.hasOwnProperty.call(defaults, "proxyUrl") &&
    defaults.proxyUrl !== undefined
  ) {
    candidates.push(defaults.proxyUrl);
  } else if (configuredProxyUrl !== undefined) {
    candidates.push(configuredProxyUrl);
  }

  if (candidates.length === 0) return { shouldSend: false };

  const proxyUrl = candidates[0];
  if (proxyUrl === null || proxyUrl === "") {
    return { shouldSend: true, proxyUrl: null };
  }
  if (typeof proxyUrl === "string") return { shouldSend: true, proxyUrl };

  return { shouldSend: false };
}

/**
 * Creates a stealth HTTP client that proxies requests through the stealth-req-api server
 * @param config - Configuration options for the client
 * @returns Axios instance configured to use the stealth proxy
 */
export function createStealthClient(
  config: StealthClientConfig = {},
): StealthAxiosInstance {
  const {
    baseURL = process.env.STEALTH_REQ_HOST || "http://localhost:3000",
    timeout = 30000,
    tlsClientIdentifier = "chrome_120",
    proxyUrl,
    followRedirects = true,
    insecureSkipVerify = false,
    proxySecret = process.env.STEALTH_REQ_SECRET, // Auto-read from env
  } = config;

  // Create base axios instance for communicating with the proxy server
  const proxyClient = axios.create({
    baseURL,
    timeout: timeout + 5000, // Add buffer for proxy timeout
    headers: proxySecret ? { "X-Proxy-Secret": proxySecret } : {},
  });

  // Create the stealth client with custom request interceptor
  const stealthClient = axios.create({
    timeout,
  }) as StealthAxiosInstance;

  // Intercept all requests and route through the proxy
  stealthClient.interceptors.request.use(
    async (axiosConfig: StealthAxiosRequestConfig) => {
      const targetUrl = stealthClient.getUri(axiosConfig);
      const headerBag = AxiosHeaders.from(
        axiosConfig.headers as Parameters<typeof AxiosHeaders.from>[0],
      );
      const transformedData = applyTransformRequest(
        axiosConfig.data,
        headerBag,
        axiosConfig.transformRequest ?? axios.defaults.transformRequest,
        axiosConfig,
      );
      const headers = normalizeHeaders(headerBag);
      const serializedData = serializeRequestData(
        transformedData,
        headers,
        axiosConfig,
      );
      const requestProxy = resolveRequestProxyUrl(
        axiosConfig,
        stealthClient.defaults,
        proxyUrl,
      );
      const requestTimeout = axiosConfig.timeout ?? timeout;
      const isByteResponse = axiosConfig.responseType === "arraybuffer";
      const proxyResponseType = resolveProxyResponseType(
        axiosConfig.responseType,
      );
      const validateStatus =
        Object.prototype.hasOwnProperty.call(axiosConfig, "validateStatus")
          ? axiosConfig.validateStatus
          : stealthClient.defaults.validateStatus;

      // Build the proxy request payload
      const payload: ProxyRequestPayload = {
        url: targetUrl,
        method: axiosConfig.method?.toUpperCase() || "GET",
        headers,
        ...serializedData,
        clientIdentifier: tlsClientIdentifier,
        followRedirects,
        insecureSkipVerify,
        timeout: requestTimeout,
        ...(isByteResponse ? { isByteResponse: true } : {}),
        ...(requestProxy.shouldSend ? { proxyUrl: requestProxy.proxyUrl ?? null } : {}),
      };

      // Make request through the proxy server
      const proxyResponse = await proxyClient.post<any>("/proxy", payload, {
        timeout: requestTimeout + 5000,
        responseType: proxyResponseType,
        transformResponse: axiosConfig.transformResponse,
        validateStatus: () => true,
      });

      // The server now returns the raw body directly with headers set on the response
      // Transform proxy response into axios response format
      const transformedResponse: any = {
        data: proxyResponse.data,
        status: proxyResponse.status,
        statusText: proxyResponse.statusText,
        headers: proxyResponse.headers,
        config: axiosConfig,
        request: {},
      };

      // Throw the response to skip the actual request
      // This is caught by the response interceptor
      return Promise.reject({
        isProxyResponse: true,
        validateStatus,
        response: transformedResponse,
      });
    },
  );

  // Response interceptor to handle the transformed response
  stealthClient.interceptors.response.use(
    (response) => response,
    (error) => {
      // If this is our proxy response, return it as success
      if (error.isProxyResponse) {
        const response = error.response as AxiosResponse;
        const validateStatus = error.validateStatus as
          | ((status: number) => boolean)
          | null
          | undefined;

        if (!validateStatus || validateStatus(response.status)) {
          return Promise.resolve(response);
        }

        return Promise.reject(
          new AxiosError(
            `Request failed with status code ${response.status}`,
            getStatusErrorCode(response.status),
            response.config,
            response.request,
            response,
          ),
        );
      }
      // Otherwise, it's a real error
      return Promise.reject(error);
    },
  );

  return stealthClient;
}

export default createStealthClient;
