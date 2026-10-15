import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
  query,
  orderBy,
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

// Plant Machinery Fleet for Automated 5-Axis CNC Manufacturing Machine Cell (5 Assets Starting from M001)
export const SEED_MACHINES: Machine[] = [
  {
    machine_id: 'M001',
    name: '5-Axis CNC High-Speed Main Electrospindle Unit',
    model: 'Kessler HSK-A63 Direct-Drive Electrospindle',
    subsystem_type: 'cnc_spindle',
    location: 'CNC Cell 1 · Milling Spindle Head & Z-Axis Column',
    manufacturer: 'Franz Kessler GmbH',
    status: 'warning',
    baseline_metrics: {
      normal_temp_c: 42.0,
      max_temp_c: 65.0,
      normal_vibration_mms: 1.1,
      iso_vibration_limit: 2.2, // ISO 10816-3 Class II / Group 2 Alert Threshold
      rated_rpm: 15000,
      power_baseline_kw: 35.0,
      iso_standard: 'ISO 10816-3:2009',
      iso_group: 'Group 2',
      foundation_type: 'rigid',
      vibration_zone_a: 1.1,
      vibration_zone_b: 1.8,
      vibration_zone_c_alert: 2.8,
      vibration_zone_d_danger: 4.5,
      primary_parameter_label: 'HSK Tool Clamping Force',
      primary_parameter_value: '18.0',
      primary_parameter_unit: 'kN',
      secondary_parameter_label: 'Radial Runout Tolerance',
      secondary_parameter_value: '0.003',
      secondary_parameter_unit: 'mm',
      tertiary_parameter_label: 'Oil-Air Lube Mist Pressure',
      tertiary_parameter_value: '2.8',
      tertiary_parameter_unit: 'bar',
    },
    installed_date: '2023-11-14',
    asset_criticality: 'CRITICAL_A',
    description: 'Primary high-speed milling spindle for 5-axis automated machining cell. Subject to thermal expansion and coupling dynamics.',
  },
  {
    machine_id: 'M002',
    name: 'High-Pressure Hydraulic Clamping & Tool-Changer Unit',
    model: 'Bosch Rexroth A10VSO 71DFR Variable Axial Piston Pump',
    subsystem_type: 'hydraulic_pump',
    location: 'CNC Cell 1 · Hydraulic Power Skid & Fixture Manifold',
    manufacturer: 'Bosch Rexroth',
    status: 'nominal',
    baseline_metrics: {
      normal_temp_c: 48.0,
      max_temp_c: 68.0,
      normal_vibration_mms: 1.4,
      iso_vibration_limit: 2.8, // ISO 10816-3 Group 3 (Pumps with separate driver)
      rated_rpm: 1750,
      power_baseline_kw: 18.5,
      iso_standard: 'ISO 10816-3:2009',
      iso_group: 'Group 3',
      foundation_type: 'rigid',
      vibration_zone_a: 1.4,
      vibration_zone_b: 2.3,
      vibration_zone_c_alert: 3.5,
      vibration_zone_d_danger: 4.5,
      primary_parameter_label: 'System Hydraulic Pressure',
      primary_parameter_value: '210',
      primary_parameter_unit: 'bar',
      secondary_parameter_label: 'Fluid Viscosity Grade',
      secondary_parameter_value: 'ISO VG 46',
      secondary_parameter_unit: 'cSt @ 40°C',
      tertiary_parameter_label: 'Return Line Delta-P',
      tertiary_parameter_value: '2.2',
      tertiary_parameter_unit: 'bar',
    },
    installed_date: '2022-08-20',
    asset_criticality: 'CRITICAL_A',
    description: 'Supplies continuous hydraulic pressure to automatic pallet clamp fixtures, B/C axis disc brakes, and automatic tool changer arm.',
  },
  {
    machine_id: 'M003',
    name: 'C-Axis Rotary Table Planetary Reduction Gearbox',
    model: 'Wittenstein TP+ 300 High-Precision Planetary Gearbox',
    subsystem_type: 'planetary_gearbox',
    location: 'CNC Cell 1 · Rotary Worktable Direct-Drive C-Axis',
    manufacturer: 'Wittenstein SE',
    status: 'nominal',
    baseline_metrics: {
      normal_temp_c: 52.0,
      max_temp_c: 74.0,
      normal_vibration_mms: 1.2,
      iso_vibration_limit: 2.5, // ISO 10816-3 Group 2 Medium Machinery
      rated_rpm: 2400,
      power_baseline_kw: 22.0,
      iso_standard: 'ISO 10816-3:2009',
      iso_group: 'Group 2',
      foundation_type: 'rigid',
      vibration_zone_a: 1.2,
      vibration_zone_b: 1.8,
      vibration_zone_c_alert: 2.8,
      vibration_zone_d_danger: 4.5,
      primary_parameter_label: 'Torsional Backlash Limit',
      primary_parameter_value: '0.8',
      primary_parameter_unit: 'arcmin',
      secondary_parameter_label: 'Gear Mesh Frequency (GMF)',
      secondary_parameter_value: '520',
      secondary_parameter_unit: 'Hz',
      tertiary_parameter_label: 'Oil Sump Temperature',
      tertiary_parameter_value: '52.0',
      tertiary_parameter_unit: '°C',
    },
    installed_date: '2023-04-12',
    asset_criticality: 'IMPORTANT_B',
    description: 'Precision reduction drive transmitting high torque to the 5-axis rotary table. Critical for sub-micron surface finish profiling.',
  },
  {
    machine_id: 'M004',
    name: 'Through-Spindle High-Pressure Coolant Delivery Pump',
    model: 'Grundfos MTH 4-12/12 Multistage Centrifugal Immersion Pump',
    subsystem_type: 'coolant_pump',
    location: 'CNC Cell 1 · High-Pressure Filtration Skid',
    manufacturer: 'Grundfos Industrial',
    status: 'nominal',
    baseline_metrics: {
      normal_temp_c: 32.0,
      max_temp_c: 48.0,
      normal_vibration_mms: 1.6,
      iso_vibration_limit: 3.2, // ISO 10816-3 Group 3 (Flexible mounting)
      rated_rpm: 2900,
      power_baseline_kw: 15.0,
      iso_standard: 'ISO 10816-3:2009',
      iso_group: 'Group 3',
      foundation_type: 'flexible',
      vibration_zone_a: 1.6,
      vibration_zone_b: 2.8,
      vibration_zone_c_alert: 4.5,
      vibration_zone_d_danger: 7.1,
      primary_parameter_label: 'Discharge Delivery Pressure',
      primary_parameter_value: '70',
      primary_parameter_unit: 'bar',
      secondary_parameter_label: 'Coolant Delivery Flow Rate',
      secondary_parameter_value: '45.0',
      secondary_parameter_unit: 'L/min',
      tertiary_parameter_label: 'Filtration Absolute Rating',
      tertiary_parameter_value: '15',
      tertiary_parameter_unit: 'µm',
    },
    installed_date: '2024-02-18',
    asset_criticality: 'IMPORTANT_B',
    description: 'Delivers 70 bar through-spindle coolant directly to drill and endmill flutes for continuous chip evacuation and thermal stabilization.',
  },
  {
    machine_id: 'M005',
    name: 'Auxiliary Plant Backup Diesel Power Generator & Sync Alternator',
    model: 'Cummins QSL9-G5 / Stamford UCI274 Alternator Set',
    subsystem_type: 'power_generator',
    location: 'Plant Utility Enclosure · Standby Generation Bay 1',
    manufacturer: 'Cummins Power Generation',
    status: 'nominal',
    baseline_metrics: {
      normal_temp_c: 80.0,
      max_temp_c: 98.0,
      normal_vibration_mms: 2.4,
      iso_vibration_limit: 4.5, // ISO 10816-3 Group 1 (>300 kW, Flexible foundation on isolators)
      rated_rpm: 1800,
      power_baseline_kw: 320.0,
      iso_standard: 'ISO 10816-3:2009',
      iso_group: 'Group 1',
      foundation_type: 'flexible',
      vibration_zone_a: 2.4,
      vibration_zone_b: 3.5,
      vibration_zone_c_alert: 5.3,
      vibration_zone_d_danger: 8.5,
      primary_parameter_label: 'Alternator 3-Phase Line Voltage',
      primary_parameter_value: '480',
      primary_parameter_unit: 'V',
      secondary_parameter_label: 'Rated Power Factor',
      secondary_parameter_value: '0.80',
      secondary_parameter_unit: 'cos φ',
      tertiary_parameter_label: 'Stator Phase Imbalance Limit',
      tertiary_parameter_value: '< 1.0',
      tertiary_parameter_unit: '%',
    },
    installed_date: '2022-01-10',
    asset_criticality: 'CRITICAL_A',
    description: 'Plant standby power generator backing up automated CNC cell spindle cooling, controls, and hydraulic unclamp during grid fluctuations.',
  },
];

