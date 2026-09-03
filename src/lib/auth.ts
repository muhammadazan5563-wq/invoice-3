import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signOut } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Request Google Sheets scope and user info scopes
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/userinfo.email');
provider.addScope('https://www.googleapis.com/auth/userinfo.profile');
// Force account selection and consent to always get a fresh OAuth token
provider.setCustomParameters({ prompt: 'consent' });

let isSigningIn = false;
let cachedAccessToken: string | null = null;

const TOKEN_STORAGE_KEY = 'invoice_firebase_token';
const USER_STORAGE_KEY = 'invoice_firebase_user';

// Store token in localStorage for persistence
function persistToken(token: string) {
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch (e) {
    console.warn('Failed to persist token:', e);
  }
}

// Get persisted token from localStorage
function getPersistedToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch (e) {
    return null;
  }
}

// Clear persisted token
function clearPersistedToken() {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
  } catch (e) {
    console.warn('Failed to clear persisted token:', e);
  }
}

// Validate if a token works with Google Sheets API
async function validateGoogleToken(token: string): Promise<boolean> {
  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=' + encodeURIComponent(token));
    if (response.ok) {
      const data = await response.json();
      // Check if the token has the spreadsheets scope
      const scopes = data.scope || '';
      return scopes.includes('spreadsheets');
    }
    return false;
  } catch {
    return false;
  }
}

// Initialize auth state listener. Call this on app load.
export const initAuth = (
  onAuthSuccess: (user: User, token: string) => void,
  onAuthFailure: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      // First check if we have a cached token from the current session
      if (cachedAccessToken) {
        // Validate the cached token is still a valid Google OAuth token
        const isValid = await validateGoogleToken(cachedAccessToken);
        if (isValid) {
          onAuthSuccess(user, cachedAccessToken);
          return;
        }
        // Token is invalid/expired, clear it
        cachedAccessToken = null;
        clearPersistedToken();
      }

      // Try to get persisted token from localStorage
      const persistedToken = getPersistedToken();
      if (persistedToken) {
        const isValid = await validateGoogleToken(persistedToken);
        if (isValid) {
          cachedAccessToken = persistedToken;
          onAuthSuccess(user, persistedToken);
          return;
        }
        // Token is expired, clear it
        clearPersistedToken();
      }

      // No valid OAuth token available - user needs to re-authenticate
      // We'll pass a special marker so the app knows to prompt re-auth
      onAuthFailure();
    } else {
      cachedAccessToken = null;
      clearPersistedToken();
      onAuthFailure();
    }
  });
};

// Must be called from a button click or user interaction
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }

    cachedAccessToken = credential.accessToken;
    persistToken(credential.accessToken);
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

// Re-authenticate to get a fresh Google OAuth2 access token
// This is needed when the stored token has expired
export const refreshGoogleToken = async (): Promise<string | null> => {
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token');
    }
    cachedAccessToken = credential.accessToken;
    persistToken(credential.accessToken);
    return credential.accessToken;
  } catch (error: any) {
    console.error('Token refresh error:', error);
    return null;
  }
};

export const getAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const logout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
  clearPersistedToken();
};
