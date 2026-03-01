const { app } = require('@azure/functions');

/**
 * Health check endpoint for monitoring
 * Returns 200 with diagnostics (no auth required)
 */
app.http('health', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'health',
    handler: async (request, context) => {
        context.log('[HEALTH] Health check requested');

        return {
            status: 200,
            jsonBody: {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                version: process.env.APP_VERSION || '1.0.0',
                runtime: process.version,
                hasStorageConn: !!(process.env.STORAGE_CONNECTION_STRING),
                hasWebJobsStorage: !!(process.env.AzureWebJobsStorage)
            }
        };
    }
});
