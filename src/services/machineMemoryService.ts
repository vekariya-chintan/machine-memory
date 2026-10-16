import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
  query,
  orderBy,
  limit,
  startAfter,
  DocumentSnapshot,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  Machine,
  Incident,
  KnowledgeItem,
  Technician,
  EvidenceItem,
  SensorReading,
  ExtractionResult,
} from '../types/industrial';
import {
  SEED_MACHINES,
  SEED_INCIDENTS,
  SEED_KNOWLEDGE,
  SEED_TECHNICIANS,
  SEED_EVIDENCE,
} from '../db/seedData';

/**
 * Recursively removes all `undefined` values from an object or array before passing to Firestore setDoc/updateDoc
 */
export function cleanFirestoreData<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj
      .map((item) => cleanFirestoreData(item))
      .filter((item) => item !== undefined) as unknown as T;
  }
  if (typeof obj === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        const cleanedValue = cleanFirestoreData(value);
        if (cleanedValue !== undefined) {
          cleaned[key] = cleanedValue;
        }
      }
    }
    return cleaned as T;
  }
  return obj;
}

/**
 * Resets Central Database collections and re-seeds with the 5 assets of the automated CNC system (M001-M005)
 */
export async function clearAndResetFleetToM001(): Promise<void> {
  try {
    // 1. Delete all existing documents in 'machines'
    const machinesSnap = await getDocs(collection(db, 'machines'));
    for (const d of machinesSnap.docs) {
      await deleteDoc(d.ref);
    }

    // 2. Delete all existing documents in 'incidents'
    const incSnap = await getDocs(collection(db, 'incidents'));
    for (const d of incSnap.docs) {
      await deleteDoc(d.ref);
    }

    // 3. Delete all existing documents in 'knowledge'
    const knowSnap = await getDocs(collection(db, 'knowledge'));
    for (const d of knowSnap.docs) {
      await deleteDoc(d.ref);
    }

    // 4. Technicians are securely stored and managed server-side
    try {
      const techSnap = await getDocs(collection(db, 'technicians'));
      for (const d of techSnap.docs) {
        await deleteDoc(d.ref);
      }
    } catch {
      // Ignored: technicians collection is secured against client-side writes
    }

    // 5. Delete all existing documents in 'evidence'
    const eviSnap = await getDocs(collection(db, 'evidence'));
    for (const d of eviSnap.docs) {
      await deleteDoc(d.ref);
    }

    // 6. Seed fresh 5 machines (M001 through M005)
    for (const m of SEED_MACHINES) {
      await setDoc(doc(db, 'machines', m.machine_id), cleanFirestoreData(m));
    }

    // 7. Seed fresh incidents for M001-M005
    for (const inc of SEED_INCIDENTS) {
      await setDoc(doc(db, 'incidents', inc.incident_id), cleanFirestoreData(inc));
    }

    // 8. Seed fresh knowledge entries for M001-M005
    for (const k of SEED_KNOWLEDGE) {
      await setDoc(doc(db, 'knowledge', k.knowledge_id), cleanFirestoreData(k));
    }

    // 9. Technicians directory stored directly in central database
    try {
      for (const t of SEED_TECHNICIANS) {
        await setDoc(doc(db, 'technicians', t.technician_id), cleanFirestoreData(t));
      }
    } catch (e) {
      console.warn('Technicians collection initialization warning:', e);
    }

    // 10. Seed evidence
    for (const e of SEED_EVIDENCE) {
      await setDoc(doc(db, 'evidence', e.evidence_id), cleanFirestoreData(e));
    }

    console.log('Central database fleet initialized with M001-M005 and blueprint collections.');
  } catch (error) {
    console.error('Error during clearAndResetFleetToM001:', error);
    throw error;
  }
}

/**
 * Executes the entire Firebase blueprint by establishing and seeding the 5 core collections:
 * 'machines', 'incidents', 'knowledge', 'evidence', 'technicians'
 */
