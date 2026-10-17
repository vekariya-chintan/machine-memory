import 'dotenv/config';
import crypto from 'crypto';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, setDoc, collection, getDocs, deleteDoc } from 'firebase/firestore';
import {
  SEED_MASTER_ROLES,
  SEED_MASTER_SHIFTS,
  SEED_MASTER_SKILLS,
  SEED_MASTER_SUBSYSTEMS,
  SEED_MASTER_ISO_GROUPS,
  SEED_MASTER_FOUNDATION_TYPES,
  SEED_MASTER_KNOWLEDGE_TYPES,
  SEED_MACHINES,
  SEED_INCIDENTS,
  SEED_KNOWLEDGE,
  SEED_USERS,
  SEED_TECHNICIANS,
  SEED_EVIDENCE,
} from '../src/db/seedData.js';

/**
 * Standalone Database Seeder Script
 * Clears existing collections in Firestore and explicitly populates
 * master collections, users, baseline datasets, and indexes.
 * Run manually via `npm run seed`.
 */

async function clearCollection(db: any, collectionName: string) {
  try {
    const colRef = collection(db, collectionName);
    const snapshot = await getDocs(colRef);
    if (!snapshot.empty) {
      console.log(` Clearing ${snapshot.docs.length} documents from [${collectionName}]...`);
      for (const d of snapshot.docs) {
        await deleteDoc(doc(db, collectionName, d.id));
      }
    }
  } catch (err: any) {
    console.warn(`   Note clearing collection [${collectionName}]:`, err?.message || err);
  }
}

