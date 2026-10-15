import { collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, testFirestoreConnection } from '../lib/firebase';
import { Technician } from '../types/industrial';
import { computeSha256 } from './authService';
import { cleanFirestoreData } from './machineMemoryService';

/**
 * Returns the configured default technician password from environment variables.
 */
export function getDefaultTechnicianPassword(): string {
  const envPassword = (import.meta.env.VITE_DEFAULT_TECHNICIAN_PASSWORD as string) || '';
  return envPassword.trim();
}

/**
 * Malicious input detection patterns (XSS, script injection, URI schemes, prototype pollution, control chars).
 */
const DANGEROUS_HTML_REGEX = /<[^>]*>|<!--.*?-->/gi;
const DANGEROUS_PROTOCOLS_REGEX = /(?:javascript|vbscript|data|file)\s*:/gi;
const DANGEROUS_EVENT_HANDLERS_REGEX = /\bon\w+\s*=/gi;
const CONTROL_CHARS_REGEX = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;
const PROTOTYPE_POLLUTION_REGEX = /\b(?:__proto__|constructor|prototype)\b/gi;

/**
 * Deeply sanitizes a string by stripping malicious tags, scripts, control characters,
 * and dangerous protocols to protect against injection and XSS.
 */
export function sanitizeString(input: string | null | undefined): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(CONTROL_CHARS_REGEX, '')
    .replace(DANGEROUS_HTML_REGEX, '')
    .replace(DANGEROUS_PROTOCOLS_REGEX, '')
    .replace(DANGEROUS_EVENT_HANDLERS_REGEX, '')
    .replace(PROTOTYPE_POLLUTION_REGEX, '')
    .trim();
}

/**
 * Checks if a string contains prohibited injection patterns.
 */
export function containsMaliciousPayload(input: string): boolean {
  if (!input) return false;
  return (
    DANGEROUS_HTML_REGEX.test(input) ||
    DANGEROUS_PROTOCOLS_REGEX.test(input) ||
    DANGEROUS_EVENT_HANDLERS_REGEX.test(input) ||
    CONTROL_CHARS_REGEX.test(input) ||
    PROTOTYPE_POLLUTION_REGEX.test(input)
  );
}

export interface TechnicianValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  sanitized: {
    technician_id: string;
    name: string;
    email: string;
    role: string;
    shift: string;
    experience: number;
    skills: string[];
    password?: string;
  };
}

/**
 * Validates technician form input with strict industrial security rules.
 */
