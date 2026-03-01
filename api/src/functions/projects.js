const { app } = require('@azure/functions');
const { readJSON, writeJSON, listJSON, readBatchJSON, deleteBlob, CONTAINER } = require('../storage/blob');
const { checkAuthorization, getUserFromRequest } = require('../middleware/auth');

// CORS headers for all responses
function corsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Auth-Token'
    };
}

// Normalize sharedWith: handles both old format ("email") and new format ({email, access})
function normalizeSharedWith(sharedWith) {
    if (!Array.isArray(sharedWith)) return [];
    return sharedWith.map(entry => {
        if (typeof entry === 'string') return { email: entry.toLowerCase(), access: 'edit' };
        return { email: (entry.email || '').toLowerCase(), access: entry.access || 'edit' };
    });
}

// Get a user's access level for a project (returns 'edit', 'view', or null)
function getUserAccess(sharedWith, userEmail) {
    const normalized = normalizeSharedWith(sharedWith);
    const entry = normalized.find(e => e.email === userEmail.toLowerCase());
    return entry ? entry.access : null;
}

// --- OPTIONS handlers for CORS preflight ---

app.http('projectsOptions', {
    methods: ['OPTIONS'],
    authLevel: 'anonymous',
    route: 'projects/{id?}',
    handler: async () => ({ status: 204, headers: corsHeaders() })
});

app.http('projectSharingOptions', {
    methods: ['OPTIONS'],
    authLevel: 'anonymous',
    route: 'projects/{id}/sharing',
    handler: async () => ({ status: 204, headers: corsHeaders() })
});

app.http('meOptions', {
    methods: ['OPTIONS'],
    authLevel: 'anonymous',
    route: 'me',
    handler: async () => ({ status: 204, headers: corsHeaders() })
});

// --- GET /api/projects - List projects (filtered by access) ---

app.http('listProjects', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'projects',
    handler: async (request, context) => {
        const authResult = await checkAuthorization(request);
        if (!authResult.authorized) {
            return {
                status: authResult.status,
                headers: { 'Content-Type': 'application/json', ...corsHeaders() },
                body: JSON.stringify({ error: authResult.error })
            };
        }

        const userEmail = authResult.user.email.toLowerCase();
        const isAdmin = authResult.user.role === 'admin';

        try {
            const blobNames = await listJSON(CONTAINER, 'layouts/');
            const allProjects = await readBatchJSON(CONTAINER, blobNames);

            const projects = allProjects.filter(data => {
                const owner = (data.owner || '').toLowerCase();
                const userAccess = getUserAccess(data.sharedWith, userEmail);
                return isAdmin || owner === userEmail || userAccess !== null;
            }).map(data => ({
                id: data.id,
                name: data.name || 'Untitled',
                propertyAddress: data.layout?.propertyAddress || '',
                elementCount: data.layout?.elements?.length || 0,
                lastModified: data.updatedAt || data.createdAt,
                owner: data.owner || null,
                sharedWith: data.sharedWith || []
            }));

            return {
                status: 200,
                headers: { 'Content-Type': 'application/json', ...corsHeaders() },
                body: JSON.stringify(projects)
            };
        } catch (error) {
            context.error('Error listing projects:', error);
            return {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...corsHeaders() },
                body: JSON.stringify({ error: 'Failed to list projects', details: error.message })
            };
        }
    }
});

// --- GET /api/projects/{id} - Get a specific project ---

app.http('getProject', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'projects/{id}',
    handler: async (request, context) => {
        const authResult = await checkAuthorization(request);
        if (!authResult.authorized) {
            return {
                status: authResult.status,
                headers: { 'Content-Type': 'application/json', ...corsHeaders() },
                body: JSON.stringify({ error: authResult.error })
            };
        }

        const id = request.params.id;
        if (!id) {
            return {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders() },
                body: JSON.stringify({ error: 'Project ID is required' })
            };
        }

        const userEmail = authResult.user.email.toLowerCase();
        const isAdmin = authResult.user.role === 'admin';

        try {
            const data = await readJSON(CONTAINER, `layouts/${id}.json`);
            if (!data) {
                return {
                    status: 404,
                    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
                    body: JSON.stringify({ error: 'Project not found' })
                };
            }

            // Check access
            const owner = (data.owner || '').toLowerCase();
            const userAccess = getUserAccess(data.sharedWith, userEmail);
            if (!isAdmin && owner !== userEmail && userAccess === null) {
                return {
                    status: 403,
                    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
                    body: JSON.stringify({ error: 'You do not have access to this project' })
                };
            }

            // Add canEdit flag for the frontend
            const canEdit = isAdmin || owner === userEmail ||
                (authResult.user.role !== 'viewer' && userAccess === 'edit');
            data.canEdit = canEdit;

            return {
                status: 200,
                headers: { 'Content-Type': 'application/json', ...corsHeaders() },
                body: JSON.stringify(data)
            };
        } catch (error) {
            context.error('Error getting project:', error);
            return {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...corsHeaders() },
                body: JSON.stringify({ error: 'Failed to get project', details: error.message })
            };
        }
    }
});

