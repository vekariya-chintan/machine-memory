import React, { useState, useEffect } from 'react';
import {
  X,
  Eye,
  EyeOff,
  UserPlus,
  AlertCircle,
  Plus,
} from 'lucide-react';
import { Technician } from '../types/industrial';
import {
  validateTechnicianForm,
  containsMaliciousPayload,
} from '../services/technicianService';

interface TechnicianFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (formData: {
    technician_id: string;
    name: string;
    email: string;
    role: string;
    shift: string;
    experience: number;
    skills: string[];
    password?: string;
  }) => Promise<boolean>;
  mode?: 'create' | 'edit';
  initialData?: Technician | null;
  existingTechnicians: Technician[];
}

const COMMON_ROLES = [
  'Lead Master Technician',
  'Reliability & Telemetry Engineer',
  'Junior Maintenance Specialist',
  'Plant Operations Director',
  'Vibration & FFT Metrology Specialist',
  'Hydraulics & Spindle Diagnostic Tech',
  'SCADA / Automation Systems Engineer',
  'Electrical & Drives Specialist',
  'Rotating Equipment Reliability Lead',
];

const COMMON_SHIFTS = [
  'Day Shift · Automated Machining Lines',
  'Swing Shift · Automated Machining Lines',
  'Night Shift · Autonomous Monitoring',
  'Day Shift · Plant Utility & Backup Systems',
  'Plant Operations & Engineering Leadership',
  'Rotating 12h Shift · Utility Systems',
  'Weekend Emergency Reliability Team',
];

const PRESET_SKILLS = [
  'ISO 10816-3 Compliance',
  'Spindle Alignment',
  'Vibration Analysis ISO-II',
  'Hydraulics',
  'CNC Metrology',
  'SCADA',
  'FFT Spectral Analysis',
  'Mechanical LOTO',
  'Coolant Filtration',
  'Thermography Level 1',
  'Dial Indicators',
  'Executive Reliability',
];

