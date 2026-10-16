import { initializeApp, getApps, getApp, FirebaseApp, FirebaseOptions } from 'firebase/app';
import { getFirestore, doc, getDocFromServer, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { getStorage, FirebaseStorage } from 'firebase/storage';

export let app: FirebaseApp;
export let db: Firestore;
export let auth: Auth;
export let storage: FirebaseStorage;

let initPromise: Promise<void> | null = null;

type RuntimeFirebaseConfig = {
  projectId?: string;
  appId?: string;
  apiKey?: string;
  authDomain?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  measurementId?: string;
  firestoreDatabaseId?: string;
};

function readViteFallbackConfig(): RuntimeFirebaseConfig {
  const env = import.meta.env;
  return {
    projectId: env.VITE_FIREBASE_PROJECT_ID || '',
    appId: env.VITE_FIREBASE_APP_ID || '',
    apiKey: env.VITE_FIREBASE_API_KEY || '',
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || '',
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || '',
    firestoreDatabaseId: env.VITE_FIREBASE_DATABASE_ID || '',
  };
}

async function fetchRuntimeFirebaseConfig(): Promise<RuntimeFirebaseConfig> {
  try {
    const res = await fetch('/api/config/firebase');
    if (!res.ok) {
      throw new Error(`Firebase config endpoint returned ${res.status}`);
    }
    return (await res.json()) as RuntimeFirebaseConfig;
  } catch (error) {
    console.warn('Failed to load /api/config/firebase; falling back to Vite env.', error);
    return readViteFallbackConfig();
  }
}

function resolveFirebaseConfig(runtime: RuntimeFirebaseConfig): {
  options: FirebaseOptions;
  firestoreDatabaseId: string;
} {
  const fallback = readViteFallbackConfig();
  const apiKey = runtime.apiKey || fallback.apiKey || '';
  const projectId = runtime.projectId || fallback.projectId || '';
  const appId = runtime.appId || fallback.appId || '';
  const authDomain = runtime.authDomain || fallback.authDomain || '';
  const storageBucket = runtime.storageBucket || fallback.storageBucket || '';
  const messagingSenderId = runtime.messagingSenderId || fallback.messagingSenderId || '';
  const measurementId = runtime.measurementId || fallback.measurementId || '';
  const firestoreDatabaseId = runtime.firestoreDatabaseId || fallback.firestoreDatabaseId || '';

  if (!apiKey || !projectId) {
    throw new Error(
      'Firebase configuration is incomplete. Set VITE_FIREBASE_* / FIREBASE_* env vars on the server (see /api/config/firebase).'
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
      const runtime = await fetchRuntimeFirebaseConfig();
      const { options, firestoreDatabaseId } = resolveFirebaseConfig(runtime);
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