export async function executeFirebaseBlueprint(): Promise<{
  success: boolean;
  collectionsCreated: string[];
  counts: Record<string, number>;
}> {
  await clearAndResetFleetToM001();
  return {
    success: true,
    collectionsCreated: ['machines', 'incidents', 'knowledge', 'evidence', 'technicians'],
    counts: {
      machines: SEED_MACHINES.length,
      incidents: SEED_INCIDENTS.length,
      knowledge: SEED_KNOWLEDGE.length,
      evidence: SEED_EVIDENCE.length,
      technicians: SEED_TECHNICIANS.length,
    },
  };
}

/**
 * Verifies Firestore database connection on boot.
 * Does not perform automatic seeding. Use `npm run seed` when initial data population is needed.
 */
export async function initializeFirestoreDatabase(): Promise<{ success: boolean; seeded: boolean }> {
  try {
    const machinesCol = collection(db, 'machines');
    await getDocs(machinesCol);
    return { success: true, seeded: false };
  } catch (error) {
    console.error('Error during database connectivity check:', error);
    throw error;
  }
}

export function getMachineDataset(machineId: string, machine?: Machine) {
  const normTemp = machine?.baseline_metrics?.normal_temp_c ?? 45.0;
  const isoVib = machine?.baseline_metrics?.iso_vibration_limit ?? 2.2;
  const normVib = machine?.baseline_metrics?.normal_vibration_mms ?? 1.2;
  const ratedRpm = machine?.baseline_metrics?.rated_rpm ?? 3000;
  const powerKw = machine?.baseline_metrics?.power_baseline_kw ?? 15.0;

  return {
    defaultMemo: `${machine?.name || machineId} develops vibration after approximately 20 minutes under load. Inspect primary drive couplings and mounting alignments before ordering mechanical teardown.`,
    csv: `timestamp,machine_id,temperature,vibration,rpm,power
08:00,${machineId},${normTemp.toFixed(1)},${normVib.toFixed(1)},${ratedRpm},${powerKw.toFixed(1)}
08:05,${machineId},${(normTemp + 0.9).toFixed(1)},${(normVib + 0.1).toFixed(1)},${ratedRpm - 2},${(powerKw + 0.1).toFixed(1)}
08:10,${machineId},${(normTemp + 2.2).toFixed(1)},${(normVib + 0.3).toFixed(1)},${ratedRpm - 3},${(powerKw + 0.3).toFixed(1)}
08:15,${machineId},${(normTemp + 4.1).toFixed(1)},${(isoVib + 0.2).toFixed(1)},${ratedRpm - 5},${(powerKw + 0.5).toFixed(1)}
08:20,${machineId},${(normTemp + 6.0).toFixed(1)},${(isoVib + 0.6).toFixed(1)},${ratedRpm - 10},${(powerKw + 0.8).toFixed(1)}`,
    rows: [
      { timestamp: '08:00', minute: 0, machine_id: machineId, temperature: normTemp, vibration: normVib, rpm: ratedRpm, power: powerKw },
      { timestamp: '08:05', minute: 5, machine_id: machineId, temperature: normTemp + 0.9, vibration: normVib + 0.1, rpm: ratedRpm - 2, power: powerKw + 0.1 },
      { timestamp: '08:10', minute: 10, machine_id: machineId, temperature: normTemp + 2.2, vibration: normVib + 0.3, rpm: ratedRpm - 3, power: powerKw + 0.3 },
      { timestamp: '08:15', minute: 15, machine_id: machineId, temperature: normTemp + 4.1, vibration: isoVib + 0.2, rpm: ratedRpm - 5, power: powerKw + 0.5 },
      { timestamp: '08:20', minute: 20, machine_id: machineId, temperature: normTemp + 6.0, vibration: isoVib + 0.6, rpm: ratedRpm - 10, power: powerKw + 0.8 },
    ],
  };
}

/**
 * Dynamically synthesizes sensor telemetry curves derived from Step 1 input extraction.
 * Reflects the extracted machine asset, warmup timing, vibration anomaly, and thermal parameters.
 */
