# Changelog

## [1.0.5] - 2025-10-18

### Changed
- **Breaking:** Client now reads from `STEALTH_REQ_HOST` instead of requiring explicit `baseURL`
- **Breaking:** Client now reads from `STEALTH_REQ_SECRET` instead of `PROXY_SECRET`
- Updated `.env.example` with client configuration section
- Updated README with new environment variable documentation

### Migration
If you were using `PROXY_SECRET` for the client, rename it to `STEALTH_REQ_SECRET`:
```bash
# Old
PROXY_SECRET=your-secret

# New
STEALTH_REQ_HOST=http://your-server:3000
STEALTH_REQ_SECRET=your-secret
```

## [1.0.4] - 2025-10-18

### Fixed
- Added `require` and `default` conditions to package.json exports field
- Resolved `ERR_PACKAGE_PATH_NOT_EXPORTED` error

## [1.0.3] - 2025-10-18

### Fixed
- **Critical:** Separated client and server exports to prevent loading `tlsclientwrapper` when only using the client
- Resolved `ERR_INVALID_ARG_TYPE` error when importing client in other projects
- Server module now available via `stealth-req-api/server` import

### Changed
- Main export (`stealth-req-api`) now only exports client code
- Server must be imported separately: `import { startServer } from 'stealth-req-api/server'`
- Added package.json `exports` field for proper module resolution

## [1.0.2] - 2025-10-18

### Fixed
- **Critical:** Removed top-level `await` from server module that caused "Transform failed" errors with esbuild/tsx
- Wrapped Fastify initialization in lazy `initServer()` function
- Added proper TypeScript types to route handlers

### Changed
- Server initialization now happens only when `startServer()` is called
- Routes are set up via `setupRoutes()` function

## [1.0.1] - 2025-10-18

### Added
- `prepare` script to automatically build package after npm install from GitHub
- Ensures TypeScript is compiled before package use

### Fixed
- "Cannot find module" errors when installing from GitHub
- Package now builds automatically during installation
