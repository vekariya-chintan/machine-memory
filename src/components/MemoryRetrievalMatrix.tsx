import React, { useState } from 'react';
import {
  Database,
  Search,
  CheckCircle2,
  BookOpen,
  User,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Layers,
  Wrench,
  Camera,
  Video,
  Mic,
  ShieldCheck,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { Incident, KnowledgeItem, ExtractionResult } from '../types/industrial';

interface MemoryRetrievalMatrixProps {
  incidents: Incident[];
  knowledge: KnowledgeItem[];
  onProceed: () => void;
  onBack?: () => void;
  activeIncidentId?: string | null;
  activeMachineId?: string;
  extraction?: ExtractionResult;
}

export const MemoryRetrievalMatrix: React.FC<MemoryRetrievalMatrixProps> = ({
  incidents,
  knowledge,
  onProceed,
  onBack,
  activeIncidentId,
  activeMachineId = 'M001',
  extraction,
}) => {
  const [filter, setFilter] = useState<'all' | 'incidents' | 'tips' | 'manual' | 'history'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPhotoModal, setSelectedPhotoModal] = useState<string | null>(null);

  const currentAssetId = extraction?.machine_id || activeMachineId || 'M001';

  // Relevance scores calculation dynamically matching active asset and Step 1 extraction
  const getIncidentRelevance = (inc: Incident) => {
    const isSameMachine = inc.machine_id === currentAssetId;
    const symptoms = extraction?.symptoms || ['vibration onset after warmup'];
    const rootCause = (extraction?.probable_root_cause || '').toLowerCase();

    const matchesSymptom = symptoms.some((s) =>
      inc.symptom.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(inc.symptom.toLowerCase())
    );
    const matchesCause = rootCause && inc.cause.toLowerCase().includes(rootCause.slice(0, 15));

    if (isSameMachine && (matchesSymptom || matchesCause)) {
      return {
        score: 96,
        reason: `Direct symptom & component correlation with ${currentAssetId}: "${inc.symptom}" (${inc.downtime}m saved previously)`,
      };
    }
    if (isSameMachine) {
      return {
        score: 91,
        reason: `Historical resolution on active asset ${currentAssetId}: ${inc.cause}`,
      };
    }
    if (matchesSymptom) {
      return {
        score: 84,
        reason: `Cross-fleet identical vibration anomaly signature on ${inc.machine_id}: ${inc.symptom}`,
      };
    }
    return { score: 60, reason: `General fleet baseline reference record (${inc.machine_id})` };
  };

  const getKnowledgeRelevance = (k: KnowledgeItem) => {
    const isSameMachine = k.machine_id === currentAssetId;
    const symptoms = extraction?.symptoms || ['vibration onset after warmup'];
    const matchesTip = symptoms.some((s) => k.content.toLowerCase().includes(s.toLowerCase()));

    if (isSameMachine && matchesTip) {
      return {
        score: 98,
        reason: `Direct correlation with ${currentAssetId} technician voice memo and pre-disassembly heuristic`,
      };
    }
    if (isSameMachine) {
      return {
        score: 94,
        reason: `Official domain maintenance guidance and engineering tolerances for ${currentAssetId}`,
      };
    }
    return { score: 65, reason: `General fleet standard operating reference (${k.machine_id})` };
  };

  // Exclude ongoing active incident from historical evidence retrieval
  const safeIncidents = (incidents || [])
    .filter((inc): inc is Incident => Boolean(inc && inc.incident_id))
    .filter((inc) => {
      if (activeIncidentId && inc.incident_id === activeIncidentId) return false;
      if (inc.status === 'investigating') return false;
      return true;
    });
  const safeKnowledge = (knowledge || []).filter((k): k is KnowledgeItem => Boolean(k && k.knowledge_id));

  // Count categories
  const similarIncidentsCount = safeIncidents.filter((i) => i.machine_id === currentAssetId || i.symptom.includes('vibration')).length;
  const technicianTipsCount = safeKnowledge.filter((k) => k.type === 'technician_tip').length;
  const oemManualCount = safeKnowledge.filter((k) => k.type === 'oem_manual').length;
  const maintenanceHistoryCount = safeKnowledge.filter((k) => k.type === 'post_mortem' || k.tags?.includes('maintenance history')).length;

  const filteredIncidents = safeIncidents.filter((inc) => {
    const mId = inc.machine_id || '';
    if (filter === 'tips' || filter === 'manual' || filter === 'history') return false;
    if (filter === 'incidents' && mId !== currentAssetId && !inc.symptom.toLowerCase().includes('vibration')) return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        (inc.incident_id || '').toLowerCase().includes(q) ||
        (inc.cause || '').toLowerCase().includes(q) ||
        (inc.symptom || '').toLowerCase().includes(q) ||
        (inc.repair || '').toLowerCase().includes(q) ||
        mId.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const filteredKnowledge = safeKnowledge.filter((k) => {
    const mId = k.machine_id || '';
    if (filter === 'incidents') return false;
    if (filter === 'tips' && k.type !== 'technician_tip') return false;
    if (filter === 'manual' && k.type !== 'oem_manual') return false;
    if (filter === 'history' && k.type !== 'post_mortem' && !k.tags?.includes('maintenance history')) return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        (k.title || '').toLowerCase().includes(q) ||
        (k.content || '').toLowerCase().includes(q) ||
        (k.source || '').toLowerCase().includes(q) ||
        mId.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-5 sm:p-6 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 mb-1">
            <span className="px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-800/80 font-bold">
              STEP 04
            </span>
            <span>HISTORICAL EVIDENCE RETRIEVAL MATRIX</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-100">
            Retrieved Evidence for Asset {currentAssetId}
          </h2>
          <p className="text-xs text-slate-400 font-sans mt-0.5">
            Cross-referencing similar past {currentAssetId} incidents, technician tribal tips, machine OEM manual specifications, and maintenance history.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 bg-slate-950 px-3 py-2 rounded-lg border border-slate-800 shrink-0">
          <Database className="w-4 h-4 text-emerald-400" />
          <span>CENTRAL MEMORY: <strong className="text-slate-200">{safeIncidents.length + safeKnowledge.length} RECORDS</strong></span>
        </div>
      </div>

      {/* 4 Pillars of Retrieved Evidence Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 font-mono text-xs">
        <button
          onClick={() => setFilter('incidents')}
          className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
            filter === 'incidents'
              ? 'bg-cyan-950/70 border-cyan-500 shadow-md ring-1 ring-cyan-500/40'
              : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
            <span>1. SIMILAR INCIDENTS</span>
            <span className="text-cyan-400 font-bold">{similarIncidentsCount}</span>
          </div>
          <div className="text-sm font-bold text-slate-200 truncate">Past {currentAssetId} Cases</div>
          <div className="text-[10px] text-slate-500 mt-0.5">{extraction?.symptoms?.[0] || 'Targeted'} resolutions</div>
        </button>

        <button
          onClick={() => setFilter('tips')}
          className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
            filter === 'tips'
              ? 'bg-purple-950/70 border-purple-500 shadow-md ring-1 ring-purple-500/40'
              : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
            <span>2. TECHNICIAN KNOWLEDGE</span>
            <span className="text-purple-400 font-bold">{technicianTipsCount}</span>
          </div>
          <div className="text-sm font-bold text-slate-200 truncate">Tribal Shop-Floor Heuristics</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Operating rules &amp; diagnostics</div>
        </button>

        <button
          onClick={() => setFilter('manual')}
          className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
            filter === 'manual'
              ? 'bg-amber-950/70 border-amber-500 shadow-md ring-1 ring-amber-500/40'
              : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
            <span>3. MACHINE MANUAL</span>
            <span className="text-amber-400 font-bold">{oemManualCount}</span>
          </div>
          <div className="text-sm font-bold text-slate-200 truncate">OEM Engineering Specs</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Operating limits for {currentAssetId}</div>
        </button>

        <button
          onClick={() => setFilter('history')}
          className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
            filter === 'history'
              ? 'bg-emerald-950/70 border-emerald-500 shadow-md ring-1 ring-emerald-500/40'
              : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 text-[11px] mb-1">
            <span>4. MAINTENANCE HISTORY</span>
            <span className="text-emerald-400 font-bold">{maintenanceHistoryCount}</span>
          </div>
          <div className="text-sm font-bold text-slate-200 truncate">PM &amp; Work Order Logs</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Avoided teardowns &amp; downtime</div>
        </button>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800 overflow-x-auto">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded transition-colors whitespace-nowrap cursor-pointer ${
              filter === 'all'
                ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/50'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ALL EVIDENCE
          </button>
          <button
            onClick={() => setFilter('incidents')}
            className={`px-3 py-1.5 rounded transition-colors whitespace-nowrap cursor-pointer ${
              filter === 'incidents'
                ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/50'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            SIMILAR INCIDENTS
          </button>
          <button
            onClick={() => setFilter('tips')}
            className={`px-3 py-1.5 rounded transition-colors whitespace-nowrap cursor-pointer ${
              filter === 'tips'
                ? 'bg-purple-500/20 text-purple-300 font-bold border border-purple-500/50'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            TECHNICIAN TIPS
          </button>
          <button
            onClick={() => setFilter('manual')}
            className={`px-3 py-1.5 rounded transition-colors whitespace-nowrap cursor-pointer ${
              filter === 'manual'
                ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/50'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            OEM MANUAL
          </button>
          <button
            onClick={() => setFilter('history')}
            className={`px-3 py-1.5 rounded transition-colors whitespace-nowrap cursor-pointer ${
              filter === 'history'
                ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/50'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            MAINTENANCE HISTORY
          </button>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search retrieved evidence..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 w-full sm:w-64 font-mono"
          />
        </div>
      </div>

      {/* Retrieved Evidence Grid */}
      <div className="space-y-4">
        {/* 1. Knowledge Items (Tips, Manuals, and Post-Mortem Maintenance History) */}
        {filteredKnowledge.map((k) => {
          const rel = getKnowledgeRelevance(k);
          const isMatchingAsset = k.machine_id === currentAssetId;
          const isOem = k.type === 'oem_manual';
          const isPm = k.type === 'post_mortem' || k.tags?.includes('maintenance history');

          return (
            <div
              key={k.knowledge_id}
              className={`bg-slate-950 border rounded-lg p-4 transition-all space-y-3 ${
                isMatchingAsset
                  ? 'border-cyan-500/60 shadow-[0_0_15px_rgba(6,182,212,0.1)]'
                  : 'border-slate-800 opacity-80'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-800/80 gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                      isOem
                        ? 'bg-amber-950/80 border-amber-800 text-amber-300'
                        : isPm
                        ? 'bg-emerald-950/80 border-emerald-800 text-emerald-300'
                        : 'bg-purple-950/80 border-purple-800 text-purple-300'
                    }`}
                  >
                    {isOem ? 'OEM MANUAL SPEC' : isPm ? 'MAINTENANCE HISTORY' : 'TECHNICIAN TRIBAL TIP'}
                  </span>

                  <span className="font-bold text-sm text-cyan-300 font-mono">{k.title}</span>

                  <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                    {k.machine_id}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="text-slate-400">RELEVANCE:</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-700/80 text-emerald-300 font-bold tabular-nums">
                    {rel.score}% MATCH
                  </span>
                </div>
              </div>

              <p className="text-xs sm:text-sm font-mono text-slate-200 bg-slate-900/60 p-3 rounded border border-slate-800 leading-relaxed">
                "{k.content}"
              </p>

              {/* Verified Media Attachments if available */}
              {k.media && (
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-900 text-xs font-mono">
                  <span className="text-slate-500 text-[11px]">ATTACHED VERIFICATION MEDIA:</span>
                  {k.media.photos && k.media.photos.length > 0 && (
                    <span className="px-2 py-0.5 rounded bg-cyan-950/70 border border-cyan-800/70 text-cyan-300 flex items-center gap-1 text-[11px]">
                      <Camera className="w-3 h-3" />
                      {k.media.photos.length} Verified Photos
                    </span>
                  )}
                  {k.media.video_url && (
                    <span className="px-2 py-0.5 rounded bg-purple-950/70 border border-purple-800/70 text-purple-300 flex items-center gap-1 text-[11px]">
                      <Video className="w-3 h-3" />
                      Shaft Runout Video
                    </span>
                  )}
                  {k.media.audio_url && (
                    <span className="px-2 py-0.5 rounded bg-emerald-950/70 border border-emerald-800/70 text-emerald-300 flex items-center gap-1 text-[11px]">
                      <Mic className="w-3 h-3" />
                      Technician Voice Note
                    </span>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between text-xs font-mono text-slate-400 pt-1">
                <div className="flex items-center gap-3 text-[11px]">
                  <span>Source: <b className="text-slate-200">{k.source}</b></span>
                  <span>Author: <b className="text-slate-200">{k.created_by}</b></span>
                </div>
                <div className="text-cyan-400 italic text-[11px]">
                  Why matched: {rel.reason}
                </div>
              </div>
            </div>
          );
        })}

        {/* 2. Historical Incidents */}
        {filteredIncidents.map((inc) => {
          const rel = getIncidentRelevance(inc);
          const isHighMatch = rel.score > 85;

          return (
            <div
              key={inc.incident_id}
              className={`bg-slate-950 border rounded-lg p-4 transition-all space-y-3 ${
                isHighMatch
                  ? 'border-emerald-800/80 bg-emerald-950/10 shadow-[0_0_15px_rgba(16,185,129,0.08)]'
                  : 'border-slate-800/80 opacity-80'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-slate-800/80 gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-cyan-950/80 border border-cyan-800 text-cyan-300">
                    HISTORICAL INCIDENT
                  </span>
                  <span className="font-mono font-bold text-sm text-slate-200">{inc.incident_id}</span>
                  <span className="text-xs text-slate-400 font-mono">Date: {inc.date}</span>
                  <span className="text-xs text-cyan-400 font-mono font-bold">Asset: {inc.machine_id}</span>
                </div>

                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="text-slate-400">CORRELATION:</span>
                  <span
                    className={`px-2 py-0.5 rounded font-bold tabular-nums ${
                      isHighMatch
                        ? 'bg-emerald-950 border border-emerald-700 text-emerald-300'
                        : 'bg-slate-900 border border-slate-700 text-slate-400'
                    }`}
                  >
                    {rel.score}% MATCH
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono bg-slate-900/60 p-3 rounded border border-slate-800">
                <div>
                  <span className="text-slate-500 block text-[10px]">Reported Symptom:</span>
                  <div className="text-amber-400 font-semibold">{inc.symptom}</div>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Confirmed Root Cause:</span>
                  <div className="text-slate-200 font-semibold">{inc.cause}</div>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Executed Repair:</span>
                  <div className="text-cyan-300 font-semibold">{inc.repair}</div>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Downtime Duration:</span>
                  <div className="text-emerald-400 font-semibold tabular-nums">{inc.downtime} minutes</div>
                </div>
              </div>

              {inc.notes && (
                <div className="text-xs font-mono text-slate-300 bg-slate-900/40 p-2.5 rounded border border-slate-800">
                  <span className="text-slate-400 font-bold mr-1">Verification Note:</span> {inc.notes}
                </div>
              )}

              {/* Verified Media if available on the incident */}
              {inc.verification_media && (
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-900 text-xs font-mono">
                  <span className="text-slate-500 text-[11px]">FIELD VERIFICATION PROOF:</span>
                  {inc.verification_media.photos && inc.verification_media.photos.length > 0 && (
                    <button
                      onClick={() => setSelectedPhotoModal(inc.verification_media?.photos?.[0]?.url || null)}
                      className="px-2 py-0.5 rounded bg-cyan-950/70 border border-cyan-800/70 text-cyan-300 hover:bg-cyan-900 flex items-center gap-1 text-[11px] transition-colors"
                    >
                      <Camera className="w-3 h-3" />
                      View {inc.verification_media.photos.length} Verified Photos
                    </button>
                  )}
                  {inc.verification_media.video_url && (
                    <span className="px-2 py-0.5 rounded bg-purple-950/70 border border-purple-800/70 text-purple-300 flex items-center gap-1 text-[11px]">
                      <Video className="w-3 h-3" />
                      Runout Inspection Video
                    </span>
                  )}
                  {inc.verification_media.audio_url && (
                    <span className="px-2 py-0.5 rounded bg-emerald-950/70 border border-emerald-800/70 text-emerald-300 flex items-center gap-1 text-[11px]">
                      <Mic className="w-3 h-3" />
                      Recorded Field Audio Note
                    </span>
                  )}
                </div>
              )}

              <div className="text-xs font-mono text-cyan-400/90 text-right text-[11px]">
                Cross-reference citation: {rel.reason}
              </div>
            </div>
          );
        })}
      </div>

      {/* Action Footer */}
      <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="text-xs font-mono text-slate-400">
          Synthesized all 4 evidence pillars for asset <strong>{currentAssetId}</strong>. Ready for Autonomous Root-Cause Investigation.
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs font-mono transition-all cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>BACK</span>
            </button>
          )}
          <button
            onClick={onProceed}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs font-mono transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] shrink-0 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-slate-950" />
            <span>PROCEED TO ROOT-CAUSE INVESTIGATION</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Photo Lightbox Modal */}
      {selectedPhotoModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 max-w-lg w-full space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-slate-300 border-b border-slate-800 pb-2">
              <span className="font-bold flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-cyan-400" />
                VERIFIED INSPECTION PHOTO
              </span>
              <button
                onClick={() => setSelectedPhotoModal(null)}
                className="text-slate-400 hover:text-slate-100 px-2 py-0.5 rounded bg-slate-800 cursor-pointer"
              >
                ✕ CLOSE
              </button>
            </div>
            <img
              src={selectedPhotoModal}
              alt="Verified Inspection"
              className="w-full h-64 object-cover rounded border border-slate-800"
            />
            <p className="text-xs font-mono text-slate-300">
              High-resolution shop floor inspection evidence confirming coupling jaw degradation and shaft alignment runout.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
