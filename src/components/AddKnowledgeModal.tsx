import React, { useState } from 'react';
import { X, BookOpen, Sparkles, CheckCircle2, AlertCircle, Database, Plus } from 'lucide-react';
import { Machine, KnowledgeItem } from '../types/industrial';
import { validateKnowledgeInput } from '../lib/securityValidation';

interface AddKnowledgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (newItem: Omit<KnowledgeItem, 'knowledge_id' | 'created_at'>) => Promise<void>;
  machines: Machine[];
  defaultMachineId?: string;
  defaultCreatedBy?: string;
}

export const AddKnowledgeModal: React.FC<AddKnowledgeModalProps> = ({
  isOpen,
  onClose,
  onSave,
  machines,
  defaultMachineId = 'M001',
  defaultCreatedBy,
}) => {
  const [machineId, setMachineId] = useState(defaultMachineId !== 'all' && defaultMachineId !== 'ALL' ? defaultMachineId : (machines[0]?.machine_id || 'M001'));
  const [type, setType] = useState<KnowledgeItem['type']>('technician_tip');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [source, setSource] = useState('Technician Field Experience');
  const [createdBy, setCreatedBy] = useState(defaultCreatedBy || 'Shop Floor Specialist');
  const [confidence, setConfidence] = useState(0.95);
  const [tagsString, setTagsString] = useState('vibration, maintenance, heuristic');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const tags = tagsString
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const rawPayload = {
      machine_id: machineId,
      type,
      title,
      content,
      source: source || 'Technician Field Memo',
      created_by: createdBy || 'Plant Technician',
      confidence: Number(confidence),
      tags: tags.length > 0 ? tags : ['heuristic', machineId],
    };

    const validation = validateKnowledgeInput(rawPayload);
    if (!validation.isValid) {
      const firstErr = Object.values(validation.errors)[0];
      setError(firstErr);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave(validation.sanitized);
      // Reset form
      setTitle('');
      setContent('');
      onClose();
    } catch (err: any) {
      console.error('Error adding knowledge:', err);
      setError(err?.message || 'Failed to save knowledge.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedMachine = machines.find((m) => m.machine_id === machineId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-950/80 border border-cyan-800 text-cyan-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-100">
                Add New Knowledge &amp; Technician Tip
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 font-mono text-xs text-slate-200">
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-950/50 border border-red-800/80 text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Machine Target and Tip Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 font-bold mb-1">
                Target Machine Asset *
              </label>
              <select
                value={machineId}
                onChange={(e) => setMachineId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500 font-mono"
              >
                {machines.map((m) => (
                  <option key={m.machine_id} value={m.machine_id}>
                    {m.machine_id} - {m.name}
                  </option>
                ))}
              </select>
              {selectedMachine && (
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Location: {selectedMachine.location || 'Bay'} · {selectedMachine.model || 'Standard'}
                </span>
              )}
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">
                Knowledge Type *
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500 font-mono"
              >
                <option value="technician_tip">Technician Field Tip &amp; Heuristic</option>
                <option value="oem_manual">OEM Manual &amp; Specification</option>
                <option value="post_mortem">Post-Mortem Root Cause Finding</option>
                <option value="best_practice">Standard Maintenance Procedure</option>
              </select>
              <span className="text-[10px] text-cyan-400 mt-1 block">
                Permanently indexed in memory retrieval
              </span>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-slate-300 font-bold mb-1">
              Title / Summary Rule *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. M001: Spindle Jaw Coupling Thermal Clearance Inspection"
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Content / Heuristic */}
          <div>
            <label className="block text-slate-300 font-bold mb-1">
              Actionable Tip &amp; Institutional Memory Content *
            </label>
            <textarea
              required
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Describe the physical symptom, heuristic rule of thumb, inspection steps, or preventative procedure that prevents teardowns..."
              className="w-full bg-slate-950 border border-slate-800 rounded p-3 text-slate-100 focus:outline-none focus:border-cyan-500 font-mono leading-relaxed"
            />
          </div>

          {/* Author and Source */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 font-bold mb-1">
                Source Document / Shift
              </label>
              <input
                type="text"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="e.g. Lead Maintenance Shift Memo"
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">
                Technician / Contributor
              </label>
              <input
                type="text"
                value={createdBy}
                onChange={(e) => setCreatedBy(e.target.value)}
                placeholder="e.g. Marcus Vance (Lead Master Tech)"
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Confidence and Tags */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-300 font-bold">Confidence Rating</label>
                <span className="text-emerald-400 font-bold">{Math.round(confidence * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="1.0"
                step="0.01"
                value={confidence}
                onChange={(e) => setConfidence(parseFloat(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">
                Tags (Comma-separated)
              </label>
              <input
                type="text"
                value={tagsString}
                onChange={(e) => setTagsString(e.target.value)}
                placeholder="vibration, coupling, ISO 10816-3"
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Modal Actions */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span>Recorded to institutional memory</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-1.5 px-4 py-2 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold transition-all shadow-[0_0_12px_rgba(6,182,212,0.3)] disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? (
                  <span>Saving...</span>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Save Knowledge &amp; Tip</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
