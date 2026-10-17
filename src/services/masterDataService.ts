import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
} from 'firebase/firestore';
import { db, ensureFirebase } from '../lib/firebase';

export interface MasterOption {
  id: string;
  name: string;
  code?: string;
  description?: string;
  is_custom?: boolean;
  created_at?: string;
}

export type MasterCategory =
  | 'roles'
  | 'shifts'
  | 'skills'
  | 'subsystems'
  | 'iso_groups'
  | 'foundation_types'
  | 'knowledge_types';

const COLLECTION_MAP: Record<MasterCategory, string> = {
  roles: 'master_roles',
  shifts: 'master_shifts',
  skills: 'master_skills',
  subsystems: 'master_subsystems',
  iso_groups: 'master_iso_groups',
  foundation_types: 'master_foundation_types',
  knowledge_types: 'master_knowledge_types',
};

// In-memory cache for fast UI rendering after initial Firestore sync
const masterCache: Record<string, MasterOption[]> = {};

/**
 * Normalizes text to create a clean string ID.
 */
function slugifyId(category: MasterCategory, name: string): string {
  const clean = name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  const prefix = category.substring(0, 3).toUpperCase();
  return `${prefix}_${clean.substring(0, 40)}`;
}

/**
 * Fetch master options directly from Firebase Firestore.
 */
export async function fetchMasterOptions(category: MasterCategory): Promise<MasterOption[]> {
  try {
    await ensureFirebase();
    const collectionName = COLLECTION_MAP[category];
    const colRef = collection(db, collectionName);
    const snapshot = await getDocs(colRef);

    const items: MasterOption[] = snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: String(data.name || d.id),
        code: data.code ? String(data.code) : undefined,
        description: data.description ? String(data.description) : undefined,
        is_custom: Boolean(data.is_custom),
        created_at: data.created_at ? String(data.created_at) : undefined,
      };
    });

    masterCache[category] = items;
    return items;
  } catch (error) {
    console.warn(`Failed to fetch master ${category} from Firestore:`, error);
    return masterCache[category] || [];
  }
}

/**
 * Get current cached master options (synchronous) or empty array.
 */
export function getCachedMasterOptions(category: MasterCategory): MasterOption[] {
  return masterCache[category] || [];
}

/**
 * Check if option exists in Firebase master table.
 * If user entered custom value, insert it into Firebase master collection
 * and return the created/found master option containing its foreign key ID.
 */
export async function addOrGetMasterOption(
  category: MasterCategory,
  inputValue: string,
  extraProps: Partial<MasterOption> = {}
): Promise<MasterOption> {
  const trimmed = inputValue.trim();
  if (!trimmed) {
    throw new Error('Master option value cannot be empty.');
  }

  // 1. Fetch current options from Firebase
  const currentOptions = await fetchMasterOptions(category);

  // 2. Check if already exists (case-insensitive name match or code match)
  const existing = currentOptions.find(
    (opt) =>
      opt.name.toLowerCase() === trimmed.toLowerCase() ||
      (opt.code && opt.code.toLowerCase() === trimmed.toLowerCase()) ||
      opt.id.toLowerCase() === trimmed.toLowerCase()
  );

  if (existing) {
    return existing;
  }

  // 3. Create new master option in Firebase Firestore
  const generatedId = slugifyId(category, trimmed);
  const collectionName = COLLECTION_MAP[category];

  const newOption: MasterOption = {
    id: generatedId,
    name: trimmed,
    code: extraProps.code || trimmed.toLowerCase().replace(/\s+/g, '_'),
    description: extraProps.description || `Custom ${category} added by user`,
    is_custom: true,
    created_at: new Date().toISOString(),
    ...extraProps,
  };

  try {
    await ensureFirebase();
    const docRef = doc(db, collectionName, generatedId);
    await setDoc(docRef, newOption);

    // Update in-memory cache
    if (!masterCache[category]) masterCache[category] = [];
    masterCache[category].push(newOption);

    console.log(`Saved custom ${category} master record to Firestore:`, generatedId, trimmed);
    return newOption;
  } catch (error) {
    console.error(`Failed to save custom master option to Firebase:`, error);
    if (!masterCache[category]) masterCache[category] = [];
    masterCache[category].push(newOption);
    return newOption;
  }
}

/**
 * Pre-initialize all master collections from Firebase.
 */
export async function initializeMasterTables(): Promise<void> {
  const categories: MasterCategory[] = [
    'roles',
    'shifts',
    'skills',
    'subsystems',
    'iso_groups',
    'foundation_types',
    'knowledge_types',
  ];

  await Promise.all(
    categories.map((cat) => fetchMasterOptions(cat).catch(() => []))
  );
}