export const SEED_INCIDENTS: Incident[] = [
  // M001 Incidents
  {
    incident_id: 'INC-001-A',
    date: '2026-02-12',
    machine_id: 'M001',
    symptom: 'vibration onset after 20-min warmup',
    cause: 'spindle flexible coupling misalignment',
    repair: 'realigned coupling jaws with dial indicator; torqued clamp bolts to 45 Nm',
    downtime: 42,
    status: 'resolved',
    notes: 'Radial offset measured 0.12mm after warm-up. Dial indicator alignment restored gap to within 0.02mm.',
  },
  {
    incident_id: 'INC-001-B',
    date: '2026-06-08',
    machine_id: 'M001',
    symptom: 'vibration chatter during finish passes',
    cause: 'elastomer spider insert cyclical wear',
    repair: 'replaced polyurethane spider insert',
    downtime: 67,
    status: 'resolved',
    notes: 'Polyurethane spider insert shredded from cyclical thermal expansion friction.',
  },
  // M002 Incidents
  {
    incident_id: 'INC-002-A',
    date: '2026-01-20',
    machine_id: 'M002',
    symptom: 'acoustic cavitation whine & suction pressure loss',
    cause: 'clogged dual-mesh suction strainer on hydraulic sump',
    repair: 'cleaned strainer mesh and purged air from hydraulic circuit',
    downtime: 38,
    status: 'resolved',
    notes: 'Inlet vacuum spiked to -0.38 bar due to aluminum swarf ingress into reservoir.',
  },
  {
    incident_id: 'INC-002-B',
    date: '2026-04-14',
    machine_id: 'M002',
    symptom: 'tool changer clamp cylinder slow motion',
    cause: 'proportional valve pilot orifice silted with micro-particulates',
    repair: 'ultrasonic cleaned pilot cartridge and renewed return line filter',
    downtime: 55,
    status: 'resolved',
    notes: 'Contamination index ISO 4406 reached 21/18/15; system flushed to 16/14/11.',
  },
  // M003 Incidents
  {
    incident_id: 'INC-003-A',
    date: '2026-03-04',
    machine_id: 'M003',
    symptom: 'high-frequency tooth chatter and temperature spike',
    cause: 'planetary carrier oil starvation and sheared sun gear keyway',
    repair: 'replaced planetary cartridge and flushed synthetic gear oil',
    downtime: 95,
    status: 'resolved',
    notes: 'Oil bath temp reached 78C; backlash widened from 0.8 to 2.4 arcmin before intervention.',
  },
  {
    incident_id: 'INC-003-B',
    date: '2026-07-19',
    machine_id: 'M003',
    symptom: 'C-axis rotary positioning drift during helical milling',
    cause: 'encoder coupling set-screw loose on input pin',
    repair: 're-torqued collar with threadlocker and verified laser interferometer index',
    downtime: 34,
    status: 'resolved',
    notes: 'Positional repeatability restored to +/- 0.002 degrees.',
  },
  // M004 Incidents
  {
    incident_id: 'INC-004-A',
    date: '2026-05-11',
    machine_id: 'M004',
    symptom: 'through-spindle coolant delivery pressure drop below 40 bar',
    cause: 'cyclone separator ceramic cone erosion allowing debris into impeller',
    repair: 'swapped ceramic hydrocyclone cone and replaced primary impeller wear ring',
    downtime: 60,
    status: 'resolved',
    notes: 'Discharge pressure restored to nominal 70 bar at 45 L/min flow.',
  },
  {
    incident_id: 'INC-004-B',
    date: '2026-08-02',
    machine_id: 'M004',
    symptom: 'coolant pump motor frame vibration flutter at 2900 RPM',
    cause: 'suction strainer cavitation from foaming water-soluble emulsion',
    repair: 'adjusted anti-foam additive ratio and cleaned immersion intake screen',
    downtime: 28,
    status: 'resolved',
    notes: 'Emulsion concentration was high at 14%; rebalanced to 8.5% with DI water.',
  },
  // M005 Incidents
  {
    incident_id: 'INC-005-A',
    date: '2026-02-28',
    machine_id: 'M005',
    symptom: 'alternator housing vibration surge and AVR voltage flicker under load',
    cause: 'rotating rectifier diode bridge leakage inducing 120 Hz magnetic imbalance',
    repair: 'tested exciter diodes and replaced failed forward diode set',
    downtime: 85,
    status: 'resolved',
    notes: 'Phase voltage imbalance cleared from 3.8% back down to 0.4%.',
  },
  {
    incident_id: 'INC-005-B',
    date: '2026-06-25',
    machine_id: 'M005',
    symptom: 'engine jacket water temperature escalation past 96C',
    cause: 'thermostatic bypass regulator valve sticking partially closed',
    repair: 'replaced dual thermostatic cartridges and pressure tested coolant loop',
    downtime: 45,
    status: 'resolved',
    notes: 'Engine operating temperature stabilized at 82C under 100% resistive load bank.',
  },
];