export function validateTechnicianForm(
  data: {
    technician_id: string;
    name: string;
    email: string;
    role: string;
    shift: string;
    experience: number | string;
    skills: string[];
    password?: string;
  },
  isEditMode: boolean,
  existingTechnicians: Technician[] = []
): TechnicianValidationResult {
  const errors: Record<string, string> = {};

  // 1. Validate technician_id
  const rawId = (data.technician_id || '').trim();
  const sanitizedId = sanitizeString(rawId).toUpperCase();

  if (!sanitizedId) {
    errors.technician_id = 'Technician ID is required.';
  } else if (!/^[A-Z0-9-_]{3,20}$/.test(sanitizedId)) {
    errors.technician_id =
      'ID must be 3-20 characters: uppercase letters, numbers, hyphens, and underscores only (e.g., TECH-05).';
  } else if (!isEditMode) {
    const isDuplicate = existingTechnicians.some(
      (t) => t.technician_id.toUpperCase() === sanitizedId
    );
    if (isDuplicate) {
      errors.technician_id = `Technician ID "${sanitizedId}" already exists in the database.`;
    }
  }

  // 2. Validate Name
  const rawName = (data.name || '').trim();
  if (containsMaliciousPayload(rawName)) {
    errors.name = 'Prohibited characters detected (HTML/script injection not allowed).';
  }
  const sanitizedName = sanitizeString(rawName);
  if (!sanitizedName) {
    errors.name = 'Technician name is required.';
  } else if (sanitizedName.length < 2 || sanitizedName.length > 70) {
    errors.name = 'Name must be between 2 and 70 characters.';
  } else if (!/^[a-zA-ZÀ-ÿ0-9\s.'’\-]+$/.test(sanitizedName)) {
    errors.name = 'Name contains invalid characters. Only letters, spaces, hyphens, and dots allowed.';
  }

  // 3. Validate Email
  const rawEmail = (data.email || '').trim().toLowerCase();
  if (containsMaliciousPayload(rawEmail)) {
    errors.email = 'Prohibited characters detected in email.';
  }
  const sanitizedEmail = sanitizeString(rawEmail).toLowerCase();
  const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!sanitizedEmail) {
    errors.email = 'Corporate / Plant email is required.';
  } else if (sanitizedEmail.length > 100) {
    errors.email = 'Email address cannot exceed 100 characters.';
  } else if (!EMAIL_REGEX.test(sanitizedEmail)) {
    errors.email = 'Please enter a valid email address (e.g. name@promptnova.com).';
  } else {
    // Check for email collision with other technicians
    const emailConflict = existingTechnicians.some(
      (t) =>
        t.email.toLowerCase() === sanitizedEmail &&
        (!isEditMode || t.technician_id.toUpperCase() !== sanitizedId)
    );
    if (emailConflict) {
      errors.email = 'This email is already registered to another technician in the database.';
    }
  }

  // 4. Validate Role
  const rawRole = (data.role || '').trim();
  if (containsMaliciousPayload(rawRole)) {
    errors.role = 'Prohibited characters detected in role.';
  }
  const sanitizedRole = sanitizeString(rawRole);
  if (!sanitizedRole) {
    errors.role = 'Role / Title is required.';
  } else if (sanitizedRole.length > 80) {
    errors.role = 'Role must not exceed 80 characters.';
  }

  // 5. Validate Shift
  const rawShift = (data.shift || '').trim();
  if (containsMaliciousPayload(rawShift)) {
    errors.shift = 'Prohibited characters detected in shift.';
  }
  const sanitizedShift = sanitizeString(rawShift);
  if (!sanitizedShift) {
    errors.shift = 'Shift designation is required.';
  } else if (sanitizedShift.length > 80) {
    errors.shift = 'Shift must not exceed 80 characters.';
  }

  // 6. Validate Experience
  const expNum = Number(data.experience);
  if (isNaN(expNum) || expNum < 0 || expNum > 60 || !Number.isInteger(expNum)) {
    errors.experience = 'Experience must be an integer between 0 and 60 years.';
  }

  // 7. Validate Skills
  const sanitizedSkills: string[] = [];
  if (Array.isArray(data.skills)) {
    for (const skill of data.skills) {
      const cleanSkill = sanitizeString(skill);
      if (cleanSkill && cleanSkill.length <= 50 && !sanitizedSkills.includes(cleanSkill)) {
        sanitizedSkills.push(cleanSkill);
      }
    }
  }

  // 8. Validate Password
  const rawPassword = (data.password || '').trim();
  if (rawPassword) {
    if (containsMaliciousPayload(rawPassword)) {
      errors.password = 'Prohibited control or injection characters detected in password.';
    } else if (rawPassword.length < 6) {
      errors.password = 'Password must be at least 6 characters long.';
    } else if (rawPassword.length > 128) {
      errors.password = 'Password must not exceed 128 characters.';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    sanitized: {
      technician_id: sanitizedId,
      name: sanitizedName,
      email: sanitizedEmail,
      role: sanitizedRole,
      shift: sanitizedShift,
      experience: expNum >= 0 && expNum <= 60 ? expNum : 0,
      skills: sanitizedSkills,
      password: rawPassword,
    },
  };
}

/**
 * Fetches all technicians directly from the database (backend persistent store & Firestore).
 * Guarantees resilient loading without failing or throwing uncaught connection errors.
 */
export async function fetchTechniciansFromDatabase(): Promise<Technician[]> {
  try {
    // 1. Try persistent backend endpoint first
    const res = await fetch('/api/technicians');
    if (res.ok) {
      const data = await res.json();
      if (data && data.success && Array.isArray(data.technicians) && data.technicians.length > 0) {
        const list: Technician[] = data.technicians.map((t: any) => ({
          technician_id: String(t.technician_id),
          name: String(t.name || 'Technician'),
          email: String(t.email || ''),
          role: String(t.role || 'Maintenance Specialist'),
          skills: Array.isArray(t.skills) ? t.skills : [],
          experience: Number(t.experience ?? 5),
          shift: String(t.shift || 'Day Shift'),
          avatar_url: t.avatar_url || '',
          last_login: t.last_login || new Date().toISOString(),
        }));
        list.sort((a, b) => a.technician_id.localeCompare(b.technician_id));
        return list;
      }
    }
  } catch (backendErr) {
    console.warn('Backend /api/technicians probe note:', backendErr);
  }

  // 2. Direct Firestore fallback
  try {
    const techCol = collection(db, 'technicians');
    const snap = await getDocs(techCol);

    if (!snap.empty) {
      const technicians: Technician[] = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            technician_id: String(data.technician_id || d.id),
            name: String(data.name || 'Technician'),
            email: String(data.email || ''),
            role: String(data.role || 'Maintenance Specialist'),
            skills: Array.isArray(data.skills) ? data.skills : [],
            experience: Number(data.experience ?? 5),
            shift: String(data.shift || 'Day Shift'),
            avatar_url: data.avatar_url || '',
            last_login: data.last_login || new Date().toISOString(),
          } as Technician;
        })
        .filter((t): t is Technician => Boolean(t && t.technician_id));

      technicians.sort((a, b) => a.technician_id.localeCompare(b.technician_id));
      return technicians;
    }
  } catch (firestoreErr) {
    console.warn('Direct Firestore query note:', firestoreErr);
  }

  return [];
}

/**
 * Registers a new technician directly to the database.
 * If password is blank, takes the system default from VITE_DEFAULT_TECHNICIAN_PASSWORD.
 * The password is SHA-256 hashed before saving into the database.
 */