// --- POST /api/projects - Create a new project ---

app.http('createProject', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'projects',
    handler: async (request, context) => {
        const authResult = await checkAuthorization(request);
        if (!authResult.authorized) {
            return {
                status: authResult.status,
                headers: { 'Content-Type': 'application/json', ...corsHeaders() },
                body: JSON.stringify({ error: authResult.error })
            };
        }

        if (authResult.user.role === 'viewer') {
            return {
                status: 403,
                headers: { 'Content-Type': 'application/json', ...corsHeaders() },
                body: JSON.stringify({ error: 'Viewers have read-only access' })
            };
        }

        try {
            const body = await request.text();
            const data = JSON.parse(body);

            const id = data.id || `layout-${Date.now()}`;
            const now = new Date().toISOString();

            const project = {
                id,
                name: data.name || 'Untitled Layout',
                owner: authResult.user.email.toLowerCase(),
                createdBy: authResult.user.email,
                createdAt: now,
                updatedAt: now,
                sharedWith: data.sharedWith || [],
                layout: data.layout || {
                    version: 1,
                    propertyAddress: '',
                    ceilingHeight: 0,
                    palletConfig: { width: 48, height: 40 },
                    inventoryPerPallet: 0,
                    elements: []
                }
            };

            // Check if already exists
            const existing = await readJSON(CONTAINER, `layouts/${id}.json`);
            if (existing) {
                return {
                    status: 409,
                    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
                    body: JSON.stringify({ error: 'Project with this ID already exists' })
                };
            }

            await writeJSON(CONTAINER, `layouts/${id}.json`, project);

            return {
                status: 201,
                headers: { 'Content-Type': 'application/json', ...corsHeaders() },
                body: JSON.stringify({ id, message: 'Project created successfully' })
            };
        } catch (error) {
            context.error('Error creating project:', error);
            return {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...corsHeaders() },
                body: JSON.stringify({ error: 'Failed to create project', details: error.message })
            };
        }
    }
});

// --- PUT /api/projects/{id} - Update a project ---

app.http('updateProject', {
    methods: ['PUT'],
    authLevel: 'anonymous',
    route: 'projects/{id}',
    handler: async (request, context) => {
        const authResult = await checkAuthorization(request);
        if (!authResult.authorized) {
            return {
                status: authResult.status,
                headers: { 'Content-Type': 'application/json', ...corsHeaders() },
                body: JSON.stringify({ error: authResult.error })
            };
        }

        if (authResult.user.role === 'viewer') {
            return {
                status: 403,
                headers: { 'Content-Type': 'application/json', ...corsHeaders() },
                body: JSON.stringify({ error: 'Viewers have read-only access' })
            };
        }

        const id = request.params.id;
        if (!id) {
            return {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders() },
                body: JSON.stringify({ error: 'Project ID is required' })
            };
        }

        const userEmail = authResult.user.email.toLowerCase();
        const isAdmin = authResult.user.role === 'admin';

        try {
            const body = await request.text();
            const data = JSON.parse(body);

            // Read existing to preserve metadata and check access
            const existing = await readJSON(CONTAINER, `layouts/${id}.json`);
            if (!existing) {
                return {
                    status: 404,
                    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
                    body: JSON.stringify({ error: 'Project not found' })
                };
            }

            // Check per-project access
            const owner = (existing.owner || '').toLowerCase();
            const userAccess = getUserAccess(existing.sharedWith, userEmail);
            if (!isAdmin && owner !== userEmail && userAccess !== 'edit') {
                return {
                    status: 403,
                    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
                    body: JSON.stringify({ error: 'You have read-only access to this project' })
                };
            }

            // Preserve metadata, update layout and name
            const updated = {
                ...existing,
                name: data.name || existing.name,
                layout: data.layout || existing.layout,
                updatedAt: new Date().toISOString(),
                updatedBy: authResult.user.email
            };

            await writeJSON(CONTAINER, `layouts/${id}.json`, updated);

            return {
                status: 200,
                headers: { 'Content-Type': 'application/json', ...corsHeaders() },
                body: JSON.stringify({ id, message: 'Project saved successfully' })
            };
        } catch (error) {
            context.error('Error updating project:', error);
            return {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...corsHeaders() },
                body: JSON.stringify({ error: 'Failed to save project', details: error.message })
            };
        }
    }
});

