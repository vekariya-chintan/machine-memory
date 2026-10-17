import { User, Technician } from '../types/industrial';
import {
  fetchUsersFromDatabase,
  addUserToDatabase,
  updateUserInDatabase,
  deleteUserFromDatabase,
  validateUserForm,
  getDefaultUserPassword,
  sanitizeString,
  containsMaliciousPayload,
} from './userService';

export {
  sanitizeString,
  containsMaliciousPayload,
  getDefaultUserPassword as getDefaultTechnicianPassword,
};

export type TechnicianValidationResult = ReturnType<typeof validateUserForm>;

export const validateTechnicianForm = validateUserForm;

export async function fetchTechniciansFromDatabase(): Promise<Technician[]> {
  return await fetchUsersFromDatabase();
}

export async function addTechnicianToDatabase(
  formData: any,
  existingTechs: Technician[] = []
): Promise<{ success: boolean; technician?: Technician; error?: string }> {
  const res = await addUserToDatabase(formData, existingTechs);
  return {
    success: res.success,
    technician: res.user,
    error: res.error,
  };
}

export async function updateTechnicianInDatabase(
  techId: string,
  formData: any,
  existingTechs: Technician[] = []
): Promise<{ success: boolean; technician?: Technician; error?: string }> {
  const res = await updateUserInDatabase(techId, formData, existingTechs);
  return {
    success: res.success,
    technician: res.user,
    error: res.error,
  };
}

export async function deleteTechnicianFromDatabase(
  techId: string,
  currentAuthId?: string,
  totalCount?: number
): Promise<{ success: boolean; error?: string }> {
  return await deleteUserFromDatabase(techId, currentAuthId, totalCount);
}