export function generateTelemetryFromExtraction(extraction: ExtractionResult, machine?: Machine) {
  const machineId = extraction.machine_id || machine?.machine_id || 'M001';
  const normTemp = machine?.baseline_metrics?.normal_temp_c ?? 42.0;
  const isoVib = machine?.baseline_metrics?.iso_vibration_limit ?? 2.2;
  const normVib = machine?.baseline_metrics?.normal_vibration_mms ?? 1.1;
  const ratedRpm = machine?.baseline_metrics?.rated_rpm ?? 3000;
  const powerKw = machine?.baseline_metrics?.power_baseline_kw ?? 15.0;

  const warmup = Math.max(5, extraction.warmup_minutes || 20);
  const totalPoints = 8;
  const stepMins = Math.max(2, Math.round(warmup / 4));
  const breachIndex = 4; // Anomaly triggers around step 4

  const hasThermal = Boolean(
    extraction.extracted_parameters?.temperature_sensitivity ||
    extraction.extracted_parameters?.thermal_expansion_likely ||
    (extraction.symptoms || []).some((s) => /temp|thermal|heat|warm/i.test(s))
  );

  const hasRpmDrift = Boolean(
    extraction.extracted_parameters?.rpm_drift ||
    (extraction.symptoms || []).some((s) => /rpm|speed|slip/i.test(s))
  );

  const rows: SensorReading[] = [];
  const times = ['08:00', '08:05', '08:10', '08:15', '08:20', '08:25', '08:30', '08:35'];

  for (let i = 0; i < totalPoints; i++) {
    const minute = i * stepMins;
    const time = times[i] || `08:${String(minute).padStart(2, '0')}`;
    let vib = normVib;
    let temp = normTemp;
    let rpm = ratedRpm;
    let power = powerKw;

    if (i < breachIndex) {
      vib = normVib + i * 0.08;
      temp = normTemp + i * 1.1;
    } else {
      const breachFactor = i - breachIndex + 1;
      vib = isoVib + 0.35 + breachFactor * 0.22;
      temp = normTemp + 5.0 + (hasThermal ? breachFactor * 3.8 : breachFactor * 1.2);
      rpm = hasRpmDrift ? ratedRpm - breachFactor * 18 : ratedRpm - 2;
      power = powerKw + breachFactor * 0.9;
    }

    rows.push({
      timestamp: time,
      minute,
      machine_id: machineId,
      temperature: Number(temp.toFixed(1)),
      vibration: Number(vib.toFixed(2)),
      rpm: Math.round(rpm),
      power: Number(power.toFixed(1)),
    });
  }

  const csvHeader = 'timestamp,machine_id,temperature,vibration,rpm,power\n';
  const csvBody = rows
    .map((r) => `${r.timestamp},${r.machine_id},${r.temperature},${r.vibration},${r.rpm},${r.power}`)
    .join('\n');

  return {
    rows,
    csv: csvHeader + csvBody,
    fileName: `${machineId.toLowerCase()}_extracted_telemetry.csv`,
  };
}

/**
 * Fetch all machines from Central Database.
 * Returns only live records from Firestore; never falls back to local seed data.
 */
