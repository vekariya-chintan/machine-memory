import { collection, doc, getDocs, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { User } from '../types/industrial';
import { computeSha256 } from './authService';
import { cleanFirestoreData } from './machineMemoryService';

/**
 * Returns the configured default user password from environment variables.
 */
export function getDefaultUserPassword(): string {
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

export interface UserValidationResult {
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
 * Validates user form input with strict industrial security rules.
 */
export function validateUserForm(
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
  existingUsers: User[] = []
): UserValidationResult {
  const errors: Record<string, string> = {};

  // 1. Validate ID
  const rawId = (data.technician_id || '').trim();
  const sanitizedId = sanitizeString(rawId).toUpperCase();

  if (!sanitizedId) {
    errors.technician_id = 'User ID is required.';
  } else if (!/^[A-Z0-9-_]{3,25}$/.test(sanitizedId)) {
    errors.technician_id =
      'ID must be 3-25 characters: uppercase letters, numbers, hyphens, and underscores only (e.g., USR-05).';
  } else if (!isEditMode) {
    const isDuplicate = existingUsers.some(
      (u) => u.technician_id.toUpperCase() === sanitizedId
    );
    if (isDuplicate) {
      errors.technician_id = `User ID "${sanitizedId}" already exists.`;
    }
  }

  // 2. Validate Name
  const rawName = (data.name || '').trim();
  if (containsMaliciousPayload(rawName)) {
    errors.name = 'Prohibited characters detected (HTML/script injection not allowed).';
  }
  const sanitizedName = sanitizeString(rawName);
  if (!sanitizedName) {
    errors.name = 'User name is required.';
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
    errors.email = 'Email address is required.';
  } else if (sanitizedEmail.length > 100) {
    errors.email = 'Email address cannot exceed 100 characters.';
  } else if (!EMAIL_REGEX.test(sanitizedEmail)) {
    errors.email = 'Please enter a valid email address (e.g. name@promptnova.com).';
  } else {
    // Check for email collision with other users
    const emailConflict = existingUsers.some(
      (u) =>
        u.email.toLowerCase() === sanitizedEmail &&
        (!isEditMode || u.technician_id.toUpperCase() !== sanitizedId)
    );
    if (emailConflict) {
      errors.email = 'This email is already registered to another user.';
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
 * Fetches all users directly from Firebase Firestore `users` collection.
 */
export async function fetchUsersFromDatabase(): Promise<User[]> {
  try {
    const userCol = collection(db, 'users');
    let snap = await getDocs(userCol);

    // Fallback to technicians collection if users is empty
    if (snap.empty) {
      const techCol = collection(db, 'technicians');
      snap = await getDocs(techCol);
    }

    if (!snap.empty) {
      const users: User[] = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            technician_id: String(data.technician_id || data.user_id || d.id),
            name: String(data.name || 'User'),
            email: String(data.email || ''),
            role: String(data.role || 'Maintenance Specialist'),
            role_id: data.role_id ? String(data.role_id) : undefined,
            skills: Array.isArray(data.skills) ? data.skills : [],
            experience: Number(data.experience ?? 5),
            shift: String(data.shift || 'Day Shift'),
            avatar_url: data.avatar_url || '',
            last_login: data.last_login || new Date().toISOString(),
          } as User;
        })
        .filter((u): u is User => Boolean(u && u.technician_id));

      users.sort((a, b) => a.technician_id.localeCompare(b.technician_id));
      return users;
    }
  } catch (firestoreErr) {
    console.warn('Direct Firestore users query note:', firestoreErr);
  }

  return [];
}

/**
 * Registers a new user directly into the database.
 */
export async function addUserToDatabase(
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
  existingUsers: User[] = []
): Promise<{ success: boolean; user?: User; error?: string }> {
  const validation = validateUserForm(formData, false, existingUsers);
  if (!validation.isValid) {
    const firstError = Object.values(validation.errors)[0];
    return { success: false, error: firstError };
  }

  const { sanitized } = validation;

  try {
    const effectivePassword = sanitized.password || getDefaultUserPassword();
    
    // Attempt backend API call
    try {
      await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...sanitized,
          password: effectivePassword,
        }),
      });
    } catch (e) {
      console.warn('Backend server /api/users note:', e);
    }

    // Save directly to Firestore users collection
    const passwordHash = await computeSha256(effectivePassword);
    const createdUser: User = {
      technician_id: sanitized.technician_id,
      name: sanitized.name,
      email: sanitized.email,
      role: sanitized.role,
      role_id: sanitized.role === 'Master Admin' ? 'ROLE_MASTER_ADMIN' : undefined,
      shift: sanitized.shift,
      experience: sanitized.experience,
      skills: sanitized.skills,
      avatar_url: '',
      last_login: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };

    await setDoc(
      doc(db, 'users', sanitized.technician_id),
      cleanFirestoreData({
        ...createdUser,
        password_hash: passwordHash,
      })
    );

    return {
      success: true,
      user: createdUser,
    };
  } catch (error: any) {
    console.error('Error saving user to database:', error);
    return {
      success: false,
      error: error?.message || 'Failed to save user to database.',
    };
  }
}

