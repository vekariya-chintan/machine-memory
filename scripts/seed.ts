import 'dotenv/config';
import crypto from 'crypto';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import {
  SEED_MACHINES,
  SEED_INCIDENTS,
  SEED_KNOWLEDGE,
  SEED_TECHNICIANS,
  SEED_EVIDENCE,
} from '../src/db/seedData.js';

/**
 * Standalone Database Seeder Script
 * Explicitly populates Firestore collections with master baseline seed datasets.
 * Run manually via `npm run seed`.
 */

async function runSeeder() {
  console.log('================================================================');
  console.log(' PROMPTNOVA MACHINEMEMORY - STANDALONE DATABASE SEEDER');
  console.log('================================================================');

  const projectId = process.env.VITE_FIREBASE_PROJECT_ID;
  const apiKey = process.env.VITE_FIREBASE_API_KEY;
  const appId = process.env.VITE_FIREBASE_APP_ID;
  const authDomain = process.env.VITE_FIREBASE_AUTH_DOMAIN;
  const storageBucket = process.env.VITE_FIREBASE_STORAGE_BUCKET;
  const firestoreDatabaseId = process.env.VITE_FIREBASE_DATABASE_ID;

  if (!projectId || !apiKey) {
    console.error('❌ Error: Missing Firebase configuration in environment variables.');
    console.error('   Please check VITE_FIREBASE_PROJECT_ID and VITE_FIREBASE_API_KEY in .env file.');
    process.exit(1);
  }

  console.log(`[CONFIG] Target Firebase Project: ${projectId}`);
  console.log(`[CONFIG] Firestore Database ID:  ${firestoreDatabaseId || '(default)'}`);

  const firebaseConfig = {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    appId,
  };

  const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  const db = firestoreDatabaseId && firestoreDatabaseId !== '(default)'
    ? getFirestore(app, firestoreDatabaseId)
    : getFirestore(app);

  const defaultPassword = process.env.VITE_DEFAULT_TECHNICIAN_PASSWORD || 'Pass@123#';
  const defaultPasswordHash = crypto.createHash('sha256').update(defaultPassword).digest('hex');

  try {
    // 1. Seed Machines
    console.log(`\n[SEEDER 1/5] Populating machines collection (${SEED_MACHINES.length} records)...`);
    for (const machine of SEED_MACHINES) {
      await setDoc(doc(db, 'machines', machine.machine_id), machine, { merge: true });
      console.log(`   ✓ Asset [${machine.machine_id}] - ${machine.name}`);
    }

    // 2. Seed Incidents
    console.log(`\n[SEEDER 2/5] Populating incidents collection (${SEED_INCIDENTS.length} records)...`);
    for (const incident of SEED_INCIDENTS) {
      await setDoc(doc(db, 'incidents', incident.incident_id), incident, { merge: true });
      console.log(`   ✓ Incident [${incident.incident_id}] - ${incident.machine_id}`);
    }

    // 3. Seed Knowledge Items
    console.log(`\n[SEEDER 3/5] Populating knowledge collection (${SEED_KNOWLEDGE.length} records)...`);
    for (const item of SEED_KNOWLEDGE) {
      await setDoc(doc(db, 'knowledge', item.knowledge_id), item, { merge: true });
      console.log(`   ✓ Knowledge [${item.knowledge_id}] - ${item.title}`);
    }

    // 4. Seed Technicians
    console.log(`\n[SEEDER 4/5] Populating technicians collection (${SEED_TECHNICIANS.length} records)...`);
    for (const tech of SEED_TECHNICIANS) {
      const techPayload = {
        ...tech,
        password_hash: defaultPasswordHash,
        last_login: new Date().toISOString(),
      };
      await setDoc(doc(db, 'technicians', tech.technician_id), techPayload, { merge: true });
      console.log(`   ✓ Technician [${tech.technician_id}] - ${tech.name} (${tech.email})`);
    }

    // 5. Seed Evidence Items
    console.log(`\n[SEEDER 5/5] Populating evidence collection (${SEED_EVIDENCE.length} records)...`);
    for (const evi of SEED_EVIDENCE) {
      await setDoc(doc(db, 'evidence', evi.evidence_id), evi, { merge: true });
      console.log(`   ✓ Evidence [${evi.evidence_id}] - Incident ${evi.incident_id}`);
    }

    console.log('\n================================================================');
    console.log(' 🎉 DATABASE SEEDING COMPLETED SUCCESSFULLY!');
    console.log(' All baseline collections populated in Firestore.');
    console.log('================================================================\n');
    process.exit(0);
  } catch (err: any) {
    console.error('\n❌ Seeding failed with error:', err?.message || err);
    process.exit(1);
  }
}

runSeeder();