export async function fetchMachines(): Promise<Machine[]> {
  try {
    const snap = await getDocs(collection(db, 'machines'));
    if (!snap.empty) {
      const sanitized = snap.docs
        .map((d) => {
          const data = d.data();
          if (!data) return null;
          const machineId = String(data.machine_id || d.id || '').trim();
          if (!machineId) return null;

          return {
            machine_id: machineId,
            name: data.name || `Machine Asset ${machineId}`,
            model: data.model || 'Standard Industrial Unit',
            subsystem_type: data.subsystem_type || 'custom',
            location: data.location || 'Plant Floor',
            manufacturer: data.manufacturer || 'Industrial Automation OEM',
            status: data.status === 'warning' || data.status === 'critical' || data.status === 'maintenance' ? data.status : 'nominal',
            baseline_metrics: {
              normal_temp_c: Number(data.baseline_metrics?.normal_temp_c ?? 45.0),
              max_temp_c: Number(data.baseline_metrics?.max_temp_c ?? 65.0),
              normal_vibration_mms: Number(data.baseline_metrics?.normal_vibration_mms ?? 1.2),
              iso_vibration_limit: Number(data.baseline_metrics?.iso_vibration_limit ?? 2.2),
              rated_rpm: Number(data.baseline_metrics?.rated_rpm ?? 3000),
              power_baseline_kw: Number(data.baseline_metrics?.power_baseline_kw ?? 15.0),
              iso_standard: data.baseline_metrics?.iso_standard || 'ISO 10816-3:2009',
              iso_group: data.baseline_metrics?.iso_group || 'Group 2',
              foundation_type: data.baseline_metrics?.foundation_type || 'rigid',
              vibration_zone_a: Number(data.baseline_metrics?.vibration_zone_a ?? 1.1),
              vibration_zone_b: Number(data.baseline_metrics?.vibration_zone_b ?? 1.8),
              vibration_zone_c_alert: Number(data.baseline_metrics?.vibration_zone_c_alert ?? 2.8),
              vibration_zone_d_danger: Number(data.baseline_metrics?.vibration_zone_d_danger ?? 4.5),
              primary_parameter_label: data.baseline_metrics?.primary_parameter_label || 'Operating Pressure',
              primary_parameter_value: data.baseline_metrics?.primary_parameter_value ?? 'Nominal',
              primary_parameter_unit: data.baseline_metrics?.primary_parameter_unit || '',
              secondary_parameter_label: data.baseline_metrics?.secondary_parameter_label || 'Tolerance',
              secondary_parameter_value: data.baseline_metrics?.secondary_parameter_value ?? 'Standard',
              secondary_parameter_unit: data.baseline_metrics?.secondary_parameter_unit || '',
              tertiary_parameter_label: data.baseline_metrics?.tertiary_parameter_label || 'Lube Parameter',
              tertiary_parameter_value: data.baseline_metrics?.tertiary_parameter_value ?? 'Verified',
              tertiary_parameter_unit: data.baseline_metrics?.tertiary_parameter_unit || '',
            },
            installed_date: data.installed_date || new Date().toISOString().split('T')[0],
            asset_criticality: data.asset_criticality || 'IMPORTANT_B',
            description: data.description || '',
          } as Machine;
        })
        .filter((m): m is Machine => Boolean(m && m.machine_id));

      return sanitized;
    }
  } catch (err) {
    console.warn('Central database fetchMachines failed (no local fallback):', err);
    throw err;
  }
  return [];
}

/**
 * Register a new plant machine asset directly into Central Database
 */
export async function addMachineToFirestore(machine: Machine): Promise<Machine> {
  await setDoc(doc(db, 'machines', machine.machine_id), cleanFirestoreData(machine));
  return machine;
}

/**
 * Update an existing plant machine asset in Central Database
 */
export async function updateMachineInFirestore(machine: Machine): Promise<Machine> {
  await setDoc(doc(db, 'machines', machine.machine_id), cleanFirestoreData(machine), { merge: true });
  return machine;
}

/**
 * Delete a machine asset and associated incident references from Central Database
 */
export async function deleteMachineFromFirestore(machineId: string): Promise<void> {
  await deleteDoc(doc(db, 'machines', machineId));
}

/**
 * Fetch all incidents from Central Database.
 * Returns only live records from Firestore; never falls back to local seed data.
 */
export async function fetchIncidents(): Promise<Incident[]> {
  try {
    const q = query(collection(db, 'incidents'), orderBy('date', 'desc'));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const sanitized = snap.docs
        .map((d) => {
          const data = d.data();
          if (!data) return null;
          const incidentId = String(data.incident_id || d.id || '').trim();
          if (!incidentId) return null;

          return {
            incident_id: incidentId,
            date: data.date || new Date().toISOString().split('T')[0],
            machine_id: String(data.machine_id || 'M001'),
            symptom: data.symptom || 'Vibration onset after warmup',
            cause: data.cause || 'Mechanical misalignment',
            repair: data.repair || 'Targeted component realign / replacement',
            downtime: Number(data.downtime || 0),
            status: data.status || 'resolved',
            notes: data.notes || '',
            verified_by: data.verified_by || undefined,
            outcome: data.outcome || undefined,
            verification_media: data.verification_media || undefined,
          } as Incident;
        })
        .filter((i): i is Incident => Boolean(i && i.incident_id));

      return sanitized;
    }
  } catch (err) {
    console.warn('Central database fetchIncidents failed (no local fallback):', err);
    throw err;
  }
  return [];
}

