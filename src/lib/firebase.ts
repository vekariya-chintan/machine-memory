import { initializeApp, getApps, getApp, FirebaseApp, FirebaseOptions } from 'firebase/app';
import { getFirestore, doc, getDocFromServer, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { getStorage, FirebaseStorage } from 'firebase/storage';

export let app: FirebaseApp;
export let db: Firestore;
export let auth: Auth;
export let storage: FirebaseStorage;

let initPromise: Promise<void> | null = null;

function getFirebaseConfig(): {
  options: FirebaseOptions;
  firestoreDatabaseId: string;
} {
  const env = import.meta.env;
  const apiKey = env.VITE_FIREBASE_API_KEY || '';
  const projectId = env.VITE_FIREBASE_PROJECT_ID || '';
  const appId = env.VITE_FIREBASE_APP_ID || '';
  const authDomain = env.VITE_FIREBASE_AUTH_DOMAIN || '';
  const storageBucket = env.VITE_FIREBASE_STORAGE_BUCKET || '';
  const messagingSenderId = env.VITE_FIREBASE_MESSAGING_SENDER_ID || '';
  const measurementId = env.VITE_FIREBASE_MEASUREMENT_ID || '';
  const firestoreDatabaseId = env.VITE_FIREBASE_DATABASE_ID || '';

  if (!apiKey || !projectId) {
    throw new Error(
      'Firebase configuration is incomplete. Please ensure VITE_FIREBASE_* environment variables are set in import.meta.env.'
    );
  }

  return {
    options: {
      apiKey,
      authDomain,
      projectId,
      storageBucket,
      messagingSenderId,
      appId,
      measurementId,
    },
    firestoreDatabaseId,
  };
}

function bindFirebaseServices(firebaseApp: FirebaseApp, firestoreDatabaseId: string) {
  app = firebaseApp;
  db =
    firestoreDatabaseId && firestoreDatabaseId !== '(default)'
      ? getFirestore(firebaseApp, firestoreDatabaseId)
      : getFirestore(firebaseApp);
  auth = getAuth(firebaseApp);
  storage = getStorage(firebaseApp);
}

/**
 * Initialize Firebase directly from import.meta.env.
 * Safe to call multiple times; subsequent calls reuse the same promise/app.
 */
export async function initFirebase(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      const { options, firestoreDatabaseId } = getFirebaseConfig();
      const firebaseApp = getApps().length ? getApp() : initializeApp(options);
      bindFirebaseServices(firebaseApp, firestoreDatabaseId);
    })().catch((error) => {
      initPromise = null;
      throw error;
    });
  }

  await initPromise;
}

/** Ensure Firebase is ready before Auth/Firestore usage. */
export async function ensureFirebase(): Promise<void> {
  await initFirebase();
}

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

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
      emailVerified: auth?.currentUser?.emailVerified || null,
      isAnonymous: auth?.currentUser?.isAnonymous || null,
      tenantId: auth?.currentUser?.tenantId || null,
      providerInfo:
        auth?.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export type FirestoreErrorType = 'network_unreachable' | 'permission_denied' | 'other';

export interface ClassifiedFirestoreError {
  type: FirestoreErrorType;
  title: string;
  message: string;
  resolution: string;
  details?: string;
  timestamp: string;
}

export function classifyFirestoreError(error: unknown): ClassifiedFirestoreError {
  const msg = error instanceof Error ? error.message : String(error);
  const code = (error as any)?.code || '';
  const lowerMsg = msg.toLowerCase();

  const isPermission =
    code === 'permission-denied' ||
    lowerMsg.includes('permission') ||
    lowerMsg.includes('missing or insufficient permissions') ||
    lowerMsg.includes('insufficient permissions');

  const isNetwork =
    code === 'unavailable' ||
    code === 'deadline-exceeded' ||
    lowerMsg.includes('client is offline') ||
    lowerMsg.includes('failed to get document because the client is offline') ||
    lowerMsg.includes('could not reach cloud firestore backend') ||
    lowerMsg.includes('network unreachable') ||
    lowerMsg.includes('network error') ||
    lowerMsg.includes('network request failed') ||
    lowerMsg.includes('connection refused') ||
    lowerMsg.includes('timeout') ||
    lowerMsg.includes('fetch failed') ||
    lowerMsg.includes('failed-precondition');

  if (isPermission) {
    return {
      type: 'permission_denied',
      title: 'Permission Denied · Security Policy',
      message:
        'Access to fleet collections was rejected by authorization rules (Missing or insufficient permissions).',
      resolution:
        'Verify your account authorization or ensure your technician profile has valid permissions.',
      details: code ? `[${code}] ${msg}` : msg,
      timestamp: new Date().toLocaleTimeString(),
    };
  }

  if (isNetwork) {
    return {
      type: 'network_unreachable',
      title: 'Network Unreachable · Offline',
      message:
        'Unable to communicate with the service backend. The client is offline or the network connection was interrupted.',
      resolution:
        'Check your internet connection and click Retry below.',
      details: code ? `[${code}] ${msg}` : msg,
      timestamp: new Date().toLocaleTimeString(),
    };
  }

  return {
    type: 'other',
    title: 'Connection Error',
    message: msg || 'An unexpected error occurred while communicating with the service.',
    resolution: 'Verify your configuration and click Retry Connection below.',
    details: code ? `[${code}] ${msg}` : msg,
    timestamp: new Date().toLocaleTimeString(),
  };
}

// Connectivity verification per Firebase integration guidelines
export async function testFirestoreConnection(): Promise<{
  connected: boolean;
  errorInfo?: ClassifiedFirestoreError;
}> {
  try {
    await ensureFirebase();
    // getDocFromServer forces an actual network round-trip to the Firestore server
    await getDocFromServer(doc(db, 'test', 'connection'));
    return { connected: true };
  } catch (error: any) {
    const errorInfo = classifyFirestoreError(error);
    console.warn('Firestore connection probe failed:', errorInfo.type, errorInfo.details);
    return {
      connected: false,
      errorInfo,
    };
  }
}
