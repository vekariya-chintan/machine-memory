/**
 * Comprehensive Industrial Security Validation & Input Sanitization Library
 * Protects against XSS, Script Injection, Prototype Pollution, and Malicious Payloads
 * Enforces strict typing, length boundaries, and regex patterns on both Frontend & Backend.
 */

// Malicious payload detection patterns
const DANGEROUS_HTML_REGEX = /<[^>]*>|<!--.*?-->/gi;
const DANGEROUS_PROTOCOLS_REGEX = /(?:javascript|vbscript|data|file)\s*:/gi;
const DANGEROUS_EVENT_HANDLERS_REGEX = /\bon\w+\s*=/gi;
const CONTROL_CHARS_REGEX = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;
const PROTOTYPE_POLLUTION_REGEX = /\b(?:__proto__|constructor|prototype)\b/gi;
const SQL_NOSQL_INJECTION_REGEX = /\b(?:DROP\s+TABLE|DELETE\s+FROM|UNION\s+SELECT|INSERT\s+INTO|UPDATE\s+.*?\s+SET|\$gt|\$lt|\$where|\$ne|\$regex)\b/gi;

/**
 * Checks if input string contains any prohibited malicious injection vector.
 */
export function containsMaliciousPayload(input: string | null | undefined): boolean {
  if (!input || typeof input !== 'string') return false;
  return (
    DANGEROUS_HTML_REGEX.test(input) ||
    DANGEROUS_PROTOCOLS_REGEX.test(input) ||
    DANGEROUS_EVENT_HANDLERS_REGEX.test(input) ||
    CONTROL_CHARS_REGEX.test(input) ||
    PROTOTYPE_POLLUTION_REGEX.test(input) ||
    SQL_NOSQL_INJECTION_REGEX.test(input)
  );
}

/**
 * Sanitizes input string by removing control characters, dangerous tags, script protocols,
 * event handlers, and prototype pollution keywords. Truncates to maxLen if specified.
 */
export function sanitizeString(input: string | null | undefined, maxLen?: number): string {
  if (typeof input !== 'string') return '';
  let clean = input
    .replace(CONTROL_CHARS_REGEX, '')
    .replace(DANGEROUS_HTML_REGEX, '')
    .replace(DANGEROUS_PROTOCOLS_REGEX, '')
    .replace(DANGEROUS_EVENT_HANDLERS_REGEX, '')
    .replace(PROTOTYPE_POLLUTION_REGEX, '')
    .trim();

  if (typeof maxLen === 'number' && maxLen > 0 && clean.length > maxLen) {
    clean = clean.slice(0, maxLen).trim();
  }
  return clean;
}

export interface SecurityValidationResult<T> {
  isValid: boolean;
  errors: Record<string, string>;
  sanitized: T;
}

/**
 * Validates Machine Asset Input Specifications
 */
