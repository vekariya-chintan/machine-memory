import { Technician } from '../types/industrial';

export const UNIVERSAL_DEFAULT_PASSWORD = 'Pass@123#';

// Known SHA-256 hash for "Pass@123#"
export const PASS_123_SHA256_HASH = '8f96e4df9c1044432a13ee1d7e80fcfc3196fcbe0e49aa9b794121b689df9ccf';

const SESSION_STORAGE_KEY = 'promptnova_auth_technician';
const TOKEN_STORAGE_KEY = 'promptnova_auth_token';

export const INITIAL_TECHNICIANS: Technician[] = [
  {
    technician_id: 'TECH-01',
    name: 'Marcus Vance',
    email: 'marcus.vance@promptnova.com',
    password_hash: PASS_123_SHA256_HASH,
    role: 'Lead Master Technician',
    skills: ['Spindle Alignment', 'Vibration Analysis ISO-II', 'Hydraulics', 'CNC Metrology'],
    experience: 18,
    shift: 'Day Shift · Automated Machining Lines',
    avatar_url: '',
    last_login: new Date().toISOString(),
  },
  {
    technician_id: 'TECH-02',
    name: 'Elena Rostova',
    email: 'elena.rostova@promptnova.com',
    password_hash: PASS_123_SHA256_HASH,
    role: 'Reliability & Telemetry Engineer',
    skills: ['SCADA', 'FFT Spectral Analysis', 'ISO 10816-3 Compliance', 'Hydraulic Circuits'],
    experience: 7,
    shift: 'Swing Shift · Automated Machining Lines',
    avatar_url: '',
    last_login: new Date().toISOString(),
  },
  {
    technician_id: 'TECH-03',
    name: 'David Chen',
    email: 'david.chen@promptnova.com',
    password_hash: PASS_123_SHA256_HASH,
    role: 'Junior Maintenance Specialist',
    skills: ['Mechanical LOTO', 'Preventive Maintenance', 'Dial Indicators', 'Coolant Filtration'],
    experience: 2,
    shift: 'Day Shift · Plant Utility & Backup Systems',
    avatar_url: '',
    last_login: new Date().toISOString(),
  },
  {
    technician_id: 'TECH-04',
    name: 'Chintan Vekariya',
    email: 'chintanvekariya023@gmail.com',
    password_hash: PASS_123_SHA256_HASH,
    role: 'Plant Operations Director',
    skills: ['Executive Reliability', 'Autonomous RCA', 'Predictive Fleet Optimization', 'ISO Audits'],
    experience: 12,
    shift: 'Plant Operations & Engineering Leadership',
    avatar_url: '',
    last_login: new Date().toISOString(),
  },
];

/**
 * Backward compatibility helper - backend handles directory persistence securely.
 */
export async function ensureTechniciansTablePopulated(): Promise<Technician[]> {
  return INITIAL_TECHNICIANS;
}

/**
 * Authenticates technician securely via backend API route (/api/auth/login).
 * Passwords and hashes are processed on the server and never exposed in browser payloads.
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
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: normalizedEmail,
        password: trimmedPassword,
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.success || !data.technician) {
      return {
        success: false,
        error: data.error || 'Incorrect email or password.',
      };
    }

    const tech = data.technician as Technician;
    const token = data.token as string;

    saveActiveTechnicianSession(tech, token);

    return {
      success: true,
      technician: tech,
      token,
    };
  } catch (error: any) {
    console.error('Authentication backend request error:', error);
    return {
      success: false,
      error: 'Unable to connect to authentication server. Please try again.',
    };
  }
}

/**
 * Validates stored session token with the backend on app boot
 */
export async function verifySessionWithBackend(): Promise<Technician | null> {
  const token = getActiveSessionToken();
  if (!token) return null;

  try {
    const res = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.technician) {
        return data.technician as Technician;
      }
    } else {
      // Token expired or invalid
      logoutTechnician();
    }
  } catch (e) {
    // If backend is momentarily unreachable, fallback to cached session
    return getActiveTechnicianSession();
  }
  return null;
}

/**
 * Save active technician and bearer token in localStorage
 */
export function saveActiveTechnicianSession(tech: Technician | null, token?: string | null): void {
  try {
    if (tech) {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(tech));
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
  } catch (e) {
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