export const SEED_KNOWLEDGE: KnowledgeItem[] = [
  // M001 Knowledge
  {
    knowledge_id: 'KNOW-001',
    machine_id: 'M001',
    type: 'technician_tip',
    title: 'M001: Spindle Warmup & Coupling Misalignment Rule',
    content:
      'If M001 starts vibrating after about 20 minutes of runtime, do NOT order an expensive spindle bearing replacement. Inspect the spindle flexible coupling alignment and polyurethane elastomer spider insert first. Thermal axial growth pushes the coupling into angular bind.',
    source: 'Shop Floor Field Memo',
    created_by: 'Marcus Vance (Lead Master Tech · 18y)',
    confidence: 0.96,
    created_at: '2026-06-14T09:30:00Z',
    tags: ['warmup', 'vibration', 'coupling', 'spindle', 'ISO 10816-3'],
  },
  {
    knowledge_id: 'KNOW-002',
    machine_id: 'M001',
    type: 'oem_manual',
    title: 'Kessler HSK-A63 OEM Maintenance Manual - Section 4.3',
    content:
      'Drive Shaft Coupling Thermal Expansion: Under continuous high-speed operation exceeding 18 minutes, the electrospindle shaft experiences 0.04-0.08mm axial growth. Clamp bolts must be torqued to 45 Nm. Misaligned couplings exhibit 1X/2X rotational vibration exceeding 2.2 mm/s while maintaining normal drive RPM.',
    source: 'Kessler OEM Maintenance Manual Rev 4.2',
    created_by: 'Franz Kessler Technical Services',
    confidence: 0.99,
    created_at: '2024-01-10T00:00:00Z',
    tags: ['oem', 'specifications', 'thermal expansion', 'torque', 'ISO 10816-3'],
  },
  // M002 Knowledge
  {
    knowledge_id: 'KNOW-003',
    machine_id: 'M002',
    type: 'technician_tip',
    title: 'M002: Hydraulic Cavitation vs Pump Mechanical Failure Rule',
    content:
      'If Hydraulic Pump M002 starts emitting a high-pitched cavitation whine during rapid tool-change cycles, check the dual-mesh suction strainer on the sump before unbolting the hydraulic pump. 9 times out of 10 it is swarf buildup starving the inlet.',
    source: 'Reliability Engineer Log',
    created_by: 'Elena Rostova (Reliability Engineer · 7y)',
    confidence: 0.95,
    created_at: '2026-05-12T14:15:00Z',
    tags: ['cavitation', 'hydraulic', 'strainer', 'pump', 'ISO 10816-3'],
  },
  {
    knowledge_id: 'KNOW-004',
    machine_id: 'M002',
    type: 'oem_manual',
    title: 'Rexroth A10VSO OEM Technical Specification - Section 5.1',
    content:
      'Inlet Filtration Requirements: Nominal system pressure 210 bar. Suction vacuum must not exceed -0.2 bar. Swarf accumulation on suction strainer induces cavitation erosion on cylinder block barrel. Flush strainer mesh every 300 operating hours.',
    source: 'Bosch Rexroth Technical Manual',
    created_by: 'Bosch Rexroth Engineering',
    confidence: 0.99,
    created_at: '2023-08-01T00:00:00Z',
    tags: ['oem', 'hydraulic', 'pressure', 'filtration', 'ISO 10816-3'],
  },
  // M003 Knowledge
  {
    knowledge_id: 'KNOW-005',
    machine_id: 'M003',
    type: 'technician_tip',
    title: 'M003: Planetary Gearbox High-Frequency Mesh Chatter Heuristic',
    content:
      'When Gearbox M003 triggers high-frequency vibration during heavy C-axis milling, verify oil sump synthetic viscosity (ISO VG 220) and measure torsional backlash before dismounting the gearbox. Low oil film thickness induces high gear mesh frequency harmonics.',
    source: 'Shop Floor Field Memo',
    created_by: 'Marcus Vance (Lead Master Tech · 18y)',
    confidence: 0.94,
    created_at: '2026-06-20T11:00:00Z',
    tags: ['gearbox', 'planetary', 'vibration', 'backlash', 'ISO 10816-3'],
  },
  {
    knowledge_id: 'KNOW-006',
    machine_id: 'M003',
    type: 'oem_manual',
    title: 'Wittenstein TP+ Planetary Service Guide - Section 3.4',
    content:
      'Planetary Gearbox Operating Limits: Torsional backlash must not exceed 0.8 arc-min. Gear mesh frequency harmonics at 2400 RPM rated input should not exceed 2.5 mm/s RMS under ISO 10816-3 Group 2 limits. Use synthetic polyalphaolefin (PAO) gear lubricant.',
    source: 'Wittenstein Engineering Documentation',
    created_by: 'Wittenstein SE Application Engineering',
    confidence: 0.98,
    created_at: '2023-04-15T00:00:00Z',
    tags: ['oem', 'gearbox', 'vibration', 'tolerances', 'ISO 10816-3'],
  },
  // M004 Knowledge
  {
    knowledge_id: 'KNOW-007',
    machine_id: 'M004',
    type: 'technician_tip',
    title: 'M004: Coolant Delivery Pressure Drop vs Impeller Wear Rule',
    content:
      'When Through-Spindle Coolant Pump M004 experiences pressure drop below 50 bar, check the 15-micron suction filter canister and pressure relief valve seal before replacing the multi-stage impeller. A clogged pre-filter creates severe impeller cavitation flutter.',
    source: 'Shop Floor Field Memo',
    created_by: 'Marcus Vance (Lead Master Tech · 18y)',
    confidence: 0.94,
    created_at: '2026-06-20T11:00:00Z',
    tags: ['coolant', 'pump', 'filtration', 'pressure drop', 'ISO 10816-3'],
  },
  {
    knowledge_id: 'KNOW-008',
    machine_id: 'M004',
    type: 'oem_manual',
    title: 'Grundfos MTH High-Pressure Service Manual - Section 7.2',
    content:
      'Centrifugal Immersion Pump Maintenance: Rated discharge 70 bar at 2900 RPM. Under ISO 10816-3 Group 3 (Flexible mounting), alert vibration threshold is 3.2 mm/s RMS. Ensure minimum net positive suction head (NPSH) of 2.5 m to prevent hydraulic impeller cavitation.',
    source: 'Grundfos Industrial Pump Manual',
    created_by: 'Grundfos Systems Engineering',
    confidence: 0.99,
    created_at: '2024-03-01T00:00:00Z',
    tags: ['oem', 'coolant pump', 'pressure', 'NPSH', 'ISO 10816-3'],
  },
  // M005 Knowledge
  {
    knowledge_id: 'KNOW-009',
    machine_id: 'M005',
    type: 'technician_tip',
    title: 'M005: Generator 120 Hz Vibration vs Bearing Fault Rule',
    content:
      'On Backup Generator M005, if casing vibration surges at 120 Hz (twice line frequency) under load, inspect the rotating rectifier diode pack and exciter stator before ordering main bearing teardown. A shorted diode produces an asymmetrical magnetic field that mimics bearing mechanical unbalance.',
    source: 'Reliability Engineer Log',
    created_by: 'Elena Rostova (Reliability Engineer · 7y)',
    confidence: 0.95,
    created_at: '2026-05-30T16:20:00Z',
    tags: ['generator', 'alternator', 'rectifier', 'vibration', 'ISO 10816-3'],
  },
  {
    knowledge_id: 'KNOW-010',
    machine_id: 'M005',
    type: 'oem_manual',
    title: 'Cummins / Stamford Alternator Technical Reference - Section 2.8',
    content:
      'Standby Generator Set Specifications: Rated output 320 kW (400 kVA) at 1800 RPM. Under ISO 10816-3 Group 1 (Flexible foundation on vibration isolators), Zone C alert limit is 4.5 mm/s RMS. Stator winding temperature must not exceed 98C under continuous prime rating.',
    source: 'Cummins Generator Systems Engineering',
    created_by: 'Cummins Power Systems',
    confidence: 0.98,
    created_at: '2023-09-12T00:00:00Z',
    tags: ['oem', 'generator', 'alternator', 'temperature', 'ISO 10816-3'],
  },
];