/**
 * Updates an existing user directly in the database.
 */
export async function updateUserInDatabase(
  userId: string,
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
  existingUsers: User[] = []
): Promise<{ success: boolean; user?: User; error?: string }> {
  const validation = validateUserForm(formData, true, existingUsers);
  if (!validation.isValid) {
    const firstError = Object.values(validation.errors)[0];
    return { success: false, error: firstError };
  }

  const { sanitized } = validation;

  try {
    try {
      await fetch(`/api/users/${encodeURIComponent(userId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...sanitized }),
      });
    } catch (e) {
      console.warn('Backend server /api/users update note:', e);
    }

    const docRef = doc(db, 'users', userId);
    const updates: Record<string, any> = {
      name: sanitized.name,
      email: sanitized.email,
      role: sanitized.role,
      role_id: sanitized.role === 'Master Admin' ? 'ROLE_MASTER_ADMIN' : undefined,
      shift: sanitized.shift,
      experience: sanitized.experience,
      skills: sanitized.skills,
      updated_at: new Date().toISOString(),
    };

    if (sanitized.password && sanitized.password.trim()) {
      updates.password_hash = await computeSha256(sanitized.password.trim());
    }

    await setDoc(docRef, cleanFirestoreData(updates), { merge: true });

    const updatedUser: User = {
      technician_id: userId,
      name: sanitized.name,
      email: sanitized.email,
      role: sanitized.role,
      role_id: sanitized.role === 'Master Admin' ? 'ROLE_MASTER_ADMIN' : undefined,
      shift: sanitized.shift,
      experience: sanitized.experience,
      skills: sanitized.skills,
      updated_at: new Date().toISOString(),
    };

    return {
      success: true,
      user: updatedUser,
    };
  } catch (error: any) {
    console.error('Error updating user in database:', error);
    return {
      success: false,
      error: error?.message || 'Failed to update user in database.',
    };
  }
}

/**
 * Deletes a user directly from the database.
 */
export async function deleteUserFromDatabase(
  userId: string,
  currentAuthenticatedUserId?: string,
  totalUsersCount?: number
): Promise<{ success: boolean; error?: string }> {
  if (!userId) {
    return { success: false, error: 'User ID is required for deletion.' };
  }

  if (
    currentAuthenticatedUserId &&
    userId.toUpperCase() === currentAuthenticatedUserId.toUpperCase()
  ) {
    return {
      success: false,
      error: 'Action blocked: You cannot delete your currently active session.',
    };
  }

  if (typeof totalUsersCount === 'number' && totalUsersCount <= 1) {
    return {
      success: false,
      error: 'Action blocked: Minimum of 1 user required in the database.',
    };
  }

  try {
    try {
      await fetch(`/api/users/${encodeURIComponent(userId)}`, {
        method: 'DELETE',
      });
    } catch (e) {
      console.warn('Backend server delete user note:', e);
    }

    await deleteDoc(doc(db, 'users', userId));

    return { success: true };
  } catch (error: any) {
    console.error('Error deleting user from database:', error);
    return {
      success: false,
      error: error?.message || 'Failed to delete user from database.',
    };
  }
}