// Index definitions for required Firestore collections & fields
const REQUIRED_INDEXES = [
  {
    index_id: 'IDX_USERS_MAIN',
    collectionGroup: 'users',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'technician_id', order: 'ASCENDING' },
      { fieldPath: 'email', order: 'ASCENDING' },
      { fieldPath: 'role', order: 'ASCENDING' },
      { fieldPath: 'shift', order: 'ASCENDING' },
    ],
  },
  {
    index_id: 'IDX_MACHINES_MAIN',
    collectionGroup: 'machines',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'machine_id', order: 'ASCENDING' },
      { fieldPath: 'status', order: 'ASCENDING' },
      { fieldPath: 'subsystem_type', order: 'ASCENDING' },
    ],
  },
  {
    index_id: 'IDX_INCIDENTS_MAIN',
    collectionGroup: 'incidents',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'incident_id', order: 'ASCENDING' },
      { fieldPath: 'machine_id', order: 'ASCENDING' },
      { fieldPath: 'created_at', order: 'DESCENDING' },
      { fieldPath: 'severity', order: 'ASCENDING' },
    ],
  },
  {
    index_id: 'IDX_KNOWLEDGE_MAIN',
    collectionGroup: 'knowledge',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'knowledge_id', order: 'ASCENDING' },
      { fieldPath: 'machine_id', order: 'ASCENDING' },
      { fieldPath: 'type', order: 'ASCENDING' },
      { fieldPath: 'created_at', order: 'DESCENDING' },
    ],
  },
  {
    index_id: 'IDX_EVIDENCE_MAIN',
    collectionGroup: 'evidence',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'evidence_id', order: 'ASCENDING' },
      { fieldPath: 'incident_id', order: 'ASCENDING' },
      { fieldPath: 'type', order: 'ASCENDING' },
    ],
  },
  {
    index_id: 'IDX_MASTER_ROLES',
    collectionGroup: 'master_roles',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'id', order: 'ASCENDING' },
      { fieldPath: 'name', order: 'ASCENDING' },
    ],
  },
  {
    index_id: 'IDX_MASTER_SHIFTS',
    collectionGroup: 'master_shifts',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'id', order: 'ASCENDING' },
      { fieldPath: 'name', order: 'ASCENDING' },
    ],
  },
  {
    index_id: 'IDX_MASTER_SKILLS',
    collectionGroup: 'master_skills',
    queryScope: 'COLLECTION',
    fields: [
      { fieldPath: 'id', order: 'ASCENDING' },
      { fieldPath: 'name', order: 'ASCENDING' },
    ],
  },
];

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
    const allCollections = [
      'master_roles',
      'master_shifts',
      'master_skills',
      'master_subsystems',
      'master_iso_groups',
      'master_foundation_types',
      'master_knowledge_types',
      'machines',
      'incidents',
      'knowledge',
      'users',
      'technicians',
      'evidence',
      '_indexes',
    ];

    console.log('\n[STEP 1] Clearing existing data from all Firebase Firestore collections...');
    for (const col of allCollections) {
      await clearCollection(db, col);
    }

    // 1. Seed Master Collections
    console.log('\n[STEP 2] Populating Firebase Master Tables...');

    // Roles
    console.log(`   Seeding master_roles (${SEED_MASTER_ROLES.length} records)...`);
    for (const role of SEED_MASTER_ROLES) {
      await setDoc(doc(db, 'master_roles', role.id), { ...role, is_custom: false, created_at: new Date().toISOString() });
    }

    // Shifts
    console.log(`   Seeding master_shifts (${SEED_MASTER_SHIFTS.length} records)...`);
    for (const shift of SEED_MASTER_SHIFTS) {
      await setDoc(doc(db, 'master_shifts', shift.id), { ...shift, is_custom: false, created_at: new Date().toISOString() });
    }

    // Skills
    console.log(`   Seeding master_skills (${SEED_MASTER_SKILLS.length} records)...`);
    for (const skill of SEED_MASTER_SKILLS) {
      await setDoc(doc(db, 'master_skills', skill.id), { ...skill, is_custom: false, created_at: new Date().toISOString() });
    }

    // Subsystems
    console.log(`   Seeding master_subsystems (${SEED_MASTER_SUBSYSTEMS.length} records)...`);
    for (const sub of SEED_MASTER_SUBSYSTEMS) {
      await setDoc(doc(db, 'master_subsystems', sub.id), { ...sub, is_custom: false, created_at: new Date().toISOString() });
    }

    // ISO Groups
    console.log(`   Seeding master_iso_groups (${SEED_MASTER_ISO_GROUPS.length} records)...`);
    for (const iso of SEED_MASTER_ISO_GROUPS) {
      await setDoc(doc(db, 'master_iso_groups', iso.id), { ...iso, is_custom: false, created_at: new Date().toISOString() });
    }

    // Foundation Types
    console.log(`   Seeding master_foundation_types (${SEED_MASTER_FOUNDATION_TYPES.length} records)...`);
    for (const fnd of SEED_MASTER_FOUNDATION_TYPES) {
      await setDoc(doc(db, 'master_foundation_types', fnd.id), { ...fnd, is_custom: false, created_at: new Date().toISOString() });
    }

    // Knowledge Types
    console.log(`   Seeding master_knowledge_types (${SEED_MASTER_KNOWLEDGE_TYPES.length} records)...`);
    for (const kt of SEED_MASTER_KNOWLEDGE_TYPES) {
      await setDoc(doc(db, 'master_knowledge_types', kt.id), { ...kt, is_custom: false, created_at: new Date().toISOString() });
    }

    // 2. Seed Main Entities
    console.log('\n[STEP 3] Populating Main Dataset Tables...');

    // Seed Machines
    console.log(`   Seeding machines (${SEED_MACHINES.length} records)...`);
    for (const machine of SEED_MACHINES) {
      await setDoc(doc(db, 'machines', machine.machine_id), machine);
      console.log(`     ✓ Asset [${machine.machine_id}] - ${machine.name}`);
    }

    // Seed Incidents
    console.log(`   Seeding incidents (${SEED_INCIDENTS.length} records)...`);
    for (const incident of SEED_INCIDENTS) {
      await setDoc(doc(db, 'incidents', incident.incident_id), incident);
      console.log(`     ✓ Incident [${incident.incident_id}] - ${incident.machine_id}`);
    }

    // Seed Knowledge Items
    console.log(`   Seeding knowledge (${SEED_KNOWLEDGE.length} records)...`);
    for (const item of SEED_KNOWLEDGE) {
      await setDoc(doc(db, 'knowledge', item.knowledge_id), item);
      console.log(`     ✓ Knowledge [${item.knowledge_id}] - ${item.title}`);
    }

    // Seed Users
    console.log(`   Seeding users (${SEED_USERS.length} records)...`);
    for (const user of SEED_USERS) {
      const userPayload = {
        ...user,
        password_hash: defaultPasswordHash,
        last_login: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
      await setDoc(doc(db, 'users', user.technician_id), userPayload);
      await setDoc(doc(db, 'technicians', user.technician_id), userPayload);
      console.log(`     ✓ User [${user.technician_id}] - ${user.name} (${user.email}) - ${user.role}`);
    }

    // Seed Evidence Items
    console.log(`   Seeding evidence (${SEED_EVIDENCE.length} records)...`);
    for (const evi of SEED_EVIDENCE) {
      await setDoc(doc(db, 'evidence', evi.evidence_id), evi);
      console.log(`     ✓ Evidence [${evi.evidence_id}] - Incident ${evi.incident_id}`);
    }

    // 3. Seed Indexes Table
    console.log('\n[STEP 4] Registering Firebase Table Indexes...');
    for (const idx of REQUIRED_INDEXES) {
      await setDoc(doc(db, '_indexes', idx.index_id), idx);
      console.log(`     ✓ Index registered: [${idx.index_id}] for collection group [${idx.collectionGroup}]`);
    }

    console.log('\n================================================================');
    console.log(' 🎉 DATABASE SEEDING & INDEXES REGISTRATION COMPLETED SUCCESSFULLY!');
    console.log(' All collections cleared and re-populated with master data, users & indexes.');
    console.log('================================================================\n');
    process.exit(0);
  } catch (err: any) {
    console.error('\n❌ Seeding failed with error:', err?.message || err);
    process.exit(1);
  }
}

runSeeder();
