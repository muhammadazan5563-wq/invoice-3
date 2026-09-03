import { getApps, initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDocs,
  setDoc,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, firebaseConfig, storage } from './firebase';

export type ContactType = 'vendor' | 'customer';

/** A vendor or customer record stored in Firestore, keyed by their auth uid. */
export interface Contact {
  id: string;
  type: ContactType;
  fullName: string;
  phone: string;
  email: string;
  companyName: string;
  location: string;
  address: string;
  area: string;
  cnicFrontUrl: string;
  cnicBackUrl: string;
  chequeUrl: string;
  tempPassword: string;
  createdAt: string;
}

/** Form values captured on the Contacts page. */
export interface ContactDraft {
  type: ContactType;
  fullName: string;
  phone: string;
  email: string;
  password?: string;
  companyName?: string;
  location?: string;
  address?: string;
  area?: string;
}

/** Documents uploaded for a customer contact. */
export interface ContactFiles {
  cnicFront?: File | null;
  cnicBack?: File | null;
  cheque?: File | null;
}

export interface CreateContactResult {
  contact: Contact;
  /** Plain password so the admin can hand it to the vendor or customer. */
  password: string;
}

const CONTACTS_COLLECTION = 'contacts';
const PROVISIONER_APP_NAME = 'contact-provisioner';
const FIREBASE_OPERATION_TIMEOUT_MS = 20000;

function withFirebaseTimeout<T>(operation: Promise<T>, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(new Error(`${message} timed out. Check your Firebase connection and try again.`)),
      FIREBASE_OPERATION_TIMEOUT_MS
    );
    operation.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function normalizeEmail(email: string): string {
  return (email || '').trim().toLowerCase();
}

/** Readable, unambiguous password used when the admin does not supply one. */
export function generatePassword(length = 10): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let password = '';
  bytes.forEach((byte) => {
    password += alphabet[byte % alphabet.length];
  });
  return password;
}

function toContact(id: string, data: Record<string, any>): Contact {
  return {
    id,
    type: data.type === 'vendor' ? 'vendor' : 'customer',
    fullName: data.fullName || '',
    phone: data.phone || '',
    email: data.email || '',
    companyName: data.companyName || '',
    location: data.location || '',
    address: data.address || '',
    area: data.area || '',
    cnicFrontUrl: data.cnicFrontUrl || '',
    cnicBackUrl: data.cnicBackUrl || '',
    chequeUrl: data.chequeUrl || '',
    tempPassword: data.tempPassword || '',
    createdAt: data.createdAt || '',
  };
}

/** Every contact, newest first. Sorted client-side so no composite index is needed. */
export async function getContacts(): Promise<Contact[]> {
  const snapshot = await withFirebaseTimeout(
    getDocs(collection(db, CONTACTS_COLLECTION)),
    'Loading contacts'
  );
  return snapshot.docs
    .map((entry) => toContact(entry.id, entry.data()))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Resolve the contact record behind an email/password login. */
export async function getContactByEmail(email: string): Promise<Contact | null> {
  const target = normalizeEmail(email);
  if (!target) return null;

  // Read the collection and normalize locally so records created before email
  // normalization was introduced are still found during login and duplicate checks.
  const contacts = await getContacts();
  return contacts.find((contact) => normalizeEmail(contact.email) === target) || null;
}

async function uploadContactFile(uid: string, slot: string, file: File): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  const objectRef = ref(storage, `contacts/${uid}/${slot}-${Date.now()}-${safeName}`);
  await uploadBytes(objectRef, file);
  return getDownloadURL(objectRef);
}

/**
 * Creates the Firebase Auth account on a secondary app instance.
 * `createUserWithEmailAndPassword` signs the new user into whichever auth
 * instance it is given, so using a side instance keeps the admin's own
 * session on the primary instance untouched.
 */
async function provisionLogin(email: string, password: string): Promise<string> {
  const existingApp = getApps().find((app) => app.name === PROVISIONER_APP_NAME);
  const provisionerApp = existingApp || initializeApp(firebaseConfig, PROVISIONER_APP_NAME);
  const provisionerAuth = getAuth(provisionerApp);

  let credential;
  try {
    credential = await withFirebaseTimeout(
      createUserWithEmailAndPassword(provisionerAuth, email, password),
      'Creating the login account'
    );
  } catch (error: any) {
    // A previous attempt may have created Auth before timing out while writing
    // Firestore. Reuse that account when the supplied password matches it.
    if (error?.code !== 'auth/email-already-in-use') throw error;
    credential = await withFirebaseTimeout(
      signInWithEmailAndPassword(provisionerAuth, email, password),
      'Recovering the existing login account'
    );
  }
  const uid = credential.user.uid;
  // Signing out the isolated provisioner is cleanup only. Do not block the
  // admin flow on Firebase persistence/network cleanup after the account exists.
  void signOut(provisionerAuth).catch((error) => {
    console.warn('Could not clear the temporary Firebase auth session:', error);
  });
  return uid;
}

function friendlyAuthError(error: any): Error {
  const code = error?.code || '';
  if (code === 'auth/email-already-in-use') {
    return new Error('That email already has a login account. Use a different email address.');
  }
  if (code === 'auth/invalid-email') {
    return new Error('That email address is not valid.');
  }
  if (code === 'auth/weak-password') {
    return new Error('The password must be at least 6 characters long.');
  }
  if (code === 'auth/operation-not-allowed') {
    return new Error(
      'Email/password sign-in is disabled in this Firebase project. Enable it under Authentication → Sign-in method.'
    );
  }
  return new Error(error?.message || 'Failed to create the login account.');
}

/**
 * Saves the contact record and provisions its login account in one step.
 * Order matters: the auth account is created first so its uid becomes both the
 * Firestore document id and the Storage folder for that person's documents.
 */
export async function createContact(
  draft: ContactDraft,
  files: ContactFiles = {}
): Promise<CreateContactResult> {
  const email = normalizeEmail(draft.email);
  const fullName = (draft.fullName || '').trim();

  if (!fullName) throw new Error('Full name is required.');
  if (!email) throw new Error('An email address is required to create the login account.');

  const duplicate = await getContactByEmail(email);
  if (duplicate) {
    throw new Error(`A contact already exists for ${email}.`);
  }

  const password =
    draft.password && draft.password.trim().length >= 6 ? draft.password.trim() : generatePassword();

  let uid: string;
  try {
    uid = await provisionLogin(email, password);
  } catch (error: any) {
    throw friendlyAuthError(error);
  }

  const [cnicFrontUrl, cnicBackUrl, chequeUrl] = await Promise.all([
    files.cnicFront ? uploadContactFile(uid, 'cnic-front', files.cnicFront) : Promise.resolve(''),
    files.cnicBack ? uploadContactFile(uid, 'cnic-back', files.cnicBack) : Promise.resolve(''),
    files.cheque ? uploadContactFile(uid, 'cheque', files.cheque) : Promise.resolve(''),
  ]);

  const record = {
    type: draft.type,
    fullName,
    phone: (draft.phone || '').trim(),
    email,
    companyName: (draft.companyName || '').trim(),
    location: (draft.location || '').trim(),
    address: (draft.address || '').trim(),
    area: (draft.area || '').trim(),
    cnicFrontUrl,
    cnicBackUrl,
    chequeUrl,
    tempPassword: password,
    createdAt: new Date().toISOString(),
  };

  await withFirebaseTimeout(
    setDoc(doc(db, CONTACTS_COLLECTION, uid), record),
    'Saving the contact record'
  );

  return { contact: { id: uid, ...record }, password };
}
