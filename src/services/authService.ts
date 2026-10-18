import { collection, doc, getDoc, getDocs, updateDoc } from 'firebase/firestore';
import { db, testFirestoreConnection } from '../lib/firebase';
import { Technician } from '../types/industrial';

const SESSION_STORAGE_KEY = 'promptnova_auth_technician';
const TOKEN_STORAGE_KEY = 'promptnova_auth_token';

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
      console.warn('Firestore database is not connected; skipping user load.');
      return [];
    }

    const snap = await getDocs(collection(db, 'users'));

    if (!snap.empty) {
      return snap.docs
        .map((d) => {
          const data = d.data();
          return {
            technician_id: String(data.technician_id || d.id),
            name: data.name || 'User',
            email: String(data.email || ''),
            role: data.role || 'Maintenance Specialist',
            role_id: data.role_id ? String(data.role_id) : (data.role === 'Master Admin' ? 'ROLE_MASTER_ADMIN' : undefined),
            skills: Array.isArray(data.skills) ? data.skills : [],
            experience: Number(data.experience ?? 5),
            shift: data.shift || 'Day Shift',
            avatar_url: data.avatar_url || '',
            last_login: data.last_login || new Date().toISOString(),
          } as Technician;
        })
        .filter((t): t is Technician => Boolean(t && t.technician_id));
    }

    return [];
  } catch (error) {
    console.warn('Could not load users from Firestore database:', error);
    return [];
  }
}

/**
 * Authenticates user directly against Firestore database.
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
    const connected = await testFirestoreConnection();
    if (!connected) {
      return {
        success: false,
        error: 'Service unreachable. Please verify your connection.',
      };
    }

    const usersCollection = collection(db, 'users');
    const snap = await getDocs(usersCollection);

    const matchingDoc = snap.docs.find((d) => {
      const data = d.data();
      return String(data.email || '').trim().toLowerCase() === normalizedEmail;
    });

    if (!matchingDoc) {
      return {
        success: false,
        error: 'Invalid email or password.',
      };
    }

    const techData = matchingDoc.data();
    const enteredHash = await computeSha256(trimmedPassword);

    const storedHash = techData.password_hash || techData.encrypted_password;

    if (storedHash) {
      if (storedHash !== enteredHash) {
        return {
          success: false,
          error: 'Invalid email or password.',
        };
      }
    } else {
      await updateDoc(doc(db, 'users', matchingDoc.id), {
        password_hash: enteredHash,
        last_login: new Date().toISOString(),
      });
    }

    await updateDoc(doc(db, 'users', matchingDoc.id), {
      last_login: new Date().toISOString(),
    }).catch(() => {});

    const sanitizedTechnician: Technician = {
      technician_id: String(techData.technician_id || techData.user_id || matchingDoc.id),
      name: techData.name || 'User',
      email: techData.email || normalizedEmail,
      role: techData.role || 'Maintenance Specialist',
      role_id: techData.role_id ? String(techData.role_id) : (techData.role === 'Master Admin' ? 'ROLE_MASTER_ADMIN' : undefined),
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
      error: error?.message || 'Authentication error. Please check your connection.',
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
    const userDoc = await getDoc(doc(db, 'users', cachedTech.technician_id));

    if (userDoc.exists()) {
      const data = userDoc.data();
      return {
        technician_id: String(data.technician_id || userDoc.id),
        name: data.name || cachedTech.name,
        email: String(data.email || cachedTech.email),
        role: data.role || cachedTech.role,
        role_id: data.role_id ? String(data.role_id) : (data.role === 'Master Admin' ? 'ROLE_MASTER_ADMIN' : cachedTech.role_id),
        skills: Array.isArray(data.skills) ? data.skills : cachedTech.skills,
        experience: Number(data.experience ?? cachedTech.experience),
        shift: data.shift || cachedTech.shift,
        avatar_url: data.avatar_url || cachedTech.avatar_url || '',
        last_login: data.last_login || cachedTech.last_login,
      };
    }
  } catch {
    return cachedTech;
  }
  return cachedTech;
}

/**
 * Save active technician/user and bearer token in localStorage
 */
export function saveActiveTechnicianSession(tech: Technician | null, token?: string | null): void {
  try {
    if (tech) {
      const safeTech: Technician = {
        technician_id: tech.technician_id,
        name: tech.name,
        email: tech.email,
        role: tech.role,
        role_id: tech.role_id,
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
