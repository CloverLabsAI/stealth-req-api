declare module "tlsclientwrapper" {
    /** Generic string map for HTTP headers (case-insensitive by convention). */
    export type Headers = Record<string, string>;

    /** Known cookie shape used by the wrapper. */
    export interface Cookie {
        name: string;
        value: string;
        domain?: string;
        path?: string;
        expires?: number | Date;
        httpOnly?: boolean;
        secure?: boolean;
        sameSite?: "Strict" | "Lax" | "None";
    }

    /** TLS client fingerprint identifier (kept open-ended to avoid churn). */
    export type ClientProfile = string; // e.g. "chrome_131", "firefox_133"

    /** Low-level transport toggles (kept generic since upstream varies). */
    export interface TransportOptions {
        // Add concrete fields if you rely on them; left open by design.
        [key: string]: unknown;
    }

    /** Certificate pinning configuration placeholder. */
    export type CertificatePinningHosts = Record<string, string[]>;
    // Example: { "example.com": ["sha256/abcd…", "sha256/efgh…"] }

    /** Request options accepted per call (merged over session defaults). */
    export interface RequestOptions {
        /** Explicit HTTP method; omitted when using convenience helpers (get/post…). */
        method?: string;

        /** Absolute URL (required for .request(); provided implicitly in .get()/.post() helpers). */
        url?: string;

        /** Per-request headers. */
        headers?: Headers;

        /** JSON/body as string; for binary, see isByteRequest + bodyBase64. */
        body?: string | Buffer | Uint8Array;

        /**
         * Base64-encoded request body. Used when isByteRequest=true (e.g., image uploads).
         * If both body and bodyBase64 are provided, bodyBase64 takes precedence when isByteRequest is true.
         */
        bodyBase64?: string;

        /** Per-request cookies (merged with the session’s cookie jar / defaults). */
        requestCookies?: Cookie[];

        /** Follow 3xx redirects. */
        followRedirects?: boolean;

        /** Force HTTP/1.1 (useful for some endpoints/proxies). */
        forceHttp1?: boolean;

        /** Proxy URL: scheme://user:pass@host:port */
        proxyUrl?: string;

        /** Status codes that should trigger retry logic (overrides session defaults). */
        retryStatusCodes?: number[];

        /** Milliseconds-based timeout. Takes precedence over timeoutSeconds. */
        timeoutMilliseconds?: number;

        /** Seconds-based timeout (rounded). */
        timeoutSeconds?: number;

        /** Override TLS SNI */
        serverNameOverwrite?: string;

        /** Explicit header order for deterministic signing. */
        headerOrder?: string[];

        /** When true, the request body must be base64 (bodyBase64). */
        isByteRequest?: boolean;

        /** When true, the response body will be base64. */
        isByteResponse?: boolean;

        /** Bind outgoing socket to a local interface/IP. */
        localAddress?: string;

        /** Advanced transport configuration (TLS ciphers, ALPN, etc.). */
        transportOptions?: TransportOptions;
    }

    /** Response shape returned by every request. */
    export interface Response<TBody = string | Uint8Array> {
        /** Final URL (after redirects, if any). */
        url: string;

        /** HTTP status code. */
        status: number;

        /** Headers (normalized to string values). */
        headers: Headers;

        /** Response body: string (utf-8) or binary (Uint8Array) depending on options. */
        body: TBody;

        /** If isByteResponse was true, bodyBase64 provides the raw base64 string. */
        bodyBase64?: string;

        /** Cookies parsed from the response, if available. */
        cookies?: Cookie[];

        /** Whether a redirect chain occurred. */
        redirected?: boolean;

        /** HTTP version reported by the stack (e.g., "h2", "1.1"). */
        httpVersion?: string;

        /** Remote IP/port if exposed by the underlying client. */
        remoteAddress?: string;

        /** Simple timing info, if exposed with debug on. */
        timing?: {
            start: number; // ms since epoch
            end: number; // ms since epoch
            durationMs: number;
        };
    }

    /** Module-level options (worker pool + global defaults). */
    export interface TlsClientDefaultOptions {
        /** TLS fingerprint preset; defaults to a recent Chrome. */
        tlsClientIdentifier?: ClientProfile;

        /** Retry toggles. */
        retryIsEnabled?: boolean;
        retryMaxCount?: number;
        retryStatusCodes?: number[]; // default includes 408, 429, 5xx etc.

        /** Panic handling (rust ffi). */
        catchPanics?: boolean;

        /** Pin leaf/intermediate certs by host. */
        certificatePinningHosts?: CertificatePinningHosts | null;

        /** Supply your own TLS client implementation (advanced). */
        customTlsClient?: unknown | null;

        /** Advanced transport/handshake options. */
        transportOptions?: TransportOptions | null;

        /** Redirect handling default. */
        followRedirects?: boolean;

        /** Force HTTP/1.1 globally. */
        forceHttp1?: boolean;

        /** Default header order. */
        headerOrder?: string[];

        /** Default headers applied to each request. */
        defaultHeaders?: Headers | null;

        /** CONNECT headers for proxy tunneling. */
        connectHeaders?: Headers | null;

        /** TLS verify off (use cautiously). */
        insecureSkipVerify?: boolean;

        /** Default binary request/response toggles. */
        isByteRequest?: boolean;
        isByteResponse?: boolean;

        /** Mark proxy as rotating (affects connection reuse). */
        isRotatingProxy?: boolean;

        /** Global proxy. */
        proxyUrl?: string | null;

        /** Default cookies seeded into the session jar. */
        defaultCookies?: Cookie[] | null;

        /** Disable specific IP families. */
        disableIPV6?: boolean;
        disableIPV4?: boolean;

        /** Bind to local interface/IP. */
        localAddress?: string | null;

        /** Override SNI. */
        serverNameOverwrite?: string;

        /** Streaming options (reserved). */
        streamOutputBlockSize?: number | null;
        streamOutputEOFSymbol?: string | null;
        streamOutputPath?: string | null;

        /** Timeouts. */
        timeoutMilliseconds?: number;
        timeoutSeconds?: number;

        /** Debug log toggles. */
        withDebug?: boolean;

        /** Cookie jar handling. */
        withDefaultCookieJar?: boolean;
        withoutCookieJar?: boolean;

        /** Worker pool size for the module. */
        maxThreads?: number;

        /** Optional path hints for native lib/worker bootstrap. */
        libraryPath?: string;
        workerFile?: string;
    }

    /** Per-session options (inherit + override module defaults). */
    export interface TlsClientOptions
        extends Omit<
            TlsClientDefaultOptions,
            "defaultCookies" | "defaultHeaders" | "retryStatusCodes"
        > {
        /** Override default headers just for this session. */
        defaultHeaders?: Headers;

        /** Override default cookies just for this session. */
        defaultCookies?: Cookie[];

        /** Unique session id (created internally if omitted). */
        sessionId?: string;
    }

    /** Lightweight stats snapshot for the worker pool. */
    export interface PoolStats {
        /** Configured max threads. */
        maxThreads: number;

        /** Active worker count (running tasks). */
        active: number;

        /** Idle workers ready to accept tasks. */
        idle: number;

        /** Tasks waiting in queue. */
        queued: number;

        /** Completed task count (since start). */
        completed: number;

        /** Total tasks in-flight (active + queued). */
        pending: number;
    }

    /** Manages the shared worker pool and global TLS client state. */
    export class ModuleClient {
        constructor(options?: TlsClientDefaultOptions);

        /** Return current pool stats (poll periodically if you want trends). */
        getPoolStats(): PoolStats;

        /** Update module-level defaults at runtime. */
        updateDefaults(options: Partial<TlsClientDefaultOptions>): void;

        /** Gracefully stop workers and free native resources. */
        terminate(): Promise<void>;
    }

    /** Encapsulates a single TLS session (cookies, defaults, requests). */
    export class SessionClient {
        constructor(module: ModuleClient, options?: TlsClientOptions);

        /** Unique session identifier. */
        readonly sessionId: string;

        /** Read-only view of current session options. */
        get options(): Readonly<TlsClientOptions>;

        /** Merge new options into the session (e.g., change proxy, headers). */
        updateOptions(options: Partial<TlsClientOptions>): void;

        /** Cookie helpers. */
        setCookies(cookies: Cookie[], url?: string): Promise<void>;
        getCookies(domainFilter?: string): Promise<Cookie[]>;
        clearCookies(): Promise<void>;

        /** Shorthand HTTP helpers. */
        get(
            url: string,
            opts?: Omit<RequestOptions, "method" | "url">
        ): Promise<Response>;
        delete(
            url: string,
            opts?: Omit<RequestOptions, "method" | "url">
        ): Promise<Response>;
        head(
            url: string,
            opts?: Omit<RequestOptions, "method" | "url">
        ): Promise<Response>;
        options(
            url: string,
            opts?: Omit<RequestOptions, "method" | "url">
        ): Promise<Response>;
        post(
            url: string,
            body?: RequestOptions["body"],
            opts?: Omit<RequestOptions, "method" | "url" | "body">
        ): Promise<Response>;
        put(
            url: string,
            body?: RequestOptions["body"],
            opts?: Omit<RequestOptions, "method" | "url" | "body">
        ): Promise<Response>;
        patch(
            url: string,
            body?: RequestOptions["body"],
            opts?: Omit<RequestOptions, "method" | "url" | "body">
        ): Promise<Response>;

        /**
         * Fully custom request. When isByteResponse=true, `body` is Uint8Array and `bodyBase64` is also provided.
         * When isByteResponse=false, `body` is a UTF-8 string.
         */
        request<TBody = string | Uint8Array>(
            opts: RequestOptions & { url: string; method?: string }
        ): Promise<Response<TBody>>;

        /** Destroy the underlying session and free resources; instance becomes unusable. */
        destroySession(): Promise<void>;
    }
}