export async function addTechnicianToDatabase(
  formData: {
    technician_id: string;
    name: string;
    email: string;
    role: string;
    shift: string;
    experience: number | string;
    skills: string[];
    password?: string;
  },
  existingTechnicians: Technician[] = []
): Promise<{ success: boolean; technician?: Technician; error?: string }> {
  // Validate input
  const validation = validateTechnicianForm(formData, false, existingTechnicians);
  if (!validation.isValid) {
    const firstError = Object.values(validation.errors)[0];
    return { success: false, error: firstError };
  }

  const { sanitized } = validation;

  try {
    // 1. Save to persistent backend database
    const effectivePassword = sanitized.password || getDefaultTechnicianPassword();
    const res = await fetch('/api/technicians', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...sanitized,
        password: effectivePassword,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success || !data.technician) {
      return {
        success: false,
        error: data.error || 'Failed to save technician to database.',
      };
    }

    const createdTechnician = data.technician as Technician;

    // 2. Also mirror to Firestore if reachable (non-blocking)
    try {
      const passwordHash = await computeSha256(effectivePassword);
      await setDoc(
        doc(db, 'technicians', sanitized.technician_id),
        cleanFirestoreData({
          ...sanitized,
          avatar_url: '',
          password_hash: passwordHash,
          last_login: new Date().toISOString(),
          created_at: new Date().toISOString(),
        })
      );
    } catch (fsErr) {
      console.warn('Non-blocking Firestore sync note:', fsErr);
    }

    return {
      success: true,
      technician: createdTechnician,
    };
  } catch (error: any) {
    console.error('Error saving technician to database:', error);
    return {
      success: false,
      error: error?.message || 'Failed to save technician to database.',
    };
  }
}

/**
 * Updates an existing technician directly in the database.
 * If password field is non-empty, re-hashes and updates credentials.
 * If password field is blank, retains existing credentials in the database.
 */
export async function updateTechnicianInDatabase(
  technicianId: string,
  formData: {
    technician_id: string;
    name: string;
    email: string;
    role: string;
    shift: string;
    experience: number | string;
    skills: string[];
    password?: string;
  },
  existingTechnicians: Technician[] = []
): Promise<{ success: boolean; technician?: Technician; error?: string }> {
  // Validate input
  const validation = validateTechnicianForm(formData, true, existingTechnicians);
  if (!validation.isValid) {
    const firstError = Object.values(validation.errors)[0];
    return { success: false, error: firstError };
  }

  const { sanitized } = validation;

  try {
    // 1. Send update request to backend database API
    const res = await fetch(`/api/technicians/${encodeURIComponent(technicianId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...sanitized,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success || !data.technician) {
      return {
        success: false,
        error: data.error || 'Failed to update technician in database.',
      };
    }

    const updatedTechnician = data.technician as Technician;

    // 2. Also mirror updates to Firestore if reachable (non-blocking)
    try {
      const docRef = doc(db, 'technicians', technicianId);
      const updates: Record<string, any> = {
        name: sanitized.name,
        email: sanitized.email,
        role: sanitized.role,
        shift: sanitized.shift,
        experience: sanitized.experience,
        skills: sanitized.skills,
        updated_at: new Date().toISOString(),
      };

      if (sanitized.password && sanitized.password.trim()) {
        updates.password_hash = await computeSha256(sanitized.password.trim());
      }

      await updateDoc(docRef, cleanFirestoreData(updates));
    } catch (fsErr) {
      console.warn('Non-blocking Firestore update sync note:', fsErr);
    }

    return {
      success: true,
      technician: updatedTechnician,
    };
  } catch (error: any) {
    console.error('Error updating technician in database:', error);
    return {
      success: false,
      error: error?.message || 'Failed to update technician in database.',
    };
  }
}

/**
 * Deletes a technician directly from the database.
 */
export async function deleteTechnicianFromDatabase(
  technicianId: string,
  currentAuthenticatedTechId?: string,
  totalTechniciansCount?: number
): Promise<{ success: boolean; error?: string }> {
  if (!technicianId) {
    return { success: false, error: 'Technician ID is required for deletion.' };
  }

  // Safety check: Prevent deleting logged-in technician
  if (currentAuthenticatedTechId && technicianId.toUpperCase() === currentAuthenticatedTechId.toUpperCase()) {
    return {
      success: false,
      error: 'Action blocked: You cannot delete your currently active authenticated technician session.',
    };
  }

  // Safety check: Keep at least 1 technician
  if (typeof totalTechniciansCount === 'number' && totalTechniciansCount <= 1) {
    return {
      success: false,
      error: 'Action blocked: Minimum of 1 technician required in the database for system access.',
    };
  }

  try {
    // 1. Delete from backend database endpoint
    const res = await fetch(`/api/technicians/${encodeURIComponent(technicianId)}`, {
      method: 'DELETE',
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || 'Failed to delete technician from database.',
      };
    }

    // 2. Also mirror delete to Firestore if reachable (non-blocking)
    try {
      await deleteDoc(doc(db, 'technicians', technicianId));
    } catch (fsErr) {
      console.warn('Non-blocking Firestore delete sync note:', fsErr);
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error deleting technician from database:', error);
    return {
      success: false,
      error: error?.message || 'Failed to delete technician from database.',
    };
  }
}
