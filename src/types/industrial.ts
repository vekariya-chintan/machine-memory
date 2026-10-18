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
  iso_standard?: string;
  iso_group?: IsoMachineGroup;
  foundation_type?: FoundationType;
  vibration_zone_a?: number;
  vibration_zone_b?: number;
  vibration_zone_c_alert?: number;
  vibration_zone_d_danger?: number;

  iso_zone_a_limit?: number;
  iso_zone_b_limit?: number;
  iso_zone_c_limit?: number;
  iso_zone_d_limit?: number;

  // Asset-Specific Operating Parameters
  primary_parameter_label?: string;
  primary_parameter_value?: string | number;
  primary_parameter_unit?: string;

  secondary_parameter_label?: string;
  secondary_parameter_value?: string | number;
  secondary_parameter_unit?: string;

  tertiary_parameter_label?: string;
  tertiary_parameter_value?: string | number;
  tertiary_parameter_unit?: string;
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
  subsystem_id?: string;
  location: string;
  manufacturer: string;
  status: 'nominal' | 'warning' | 'critical' | 'maintenance';
  baseline_metrics: BaselineMetrics;
  installed_date: string;
  iso_machine_group?: IsoMachineGroup;
  iso_group_id?: string;
  foundation_type?: FoundationType;
  foundation_type_id?: string;
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
  tool?: string;
}

export interface ExtractionResult {
  machine_id: string;
  machine_name: string;
  symptoms: string[];
  time_condition: string;
  warmup_minutes?: number;
  recommended_inspection: string;
  proscribed_action: string;
  probable_root_cause?: string;
  confidence_score: number;
  source_summary?: string;
  extracted_parameters?: {
    temperature_sensitivity?: boolean;
    rpm_drift?: boolean;
    thermal_expansion_likely?: boolean;
  };
  // Repository answer produced alongside the extraction, so the memory browser
  // can display it without spending a second AI request
  institutional_answer?: string;
}

export interface KnowledgeItem {
  knowledge_id: string;
  machine_id: string;
  title: string;
  content: string;
  type: string;
  type_id?: string;
  knowledge_type_id?: string;
  author?: string;
  created_by?: string;
  source?: string;
  confidence?: number;
  confidence_score?: number;
  created_at: string;
  verified?: boolean;
  related_incident_ids?: string[];
  tags?: string[];
  media?: any;
}

export interface EvidenceItem {
  evidence_id: string;
  incident_id: string;
  type: string;
  source: string;
  content: string;
  relevance_score?: number;
  created_at?: string;
}

export interface User {
  technician_id: string;
  name: string;
  email: string;
  role: string;
  role_id?: string;
  skills: string[];
  skill_ids?: string[];
  experience: number;
  shift: string;
  shift_id?: string;
  avatar_url?: string;
  last_login?: string;
  created_at?: string;
  updated_at?: string;
  password_hash?: string;
}

export type Technician = User;
