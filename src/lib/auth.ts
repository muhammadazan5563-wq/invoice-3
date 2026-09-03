import {
  GoogleAuthProvider,
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { auth } from './firebase';
import { Contact, getContactByEmail } from './contacts';

/** Google accounts are administrators; everyone else is a vendor or a customer. */
export type Role = 'admin' | 'vendor' | 'customer';

export interface Session {
  user: User;
  role: Role;
  /** The Firestore contact behind a vendor/customer login. Null for admins. */
  contact: Contact | null;
  /** Google OAuth access token, used by the Sheets integration in Settings. */
  accessToken: string | null;
}

const TOKEN_STORAGE_KEY = 'invoice_google_token';

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/userinfo.email');
provider.addScope('https://www.googleapis.com/auth/userinfo.profile');
provider.setCustomParameters({ prompt: 'consent' });

let cachedAccessToken: string | null = null;

function persistToken(token: string): void {
  cachedAccessToken = token;
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // Storage can be blocked; the in-memory cache still works for this session.
  }
}

function readPersistedToken(): string | null {
  if (cachedAccessToken) return cachedAccessToken;
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function clearPersistedToken(): void {
  cachedAccessToken = null;
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Ignore storage failures on sign-out.
  }
}

export function getAccessToken(): string | null {
  return readPersistedToken();
}

export function isGoogleUser(user: User): boolean {
  return user.providerData.some((profile) => profile?.providerId === 'google.com');
}

/**
 * Turns a Firebase user into an app session.
 * Returns null when an email/password user has no matching contact record,
 * which means they must not be allowed into any panel.
 */
export async function resolveSession(user: User): Promise<Session | null> {
  if (isGoogleUser(user)) {
    return { user, role: 'admin', contact: null, accessToken: readPersistedToken() };
  }

  const contact = await getContactByEmail(user.email || '');
  if (!contact) return null;

  return { user, role: contact.type, contact, accessToken: null };
}

/** Watches the auth state and hands back a fully resolved session. */
export function initAuth(
  onSession: (session: Session) => void,
  onSignedOut: (reason?: string) => void
) {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (!user) {
      clearPersistedToken();
      onSignedOut();
      return;
    }

    try {
      const session = await resolveSession(user);
      if (session) {
        onSession(session);
        return;
      }
      await signOut(auth);
      onSignedOut(
        'This account has no contact record yet. Ask the administrator to create your contact first.'
      );
    } catch (error: any) {
      onSignedOut(error?.message || 'Failed to load your account.');
    }
  });
}

export async function googleSignIn(): Promise<Session> {
  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (credential?.accessToken) {
    persistToken(credential.accessToken);
  }

  return {
    user: result.user,
    role: 'admin',
    contact: null,
    accessToken: credential?.accessToken || readPersistedToken(),
  };
}

export async function emailSignIn(email: string, password: string): Promise<Session> {
  const result = await signInWithEmailAndPassword(auth, email.trim(), password);
  const session = await resolveSession(result.user);

  if (!session) {
    await signOut(auth);
    throw new Error(
      'No contact record found for this login. Ask the administrator to create your contact first.'
    );
  }

  return session;
}

/** Re-runs the Google popup to obtain a fresh Sheets access token. */
export async function refreshGoogleToken(): Promise<string | null> {
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) return null;
    persistToken(credential.accessToken);
    return credential.accessToken;
  } catch (error) {
    console.error('Token refresh failed:', error);
    return null;
  }
}

export async function logout(): Promise<void> {
  await signOut(auth);
  clearPersistedToken();
}
