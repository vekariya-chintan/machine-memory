export type IsoMachineGroup = 'Group 1' | 'Group 2' | 'Group 3' | 'Group 4';
export type FoundationType = 'rigid' | 'flexible';

export type AssetSubsystemType =
  | 'cnc_spindle'
  | 'hydraulic_pump'
  | 'planetary_gearbox'
  | 'coolant_pump'
  | 'power_generator'
  | 'custom';

export interface BaselineMetrics {
  normal_temp_c: number;
  max_temp_c: number;
  normal_vibration_mms: number;
  iso_vibration_limit: number;
  rated_rpm: number;
  power_baseline_kw: number;

  // ISO 10816-3 Vibration Severity Classification
  iso_standard?: string; // e.g. 'ISO 10816-3:2009'
  iso_group?: IsoMachineGroup; // Group 1 (>300kW), Group 2 (15-300kW), Group 3 (Pumps with separate driver), Group 4 (Pumps integrated)
  foundation_type?: FoundationType; // 'rigid' | 'flexible'
  vibration_zone_a?: number; // Zone A: Newly commissioned / Good (upper limit mm/s RMS)
  vibration_zone_b?: number; // Zone B: Acceptable for unrestricted continuous operation
  vibration_zone_c_alert?: number; // Zone C: Alert / Unsatisfactory for long-term operation
  vibration_zone_d_danger?: number; // Zone D: Danger / Trip threshold

  iso_zone_a_limit?: number;
  iso_zone_b_limit?: number;
  iso_zone_c_limit?: number;
  iso_zone_d_limit?: number;

  // Asset-Specific Operating Parameters (ISO & Mechanical Operating Baselines)
  primary_parameter_label?: string; // e.g. 'System Hydraulic Pressure', 'Clamping Force', 'Torsional Backlash', 'Discharge Pressure', 'Rated Voltage'
  primary_parameter_value?: string | number; // e.g. 210, 18, 0.8, 70, 480
  primary_parameter_unit?: string; // e.g. 'bar', 'kN', 'arcmin', 'bar', 'V'

  secondary_parameter_label?: string; // e.g. 'Fluid Viscosity Grade', 'Radial Runout Tolerance', 'Gear Mesh Frequency', 'Delivery Flow Rate', 'Power Factor'
  secondary_parameter_value?: string | number; // e.g. 'ISO VG 46', '0.003', '520', '45', '0.80'
  secondary_parameter_unit?: string; // e.g. 'cSt', 'mm', 'Hz', 'L/min', 'cos φ'

  tertiary_parameter_label?: string; // e.g. 'Return Line Delta-P', 'Lube Mist Pressure', 'Oil Bath Temperature', 'Filtration Rating', 'Stator Phase Imbalance'
  tertiary_parameter_value?: string | number; // e.g. '2.2', '2.8', '52.0', '15', '< 1.0'
  tertiary_parameter_unit?: string; // e.g. 'bar', 'bar', '°C', 'µm', '%'
}

export interface SubsystemKeyParam {
  name: string;
  baseline_value: string | number;
  unit: string;
  alert_threshold?: string;
}

export interface SubsystemParameters {
  subsystem_type?: AssetSubsystemType;
  key_parameters?: SubsystemKeyParam[];
}

export interface Machine {
  machine_id: string;
  name: string;
  model: string;
  subsystem_type?: AssetSubsystemType;
  location: string;
  manufacturer: string;
  status: 'nominal' | 'warning' | 'critical' | 'maintenance';
  baseline_metrics: BaselineMetrics;
  installed_date: string;
  iso_machine_group?: IsoMachineGroup;
  foundation_type?: FoundationType;
  subsystem_parameters?: SubsystemParameters;
  asset_criticality?: 'CRITICAL_A' | 'IMPORTANT_B' | 'GENERAL_C';
  description?: string;
}

export interface SensorReading {
  timestamp: string;
  minute: number;
  machine_id: string;
  temperature: number;
  vibration: number;
  rpm: number;
  power: number;
}

export interface VerificationMediaItem {
  id: string;
  type: 'photo' | 'video' | 'audio';
  url: string;
  name?: string;
  caption?: string;
  timestamp?: string;
}

export interface VerificationMedia {
  audio_url?: string;
  audio_note?: string;
  photos?: VerificationMediaItem[];
  video_url?: string;
  video_note?: string;
}

export interface Incident {
  incident_id: string;
  date: string;
  machine_id: string;
  symptom: string;
  cause: string;
  repair: string;
  downtime: number; // in minutes
  status: 'resolved' | 'investigating' | 'verified';
  sensor_snapshot?: SensorReading[];
  ai_hypotheses?: DiagnosticHypothesis[];
  notes?: string;
  verified_by?: string;
  outcome?: string;
  verification_media?: VerificationMedia;
}

export interface DiagnosticHypothesis {
  id: string;
  rank: number;
  cause: string;
  confidence_pct: number;
  why_not_alternative: string;
  evidence_chain: string[];
}

export interface RecommendedAction {
  step: number;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  action: string;
  tool: string;
}

export interface KnowledgeItem {
  knowledge_id: string;
  machine_id: string;
  type: 'technician_tip' | 'oem_manual' | 'post_mortem';
  title: string;
  content: string;
  source: string;
  created_by: string;
  confidence: number;
  created_at: string;
  tags: string[];
  media?: VerificationMedia;
}

export interface Technician {
  technician_id: string;
  name: string;
  email: string;
  password_hash?: string;
  encrypted_password?: string;
  role: string;
  skills: string[];
  experience: number;
  shift: string;
  avatar_url?: string;
  last_login?: string;
}

export interface EvidenceItem {
  evidence_id: string;
  incident_id: string;
  type: 'sensor_telemetry' | 'technician_audio' | 'oem_specification' | 'past_incident';
  source: string;
  content: string;
  relevance_score: number;
}

export interface ExtractionResult {
  machine_id: string;
  machine_name: string;
  symptoms: string[];
  time_condition: string;
  warmup_minutes: number;
  recommended_inspection: string;
  proscribed_action: string;
  probable_root_cause: string;
  confidence_score: number;
  source_summary: string;
  extracted_parameters: {
    temperature_sensitivity: boolean;
    rpm_drift: boolean;
    thermal_expansion_likely: boolean;
  };
}
