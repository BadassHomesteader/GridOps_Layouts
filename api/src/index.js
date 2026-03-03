// Entry point for Azure Functions v4

// Polyfill: ensure global crypto is available (needed by @azure/storage-blob SDK)
if (typeof globalThis.crypto === 'undefined') {
    globalThis.crypto = require('crypto');
}

// Import all function modules so they're registered with the app
require('./functions/projects');
require('./functions/health');
require('./functions/users');
