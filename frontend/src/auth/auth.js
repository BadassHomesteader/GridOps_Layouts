/**
 * Authentication Module for GridOps Layouts
 * Uses MSAL.js (Microsoft Authentication Library) for Azure AD sign-in
 * Dev mode (localhost) bypasses auth entirely
 */

let msalInstance = null;
let msalAccount = null;
let cachedIdToken = null;
let currentUser = null;
let isDevMode = false;

// MSAL Configuration — multi-tenant Azure AD
// TODO: Replace clientId with your Azure AD App Registration clientId
const msalConfig = {
    auth: {
        clientId: '6e24e899-9a39-499b-9faa-19b181c5d438',
        authority: 'https://login.microsoftonline.com/common',
        redirectUri: window.location.origin
    },
    cache: {
        cacheLocation: 'localStorage',
        storeAuthStateInCookie: false
    }
};

const loginScopes = ['openid', 'profile', 'email'];

function detectDevMode() {
    const hostname = window.location.hostname;
    return hostname === 'localhost' || hostname === '127.0.0.1';
}

function accountToUser(account) {
    return {
        name: account.name || account.username || 'User',
        email: account.username || ''
    };
}

/**
 * Initialize authentication.
 * In dev mode, bypasses MSAL entirely.
 * In production, handles redirect callback or initiates login.
 */
export async function init() {
    isDevMode = detectDevMode();

    if (isDevMode) {
        console.log('[Auth] Dev mode detected - using dev bypass');
        currentUser = { name: 'Dev User', email: 'dev@localhost' };
        return;
    }

    // Production: use MSAL.js (loaded via CDN script tag)
    if (typeof msal === 'undefined') {
        console.error('[Auth] MSAL library not loaded');
        return;
    }

    msalInstance = new msal.PublicClientApplication(msalConfig);

    try {
        // Handle redirect callback (returning from Microsoft login page)
        const response = await msalInstance.handleRedirectPromise();
        if (response) {
            msalAccount = response.account;
            cachedIdToken = response.idToken || null;
            currentUser = accountToUser(response.account);
            console.log('[Auth] Signed in via redirect:', currentUser.email);
            return;
        }

        // Check for cached session
        const accounts = msalInstance.getAllAccounts();
        if (accounts.length > 0) {
            msalAccount = accounts[0];
            currentUser = accountToUser(accounts[0]);
            console.log('[Auth] Restored cached session:', currentUser.email);
            // Acquire token eagerly so it's ready for API calls
            try {
                const silentResponse = await msalInstance.acquireTokenSilent({
                    scopes: loginScopes,
                    account: accounts[0]
                });
                cachedIdToken = silentResponse.idToken || null;
            } catch (e) {
                console.warn('[Auth] Eager token acquisition failed:', e.message);
            }
            return;
        }

        // Not authenticated — wait for user to click sign-in
        console.log('[Auth] Not authenticated — showing login screen');
    } catch (err) {
        console.error('[Auth] MSAL initialization error:', err);
    }
}

/**
 * Trigger Microsoft login redirect (called from sign-in button)
 */
export async function login() {
    if (!msalInstance) return;
    await msalInstance.loginRedirect({
        scopes: loginScopes,
        prompt: 'select_account'
    });
}

/**
 * Get ID token for API calls
 */
export async function getToken() {
    if (isDevMode) return null;
    if (!msalInstance || !currentUser) return null;

    if (cachedIdToken) return cachedIdToken;

    const account = msalAccount || (msalInstance.getAllAccounts()[0]);
    if (!account) return null;

    try {
        const response = await msalInstance.acquireTokenSilent({
            scopes: loginScopes,
            account: account
        });
        cachedIdToken = response.idToken || null;
        return cachedIdToken;
    } catch (err) {
        console.error('[Auth] Token acquisition error:', err);
        try {
            await msalInstance.acquireTokenRedirect({ scopes: loginScopes });
        } catch (redirectErr) {
            console.error('[Auth] Token redirect error:', redirectErr);
        }
        return null;
    }
}

export function getUser() {
    return currentUser;
}

export function isAuthenticated() {
    return currentUser !== null;
}

export function isDevModeActive() {
    return isDevMode;
}

export function logout() {
    if (isDevMode) {
        currentUser = null;
        return;
    }
    if (!msalInstance) return;
    msalInstance.logoutRedirect({
        postLogoutRedirectUri: window.location.origin
    });
}