export function validateMachineInput(
  data: any,
  isEditMode: boolean = false,
  existingMachineIds: string[] = []
): SecurityValidationResult<any> {
  const errors: Record<string, string> = {};

  const rawId = (data?.machine_id || '').trim().toUpperCase();
  const sanitizedId = sanitizeString(rawId, 20).toUpperCase();

  if (!sanitizedId) {
    errors.machine_id = 'Asset ID is required.';
  } else if (!/^[A-Z0-9-_]{3,20}$/.test(sanitizedId)) {
    errors.machine_id = 'Asset ID must be 3-20 characters: uppercase letters, numbers, hyphens, and underscores only (e.g., M001).';
  } else if (!isEditMode && existingMachineIds.map((id) => id.toUpperCase()).includes(sanitizedId)) {
    errors.machine_id = `Asset ID "${sanitizedId}" already exists in the database.`;
  }

  const rawName = (data?.name || '').trim();
  if (containsMaliciousPayload(rawName)) {
    errors.name = 'Prohibited characters or script tags detected in equipment name.';
  }
  const sanitizedName = sanitizeString(rawName, 100);
  if (!sanitizedName) {
    errors.name = 'Equipment name is required.';
  } else if (sanitizedName.length < 2 || sanitizedName.length > 100) {
    errors.name = 'Equipment name must be between 2 and 100 characters.';
  }

  const rawModel = (data?.model || '').trim();
  if (containsMaliciousPayload(rawModel)) {
    errors.model = 'Prohibited characters detected in equipment model.';
  }
  const sanitizedModel = sanitizeString(rawModel, 80) || 'Standard Equipment';

  const rawManufacturer = (data?.manufacturer || '').trim();
  if (containsMaliciousPayload(rawManufacturer)) {
    errors.manufacturer = 'Prohibited characters detected in manufacturer name.';
  }
  const sanitizedManufacturer = sanitizeString(rawManufacturer, 80) || 'OEM';

  const rawLocation = (data?.location || '').trim();
  if (containsMaliciousPayload(rawLocation)) {
    errors.location = 'Prohibited characters detected in location.';
  }
  const sanitizedLocation = sanitizeString(rawLocation, 100) || 'Factory Floor';

  const rawDescription = (data?.description || '').trim();
  if (containsMaliciousPayload(rawDescription)) {
    errors.description = 'Prohibited characters detected in description.';
  }
  const sanitizedDescription = sanitizeString(rawDescription, 500);

  // Validate Subsystem Type
  const validSubsystems = ['cnc_spindle', 'hydraulic_pump', 'planetary_gearbox', 'coolant_pump', 'power_generator', 'custom'];
  const subsystem = validSubsystems.includes(data?.subsystem_type) ? data.subsystem_type : 'custom';

  // Validate Numbers
  const normalTemp = Number(data?.baseline_metrics?.normal_temp_c ?? 45);
  const maxTemp = Number(data?.baseline_metrics?.max_temp_c ?? 85);
  const normalVib = Number(data?.baseline_metrics?.normal_vibration_mms ?? 1.8);
  const isoLimit = Number(data?.baseline_metrics?.iso_vibration_limit ?? 2.8);
  const ratedRpm = Math.max(0, Math.min(100000, Number(data?.baseline_metrics?.rated_rpm ?? 3000)));
  const powerKw = Math.max(0, Math.min(10000, Number(data?.baseline_metrics?.power_baseline_kw ?? 15)));

  if (isNaN(normalTemp) || normalTemp < -50 || normalTemp > 500) {
    errors.normal_temp_c = 'Normal operating temperature must be a valid number between -50°C and 500°C.';
  }
  if (isNaN(maxTemp) || maxTemp < -50 || maxTemp > 500) {
    errors.max_temp_c = 'Maximum temperature limit must be a valid number between -50°C and 500°C.';
  }
  if (isNaN(normalVib) || normalVib < 0 || normalVib > 100) {
    errors.normal_vibration_mms = 'Normal vibration RMS must be a non-negative number up to 100 mm/s.';
  }
  if (isNaN(isoLimit) || isoLimit < 0 || isoLimit > 100) {
    errors.iso_vibration_limit = 'ISO vibration limit must be a non-negative number up to 100 mm/s.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    sanitized: {
      machine_id: sanitizedId,
      name: sanitizedName,
      model: sanitizedModel,
      manufacturer: sanitizedManufacturer,
      location: sanitizedLocation,
      subsystem_type: subsystem,
      status: data?.status === 'warning' || data?.status === 'critical' || data?.status === 'maintenance' ? data.status : 'nominal',
      installed_date: data?.installed_date || new Date().toISOString().split('T')[0],
      iso_machine_group: data?.iso_machine_group || 'Group 2',
      foundation_type: data?.foundation_type === 'flexible' ? 'flexible' : 'rigid',
      baseline_metrics: {
        normal_temp_c: normalTemp,
        max_temp_c: maxTemp,
        normal_vibration_mms: normalVib,
        iso_vibration_limit: isoLimit,
        iso_zone_a_limit: Number(data?.baseline_metrics?.iso_zone_a_limit ?? 1.4),
        iso_zone_b_limit: Number(data?.baseline_metrics?.iso_zone_b_limit ?? 2.8),
        iso_zone_c_limit: Number(data?.baseline_metrics?.iso_zone_c_limit ?? 4.5),
        iso_zone_d_limit: Number(data?.baseline_metrics?.iso_zone_d_limit ?? 7.1),
        rated_rpm: ratedRpm,
        power_baseline_kw: powerKw,
      },
      subsystem_parameters: data?.subsystem_parameters || undefined,
      description: sanitizedDescription,
    },
  };
}

/**
 * Validates Knowledge Base Entry Input
 */