// Universal SHA-256 encrypted password for "Pass@123#"
export const PASS_123_SHA256_HASH = '8f96e4df9c1044432a13ee1d7e80fcfc3196fcbe0e49aa9b794121b689df9ccf';

export const SEED_TECHNICIANS: Technician[] = [
  {
    technician_id: 'TECH-01',
    name: 'Marcus Vance',
    email: 'marcus.vance@promptnova.com',
    password_hash: PASS_123_SHA256_HASH,
    encrypted_password: PASS_123_SHA256_HASH,
    role: 'Lead Master Technician',
    skills: ['Spindle Alignment', 'Vibration Analysis ISO-II', 'Hydraulics', 'CNC Metrology'],
    experience: 18,
    shift: 'Day Shift · Automated Machining Lines',
    avatar_url: '',
    last_login: '2026-10-14T08:00:00Z',
  },
  {
    technician_id: 'TECH-02',
    name: 'Elena Rostova',
    email: 'elena.rostova@promptnova.com',
    password_hash: PASS_123_SHA256_HASH,
    encrypted_password: PASS_123_SHA256_HASH,
    role: 'Reliability & Telemetry Engineer',
    skills: ['SCADA', 'FFT Spectral Analysis', 'ISO 10816-3 Compliance', 'Hydraulic Circuits'],
    experience: 7,
    shift: 'Swing Shift · Automated Machining Lines',
    avatar_url: '',
    last_login: '2026-10-14T07:30:00Z',
  },
  {
    technician_id: 'TECH-03',
    name: 'David Chen',
    email: 'david.chen@promptnova.com',
    password_hash: PASS_123_SHA256_HASH,
    encrypted_password: PASS_123_SHA256_HASH,
    role: 'Junior Maintenance Specialist',
    skills: ['Mechanical LOTO', 'Preventive Maintenance', 'Dial Indicators', 'Coolant Filtration'],
    experience: 2,
    shift: 'Day Shift · Plant Utility & Backup Systems',
    avatar_url: '',
    last_login: '2026-10-14T06:45:00Z',
  },
  {
    technician_id: 'TECH-04',
    name: 'Chintan Vekariya',
    email: 'chintanvekariya023@gmail.com',
    password_hash: PASS_123_SHA256_HASH,
    encrypted_password: PASS_123_SHA256_HASH,
    role: 'Plant Operations Director',
    skills: ['Executive Reliability', 'Autonomous RCA', 'Predictive Fleet Optimization', 'ISO Audits'],
    experience: 12,
    shift: 'Plant Operations & Engineering Leadership',
    avatar_url: '',
    last_login: '2026-10-14T08:15:00Z',
  },
];

