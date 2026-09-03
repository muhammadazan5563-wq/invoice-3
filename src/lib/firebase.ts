import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import config from '../../firebase-applet-config.json';

/**
 * Single Firebase entry point for the whole app.
 * Every module must import `auth`, `db` and `storage` from here so that the
 * browser only ever holds one initialized Firebase app instance.
 */
export const firebaseConfig = config;

export const firebaseApp: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(firebaseApp);
// Long-polling avoids Firestore WebChannel requests hanging on some ISP,
// corporate, and browser network configurations.
export const db = initializeFirestore(firebaseApp, {
  experimentalForceLongPolling: true,
  useFetchStreams: false,
});
export const storage = getStorage(firebaseApp);
