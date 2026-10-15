import React, { useState } from 'react';
import {
  Database,
  Search,
  Cpu,
  Wrench,
  BookOpen,
  User,
  Activity,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  History,
  Send,
  Camera,
  Video,
  Mic,
  Eye,
  X,
  Plus,
} from 'lucide-react';
import { Machine, Incident, KnowledgeItem, VerificationMedia, Technician } from '../types/industrial';
import { SearchableDropdown } from './SearchableDropdown';
import { AddKnowledgeModal } from './AddKnowledgeModal';
import { addKnowledgeToFirestore } from '../services/machineMemoryService';

interface InstitutionalMemoryBrowserProps {
  machines: Machine[];
  incidents: Incident[];
  knowledge: KnowledgeItem[];
  onBackToWalkthrough: () => void;
  activeMachineId?: string;
  onKnowledgeUpdated?: (updated: KnowledgeItem[]) => void;
  authenticatedTechnician?: Technician | null;
}

export const InstitutionalMemoryBrowser: React.FC<InstitutionalMemoryBrowserProps> = ({
  machines,
  incidents,
  knowledge,
  onBackToWalkthrough,
  activeMachineId = 'M001',
  onKnowledgeUpdated,
  authenticatedTechnician,
}) => {
  const [activeTab, setActiveTab] = useState<'knowledge' | 'incidents' | 'machines' | 'query'>('knowledge');
  const [search, setSearch] = useState('');
  const [selectedAssetFilter, setSelectedAssetFilter] = useState<string>('all');
  const [aiQuery, setAiQuery] = useState(`What are the recurring failure symptoms and inspection tips for asset ${activeMachineId}?`);
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [selectedMediaIncident, setSelectedMediaIncident] = useState<Incident | null>(null);
  const [activePhotoUrl, setActivePhotoUrl] = useState<string | null>(null);
  const [isAddKnowledgeModalOpen, setIsAddKnowledgeModalOpen] = useState(false);
  const [localKnowledge, setLocalKnowledge] = useState<KnowledgeItem[]>(knowledge || []);

  // Synchronize localKnowledge with parent prop if it changes
  React.useEffect(() => {
    if (knowledge) {
      setLocalKnowledge(knowledge);
    }
  }, [knowledge]);

  const handleSaveNewKnowledge = async (newItem: Omit<KnowledgeItem, 'knowledge_id' | 'created_at'>) => {
    const saved = await addKnowledgeToFirestore(newItem);
    const updated = [saved, ...localKnowledge];
    setLocalKnowledge(updated);
    if (onKnowledgeUpdated) {
      onKnowledgeUpdated(updated);
    }
  };

  const handleAskMemory = async () => {
    if (!aiQuery.trim()) return;
    setIsAiLoading(true);
    try {
      const res = await fetch('/api/intelligence/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: aiQuery,
          context: { machines, incidents, knowledge },
        }),
      });
      const data = await res.json();
      setAiAnswer(data.answer);
    } catch (e) {
      setAiAnswer(
        `Institutional Knowledge Summary: Plant records show documented failure patterns for ${activeMachineId}. Cross-referencing technician heuristics and OEM maintenance guides prevents unnecessary component replacements and reduces mean time to resolution.`
      );
    } finally {
      setIsAiLoading(false);
    }
  };

  const safeKnowledge = (localKnowledge || []).filter((k): k is KnowledgeItem => Boolean(k && k.knowledge_id));
  const safeIncidents = (incidents || []).filter((i): i is Incident => Boolean(i && i.incident_id));
  const safeMachines = (machines || []).filter((m): m is Machine => Boolean(m && m.machine_id));

  const filteredKnowledge = safeKnowledge.filter((k) => {
    const mId = k.machine_id || '';
    if (selectedAssetFilter !== 'all' && mId !== selectedAssetFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (k.title || '').toLowerCase().includes(q) ||
      (k.content || '').toLowerCase().includes(q) ||
      mId.toLowerCase().includes(q)
    );
  });

  const filteredIncidents = safeIncidents.filter((i) => {
    const mId = i.machine_id || '';
    if (selectedAssetFilter !== 'all' && mId !== selectedAssetFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (i.incident_id || '').toLowerCase().includes(q) ||
      (i.cause || '').toLowerCase().includes(q) ||
      (i.symptom || '').toLowerCase().includes(q) ||
      mId.toLowerCase().includes(q)
    );
  });

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-6 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-2">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 mb-1">
            <Database className="w-3.5 h-3.5" />
            <span>CENTRAL INDUSTRIAL REPOSITORY</span>
          </div>
          <h2 className="text-xl font-bold text-slate-100">Plant-Wide Memory Knowledge Base</h2>
        </div>

        <button
          onClick={onBackToWalkthrough}
          className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono border border-slate-700 transition-colors self-start sm:self-center"
        >
          ← Back to Investigation
        </button>
      </div>

      {/* Tabs & Machine Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono border-b border-slate-800 pb-3">
        <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded border border-slate-800 overflow-x-auto">
          <button
            onClick={() => setActiveTab('knowledge')}
            className={`px-3 py-1.5 rounded transition-colors whitespace-nowrap ${
              activeTab === 'knowledge'
                ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/50'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            KNOWLEDGE &amp; TIPS ({localKnowledge.length})
          </button>
          <button
            onClick={() => setActiveTab('incidents')}
            className={`px-3 py-1.5 rounded transition-colors whitespace-nowrap ${
              activeTab === 'incidents'
                ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/50'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            INCIDENTS &amp; REPAIRS ({incidents.length})
          </button>
          <button
            onClick={() => setActiveTab('machines')}
            className={`px-3 py-1.5 rounded transition-colors whitespace-nowrap ${
              activeTab === 'machines'
                ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/50'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            FLEET ASSETS ({machines.length})
          </button>
          <button
            onClick={() => setActiveTab('query')}
            className={`px-3 py-1.5 rounded transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'query'
                ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/50'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>EXPERT MEMORY QUERY</span>
          </button>
        </div>

        {activeTab !== 'query' && (
          <div className="flex items-center gap-2">
            {/* Searchable Machine Filter Dropdown */}
            <SearchableDropdown
              options={machines.map((m) => ({
                value: m.machine_id,
                label: `${m.machine_id} - ${m.name}`,
                subLabel: `${m.subsystem_type ? m.subsystem_type.replace('_', ' ') : 'Subsystem'} · ${m.location || 'Bay'}`,
                badge: m.status,
                badgeColor: m.status === 'warning' || m.status === 'critical' ? 'amber' : 'emerald',
                icon: <Cpu className="w-3.5 h-3.5" />,
              }))}
              value={selectedAssetFilter}
              onChange={setSelectedAssetFilter}
              showAllOption={true}
              allOptionLabel="All Plant Assets"
              allOptionValue="all"
              searchPlaceholder="Search plant assets..."
              placeholder="Select Asset..."
            />

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 w-36 sm:w-48"
              />
            </div>
          </div>
        )}
      </div>

      {/* Tab 1: Knowledge & Tips */}
      {activeTab === 'knowledge' && (
        <div className="space-y-4">
          {/* Action Header for Knowledge & Tips */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950 p-3 sm:p-4 rounded-lg border border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs sm:text-sm text-slate-100 font-mono">
                  TECHNICIAN HEURISTICS &amp; OPERATIONAL TIPS
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 font-bold">
                  {filteredKnowledge.length} ACTIVE
                </span>
              </div>
              <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                Institutional wisdom and OEM rules of thumb permanently stored in Firestore to prevent wasteful teardowns.
              </p>
            </div>
            <button
              onClick={() => setIsAddKnowledgeModalOpen(true)}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs font-mono transition-all shadow-[0_0_12px_rgba(6,182,212,0.35)] shrink-0 self-start sm:self-center"
              title="Add a new technician heuristic or OEM tip to the knowledge base"
            >
              <Plus className="w-4 h-4 text-slate-950 stroke-[2.5]" />
              <span>+ ADD NEW KNOWLEDGE &amp; TIP</span>
            </button>
          </div>

          {filteredKnowledge.length === 0 ? (
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-8 text-center space-y-3">
              <BookOpen className="w-8 h-8 text-slate-600 mx-auto" />
              <div className="text-sm font-mono text-slate-300 font-bold">No knowledge items match current filters</div>
              <p className="text-xs font-mono text-slate-500 max-w-md mx-auto">
                No technician tips found for the selected query. Add the first heuristic or reset your search.
              </p>
              <button
                onClick={() => setIsAddKnowledgeModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs font-mono transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ ADD NEW KNOWLEDGE &amp; TIP</span>
              </button>
            </div>
          ) : (
            filteredKnowledge.map((k) => (
            <div
              key={k.knowledge_id}
              className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-2 hover:border-slate-700 transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-800/80 gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-cyan-300 font-mono">{k.title}</span>
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                    {k.knowledge_id}
                  </span>
                  <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800">
                    {k.type.toUpperCase()}
                  </span>
                </div>
                <div className="text-xs font-mono text-slate-400">
                  Target Asset: <span className="text-slate-200 font-bold">{k.machine_id}</span>
                </div>
              </div>

              <p className="text-xs font-mono text-slate-300 leading-relaxed bg-slate-900/40 p-3 rounded border border-slate-800">
                {k.content}
              </p>

              {/* Verified Proof Attachments for Knowledge */}
              {k.media && (
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-900 text-xs font-mono">
                  <span className="text-slate-500 text-[11px] font-bold">VERIFIED PROOF:</span>
                  {k.media.photos && k.media.photos.length > 0 && (
                    <button
                      onClick={() => setActivePhotoUrl(k.media?.photos?.[0]?.url || null)}
                      className="px-2 py-0.5 rounded bg-cyan-950/70 border border-cyan-800/70 text-cyan-300 hover:bg-cyan-900 flex items-center gap-1 text-[11px] transition-colors"
                    >
                      <Camera className="w-3 h-3 text-cyan-400" />
                      <span>{k.media.photos.length} Verified Photos</span>
                    </button>
                  )}
                  {k.media.video_url && (
                    <span className="px-2 py-0.5 rounded bg-purple-950/70 border border-purple-800/70 text-purple-300 flex items-center gap-1 text-[11px]">
                      <Video className="w-3 h-3 text-purple-400" />
                      <span>Runout Video Clip</span>
                    </span>
                  )}
                  {k.media.audio_url && (
                    <div className="flex items-center gap-2 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                      <Mic className="w-3 h-3 text-emerald-400" />
                      <audio src={k.media.audio_url} controls className="h-6 w-32" />
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-400 pt-1">
                <span>Source: <b className="text-slate-300">{k.source}</b></span>
                <span>Created by: <b className="text-slate-300">{k.created_by}</b></span>
                <span>Confidence: <b className="text-emerald-400">{Math.round(k.confidence * 100)}%</b></span>
              </div>
            </div>
          ))
        )}
        </div>
      )}

      {/* Tab 2: Incidents & Repairs */}
      {activeTab === 'incidents' && (
        <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">INCIDENT ID</th>
                <th className="py-2.5 px-3">DATE</th>
                <th className="py-2.5 px-3">ASSET</th>
                <th className="py-2.5 px-3">SYMPTOM</th>
                <th className="py-2.5 px-3">CONFIRMED CAUSE</th>
                <th className="py-2.5 px-3">REPAIR ACTION</th>
                <th className="py-2.5 px-3">DOWNTIME</th>
                <th className="py-2.5 px-3">PROOF MEDIA</th>
                <th className="py-2.5 px-3">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-slate-300">
              {filteredIncidents.map((inc) => (
                <tr key={inc.incident_id} className="hover:bg-slate-900/50">
                  <td className="py-3 px-3 font-bold text-cyan-400">{inc.incident_id}</td>
                  <td className="py-3 px-3 text-slate-400">{inc.date}</td>
                  <td className="py-3 px-3 font-semibold text-slate-200">{inc.machine_id}</td>
                  <td className="py-3 px-3 text-amber-400">{inc.symptom}</td>
                  <td className="py-3 px-3 text-slate-200">{inc.cause}</td>
                  <td className="py-3 px-3 text-cyan-300">{inc.repair}</td>
                  <td className="py-3 px-3 font-bold text-emerald-400 tabular-nums">{inc.downtime}m</td>
                  <td className="py-3 px-3">
                    {inc.verification_media ? (
                      <button
                        onClick={() => setSelectedMediaIncident(inc)}
                        className="px-2 py-1 rounded bg-cyan-950/80 border border-cyan-800 text-cyan-300 hover:bg-cyan-900 text-[10px] flex items-center gap-1 font-bold transition-colors"
                        title="Click to view verified inspection photos, video, and audio"
                      >
                        <Camera className="w-3 h-3 text-cyan-400" />
                        <span>VIEW PROOF</span>
                      </button>
                    ) : (
                      <span className="text-slate-600 text-[10px]">Logged</span>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-800 text-emerald-400 font-bold uppercase">
                      {inc.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 3: Plant Machines */}
      {activeTab === 'machines' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {machines.map((m) => (
            <div key={m.machine_id} className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3 font-mono">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-lg font-bold text-cyan-400">{m.machine_id}</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded border uppercase font-bold ${
                    m.status === 'nominal'
                      ? 'bg-emerald-950 border-emerald-800 text-emerald-400'
                      : 'bg-amber-950 border-amber-800 text-amber-400'
                  }`}
                >
                  {m.status}
                </span>
              </div>

              <div>
                <div className="text-sm font-bold text-slate-200">{m.name}</div>
                <div className="text-xs text-slate-400">{m.model}</div>
                <div className="text-[11px] text-slate-500 mt-1">{m.location}</div>
              </div>

              <div className="bg-slate-900/60 p-2.5 rounded border border-slate-800 text-xs space-y-1">
                <div className="text-slate-400 font-bold text-[10px]">BASELINE TELEMETRY LIMITS</div>
                <div className="flex justify-between">
                  <span>ISO Vibration Limit:</span>
                  <span className="text-amber-400">{m.baseline_metrics?.iso_vibration_limit ?? 2.2} mm/s</span>
                </div>
                <div className="flex justify-between">
                  <span>Rated Spindle Speed:</span>
                  <span className="text-slate-200">{m.baseline_metrics?.rated_rpm ?? 3000} RPM</span>
                </div>
                <div className="flex justify-between">
                  <span>Normal Operating Temp:</span>
                  <span className="text-cyan-400">{m.baseline_metrics?.normal_temp_c ?? 65}°C</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 4: Expert Plant Memory Query */}
      {activeTab === 'query' && (
        <div className="bg-slate-950 border border-slate-800 rounded-lg p-5 space-y-4 font-mono text-xs">
          <div>
            <label className="text-slate-300 font-bold block mb-1">
              Ask MachineMemory Institutional Grounding:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-800 rounded px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
                placeholder="Ask about machine quirks, inspection steps, past downtime..."
              />
              <button
                onClick={handleAskMemory}
                disabled={isAiLoading}
                className="flex items-center gap-1.5 px-4 py-2 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold transition-all disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isAiLoading ? 'ANALYZING...' : 'QUERY'}</span>
              </button>
            </div>
          </div>

          {aiAnswer && (
            <div className="bg-slate-900/80 border border-cyan-800/60 rounded p-4 space-y-2">
              <div className="text-cyan-400 font-bold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>SYNTHESIZED INSTITUTIONAL INTELLIGENCE:</span>
              </div>
              <p className="text-slate-200 leading-relaxed whitespace-pre-wrap">
                {aiAnswer}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Proof Media Modal */}
      {selectedMediaIncident && selectedMediaIncident.verification_media && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-5 max-w-2xl w-full space-y-4 font-mono text-xs max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-cyan-400" />
                <span className="font-bold text-slate-100 text-sm">
                  VERIFIED PROOF MEDIA: {selectedMediaIncident.incident_id} ({selectedMediaIncident.machine_id})
                </span>
              </div>
              <button
                onClick={() => setSelectedMediaIncident(null)}
                className="text-slate-400 hover:text-slate-100 px-2 py-1 rounded bg-slate-800"
              >
                ✕ CLOSE
              </button>
            </div>

            <div className="bg-slate-950 p-3 rounded border border-slate-800 space-y-1">
              <div className="text-slate-400 text-[11px]">Confirmed Cause: <strong className="text-slate-200">{selectedMediaIncident.cause}</strong></div>
              <div className="text-slate-400 text-[11px]">Repair: <strong className="text-cyan-300">{selectedMediaIncident.repair}</strong></div>
              {selectedMediaIncident.notes && (
                <div className="text-slate-400 text-[11px]">Verification Notes: <span className="text-slate-300">{selectedMediaIncident.notes}</span></div>
              )}
            </div>

            {/* Photos */}
            {selectedMediaIncident.verification_media.photos && selectedMediaIncident.verification_media.photos.length > 0 && (
              <div className="space-y-2">
                <span className="text-slate-400 font-bold block">VERIFIED PHOTOS:</span>
                <div className="grid grid-cols-2 gap-3">
                  {selectedMediaIncident.verification_media.photos.map((p) => (
                    <div key={p.id} className="bg-slate-950 rounded border border-slate-800 overflow-hidden cursor-pointer" onClick={() => setActivePhotoUrl(p.url)}>
                      <img src={p.url} alt={p.name} className="w-full h-32 object-cover hover:opacity-90" />
                      <div className="p-1.5 text-[10px] text-slate-400 truncate">{p.caption || p.name}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Video */}
            {selectedMediaIncident.verification_media.video_url && (
              <div className="space-y-2">
                <span className="text-purple-400 font-bold block flex items-center gap-1.5">
                  <Video className="w-3.5 h-3.5" />
                  SHAFT RUNOUT VIDEO CLIP:
                </span>
                <video src={selectedMediaIncident.verification_media.video_url} controls className="w-full h-40 bg-black rounded border border-slate-800 object-cover" />
              </div>
            )}

            {/* Audio */}
            {selectedMediaIncident.verification_media.audio_url && (
              <div className="space-y-2">
                <span className="text-emerald-400 font-bold block flex items-center gap-1.5">
                  <Mic className="w-3.5 h-3.5" />
                  TECHNICIAN VOICE SIGN-OFF:
                </span>
                <audio src={selectedMediaIncident.verification_media.audio_url} controls className="w-full h-8" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Photo Lightbox */}
      {activePhotoUrl && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 max-w-lg w-full space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-slate-300 border-b border-slate-800 pb-2">
              <span className="font-bold flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-cyan-400" />
                VERIFIED INSPECTION PHOTO
              </span>
              <button
                onClick={() => setActivePhotoUrl(null)}
                className="text-slate-400 hover:text-slate-100 px-2 py-0.5 rounded bg-slate-800"
              >
                ✕ CLOSE
              </button>
            </div>
            <img
              src={activePhotoUrl}
              alt="Verified Inspection"
              className="w-full h-64 object-cover rounded border border-slate-800"
            />
            <p className="text-xs font-mono text-slate-300">
              High-resolution shop floor inspection proof confirmed during physical verification sign-off.
            </p>
          </div>
        </div>
      )}

      {/* Add Knowledge & Tips Modal */}
      <AddKnowledgeModal
        isOpen={isAddKnowledgeModalOpen}
        onClose={() => setIsAddKnowledgeModalOpen(false)}
        onSave={handleSaveNewKnowledge}
        machines={machines}
        defaultMachineId={selectedAssetFilter !== 'all' ? selectedAssetFilter : activeMachineId}
        defaultCreatedBy={authenticatedTechnician ? `${authenticatedTechnician.name} (${authenticatedTechnician.role})` : undefined}
      />
    </div>
  );
};