export const SEED_EVIDENCE: EvidenceItem[] = [
  {
    evidence_id: 'EVI-001',
    incident_id: 'INC-001-A',
    type: 'sensor_telemetry',
    source: 'Kessler HSK-A63 Radial Accelerometer',
    content: 'Radial 1X/2X vibration harmonic exceeded 2.7 mm/s after 20 minutes warmup under thermal axial growth.',
    relevance_score: 0.98,
  },
  {
    evidence_id: 'EVI-002',
    incident_id: 'INC-001-B',
    type: 'sensor_telemetry',
    source: 'Milling Head High-Res Accelerometer',
    content: 'Chatter frequencies at 840 Hz correlated directly with polyurethane elastomer spider insert mechanical backlash.',
    relevance_score: 0.95,
  },
  {
    evidence_id: 'EVI-003',
    incident_id: 'INC-002-A',
    type: 'technician_audio',
    source: 'Hydraulic Skid Ultrasound Diagnostic Probe',
    content: 'Cavitation acoustic broadband noise detected at suction port matching 40 kHz acoustic signature due to swarf clogging.',
    relevance_score: 0.96,
  },
  {
    evidence_id: 'EVI-004',
    incident_id: 'INC-003-A',
    type: 'sensor_telemetry',
    source: 'C-Axis Rotary Gearbox Telemetry Transducer',
    content: 'High gear mesh frequency harmonics (520 Hz) accompanied by temperature spike to 78°C from synthetic oil starvation.',
    relevance_score: 0.94,
  },
  {
    evidence_id: 'EVI-005',
    incident_id: 'INC-004-A',
    type: 'sensor_telemetry',
    source: 'Through-Spindle Coolant Delivery Transducer',
    content: 'Line discharge delivery pressure dropped below 40 bar at 45 L/min flow due to ceramic hydrocyclone cone erosion.',
    relevance_score: 0.93,
  },
  {
    evidence_id: 'EVI-006',
    incident_id: 'INC-005-A',
    type: 'sensor_telemetry',
    source: 'Generator Alternator Current Waveform Analyzer',
    content: '120 Hz magnetic imbalance detected in exciter stator current waveform due to rotating rectifier forward diode failure.',
    relevance_score: 0.97,
  },
];

