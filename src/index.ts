// Export client
export { createStealthClient, type StealthClientConfig, type ProxyRequestPayload, type ProxyResponse } from './client.js';

// Export server (but don't start it)
export { startServer } from './server.js';
