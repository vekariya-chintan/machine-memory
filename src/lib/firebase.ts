import { initializeApp, getApps, getApp, FirebaseOptions } from 'firebase/app';
import { getFirestore, doc, getDocFromServer, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { getStorage, FirebaseStorage } from 'firebase/storage';

// Read Firebase Web configuration from Vite client environment variables (VITE_FIREBASE_*)
const env = import.meta.env;

const projectId = env.VITE_FIREBASE_PROJECT_ID || '';
const apiKey = env.VITE_FIREBASE_API_KEY || '';
const appId = env.VITE_FIREBASE_APP_ID || '';
const authDomain = env.VITE_FIREBASE_AUTH_DOMAIN || '';
const storageBucket = env.VITE_FIREBASE_STORAGE_BUCKET || '';
const messagingSenderId = env.VITE_FIREBASE_MESSAGING_SENDER_ID || '';
const measurementId = env.VITE_FIREBASE_MEASUREMENT_ID || '';
const firestoreDatabaseId = env.VITE_FIREBASE_DATABASE_ID || '';

const firebaseConfig: FirebaseOptions = {
  apiKey,
  authDomain,
  projectId,
  storageBucket,
  messagingSenderId,
  appId,
  measurementId,
};

// Initialize Firebase App instance
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore with specific Database ID
export const db: Firestore =
  firestoreDatabaseId && firestoreDatabaseId !== '(default)'
    ? getFirestore(app, firestoreDatabaseId)
    : getFirestore(app);

// Initialize Firebase Auth
export const auth: Auth = getAuth(app);

// Initialize Firebase Storage
export const storage: FirebaseStorage = getStorage(app);

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
      providerInfo: auth?.currentUser?.providerData?.map((provider) => ({
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
      title: 'Permission Denied · Firestore Security Rules',
      message:
        'Access to Firestore fleet collections was rejected by database security rules (Missing or insufficient permissions).',
      resolution:
        'Verify your Firestore security rules (firestore.rules) or ensure your technician account has valid authorization.',
      details: code ? `[${code}] ${msg}` : msg,
      timestamp: new Date().toLocaleTimeString(),
    };
  }

  if (isNetwork) {
    return {
      type: 'network_unreachable',
      title: 'Network Unreachable · Firestore Offline',
      message:
        'Unable to communicate with the Google Cloud Firestore backend. The client is offline or the network connection was interrupted.',
      resolution:
        'Check your internet connection, verify that the Firestore service is reachable, and click Retry below.',
      details: code ? `[${code}] ${msg}` : msg,
      timestamp: new Date().toLocaleTimeString(),
    };
  }

  return {
    type: 'other',
    title: 'Firestore Database Connection Error',
    message: msg || 'An unexpected error occurred while communicating with the Firestore database.',
    resolution:
      'Verify your Firebase project configuration and click Retry Connection below.',
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

testFirestoreConnection().catch(() => {});
