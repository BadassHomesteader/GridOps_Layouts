/**
 * API Client for GridOps Layouts
 * Handles authenticated requests to the backend API.
 * Uses X-Auth-Token header (SWA strips standard Authorization header).
 */
import { getToken, isAuthenticated } from './auth.js';

const API_BASE = '/api';

async function getAuthHeaders(additionalHeaders = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...additionalHeaders
    };

    if (isAuthenticated()) {
        const token = await getToken();
        if (token) {
            headers['X-Auth-Token'] = token;
        }
    }

    return headers;
}

export async function apiGet(path) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${path}`, { headers });
    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(error.error || `API error: ${response.status}`);
    }
    return response.json();
}

export async function apiPost(path, body) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
    });
    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(error.error || `API error: ${response.status}`);
    }
    return response.json();
}

export async function apiPut(path, body) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${path}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(body)
    });
    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(error.error || `API error: ${response.status}`);
    }
    return response.json();
}

export async function apiDelete(path) {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}${path}`, {
        method: 'DELETE',
        headers
    });
    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(error.error || `API error: ${response.status}`);
    }
    return response.json();
}