export const TechnicianFormModal: React.FC<TechnicianFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  mode = 'create',
  initialData = null,
  existingTechnicians,
}) => {
  const [technicianId, setTechnicianId] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState(COMMON_ROLES[0]);
  const [customRole, setCustomRole] = useState('');
  const [shift, setShift] = useState(COMMON_SHIFTS[0]);
  const [customShift, setCustomShift] = useState('');
  const [experience, setExperience] = useState<number | string>(5);
  const [skills, setSkills] = useState<string[]>([]);
  const [newSkillInput, setNewSkillInput] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize form fields for create or edit mode
  useEffect(() => {
    if (!isOpen) return;

    setErrors({});
    setGeneralError(null);
    setPassword('');

    if (mode === 'edit' && initialData) {
      setTechnicianId(initialData.technician_id);
      setName(initialData.name || '');
      setEmail(initialData.email || '');

      const isKnownRole = COMMON_ROLES.includes(initialData.role);
      if (isKnownRole) {
        setRole(initialData.role);
        setCustomRole('');
      } else {
        setRole('CUSTOM');
        setCustomRole(initialData.role || '');
      }

      const isKnownShift = COMMON_SHIFTS.includes(initialData.shift);
      if (isKnownShift) {
        setShift(initialData.shift);
        setCustomShift('');
      } else {
        setShift('CUSTOM');
        setCustomShift(initialData.shift || '');
      }

      setExperience(initialData.experience ?? 5);
      setSkills(Array.isArray(initialData.skills) ? [...initialData.skills] : []);
    } else {
      // Auto-generate next technician ID for create mode
      if (existingTechnicians.length > 0) {
        const numbers = existingTechnicians
          .map((t) => {
            const match = t.technician_id.match(/TECH-(\d+)/i);
            return match ? parseInt(match[1], 10) : 0;
          })
          .filter((n) => !isNaN(n));
        const nextNum = numbers.length > 0 ? Math.max(...numbers) + 1 : existingTechnicians.length + 1;
        const padded = String(nextNum).padStart(2, '0');
        setTechnicianId(`TECH-${padded}`);
      } else {
        setTechnicianId('TECH-01');
      }
      setName('');
      setEmail('');
      setRole(COMMON_ROLES[0]);
      setCustomRole('');
      setShift(COMMON_SHIFTS[0]);
      setCustomShift('');
      setExperience(5);
      setSkills(['Vibration Analysis ISO-II', 'Hydraulics']);
    }
  }, [isOpen, mode, initialData, existingTechnicians]);

  if (!isOpen) return null;

  // Real-time security and injection validation
  const handleInputChange = (field: string, val: string) => {
    if (containsMaliciousPayload(val)) {
      setErrors((prev) => ({
        ...prev,
        [field]: 'Malicious script or prohibited characters detected.',
      }));
    } else {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleAddSkill = (skillToAdd: string) => {
    const trimmed = (skillToAdd || '').trim();
    if (!trimmed) return;
    if (containsMaliciousPayload(trimmed)) {
      setErrors((prev) => ({ ...prev, skills: 'Prohibited characters in skill tag.' }));
      return;
    }
    if (skills.length >= 12) {
      setErrors((prev) => ({ ...prev, skills: 'Maximum of 12 skills allowed.' }));
      return;
    }
    if (!skills.includes(trimmed)) {
      setSkills((prev) => [...prev, trimmed]);
      setNewSkillInput('');
      setErrors((prev) => {
        const next = { ...prev };
        delete next.skills;
        return next;
      });
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setSkills((prev) => prev.filter((s) => s !== skillToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);

    const effectiveRole = role === 'CUSTOM' ? customRole.trim() : role;
    const effectiveShift = shift === 'CUSTOM' ? customShift.trim() : shift;

    const validation = validateTechnicianForm(
      {
        technician_id: technicianId,
        name,
        email,
        role: effectiveRole,
        shift: effectiveShift,
        experience,
        skills,
        password,
      },
      mode === 'edit',
      existingTechnicians
    );

    if (!validation.isValid) {
      setErrors(validation.errors);
      // Field validation messages are displayed below each field, so do not display error message at top of the form
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await onSave({
        technician_id: validation.sanitized.technician_id,
        name: validation.sanitized.name,
        email: validation.sanitized.email,
        role: validation.sanitized.role,
        shift: validation.sanitized.shift,
        experience: validation.sanitized.experience,
        skills: validation.sanitized.skills,
        password: validation.sanitized.password,
      });

      if (success) {
        onClose();
      }
    } catch (err: any) {
      setGeneralError(err?.message || 'Failed to save technician.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-950 text-cyan-400 border border-cyan-800/60">
              <UserPlus className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-slate-100">
              {mode === 'edit' ? 'Edit Technician' : 'Register Technician'}
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {generalError && (
            <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{generalError}</span>
            </div>
          )}

          {/* Row 1: Technician ID & Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1.5 font-semibold">
                TECHNICIAN ID <span className="text-cyan-400">*</span>
              </label>
              <input
                type="text"
                value={technicianId}
                onChange={(e) => {
                  const upper = e.target.value.toUpperCase();
                  setTechnicianId(upper);
                  handleInputChange('technician_id', upper);
                }}
                disabled={isSubmitting || mode === 'edit'}
                placeholder="e.g. TECH-05"
                className={`w-full px-3.5 py-2 rounded-lg bg-slate-950 border font-mono text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none transition-colors ${
                  mode === 'edit'
                    ? 'opacity-60 cursor-not-allowed border-slate-800'
                    : errors.technician_id
                    ? 'border-rose-500 focus:border-rose-500'
                    : 'border-slate-800 focus:border-cyan-500'
                }`}
              />
              {errors.technician_id && (
                <p className="mt-1 text-[11px] text-rose-400 font-mono">{errors.technician_id}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1.5 font-semibold">
                FULL NAME <span className="text-cyan-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  handleInputChange('name', e.target.value);
                }}
                disabled={isSubmitting}
                placeholder="e.g. Marcus Vance"
                className={`w-full px-3.5 py-2 rounded-lg bg-slate-950 border text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none transition-colors ${
                  errors.name ? 'border-rose-500 focus:border-rose-500' : 'border-slate-800 focus:border-cyan-500'
                }`}
              />
              {errors.name && (
                <p className="mt-1 text-[11px] text-rose-400 font-mono">{errors.name}</p>
              )}
            </div>
          </div>

          {/* Row 2: Email & Password */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1.5 font-semibold">
                EMAIL <span className="text-cyan-400">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  handleInputChange('email', e.target.value);
                }}
                disabled={isSubmitting}
                placeholder="e.g. marcus.vance@promptnova.com"
                className={`w-full px-3.5 py-2 rounded-lg bg-slate-950 border text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none transition-colors ${
                  errors.email ? 'border-rose-500 focus:border-rose-500' : 'border-slate-800 focus:border-cyan-500'
                }`}
              />
              {errors.email && (
                <p className="mt-1 text-[11px] text-rose-400 font-mono">{errors.email}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1.5 font-semibold">
                PASSWORD {mode === 'edit' && <span className="text-[10px] text-slate-400 font-normal">(Leave blank to keep unchanged)</span>}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    handleInputChange('password', e.target.value);
                  }}
                  disabled={isSubmitting}
                  placeholder={mode === 'edit' ? 'Blank = keep current password' : 'Blank = use default password'}
                  className={`w-full pl-3.5 pr-10 py-2 rounded-lg bg-slate-950 border font-mono text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none transition-colors ${
                    errors.password ? 'border-rose-500 focus:border-rose-500' : 'border-slate-800 focus:border-cyan-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-[11px] text-rose-400 font-mono">{errors.password}</p>
              )}
            </div>
          </div>

          {/* Row 3: Role & Shift */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1.5 font-semibold">
                ROLE <span className="text-cyan-400">*</span>
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                disabled={isSubmitting}
                className="w-full px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-cyan-500 transition-colors"
              >
                {COMMON_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
                <option value="CUSTOM">Custom Role...</option>
              </select>
              {role === 'CUSTOM' && (
                <input
                  type="text"
                  value={customRole}
                  onChange={(e) => {
                    setCustomRole(e.target.value);
                    handleInputChange('role', e.target.value);
                  }}
                  placeholder="Enter role..."
                  className="mt-2 w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              )}
              {errors.role && (
                <p className="mt-1 text-[11px] text-rose-400 font-mono">{errors.role}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-300 mb-1.5 font-semibold">
                SHIFT <span className="text-cyan-400">*</span>
              </label>
              <select
                value={shift}
                onChange={(e) => setShift(e.target.value)}
                disabled={isSubmitting}
                className="w-full px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-cyan-500 transition-colors"
              >
                {COMMON_SHIFTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
                <option value="CUSTOM">Custom Shift...</option>
              </select>
              {shift === 'CUSTOM' && (
                <input
                  type="text"
                  value={customShift}
                  onChange={(e) => {
                    setCustomShift(e.target.value);
                    handleInputChange('shift', e.target.value);
                  }}
                  placeholder="Enter shift..."
                  className="mt-2 w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              )}
              {errors.shift && (
                <p className="mt-1 text-[11px] text-rose-400 font-mono">{errors.shift}</p>
              )}
            </div>
          </div>

          {/* Row 4: Experience */}
          <div>
            <label className="block text-xs font-mono text-slate-300 mb-1.5 font-semibold">
              YEARS OF EXPERIENCE <span className="text-cyan-400">*</span>
            </label>
            <input
              type="number"
              min="0"
              max="60"
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              disabled={isSubmitting}
              className={`w-full px-3.5 py-2 rounded-lg bg-slate-950 border text-sm text-slate-100 font-mono focus:outline-none transition-colors ${
                errors.experience ? 'border-rose-500 focus:border-rose-500' : 'border-slate-800 focus:border-cyan-500'
              }`}
            />
            {errors.experience && (
              <p className="mt-1 text-[11px] text-rose-400 font-mono">{errors.experience}</p>
            )}
          </div>

          {/* Row 5: Skills */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-mono text-slate-300 font-semibold">
                SKILLS &amp; COMPETENCIES
              </label>
              {errors.skills && (
                <span className="text-[11px] text-rose-400 font-mono">{errors.skills}</span>
              )}
            </div>

            {/* Selected skill pills */}
            <div className="flex flex-wrap gap-1.5 p-2.5 rounded-lg bg-slate-950 border border-slate-800 min-h-[44px] items-center mb-2">
              {skills.length === 0 ? (
                <span className="text-xs text-slate-600">Select skills below or type custom skill.</span>
              ) : (
                skills.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-mono bg-cyan-950 text-cyan-300 border border-cyan-800/60"
                  >
                    <span>{skill}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSkill(skill)}
                      className="text-cyan-400/70 hover:text-rose-400 ml-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))
              )}
            </div>

            {/* Add skill input */}
            <div className="flex items-center gap-2 mb-2">
              <input
                type="text"
                value={newSkillInput}
                onChange={(e) => {
                  setNewSkillInput(e.target.value);
                  handleInputChange('new_skill', e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSkill(newSkillInput);
                  }
                }}
                placeholder="Type skill & press enter..."
                className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
              />
              <button
                type="button"
                onClick={() => handleAddSkill(newSkillInput)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>

            {/* Quick skill presets */}
            <div className="flex flex-wrap gap-1">
              {PRESET_SKILLS.map((preset) => {
                const isSelected = skills.includes(preset);
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        handleRemoveSkill(preset);
                      } else {
                        handleAddSkill(preset);
                      }
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono transition-all ${
                      isSelected
                        ? 'bg-cyan-950 text-cyan-300 border border-cyan-700'
                        : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    {isSelected ? '✓ ' : '+ '}
                    {preset}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Footer buttons */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-xs font-mono transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || Object.keys(errors).length > 0}
              className="px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs font-mono transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-md shadow-cyan-950/50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3 h-3 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>{mode === 'edit' ? 'Update Technician' : 'Register Technician'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