/**
 * Fetch all institutional knowledge from Central Database.
 * Returns only live records from Firestore; never falls back to local seed data.
 */
export async function fetchKnowledge(): Promise<KnowledgeItem[]> {
  try {
    const snap = await getDocs(collection(db, 'knowledge'));
    if (!snap.empty) {
      const sanitized = snap.docs
        .map((d) => {
          const data = d.data();
          if (!data) return null;
          const knowledgeId = String(data.knowledge_id || d.id || '').trim();
          if (!knowledgeId) return null;

          return {
            knowledge_id: knowledgeId,
            machine_id: String(data.machine_id || 'M001'),
            type: data.type || 'technician_tip',
            title: data.title || 'Operational Heuristic',
            content: data.content || '',
            source: data.source || 'Technician Field Knowledge',
            created_by: data.created_by || 'Plant Technician',
            confidence: Number(data.confidence ?? 0.9),
            created_at: data.created_at || new Date().toISOString(),
            tags: Array.isArray(data.tags) ? data.tags : [],
            media: data.media || undefined,
          } as KnowledgeItem;
        })
        .filter((k): k is KnowledgeItem => Boolean(k && k.knowledge_id));

      sanitized.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return sanitized;
    }
  } catch (err) {
    console.warn('Central database fetchKnowledge failed (no local fallback):', err);
    throw err;
  }
  return [];
}

/**
 * Commit new extracted technician knowledge directly to Central Database
 */
export async function saveExtractedKnowledgeToFirestore(
  item: Omit<KnowledgeItem, 'knowledge_id' | 'created_at'>
): Promise<KnowledgeItem> {
  const newId = `KNOW-${Date.now().toString().slice(-4)}`;
  const fullItem: KnowledgeItem = {
    ...item,
    knowledge_id: newId,
    created_at: new Date().toISOString(),
  };

  await setDoc(doc(db, 'knowledge', newId), cleanFirestoreData(fullItem));
  return fullItem;
}

/**
 * Add or update knowledge and tips directly into Central Database
 */
export async function addKnowledgeToFirestore(
  item: (Omit<KnowledgeItem, 'knowledge_id' | 'created_at'> & { knowledge_id?: string; created_at?: string }) | KnowledgeItem
): Promise<KnowledgeItem> {
  const id = item.knowledge_id || `KNOW-${Date.now().toString().slice(-4)}`;
  const fullItem: KnowledgeItem = {
    ...item,
    knowledge_id: id,
    created_at: item.created_at || new Date().toISOString(),
  };

  await setDoc(doc(db, 'knowledge', id), cleanFirestoreData(fullItem), { merge: true });
  console.log(`Knowledge item ${id} committed to Firestore collection /knowledge.`);
  return fullItem;
}

/**
 * Delete a knowledge item from Central Database
 */
export async function deleteKnowledgeFromFirestore(knowledgeId: string): Promise<void> {
  await deleteDoc(doc(db, 'knowledge', knowledgeId));
  console.log(`Knowledge item ${knowledgeId} deleted from Firestore.`);
}

/**
 * Add or update an incident in Central Database
 */
export async function addIncidentToFirestore(incident: Incident): Promise<Incident> {
  await setDoc(doc(db, 'incidents', incident.incident_id), cleanFirestoreData(incident), { merge: true });
  console.log(`Incident ${incident.incident_id} saved in Firestore /incidents.`);
  return incident;
}

/**
 * Delete an incident from Central Database
 */
