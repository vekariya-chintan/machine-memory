import 'dotenv/config';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, getDocs, listCollections } from 'firebase/firestore';

async function listAllCollections() {
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID;
  const firestoreDatabaseId = process.env.VITE_FIREBASE_DATABASE_ID;

  if (!projectId) {
    console.error('Error: Missing Firebase configuration.');
    process.exit(1);
  }

  const firebaseConfig = {
    projectId,
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    appId: process.env.VITE_FIREBASE_APP_ID,
  };

  const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  const db = firestoreDatabaseId && firestoreDatabaseId !== '(default)'
    ? getFirestore(app, firestoreDatabaseId)
    : getFirestore(app);

  try {
    // Note: Firestore Web SDK doesn't have a direct 'listCollections' method
    // to list all collections at the root.
    // This is a known limitation of the Firestore Web SDK for admin tasks.
    console.log("This environment does not support listing all root collections via the Firebase Web SDK.");
    console.log("Please manually check the Firebase Console to identify unused collections.");
  } catch (err: any) {
    console.error('Error:', err);
  }
}

listAllCollections();
