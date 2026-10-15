import { initializeApp, getApps, getApp, FirebaseOptions } from 'firebase/app';
import { getFirestore, doc, getDocFromServer, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { getStorage, FirebaseStorage } from 'firebase/storage';

// Read Firebase Web configuration from Vite client environment variables (VITE_FIREBASE_*)
const env = import.meta.env;

const projectId = env.VITE_FIREBASE_PROJECT_ID || 'smiling-agility-vxtlg';
const apiKey = env.VITE_FIREBASE_API_KEY || 'AIzaSyA_iLOEDSoDGSRiIjFd1wGW7UutmM_ax78';
const appId = env.VITE_FIREBASE_APP_ID || '1:567344177413:web:55807dda85b5361d60176c';
const authDomain = env.VITE_FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`;
const storageBucket = env.VITE_FIREBASE_STORAGE_BUCKET || `${projectId}.firebasestorage.app`;
const messagingSenderId = env.VITE_FIREBASE_MESSAGING_SENDER_ID || '567344177413';
const measurementId = env.VITE_FIREBASE_MEASUREMENT_ID || undefined;
const firestoreDatabaseId = env.VITE_FIREBASE_DATABASE_ID || 'ai-studio-295101cd-02e9-46aa-915e-767feeb43501';

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

// Connectivity verification per Firebase integration guidelines
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error: any) {
    if (error?.message?.includes('the client is offline')) {
      console.warn('Firestore client is offline or network unreachable.');
      return false;
    }
    // If permission or document does not exist, connection to server is alive
    return true;
  }
}

testFirestoreConnection().catch(() => {});