export function validateKnowledgeInput(data: any): SecurityValidationResult<any> {
  const errors: Record<string, string> = {};

  const rawTitle = (data?.title || '').trim();
  if (containsMaliciousPayload(rawTitle)) {
    errors.title = 'Prohibited characters or script injection detected in knowledge title.';
  }
  const sanitizedTitle = sanitizeString(rawTitle, 120);
  if (!sanitizedTitle) {
    errors.title = 'Knowledge title is required.';
  } else if (sanitizedTitle.length < 3 || sanitizedTitle.length > 120) {
    errors.title = 'Title must be between 3 and 120 characters.';
  }

  const rawContent = (data?.content || '').trim();
  if (containsMaliciousPayload(rawContent)) {
    errors.content = 'Prohibited characters or script injection detected in knowledge content.';
  }
  const sanitizedContent = sanitizeString(rawContent, 2000);
  if (!sanitizedContent) {
    errors.content = 'Knowledge content description is required.';
  } else if (sanitizedContent.length < 10) {
    errors.content = 'Content must be at least 10 characters long.';
  } else if (sanitizedContent.length > 2000) {
    errors.content = 'Content cannot exceed 2000 characters.';
  }

  const rawMachineId = (data?.machine_id || 'M001').trim().toUpperCase();
  const sanitizedMachineId = sanitizeString(rawMachineId, 20).toUpperCase();

  const validTypes = ['technician_tip', 'oem_manual', 'post_mortem', 'field_observation'];
  const type = validTypes.includes(data?.type) ? data.type : 'technician_tip';

  const sanitizedSource = sanitizeString((data?.source || 'Technician Log').trim(), 100);
  const sanitizedCreatedBy = sanitizeString((data?.created_by || 'Plant Specialist').trim(), 100);

  const tags: string[] = [];
  if (Array.isArray(data?.tags)) {
    for (const tag of data.tags) {
      const cleanTag = sanitizeString(String(tag), 30);
      if (cleanTag && tags.length < 10 && !tags.includes(cleanTag)) {
        tags.push(cleanTag);
      }
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    sanitized: {
      knowledge_id: data?.knowledge_id || undefined,
      machine_id: sanitizedMachineId,
      type,
      title: sanitizedTitle,
      content: sanitizedContent,
      source: sanitizedSource,
      created_by: sanitizedCreatedBy,
      confidence: Math.max(0.1, Math.min(1.0, Number(data?.confidence ?? 0.95))),
      created_at: data?.created_at || new Date().toISOString(),
      tags,
      media: data?.media || undefined,
    },
  };
}

/**
 * Validates Incident / Investigation Resolution Input
 */
export function validateResolutionInput(data: any): SecurityValidationResult<any> {
  const errors: Record<string, string> = {};

  const rawIncidentId = (data?.incident_id || '').trim().toUpperCase();
  const sanitizedIncidentId = sanitizeString(rawIncidentId, 30).toUpperCase();
  if (!sanitizedIncidentId) {
    errors.incident_id = 'Incident ID is required.';
  }

  const rawMachineId = (data?.machine_id || 'M001').trim().toUpperCase();
  const sanitizedMachineId = sanitizeString(rawMachineId, 20).toUpperCase();

  const rawCause = (data?.confirmed_cause || '').trim();
  if (containsMaliciousPayload(rawCause)) {
    errors.confirmed_cause = 'Prohibited script tags or injection detected in confirmed cause.';
  }
  const sanitizedCause = sanitizeString(rawCause, 200);
  if (!sanitizedCause) {
    errors.confirmed_cause = 'Confirmed root cause is required.';
  }

  const rawRepair = (data?.repair || '').trim();
  if (containsMaliciousPayload(rawRepair)) {
    errors.repair = 'Prohibited script tags detected in repair action.';
  }
  const sanitizedRepair = sanitizeString(rawRepair, 200);
  if (!sanitizedRepair) {
    errors.repair = 'Corrective repair action is required.';
  }

  const downtime = Math.max(1, Math.min(10000, parseInt(data?.downtime, 10) || 30));

  const rawNotes = (data?.notes || '').trim();
  if (containsMaliciousPayload(rawNotes)) {
    errors.notes = 'Prohibited script tags detected in verification notes.';
  }
  const sanitizedNotes = sanitizeString(rawNotes, 1000);

  const rawVerifiedBy = (data?.verified_by || 'Master Tech').trim();
  const sanitizedVerifiedBy = sanitizeString(rawVerifiedBy, 100);

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    sanitized: {
      incident_id: sanitizedIncidentId,
      machine_id: sanitizedMachineId,
      confirmed_cause: sanitizedCause,
      repair: sanitizedRepair,
      downtime,
      notes: sanitizedNotes,
      verified_by: sanitizedVerifiedBy,
      outcome: sanitizeString(data?.outcome || '', 300),
      verification_media: data?.verification_media || undefined,
    },
  };
}

/**
 * Validates AI & Search Query Prompt Inputs
 */
export function validateQueryInput(input: string | null | undefined): SecurityValidationResult<string> {
  const errors: Record<string, string> = {};

  const raw = (input || '').trim();
  if (containsMaliciousPayload(raw)) {
    errors.query = 'Prohibited script tags or injection characters detected in query.';
  }

  const sanitized = sanitizeString(raw, 300);
  if (!sanitized) {
    errors.query = 'Query cannot be empty.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    sanitized,
  };
}