export async function deleteIncidentFromFirestore(incidentId: string): Promise<void> {
  await deleteDoc(doc(db, 'incidents', incidentId));
}

/**
 * Commit confirmed root cause & verification to Central Database
 */
export async function saveVerifiedResolutionToFirestore(params: {
  incident_id: string;
  machine_id: string;
  confirmed_cause: string;
  repair: string;
  downtime: number;
  notes: string;
  verified_by: string;
  outcome?: string;
  verification_media?: import('../types/industrial').VerificationMedia;
}): Promise<Incident> {
  const updatedIncident: Incident = {
    incident_id: params.incident_id,
    date: new Date().toISOString().split('T')[0],
    machine_id: params.machine_id,
    symptom: 'vibration onset after warmup',
    cause: params.confirmed_cause,
    repair: params.repair,
    downtime: params.downtime,
    status: 'verified',
    notes: `${params.notes} (Verified by ${params.verified_by})`,
    verified_by: params.verified_by,
    outcome: params.outcome || 'Production restored to nominal ISO 10816-3 baseline; avoided wasteful component teardown',
    verification_media: params.verification_media,
  };

  // 1. Commit incident update to database
  await setDoc(doc(db, 'incidents', params.incident_id), cleanFirestoreData(updatedIncident));

  // 2. Commit closed-loop learning post-mortem to database knowledge base
  const postMortemKnowledge: KnowledgeItem = {
    knowledge_id: `KNOW-PM-${Date.now().toString().slice(-4)}`,
    machine_id: params.machine_id,
    type: 'post_mortem',
    title: `Post-Mortem: ${params.machine_id} Resolved via Targeted Inspection`,
    content: `Confirmed Root Cause: ${params.confirmed_cause}. Repair: ${params.repair}. Actual Downtime: ${params.downtime} minutes. Verified by ${params.verified_by}. Notes: ${params.notes}`,
    source: `Technician Field Verification (${params.incident_id})`,
    created_by: params.verified_by,
    confidence: 0.99,
    created_at: new Date().toISOString(),
    tags: ['verified', 'closed-loop', params.machine_id, 'ISO 10816-3'],
    media: params.verification_media,
  };

  await setDoc(doc(db, 'knowledge', postMortemKnowledge.knowledge_id), cleanFirestoreData(postMortemKnowledge));

  // 3. Update machine status back to nominal
  try {
    const machineRef = doc(db, 'machines', params.machine_id);
    await updateDoc(machineRef, { status: 'nominal' });
  } catch (err) {
    console.warn('Machine status update note:', err);
  }

  return updatedIncident;
}

/**
 * Fetch all evidence items from Central Database with safe fallback
 */
export async function fetchEvidence(): Promise<EvidenceItem[]> {
  try {
    const snap = await getDocs(collection(db, 'evidence'));
    if (!snap.empty) {
      const sanitized = snap.docs
        .map((d) => {
          const data = d.data();
          if (!data) return null;
          return {
            evidence_id: String(data.evidence_id || d.id),
            incident_id: String(data.incident_id || ''),
            type: data.type || 'sensor_telemetry',
            source: data.source || 'Diagnostic Telemetry',
            content: data.content || '',
            relevance_score: Number(data.relevance_score ?? 0.9),
          } as EvidenceItem;
        })
        .filter((e): e is EvidenceItem => Boolean(e && e.evidence_id));

      return sanitized;
    }
  } catch (err) {
    console.warn('Central database fetchEvidence failed (no local fallback):', err);
    throw err;
  }
  return [];
}

/**
 * Fetch all technicians from Central Database.
 * Returns only live records from Firestore; never falls back to local seed data.
 */