// Telemetry datasets mapped by machine_id (M001 to M005)
export const MACHINE_TELEMETRY_DATASETS: Record<string, { csv: string; rows: SensorReading[]; defaultMemo: string }> = {
  M001: {
    defaultMemo:
      'Machine M001 starts vibrating after about 20 minutes of runtime. Before replacing the bearing, check the spindle flexible coupling alignment and elastomer jaw wear. We had this exact problem twice.',
    csv: `timestamp,machine_id,temperature,vibration,rpm,power
08:00,M001,42.1,1.1,12000,18.2
08:05,M001,45.3,1.2,11995,18.4
08:10,M001,49.8,1.4,12002,18.7
08:15,M001,55.4,2.3,11980,19.5
08:20,M001,62.8,2.7,11950,20.8`,
    rows: [
      { timestamp: '08:00', minute: 0, machine_id: 'M001', temperature: 42.1, vibration: 1.1, rpm: 12000, power: 18.2 },
      { timestamp: '08:05', minute: 5, machine_id: 'M001', temperature: 45.3, vibration: 1.2, rpm: 11995, power: 18.4 },
      { timestamp: '08:10', minute: 10, machine_id: 'M001', temperature: 49.8, vibration: 1.4, rpm: 12002, power: 18.7 },
      { timestamp: '08:15', minute: 15, machine_id: 'M001', temperature: 55.4, vibration: 2.3, rpm: 11980, power: 19.5 },
      { timestamp: '08:20', minute: 20, machine_id: 'M001', temperature: 62.8, vibration: 2.7, rpm: 11950, power: 20.8 },
    ],
  },
  M002: {
    defaultMemo:
      'Hydraulic Unit M002 has suction pressure fluctuations and pump cavitation whining under peak clamping load. Check the dual-mesh suction strainer on the sump before unbolting the hydraulic pump.',
    csv: `timestamp,machine_id,temperature,vibration,rpm,power
08:00,M002,48.0,1.4,1750,18.5
08:05,M002,50.2,1.5,1748,18.8
08:10,M002,53.4,1.8,1751,19.2
08:15,M002,58.7,2.9,1745,21.0
08:20,M002,66.1,3.4,1738,22.8`,
    rows: [
      { timestamp: '08:00', minute: 0, machine_id: 'M002', temperature: 48.0, vibration: 1.4, rpm: 1750, power: 18.5 },
      { timestamp: '08:05', minute: 5, machine_id: 'M002', temperature: 50.2, vibration: 1.5, rpm: 1748, power: 18.8 },
      { timestamp: '08:10', minute: 10, machine_id: 'M002', temperature: 53.4, vibration: 1.8, rpm: 1751, power: 19.2 },
      { timestamp: '08:15', minute: 15, machine_id: 'M002', temperature: 58.7, vibration: 2.9, rpm: 1745, power: 21.0 },
      { timestamp: '08:20', minute: 20, machine_id: 'M002', temperature: 66.1, vibration: 3.4, rpm: 1738, power: 22.8 },
    ],
  },
  M003: {
    defaultMemo:
      'Gearbox M003 exhibits high-frequency tooth chatter and thermal buildup past 72C during heavy indexing cuts. Check synthetic gear lube viscosity and backlash clearance before ordering a whole planetary cartridge teardown.',
    csv: `timestamp,machine_id,temperature,vibration,rpm,power
08:00,M003,52.0,1.2,2400,22.0
08:05,M003,54.8,1.3,2398,22.3
08:10,M003,58.4,1.6,2402,22.8
08:15,M003,64.2,2.6,2390,24.1
08:20,M003,73.5,2.9,2385,25.8`,
    rows: [
      { timestamp: '08:00', minute: 0, machine_id: 'M003', temperature: 52.0, vibration: 1.2, rpm: 2400, power: 22.0 },
      { timestamp: '08:05', minute: 5, machine_id: 'M003', temperature: 54.8, vibration: 1.3, rpm: 2398, power: 22.3 },
      { timestamp: '08:10', minute: 10, machine_id: 'M003', temperature: 58.4, vibration: 1.6, rpm: 2402, power: 22.8 },
      { timestamp: '08:15', minute: 15, machine_id: 'M003', temperature: 64.2, vibration: 2.6, rpm: 2390, power: 24.1 },
      { timestamp: '08:20', minute: 20, machine_id: 'M003', temperature: 73.5, vibration: 2.9, rpm: 2385, power: 25.8 },
    ],
  },
  M004: {
    defaultMemo:
      'Through-Spindle Coolant Pump M004 has discharge pressure drop and impeller flutter at 2900 RPM. Inspect the 15-micron suction filter canister and pressure relief valve seal before replacing the pump motor.',
    csv: `timestamp,machine_id,temperature,vibration,rpm,power
08:00,M004,32.0,1.6,2900,15.0
08:05,M004,33.4,1.7,2898,15.2
08:10,M004,35.8,1.9,2901,15.5
08:15,M004,40.1,3.4,2892,16.8
08:20,M004,46.2,3.8,2880,17.9`,
    rows: [
      { timestamp: '08:00', minute: 0, machine_id: 'M004', temperature: 32.0, vibration: 1.6, rpm: 2900, power: 15.0 },
      { timestamp: '08:05', minute: 5, machine_id: 'M004', temperature: 33.4, vibration: 1.7, rpm: 2898, power: 15.2 },
      { timestamp: '08:10', minute: 10, machine_id: 'M004', temperature: 35.8, vibration: 1.9, rpm: 2901, power: 15.5 },
      { timestamp: '08:15', minute: 15, machine_id: 'M004', temperature: 40.1, vibration: 3.4, rpm: 2892, power: 16.8 },
      { timestamp: '08:20', minute: 20, machine_id: 'M004', temperature: 46.2, vibration: 3.8, rpm: 2880, power: 17.9 },
    ],
  },
  M005: {
    defaultMemo:
      'Standby Generator M005 exhibits housing vibration surge and AVR voltage flicker under 320 kW load bank testing. Check rotating rectifier diodes and exciter winding insulation before stripping down the main generator bearings.',
    csv: `timestamp,machine_id,temperature,vibration,rpm,power
08:00,M005,80.0,2.4,1800,320.0
08:05,M005,81.5,2.5,1799,321.2
08:10,M005,84.1,2.8,1801,323.5
08:15,M005,89.6,4.7,1795,330.1
08:20,M005,96.4,5.1,1790,338.4`,
    rows: [
      { timestamp: '08:00', minute: 0, machine_id: 'M005', temperature: 80.0, vibration: 2.4, rpm: 1800, power: 320.0 },
      { timestamp: '08:05', minute: 5, machine_id: 'M005', temperature: 81.5, vibration: 2.5, rpm: 1799, power: 321.2 },
      { timestamp: '08:10', minute: 10, machine_id: 'M005', temperature: 84.1, vibration: 2.8, rpm: 1801, power: 323.5 },
      { timestamp: '08:15', minute: 15, machine_id: 'M005', temperature: 89.6, vibration: 4.7, rpm: 1795, power: 330.1 },
      { timestamp: '08:20', minute: 20, machine_id: 'M005', temperature: 96.4, vibration: 5.1, rpm: 1790, power: 338.4 },
    ],
  },
};

