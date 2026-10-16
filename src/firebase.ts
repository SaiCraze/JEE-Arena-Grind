import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  type User
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

export const appId = 'f185877a-3655-484c-85a9-d315ecdb03cd';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): void {
  const errMessage = error instanceof Error ? error.message : String(error);
  const errCode = (error as { code?: string })?.code;

  const isUnavailable =
    errCode === 'unavailable' ||
    errMessage.includes('unavailable') ||
    errMessage.includes('Could not reach Cloud Firestore') ||
    errMessage.includes('offline');

  const errInfo: FirestoreErrorInfo = {
    error: errMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };

  if (isUnavailable) {
    console.warn('Firestore offline / transient connection notice:', errMessage);
    return;
  }

  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test initial connection as required by Firebase integration skill
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'arenaState'));
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : String(error);
    const errCode = (error as { code?: string })?.code;
    if (errCode === 'unavailable' || errMessage.includes('offline') || errMessage.includes('unavailable')) {
      console.warn('Firebase connection test: client is currently offline or connecting.');
    }
  }
}
testConnection();

export async function initFirebaseAuth(onUser?: (u: User | null) => void) {
  // Listen for auth state
  onAuthStateChanged(auth, (user) => {
    if (onUser) onUser(user);
  });

  // Try anonymous authentication or custom token if available
  try {
    const globalWindow = window as unknown as { __initial_auth_token?: string };
    if (globalWindow.__initial_auth_token) {
      return await signInWithCustomToken(auth, globalWindow.__initial_auth_token);
    }
    if (!auth.currentUser) {
      return await signInAnonymously(auth);
    }
  } catch (err: unknown) {
    console.warn('Anonymous auth note (can use without or with Google Sign In):', err);
  }
}

export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  return await signInWithPopup(auth, provider);
}