export async function fetchTechnicians(): Promise<Technician[]> {
  try {
    const snap = await getDocs(collection(db, 'technicians'));
    if (!snap.empty) {
      const sanitized = snap.docs
        .map((d) => {
          const data = d.data();
          if (!data) return null;
          return {
            technician_id: String(data.technician_id || d.id),
            name: data.name || 'Technician',
            email: String(data.email || `${d.id.toLowerCase()}@promptnova.com`),
            role: data.role || 'Maintenance Specialist',
            skills: Array.isArray(data.skills) ? data.skills : [],
            experience: Number(data.experience ?? 5),
            shift: data.shift || 'Day Shift',
            avatar_url: data.avatar_url || '',
            last_login: data.last_login || new Date().toISOString(),
          } as Technician;
        })
        .filter((t): t is Technician => Boolean(t && t.technician_id));

      return sanitized;
    }
  } catch (err) {
    console.warn('Central database fetchTechnicians failed (no local fallback):', err);
    throw err;
  }
  return [];
}

/**
 * Save new evidence item to Central Database
 */
export async function addEvidenceToFirestore(item: EvidenceItem): Promise<EvidenceItem> {
  await setDoc(doc(db, 'evidence', item.evidence_id), cleanFirestoreData(item));
  return item;
}

/**
 * Server-side paginated fetch for Incident Investigations (10 per page, latest at top)
 */
export async function fetchIncidentsPage(pageSize = 10, lastDoc?: DocumentSnapshot | null): Promise<{
  incidents: Incident[];
  lastVisible: DocumentSnapshot | null;
  hasMore: boolean;
}> {
  try {
    const constraints: any[] = [orderBy('date', 'desc'), limit(pageSize + 1)];
    if (lastDoc) {
      constraints.push(startAfter(lastDoc));
    }
    const q = query(collection(db, 'incidents'), ...constraints);
    const snap = await getDocs(q);
    const docs = snap.docs;
    const hasMore = docs.length > pageSize;
    const pageDocs = hasMore ? docs.slice(0, pageSize) : docs;
    const lastVisible = pageDocs.length > 0 ? pageDocs[pageDocs.length - 1] : null;

    const incidents = pageDocs
      .map((d) => {
        const data = d.data();
        if (!data) return null;
        const incidentId = String(data.incident_id || d.id || '').trim();
        if (!incidentId) return null;

        return {
          incident_id: incidentId,
          date: data.date || new Date().toISOString().split('T')[0],
          machine_id: String(data.machine_id || 'M001'),
          symptom: data.symptom || 'Vibration onset after warmup',
          cause: data.cause || 'Mechanical misalignment',
          repair: data.repair || 'Targeted component realign / replacement',
          downtime: Number(data.downtime || 0),
          status: data.status || 'resolved',
          notes: data.notes || '',
          verified_by: data.verified_by || undefined,
          outcome: data.outcome || undefined,
          verification_media: data.verification_media || undefined,
        } as Incident;
      })
      .filter((i): i is Incident => Boolean(i && i.incident_id));

    return { incidents, lastVisible, hasMore };
  } catch (err) {
    console.warn('fetchIncidentsPage failed:', err);
    throw err;
  }
}

/**
 * Server-side paginated fetch for Machine Assets / Assessments Management (10 per page, latest at top)
 */