export const DEMO_SENSOR_CSV = MACHINE_TELEMETRY_DATASETS.M001.csv;
export const DEMO_SENSOR_ROWS = MACHINE_TELEMETRY_DATASETS.M001.rows;

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

    // 9. Technicians are secured server-side in auth registry
    try {
      for (const t of SEED_TECHNICIANS) {
        await setDoc(doc(db, 'technicians', t.technician_id), cleanFirestoreData(t));
      }
    } catch {
      // Ignored: technicians collection is secured against client-side writes
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
 * Initializes database with general fleet machinery (M001-M005) and historical institutional memory.
 */
export async function initializeFirestoreDatabase(): Promise<void> {
  try {
    const machinesCol = collection(db, 'machines');
    const existingMachines = await getDocs(machinesCol);

    const docIds = existingMachines.docs.map((d) => d.id);
    const needsInit = existingMachines.empty || !docIds.includes('M001') || docIds.includes('M017');

    if (needsInit) {
      await clearAndResetFleetToM001();
    }
  } catch (error) {
    console.error('Error during database initialization:', error);
  }
}

export function getMachineDataset(machineId: string, machine?: Machine) {
  if (MACHINE_TELEMETRY_DATASETS[machineId]) {
    return MACHINE_TELEMETRY_DATASETS[machineId];
  }
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
 * Fetch all machines from Central Database with safe property normalization and fallback
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

      if (sanitized.length > 0) {
        return sanitized;
      }
    }
  } catch (err) {
    console.warn('Central database fetchMachines error, falling back to seed:', err);
  }
  return SEED_MACHINES;
}

