import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import 'dotenv/config';

export interface StealthClientConfig {
  baseURL?: string;
  timeout?: number;
  tlsClientIdentifier?: string;
  proxyUrl?: string;
  followRedirects?: boolean;
  insecureSkipVerify?: boolean;
  proxySecret?: string;
}

export interface ProxyRequestPayload {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  proxyUrl?: string;
  clientIdentifier?: string;
  followRedirects?: boolean;
  insecureSkipVerify?: boolean;
  timeout?: number;
}

export interface ProxyResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: any;
  url: string;
}

/**
 * Creates a stealth HTTP client that proxies requests through the stealth-req-api server
 * @param config - Configuration options for the client
 * @returns Axios instance configured to use the stealth proxy
 */
export function createStealthClient(config: StealthClientConfig = {}): AxiosInstance {
  const {
    baseURL = process.env.STEALTH_REQ_HOST || 'http://localhost:3000',
    timeout = 30000,
    tlsClientIdentifier = 'chrome_120',
    proxyUrl,
    followRedirects = true,
    insecureSkipVerify = false,
    proxySecret = process.env.STEALTH_REQ_SECRET // Auto-read from env
  } = config;

  // Create base axios instance for communicating with the proxy server
  const proxyClient = axios.create({
    baseURL,
    timeout: timeout + 5000, // Add buffer for proxy timeout
    headers: proxySecret ? { 'X-Proxy-Secret': proxySecret } : {},
    // Disable automatic decompression - the TLS client already handles this
    decompress: false
  });

  // Create the stealth client with custom request interceptor
  const stealthClient = axios.create({
    timeout
  });

  // Intercept all requests and route through the proxy
  stealthClient.interceptors.request.use(async (axiosConfig: AxiosRequestConfig) => {
    const targetUrl = axiosConfig.url || '';
    
    // Build the proxy request payload
    const payload: ProxyRequestPayload = {
      url: targetUrl,
      method: axiosConfig.method?.toUpperCase() || 'GET',
      headers: axiosConfig.headers as Record<string, string> || {},
      body: axiosConfig.data,
      clientIdentifier: tlsClientIdentifier,
      followRedirects,
      insecureSkipVerify,
      timeout,
      ...(proxyUrl && { proxyUrl })
    };

    // Make request through the proxy server
    const proxyResponse = await proxyClient.post<any>('/proxy', payload);
    
    // The server now returns the raw body directly with headers set on the response
    // Transform proxy response into axios response format
    const transformedResponse: any = {
      data: proxyResponse.data,
      status: proxyResponse.status,
      statusText: proxyResponse.statusText,
      headers: proxyResponse.headers,
      config: axiosConfig,
      request: {}
    };

    // Throw the response to skip the actual request
    // This is caught by the response interceptor
    return Promise.reject({
      isProxyResponse: true,
      response: transformedResponse
    });
  });

  // Response interceptor to handle the transformed response
  stealthClient.interceptors.response.use(
    (response) => response,
    (error) => {
      // If this is our proxy response, return it as success
      if (error.isProxyResponse) {
        return Promise.resolve(error.response);
      }
      // Otherwise, it's a real error
      return Promise.reject(error);
    }
  );

  return stealthClient;
}

export default createStealthClient;
