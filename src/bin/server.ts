#!/usr/bin/env node
import { startServer } from '../server.js';

// Start the server when run as a script
startServer().catch((error) => {
  console.error(error);
  process.exit(1);
});
