import { collection, doc, getDoc, getDocs, updateDoc } from 'firebase/firestore';
import { db, testFirestoreConnection } from '../lib/firebase';
import { Technician } from '../types/industrial';
import { SEED_TECHNICIANS } from '../db/seedData';

const SESSION_STORAGE_KEY = 'promptnova_auth_technician';
const TOKEN_STORAGE_KEY = 'promptnova_auth_token';

/**
 * Baseline technician profiles exported from central seedData module.
 */
export const DEFAULT_TECHNICIAN_PROFILES = SEED_TECHNICIANS;

/**
 * Computes SHA-256 hash using native Web Crypto API at runtime.
 */
export async function computeSha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Checks Firestore database for registered technicians.
 * Reads directly from Firestore without auto-seeding mock data when unpopulated.
 */
export async function ensureTechniciansTablePopulated(_initialPassword?: string): Promise<Technician[]> {
  try {
    const isConnected = await testFirestoreConnection();
    if (!isConnected) {
      console.warn('Firestore database is not connected; skipping technician load.');
      return [];
    }

    const techCol = collection(db, 'technicians');
    const snap = await getDocs(techCol);

    if (!snap.empty) {
      return snap.docs
        .map((d) => {
          const data = d.data();
          return {
            technician_id: String(data.technician_id || d.id),
            name: data.name || 'Technician',
            email: String(data.email || ''),
            role: data.role || 'Maintenance Specialist',
            skills: Array.isArray(data.skills) ? data.skills : [],
            experience: Number(data.experience ?? 5),
            shift: data.shift || 'Day Shift',
            avatar_url: data.avatar_url || '',
            last_login: data.last_login || new Date().toISOString(),
          } as Technician;
        })
        .filter((t): t is Technician => Boolean(t && t.technician_id));
    }

    // Database is empty - no auto-seeding. Run `npm run seed` to populate baseline data.
    return [];
  } catch (error) {
    console.warn('Could not load technicians from Firestore database:', error);
    return [];
  }
}

/**
 * Authenticates technician directly against Firestore database.
 * No credentials or sensitive data are stored locally.
 */
export async function authenticateTechnician(
  rawEmail: string,
  rawPassword: string
): Promise<{ success: boolean; technician?: Technician; token?: string; error?: string }> {
  const normalizedEmail = (rawEmail || '').trim().toLowerCase();
  const trimmedPassword = (rawPassword || '').trim();

  if (!normalizedEmail) {
    return { success: false, error: 'Please enter your email.' };
  }

  if (!trimmedPassword) {
    return { success: false, error: 'Please enter your password.' };
  }

  try {
    // 1. Ensure Firestore database is reachable
    const connected = await testFirestoreConnection();
    if (!connected) {
      return {
        success: false,
        error: 'Central database unreachable. Active Firestore connection required to authenticate.',
      };
    }

    // 2. Query Firestore directly for the technician directory
    const techCollection = collection(db, 'technicians');
    const snap = await getDocs(techCollection);

    // 3. Find matching technician in database
    const matchingDoc = snap.docs.find((d) => {
      const data = d.data();
      return String(data.email || '').trim().toLowerCase() === normalizedEmail;
    });

    if (!matchingDoc) {
      return {
        success: false,
        error: 'No registered technician found with this email in the database.',
      };
    }

    const techData = matchingDoc.data();
    const enteredHash = await computeSha256(trimmedPassword);

    // 4. Verify password hash directly against Firestore database record
    const storedHash = techData.password_hash || techData.encrypted_password;

    if (storedHash) {
      if (storedHash !== enteredHash) {
        return {
          success: false,
          error: 'Incorrect password. Verification against database credentials failed.',
        };
      }
    } else {
      // First-time initialization in database: store credential directly into Firestore
      await updateDoc(doc(db, 'technicians', matchingDoc.id), {
        password_hash: enteredHash,
        last_login: new Date().toISOString(),
      });
    }

    // 5. Update last_login in Firestore database
    await updateDoc(doc(db, 'technicians', matchingDoc.id), {
      last_login: new Date().toISOString(),
    }).catch(() => {});

    // 6. Return sanitized technician (without password_hash) for app session
    const sanitizedTechnician: Technician = {
      technician_id: String(techData.technician_id || matchingDoc.id),
      name: techData.name || 'Technician',
      email: techData.email || normalizedEmail,
      role: techData.role || 'Maintenance Specialist',
      skills: Array.isArray(techData.skills) ? techData.skills : [],
      experience: Number(techData.experience ?? 5),
      shift: techData.shift || 'Day Shift',
      avatar_url: techData.avatar_url || '',
      last_login: new Date().toISOString(),
    };

    const token = `token_${sanitizedTechnician.technician_id}_${Date.now()}`;
    saveActiveTechnicianSession(sanitizedTechnician, token);

    return {
      success: true,
      technician: sanitizedTechnician,
      token,
    };
  } catch (error: any) {
    console.error('Firestore authentication error:', error);
    return {
      success: false,
      error: error?.message || 'Database authentication error. Please verify Firestore connection.',
    };
  }
}

/**
 * Validates stored session with Firestore database on app boot
 */
export async function verifySessionWithBackend(): Promise<Technician | null> {
  const cachedTech = getActiveTechnicianSession();
  if (!cachedTech) return null;

  try {
    const techDoc = await getDoc(doc(db, 'technicians', cachedTech.technician_id));
    if (techDoc.exists()) {
      const data = techDoc.data();
      return {
        technician_id: String(data.technician_id || techDoc.id),
        name: data.name || cachedTech.name,
        email: String(data.email || cachedTech.email),
        role: data.role || cachedTech.role,
        skills: Array.isArray(data.skills) ? data.skills : cachedTech.skills,
        experience: Number(data.experience ?? cachedTech.experience),
        shift: data.shift || cachedTech.shift,
        avatar_url: data.avatar_url || cachedTech.avatar_url || '',
        last_login: data.last_login || cachedTech.last_login,
      };
    }
  } catch {
    // If database check is momentary or offline, return cached session
    return cachedTech;
  }
  return cachedTech;
}

/**
 * Save active technician and bearer token in localStorage (sanitized, no password)
 */
export function saveActiveTechnicianSession(tech: Technician | null, token?: string | null): void {
  try {
    if (tech) {
      const safeTech: Technician = {
        technician_id: tech.technician_id,
        name: tech.name,
        email: tech.email,
        role: tech.role,
        skills: tech.skills,
        experience: tech.experience,
        shift: tech.shift,
        avatar_url: tech.avatar_url || '',
        last_login: tech.last_login || new Date().toISOString(),
      };
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(safeTech));
      if (token) {
        localStorage.setItem(TOKEN_STORAGE_KEY, token);
      }
    } else {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch (e) {
    console.warn('Unable to persist session to localStorage', e);
  }
}

/**
 * Retrieve active technician from localStorage
 */
export function getActiveTechnicianSession(): Technician | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.email && parsed.technician_id) {
        return parsed as Technician;
      }
    }
  } catch {
    // Ignore parse error
  }
  return null;
}

/**
 * Retrieve active session token from localStorage
 */
export function getActiveSessionToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Clear session and log out
 */
export function logoutTechnician(): void {
  const token = getActiveSessionToken();
  if (token) {
    fetch('/api/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }
  saveActiveTechnicianSession(null, null);
}