// --- DELETE /api/projects/{id} - Delete a project ---

app.http('deleteProject', {
    methods: ['DELETE'],
    authLevel: 'anonymous',
    route: 'projects/{id}',
    handler: async (request, context) => {
        const authResult = await checkAuthorization(request);
        if (!authResult.authorized) {
            return {
                status: authResult.status,
                headers: { 'Content-Type': 'application/json', ...corsHeaders() },
                body: JSON.stringify({ error: authResult.error })
            };
        }

        if (authResult.user.role === 'viewer') {
            return {
                status: 403,
                headers: { 'Content-Type': 'application/json', ...corsHeaders() },
                body: JSON.stringify({ error: 'Viewers have read-only access' })
            };
        }

        const id = request.params.id;
        if (!id) {
            return {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders() },
                body: JSON.stringify({ error: 'Project ID is required' })
            };
        }

        const userEmail = authResult.user.email.toLowerCase();
        const isAdmin = authResult.user.role === 'admin';

        try {
            // Read existing to check access
            const existing = await readJSON(CONTAINER, `layouts/${id}.json`);
            if (!existing) {
                return {
                    status: 404,
                    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
                    body: JSON.stringify({ error: 'Project not found' })
                };
            }

            const owner = (existing.owner || '').toLowerCase();
            if (!isAdmin && owner !== userEmail) {
                return {
                    status: 403,
                    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
                    body: JSON.stringify({ error: 'Only the owner or admin can delete a project' })
                };
            }

            await deleteBlob(CONTAINER, `layouts/${id}.json`);

            return {
                status: 200,
                headers: { 'Content-Type': 'application/json', ...corsHeaders() },
                body: JSON.stringify({ message: 'Project deleted successfully' })
            };
        } catch (error) {
            context.error('Error deleting project:', error);
            return {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...corsHeaders() },
                body: JSON.stringify({ error: 'Failed to delete project', details: error.message })
            };
        }
    }
});

// --- PUT /api/projects/{id}/sharing - Update sharing ---

app.http('updateProjectSharing', {
    methods: ['PUT'],
    authLevel: 'anonymous',
    route: 'projects/{id}/sharing',
    handler: async (request, context) => {
        const authResult = await checkAuthorization(request);
        if (!authResult.authorized) {
            return {
                status: authResult.status,
                headers: { 'Content-Type': 'application/json', ...corsHeaders() },
                body: JSON.stringify({ error: authResult.error })
            };
        }

        const id = request.params.id;
        if (!id) {
            return {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders() },
                body: JSON.stringify({ error: 'Project ID is required' })
            };
        }

        const userEmail = authResult.user.email.toLowerCase();
        const isAdmin = authResult.user.role === 'admin';

        try {
            const body = await request.text();
            const { sharedWith } = JSON.parse(body);

            if (!Array.isArray(sharedWith)) {
                return {
                    status: 400,
                    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
                    body: JSON.stringify({ error: 'sharedWith must be an array' })
                };
            }

            const existing = await readJSON(CONTAINER, `layouts/${id}.json`);
            if (!existing) {
                return {
                    status: 404,
                    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
                    body: JSON.stringify({ error: 'Project not found' })
                };
            }

            // Only owner or admin can manage sharing
            const owner = (existing.owner || '').toLowerCase();
            if (!isAdmin && owner !== userEmail) {
                return {
                    status: 403,
                    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
                    body: JSON.stringify({ error: 'Only the owner or admin can manage sharing' })
                };
            }

            existing.sharedWith = normalizeSharedWith(sharedWith);
            existing.updatedAt = new Date().toISOString();
            existing.updatedBy = authResult.user.email;

            await writeJSON(CONTAINER, `layouts/${id}.json`, existing);

            return {
                status: 200,
                headers: { 'Content-Type': 'application/json', ...corsHeaders() },
                body: JSON.stringify({ id, sharedWith: existing.sharedWith, message: 'Sharing updated' })
            };
        } catch (error) {
            context.error('Error updating sharing:', error);
            return {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...corsHeaders() },
                body: JSON.stringify({ error: 'Failed to update sharing', details: error.message })
            };
        }
    }
});

// --- GET /api/me - Get current user info ---

app.http('getCurrentUser', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'me',
    handler: async (request, context) => {
        const authResult = await checkAuthorization(request);

        if (!authResult.authorized) {
            return {
                status: 200,
                headers: { 'Content-Type': 'application/json', ...corsHeaders() },
                body: JSON.stringify({ authenticated: false })
            };
        }

        return {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders() },
            body: JSON.stringify({
                authenticated: true,
                authorized: true,
                email: authResult.user.email,
                name: authResult.user.name,
                role: authResult.user.role
            })
        };
    }
});
