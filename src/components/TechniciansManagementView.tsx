import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Mail,
  Clock,
  Briefcase,
  Award,
  Layers,
  X,
  Edit,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { Technician } from '../types/industrial';
import {
  fetchTechniciansFromDatabase,
  addTechnicianToDatabase,
  updateTechnicianInDatabase,
  deleteTechnicianFromDatabase,
} from '../services/technicianService';
import { TechnicianFormModal } from './TechnicianFormModal';

interface TechniciansManagementViewProps {
  authenticatedTechnician?: Technician | null;
  onNotification?: (notification: { message: string; type: 'error' | 'success' | 'info' }) => void;
  onSessionTechnicianUpdated?: (updatedTech: Technician) => void;
}

export const TechniciansManagementView: React.FC<TechniciansManagementViewProps> = ({
  authenticatedTechnician,
  onNotification,
  onSessionTechnicianUpdated,
}) => {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedShift, setSelectedShift] = useState<string>('ALL');
  const [selectedRole, setSelectedRole] = useState<string>('ALL');

  // Registration & Edit modal state
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTechnician, setEditingTechnician] = useState<Technician | null>(null);

  // Delete confirm modal state
  const [deletingTechnician, setDeletingTechnician] = useState<Technician | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load technicians from database
  const loadTechnicians = async () => {
    setIsLoading(true);
    try {
      const data = await fetchTechniciansFromDatabase();
      setTechnicians(data);
    } catch (err: any) {
      console.warn('Technician directory load notice:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTechnicians();
  }, []);

  // Filtered technicians
  const filteredTechnicians = useMemo(() => {
    return technicians.filter((tech) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        tech.name.toLowerCase().includes(q) ||
        tech.technician_id.toLowerCase().includes(q) ||
        tech.email.toLowerCase().includes(q) ||
        tech.role.toLowerCase().includes(q) ||
        tech.shift.toLowerCase().includes(q) ||
        tech.skills.some((s) => s.toLowerCase().includes(q));

      const matchesShift = selectedShift === 'ALL' || tech.shift === selectedShift;
      const matchesRole = selectedRole === 'ALL' || tech.role === selectedRole;

      return matchesSearch && matchesShift && matchesRole;
    });
  }, [technicians, searchQuery, selectedShift, selectedRole]);

  // Unique shifts for filter
  const availableShifts = useMemo(() => {
    const set = new Set(technicians.map((t) => t.shift).filter(Boolean));
    return Array.from(set).sort();
  }, [technicians]);

  // Unique roles for filter
  const availableRoles = useMemo(() => {
    const set = new Set(technicians.map((t) => t.role).filter(Boolean));
    return Array.from(set).sort();
  }, [technicians]);

  // Handle registration submission
  const handleRegisterSave = async (formData: {
    technician_id: string;
    name: string;
    email: string;
    role: string;
    shift: string;
    experience: number;
    skills: string[];
    password?: string;
  }): Promise<boolean> => {
    const res = await addTechnicianToDatabase(formData, technicians);
    if (!res.success || !res.technician) {
      if (onNotification) {
        onNotification({
          message: res.error || 'Failed to register technician.',
          type: 'error',
        });
      }
      return false;
    }

    setTechnicians((prev) => {
      const updated = [...prev, res.technician!];
      updated.sort((a, b) => a.technician_id.localeCompare(b.technician_id));
      return updated;
    });

    if (onNotification) {
      onNotification({
        message: `Technician "${res.technician.name}" (${res.technician.technician_id}) registered successfully.`,
        type: 'success',
      });
    }

    setIsRegisterModalOpen(false);
    return true;
  };

  // Handle edit submission
  const handleEditSave = async (formData: {
    technician_id: string;
    name: string;
    email: string;
    role: string;
    shift: string;
    experience: number;
    skills: string[];
    password?: string;
  }): Promise<boolean> => {
    if (!editingTechnician) return false;

    const res = await updateTechnicianInDatabase(editingTechnician.technician_id, formData, technicians);
    if (!res.success || !res.technician) {
      if (onNotification) {
        onNotification({
          message: res.error || 'Failed to update technician.',
          type: 'error',
        });
      }
      return false;
    }

    const updatedTech = res.technician;

    setTechnicians((prev) => {
      const updated = prev.map((t) => (t.technician_id === updatedTech.technician_id ? updatedTech : t));
      updated.sort((a, b) => a.technician_id.localeCompare(b.technician_id));
      return updated;
    });

    // Update active session technician if editing current logged-in user
    if (
      authenticatedTechnician &&
      authenticatedTechnician.technician_id === updatedTech.technician_id &&
      onSessionTechnicianUpdated
    ) {
      onSessionTechnicianUpdated(updatedTech);
    }

    if (onNotification) {
      onNotification({
        message: `Technician "${updatedTech.name}" (${updatedTech.technician_id}) updated successfully.`,
        type: 'success',
      });
    }

    setIsEditModalOpen(false);
    setEditingTechnician(null);
    return true;
  };

  // Handle delete execution
  const confirmDeleteTechnician = async () => {
    if (!deletingTechnician) return;

    setIsDeleting(true);
    try {
      const res = await deleteTechnicianFromDatabase(
        deletingTechnician.technician_id,
        authenticatedTechnician?.technician_id,
        technicians.length
      );

      if (!res.success) {
        if (onNotification) {
          onNotification({
            message: res.error || 'Failed to delete technician.',
            type: 'error',
          });
        }
        return;
      }

      setTechnicians((prev) => prev.filter((t) => t.technician_id !== deletingTechnician.technician_id));

      if (onNotification) {
        onNotification({
          message: `Technician "${deletingTechnician.name}" (${deletingTechnician.technician_id}) deleted.`,
          type: 'info',
        });
      }

      setDeletingTechnician(null);
    } catch (err: any) {
      if (onNotification) {
        onNotification({
          message: err?.message || 'Error deleting technician.',
          type: 'error',
        });
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 pt-1 pb-6 space-y-4">
      {/* Top Bar: Title & Add Registration Button Only */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-cyan-950/60 border border-cyan-800/60 text-cyan-400">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-100 tracking-tight">
                Plant Technicians
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-slate-800 text-xs font-mono font-medium text-slate-300">
                {technicians.length}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Plant maintenance personnel and engineering directory
            </p>
          </div>
        </div>

        {/* Add Registration Button */}
        <button
          onClick={() => setIsRegisterModalOpen(true)}
          className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs font-mono transition-all shadow-[0_0_12px_rgba(6,182,212,0.35)] shrink-0 self-start sm:self-center cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>Register Technician</span>
        </button>
      </div>

      {/* Filters Only Bar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
        {/* Search */}
        <div className="md:col-span-6 relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, ID, email, role, or skill..."
            className="w-full pl-10 pr-10 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Shift Filter */}
        <div className="md:col-span-3 relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
            <Clock className="w-3.5 h-3.5" />
          </div>
          <select
            value={selectedShift}
            onChange={(e) => setSelectedShift(e.target.value)}
            className="w-full pl-9 pr-8 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-cyan-500 transition-colors appearance-none cursor-pointer"
          >
            <option value="ALL">All Shifts</option>
            {availableShifts.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <Filter className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
        </div>

        {/* Role Filter */}
        <div className="md:col-span-3 relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
            <Briefcase className="w-3.5 h-3.5" />
          </div>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="w-full pl-9 pr-8 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm text-slate-200 focus:outline-none focus:border-cyan-500 transition-colors appearance-none cursor-pointer"
          >
            <option value="ALL">All Roles</option>
            {availableRoles.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <Filter className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
        </div>
      </div>

      {/* Listing */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 rounded-xl bg-slate-900/30 border border-slate-800 space-y-3">
          <div className="w-8 h-8 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
          <p className="text-sm font-mono text-slate-400">Loading technicians...</p>
        </div>
      ) : filteredTechnicians.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 rounded-xl bg-slate-900/30 border border-slate-800 text-center space-y-3">
          <div className="p-3 rounded-full bg-slate-800/60 text-slate-500">
            <Users className="w-8 h-8" />
          </div>
          <h3 className="text-base font-semibold text-slate-200">No technicians found</h3>
          <p className="text-xs text-slate-400 max-w-sm">
            {searchQuery || selectedShift !== 'ALL' || selectedRole !== 'ALL'
              ? 'No technicians matched your filter criteria. Try adjusting your search query or filters.'
              : 'The technicians directory is currently empty. Click "Register Technician" to add one.'}
          </p>
          {(searchQuery || selectedShift !== 'ALL' || selectedRole !== 'ALL') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedShift('ALL');
                setSelectedRole('ALL');
              }}
              className="text-xs font-mono text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
          {filteredTechnicians.map((tech) => {
            const initials = tech.name
              .split(' ')
              .map((p) => p[0])
              .filter(Boolean)
              .slice(0, 2)
              .join('')
              .toUpperCase();

            return (
              <div
                key={tech.technician_id}
                className="flex flex-col justify-between p-5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-slate-700 transition-all shadow-sm group"
              >
                <div className="space-y-4">
                  {/* Top card row: Name, Avatar, ID, Action Buttons */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-900/80 to-slate-800 border border-cyan-800/60 flex items-center justify-center text-cyan-300 font-mono font-bold text-sm shadow-inner shrink-0">
                        {initials || 'TC'}
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-slate-100 leading-snug">
                          {tech.name}
                        </h2>
                        <span className="text-xs font-medium text-cyan-400">
                          {tech.role}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 border border-slate-700/60">
                        {tech.technician_id}
                      </span>

                      {/* Edit Button */}
                      <button
                        onClick={() => {
                          setEditingTechnician(tech);
                          setIsEditModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-cyan-950 hover:text-cyan-300 border border-slate-700/60 text-slate-400 transition-colors cursor-pointer"
                        title={`Edit ${tech.name}`}
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete Button */}
                      <button
                        onClick={() => setDeletingTechnician(tech)}
                        className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-rose-950 hover:text-rose-400 border border-slate-700/60 text-slate-400 transition-colors cursor-pointer"
                        title={`Delete ${tech.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Details grid: Email, Shift, Experience */}
                  <div className="space-y-2 text-xs text-slate-300">
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="font-mono text-slate-300 truncate">{tech.email}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="text-slate-400">{tech.shift}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Award className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="text-slate-400">
                        Experience: <strong className="text-slate-200">{tech.experience} years</strong>
                      </span>
                    </div>
                  </div>

                  {/* Skills badges */}
                  {tech.skills && tech.skills.length > 0 && (
                    <div className="pt-2 border-t border-slate-800/80">
                      <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400 mb-2">
                        <Layers className="w-3 h-3 text-cyan-500" />
                        <span>Core Competencies:</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {tech.skills.map((skill, idx) => (
                          <span
                            key={idx}
                            className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-950 text-slate-300 border border-slate-800"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Registration Modal */}
      {isRegisterModalOpen && (
        <TechnicianFormModal
          isOpen={isRegisterModalOpen}
          onClose={() => setIsRegisterModalOpen(false)}
          onSave={handleRegisterSave}
          mode="create"
          existingTechnicians={technicians}
        />
      )}

      {/* Edit Modal */}
      {isEditModalOpen && editingTechnician && (
        <TechnicianFormModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingTechnician(null);
          }}
          onSave={handleEditSave}
          mode="edit"
          initialData={editingTechnician}
          existingTechnicians={technicians}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingTechnician && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-slate-900 border border-rose-800/60 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-950 text-rose-400 border border-rose-800/60">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">Confirm Technician Deletion</h3>
                <p className="text-xs text-slate-400 font-mono">{deletingTechnician.technician_id}</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to delete <strong className="text-slate-100">{deletingTechnician.name}</strong>? This action will permanently remove their records.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDeletingTechnician(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-xs font-mono transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteTechnician}
                disabled={isDeleting}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs font-mono transition-colors flex items-center gap-2 cursor-pointer shadow-md shadow-rose-950/50"
              >
                {isDeleting ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete Technician</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