/**
 * Register a new plant machine asset directly into Central Database
 */
export async function addMachineToFirestore(machine: Machine): Promise<Machine> {
  try {
    await setDoc(doc(db, 'machines', machine.machine_id), cleanFirestoreData(machine));
  } catch (err) {
    console.error('Failed to create machine asset in database:', err);
  }
  return machine;
}

/**
 * Update an existing plant machine asset in Central Database
 */
export async function updateMachineInFirestore(machine: Machine): Promise<Machine> {
  try {
    await setDoc(doc(db, 'machines', machine.machine_id), cleanFirestoreData(machine), { merge: true });
  } catch (err) {
    console.error('Failed to update machine asset in database:', err);
  }
  return machine;
}

/**
 * Delete a machine asset and associated incident references from Central Database
 */
export async function deleteMachineFromFirestore(machineId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'machines', machineId));
  } catch (err) {
    console.error('Failed to delete machine asset from database:', err);
  }
}

/**
 * Fetch all incidents from Central Database with safe fallback
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

      if (sanitized.length > 0) {
        return sanitized;
      }
    }
  } catch (err) {
    console.warn('Central database fetchIncidents error, falling back to seed:', err);
  }
  return SEED_INCIDENTS;
}

/**
 * Fetch all institutional knowledge from Central Database with safe fallback
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

      if (sanitized.length > 0) {
        return sanitized;
      }
    }
  } catch (err) {
    console.warn('Central database fetchKnowledge error, falling back to seed:', err);
  }
  return SEED_KNOWLEDGE;
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

  try {
    await setDoc(doc(db, 'knowledge', newId), cleanFirestoreData(fullItem));
  } catch (err) {
    console.error('Failed to write knowledge item to database:', err);
  }

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

  try {
    await setDoc(doc(db, 'knowledge', id), cleanFirestoreData(fullItem), { merge: true });
    console.log(`Knowledge item ${id} committed to Firestore collection /knowledge.`);
  } catch (err) {
    console.error('Failed to write knowledge item to database:', err);
  }

  return fullItem;
}

/**
 * Delete a knowledge item from Central Database
 */
export async function deleteKnowledgeFromFirestore(knowledgeId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'knowledge', knowledgeId));
    console.log(`Knowledge item ${knowledgeId} deleted from Firestore.`);
  } catch (err) {
    console.error('Failed to delete knowledge item from database:', err);
  }
}

/**
 * Add or update an incident in Central Database
 */
export async function addIncidentToFirestore(incident: Incident): Promise<Incident> {
  try {
    await setDoc(doc(db, 'incidents', incident.incident_id), cleanFirestoreData(incident), { merge: true });
    console.log(`Incident ${incident.incident_id} saved in Firestore /incidents.`);
  } catch (err) {
    console.error('Failed to save incident to database:', err);
  }
  return incident;
}

/**
 * Delete an incident from Central Database
 */
export async function deleteIncidentFromFirestore(incidentId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'incidents', incidentId));
  } catch (err) {
    console.error('Failed to delete incident from database:', err);
  }
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
  try {
    await setDoc(doc(db, 'incidents', params.incident_id), cleanFirestoreData(updatedIncident));
  } catch (err) {
    console.error('Error saving verified incident to database:', err);
  }

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

  try {
    await setDoc(doc(db, 'knowledge', postMortemKnowledge.knowledge_id), cleanFirestoreData(postMortemKnowledge));
  } catch (err) {
    console.error('Error saving post-mortem to database:', err);
  }

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

      if (sanitized.length > 0) {
        return sanitized;
      }
    }
  } catch (err) {
    console.warn('Central database fetchEvidence error, falling back to seed:', err);
  }
  return SEED_EVIDENCE;
}

/**
 * Fetch all technicians from Central Database with safe fallback
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
            password_hash: String(data.password_hash || data.encrypted_password || PASS_123_SHA256_HASH),
            encrypted_password: String(data.encrypted_password || data.password_hash || PASS_123_SHA256_HASH),
            role: data.role || 'Maintenance Specialist',
            skills: Array.isArray(data.skills) ? data.skills : [],
            experience: Number(data.experience ?? 5),
            shift: data.shift || 'Day Shift',
            avatar_url: data.avatar_url || '',
            last_login: data.last_login || new Date().toISOString(),
          } as Technician;
        })
        .filter((t): t is Technician => Boolean(t && t.technician_id));

      if (sanitized.length > 0) {
        return sanitized;
      }
    }
  } catch (err) {
    console.warn('Central database fetchTechnicians error, falling back to seed:', err);
  }
  return SEED_TECHNICIANS;
}

/**
 * Save new evidence item to Central Database
 */
export async function addEvidenceToFirestore(item: EvidenceItem): Promise<EvidenceItem> {
  try {
    await setDoc(doc(db, 'evidence', item.evidence_id), cleanFirestoreData(item));
  } catch (err) {
    console.error('Failed to add evidence item to database:', err);
  }
  return item;
}

