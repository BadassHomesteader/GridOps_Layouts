const { app } = require('@azure/functions');
const { readJSON, writeJSON, CONTAINER } = require('../storage/blob');
const { checkAuthorization } = require('../middleware/auth');

const CONFIG_BLOB = '_config/allowed-users.json';

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Auth-Token'
};

function jsonResponse(body, status = 200) {
    return { status, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }, body: JSON.stringify(body) };
}

function errorResponse(message, status) {
    return { status, headers: { 'Content-Type': 'text/plain', ...CORS_HEADERS }, body: message };
}

/**
 * Read the current allowed-users config, initializing if needed
 */
async function readConfig() {
    let config = await readJSON(CONTAINER, CONFIG_BLOB);
    if (!config) {
        config = { allowedUsers: [], settings: { allowNewUsersByDefault: false } };
    }
    if (!config.allowedUsers) config.allowedUsers = [];
    return config;
}

// OPTIONS preflight
app.http('usersOptions', {
    methods: ['OPTIONS'],
    authLevel: 'anonymous',
    route: 'users',
    handler: async () => ({ status: 204, headers: CORS_HEADERS })
});

// GET /api/users — list all users (admin only)
app.http('listUsers', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'users',
    handler: async (request) => {
        const auth = await checkAuthorization(request);
        if (!auth.authorized) return errorResponse(auth.error, auth.status);
        if (auth.user.role !== 'admin') return errorResponse('Admin role required', 403);

        const config = await readConfig();
        return jsonResponse({ users: config.allowedUsers });
    }
});

// POST /api/users — add a user (admin only)
app.http('addUser', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'users',
    handler: async (request) => {
        const auth = await checkAuthorization(request);
        if (!auth.authorized) return errorResponse(auth.error, auth.status);
        if (auth.user.role !== 'admin') return errorResponse('Admin role required', 403);

        const body = await request.json();
        const email = (body.email || '').trim().toLowerCase();
        if (!email || !email.includes('@')) return errorResponse('Valid email required', 400);

        const config = await readConfig();
        if (config.allowedUsers.some(u => u.email.toLowerCase() === email)) {
            return errorResponse('User already exists: ' + email, 409);
        }

        config.allowedUsers.push({
            email,
            name: body.name || '',
            role: body.role || 'user',
            active: true
        });

        await writeJSON(CONTAINER, CONFIG_BLOB, config);
        return jsonResponse({ users: config.allowedUsers });
    }
});

// PUT /api/users — update a user (admin only)
app.http('updateUser', {
    methods: ['PUT'],
    authLevel: 'anonymous',
    route: 'users',
    handler: async (request) => {
        const auth = await checkAuthorization(request);
        if (!auth.authorized) return errorResponse(auth.error, auth.status);
        if (auth.user.role !== 'admin') return errorResponse('Admin role required', 403);

        const body = await request.json();
        const email = (body.email || '').trim().toLowerCase();
        if (!email) return errorResponse('Email required', 400);

        const config = await readConfig();
        const user = config.allowedUsers.find(u => u.email.toLowerCase() === email);
        if (!user) return errorResponse('User not found: ' + email, 404);

        // Prevent demoting the last active admin
        if (body.role && body.role !== 'admin' && user.role === 'admin') {
            const activeAdmins = config.allowedUsers.filter(u => u.role === 'admin' && u.active !== false);
            if (activeAdmins.length <= 1) {
                return errorResponse('Cannot demote the last active admin', 400);
            }
        }

        // Prevent deactivating the last active admin
        if (body.active === false && user.role === 'admin' && user.active !== false) {
            const activeAdmins = config.allowedUsers.filter(u => u.role === 'admin' && u.active !== false);
            if (activeAdmins.length <= 1) {
                return errorResponse('Cannot deactivate the last active admin', 400);
            }
        }

        if (body.name !== undefined) user.name = body.name;
        if (body.role !== undefined) user.role = body.role;
        if (body.active !== undefined) user.active = body.active;

        await writeJSON(CONTAINER, CONFIG_BLOB, config);
        return jsonResponse({ users: config.allowedUsers });
    }
});

// DELETE /api/users?email=... — remove a user (admin only)
app.http('deleteUser', {
    methods: ['DELETE'],
    authLevel: 'anonymous',
    route: 'users',
    handler: async (request) => {
        const auth = await checkAuthorization(request);
        if (!auth.authorized) return errorResponse(auth.error, auth.status);
        if (auth.user.role !== 'admin') return errorResponse('Admin role required', 403);

        const url = new URL(request.url);
        const email = (url.searchParams.get('email') || '').trim().toLowerCase();
        if (!email) return errorResponse('Email query parameter required', 400);

        const config = await readConfig();
        const idx = config.allowedUsers.findIndex(u => u.email.toLowerCase() === email);
        if (idx === -1) return errorResponse('User not found: ' + email, 404);

        // Prevent removing the last active admin
        const user = config.allowedUsers[idx];
        if (user.role === 'admin' && user.active !== false) {
            const activeAdmins = config.allowedUsers.filter(u => u.role === 'admin' && u.active !== false);
            if (activeAdmins.length <= 1) {
                return errorResponse('Cannot remove the last active admin', 400);
            }
        }

        config.allowedUsers.splice(idx, 1);
        await writeJSON(CONTAINER, CONFIG_BLOB, config);
        return jsonResponse({ users: config.allowedUsers });
    }
});