export async function fetchMachinesPage(pageSize = 10, lastDoc?: DocumentSnapshot | null): Promise<{
  machines: Machine[];
  lastVisible: DocumentSnapshot | null;
  hasMore: boolean;
}> {
  try {
    const constraints: any[] = [orderBy('installed_date', 'desc'), limit(pageSize + 1)];
    if (lastDoc) {
      constraints.push(startAfter(lastDoc));
    }
    const q = query(collection(db, 'machines'), ...constraints);
    const snap = await getDocs(q);
    const docs = snap.docs;
    const hasMore = docs.length > pageSize;
    const pageDocs = hasMore ? docs.slice(0, pageSize) : docs;
    const lastVisible = pageDocs.length > 0 ? pageDocs[pageDocs.length - 1] : null;

    const machines = pageDocs
      .map((d) => {
        const data = d.data();
        if (!data) return null;
        const machineId = String(data.machine_id || d.id || '').trim();
        if (!machineId) return null;

        return {
          machine_id: machineId,
          name: data.name || `Machine Asset ${machineId}`,
          model: data.model || 'Standard Industrial Unit',
          subsystem_type: data.subsystem_type || 'custom',
          location: data.location || 'Plant Floor',
          manufacturer: data.manufacturer || 'Industrial Automation OEM',
          status: data.status === 'warning' || data.status === 'critical' || data.status === 'maintenance' ? data.status : 'nominal',
          baseline_metrics: {
            normal_temp_c: Number(data.baseline_metrics?.normal_temp_c ?? 45.0),
            max_temp_c: Number(data.baseline_metrics?.max_temp_c ?? 65.0),
            normal_vibration_mms: Number(data.baseline_metrics?.normal_vibration_mms ?? 1.2),
            iso_vibration_limit: Number(data.baseline_metrics?.iso_vibration_limit ?? 2.2),
            rated_rpm: Number(data.baseline_metrics?.rated_rpm ?? 3000),
            power_baseline_kw: Number(data.baseline_metrics?.power_baseline_kw ?? 15.0),
            iso_standard: data.baseline_metrics?.iso_standard || 'ISO 10816-3:2009',
            iso_group: data.baseline_metrics?.iso_group || 'Group 2',
            foundation_type: data.baseline_metrics?.foundation_type || 'rigid',
            vibration_zone_a: Number(data.baseline_metrics?.vibration_zone_a ?? 1.1),
            vibration_zone_b: Number(data.baseline_metrics?.vibration_zone_b ?? 1.8),
            vibration_zone_c_alert: Number(data.baseline_metrics?.vibration_zone_c_alert ?? 2.8),
            vibration_zone_d_danger: Number(data.baseline_metrics?.vibration_zone_d_danger ?? 4.5),
          },
          installed_date: data.installed_date || new Date().toISOString().split('T')[0],
          asset_criticality: data.asset_criticality || 'IMPORTANT_B',
          description: data.description || '',
        } as Machine;
      })
      .filter((m): m is Machine => Boolean(m && m.machine_id));

    return { machines, lastVisible, hasMore };
  } catch (err) {
    console.warn('fetchMachinesPage failed:', err);
    throw err;
  }
}

/**
 * Server-side paginated fetch for Institutional Memory / Knowledge Items (10 per page, latest at top)
 */
export async function fetchKnowledgePage(pageSize = 10, lastDoc?: DocumentSnapshot | null): Promise<{
  knowledge: KnowledgeItem[];
  lastVisible: DocumentSnapshot | null;
  hasMore: boolean;
}> {
  try {
    const constraints: any[] = [orderBy('created_at', 'desc'), limit(pageSize + 1)];
    if (lastDoc) {
      constraints.push(startAfter(lastDoc));
    }
    const q = query(collection(db, 'knowledge'), ...constraints);
    const snap = await getDocs(q);
    const docs = snap.docs;
    const hasMore = docs.length > pageSize;
    const pageDocs = hasMore ? docs.slice(0, pageSize) : docs;
    const lastVisible = pageDocs.length > 0 ? pageDocs[pageDocs.length - 1] : null;

    const knowledge = pageDocs
      .map((d) => {
        const data = d.data();
        if (!data) return null;
        const knowledgeId = String(data.knowledge_id || d.id || '').trim();
        if (!knowledgeId) return null;

        return {
          knowledge_id: knowledgeId,
          machine_id: String(data.machine_id || 'M001'),
          type: data.type || 'technician_tip',
          title: data.title || 'Operational Heuristic',
          content: data.content || '',
          source: data.source || 'Technician Field Knowledge',
          created_by: data.created_by || 'Plant Technician',
          confidence: Number(data.confidence ?? 0.9),
          created_at: data.created_at || new Date().toISOString(),
          tags: Array.isArray(data.tags) ? data.tags : [],
          media: data.media || undefined,
        } as KnowledgeItem;
      })
      .filter((k): k is KnowledgeItem => Boolean(k && k.knowledge_id));

    return { knowledge, lastVisible, hasMore };
  } catch (err) {
    console.warn('fetchKnowledgePage failed:', err);
    throw err;
  }
}

