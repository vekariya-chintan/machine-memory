import React, { useState, useMemo } from 'react';
import {
  ShieldAlert,
  Plus,
  Search,
  Filter,
  Calendar,
  Clock,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingDown,
  Camera,
  Video,
  Mic,
  FileSpreadsheet,
  ExternalLink,
  ChevronRight,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Incident, Machine } from '../types/industrial';
import { SearchableDropdown, DropdownOption } from './SearchableDropdown';

interface InvestigationsListViewProps {
  incidents: Incident[];
  machines: Machine[];
  activeMachineId: string;
  onSelectMachineId: (id: string) => void;
  onStartNewInvestigation: (machineId?: string) => void;
  onOpenInvestigation: (incident: Incident) => void;
}

export const InvestigationsListView: React.FC<InvestigationsListViewProps> = ({
  incidents = [],
  machines = [],
  activeMachineId,
  onSelectMachineId,
  onStartNewInvestigation,
  onOpenInvestigation,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'verified' | 'resolved' | 'investigating'>('all');
  const [selectedProofIncident, setSelectedProofIncident] = useState<Incident | null>(null);
  const [activePhotoModal, setActivePhotoModal] = useState<string | null>(null);

  // Map machine names for display
  const machineMap = useMemo(() => {
    const map: Record<string, Machine> = {};
    machines.forEach((m) => {
      if (m && m.machine_id) map[m.machine_id] = m;
    });
    return map;
  }, [machines]);

  // Dropdown options for asset filter
  const assetOptions: DropdownOption[] = useMemo(() => {
    return machines.map((m) => ({
      value: m.machine_id,
      label: `${m.machine_id} - ${m.name}`,
      subLabel: `${m.subsystem_type ? m.subsystem_type.replace('_', ' ').toUpperCase() : 'SUBSYSTEM'}`,
      badge: m.status || 'nominal',
      badgeColor: m.status === 'warning' || m.status === 'critical' ? 'amber' : 'emerald',
      icon: <Cpu className="w-3.5 h-3.5" />,
    }));
  }, [machines]);

  // Sort ALL investigations in strict descending order based on creation date
  const sortedIncidents = useMemo(() => {
    const safeList = (incidents || []).filter((i): i is Incident => Boolean(i && i.incident_id));
    return [...safeList].sort((a, b) => {
      const timeA = new Date(a.date).getTime() || 0;
      const timeB = new Date(b.date).getTime() || 0;
      return timeB - timeA;
    });
  }, [incidents]);

  // Filter investigations based on search query, asset filter, and status filter
  const filteredIncidents = useMemo(() => {
    return sortedIncidents.filter((inc) => {
      // Machine filter
      if (activeMachineId && activeMachineId !== 'ALL' && inc.machine_id !== activeMachineId) {
        return false;
      }

      // Status filter
      if (statusFilter !== 'all' && inc.status !== statusFilter) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const m = machineMap[inc.machine_id];
        const matchId = (inc.incident_id || '').toLowerCase().includes(q);
        const matchMach = (inc.machine_id || '').toLowerCase().includes(q);
        const matchMachName = (m?.name || '').toLowerCase().includes(q);
        const matchSymptom = (inc.symptom || '').toLowerCase().includes(q);
        const matchCause = (inc.cause || '').toLowerCase().includes(q);
        const matchRepair = (inc.repair || '').toLowerCase().includes(q);
        const matchNotes = (inc.notes || '').toLowerCase().includes(q);
        const matchVerifiedBy = (inc.verified_by || '').toLowerCase().includes(q);

        return (
          matchId ||
          matchMach ||
          matchMachName ||
          matchSymptom ||
          matchCause ||
          matchRepair ||
          matchNotes ||
          matchVerifiedBy
        );
      }

      return true;
    });
  }, [sortedIncidents, activeMachineId, statusFilter, searchQuery, machineMap]);

  // KPI Calculations
  const totalCount = sortedIncidents.length;
  const verifiedCount = sortedIncidents.filter((i) => i.status === 'verified' || i.status === 'resolved').length;
  const inProgressCount = sortedIncidents.filter((i) => i.status === 'investigating').length;
  const totalDowntimeMinutes = sortedIncidents.reduce((sum, i) => sum + (i.downtime || 0), 0);
  const mediaCount = sortedIncidents.filter((i) => Boolean(i.verification_media)).length;

  return (
    <div className="space-y-6">
      {/* Page Header with Action Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-950 border border-slate-800 rounded-xl p-5 sm:p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
          <div>
            <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-cyan-400 mb-2">
              <span className="px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-800/80 font-bold flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-cyan-400" />
                INCIDENT INVESTIGATION REGISTRY
              </span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-400">ORDERED BY CREATION DATE (DESCENDING)</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
              Machinery Incident Investigations
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-3xl mt-1 leading-relaxed">
              Complete historical record of all plant diagnostic investigations, automated root-cause analyses, and verified failure resolutions across the manufacturing cell. Select any investigation to review the workflow or start a new investigation below.
            </p>
          </div>
        </div>

        {/* Aggregate KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-5 border-t border-slate-800/80">
          <div className="bg-slate-950/60 border border-slate-800/60 rounded-lg p-3">
            <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">TOTAL INVESTIGATIONS</div>
            <div className="text-xl sm:text-2xl font-bold font-mono text-slate-100 mt-1 tabular-nums">
              {totalCount}
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-0.5">Chronologically indexed</div>
          </div>

          <div className="bg-slate-950/60 border border-emerald-950/60 rounded-lg p-3">
            <div className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider">VERIFIED / RESOLVED</div>
            <div className="text-xl sm:text-2xl font-bold font-mono text-emerald-400 mt-1 tabular-nums">
              {verifiedCount}
            </div>
            <div className="text-[10px] text-emerald-500/80 font-mono mt-0.5">Closed with confirmed cause</div>
          </div>

          <div className="bg-slate-950/60 border border-cyan-950/60 rounded-lg p-3">
            <div className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider">PROOF MEDIA ATTACHED</div>
            <div className="text-xl sm:text-2xl font-bold font-mono text-cyan-400 mt-1 tabular-nums">
              {mediaCount}
            </div>
            <div className="text-[10px] text-cyan-500/80 font-mono mt-0.5">Photos, videos, audio notes</div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/60 rounded-lg p-3">
            <div className="text-[10px] font-mono text-amber-400 uppercase tracking-wider">TOTAL DOWNTIME TRACKED</div>
            <div className="text-xl sm:text-2xl font-bold font-mono text-amber-400 mt-1 tabular-nums">
              {totalDowntimeMinutes} <span className="text-xs font-normal text-slate-400">MIN</span>
            </div>
            <div className="text-[10px] text-slate-500 font-mono mt-0.5">~{Math.round(totalDowntimeMinutes / (totalCount || 1))}m avg per incident</div>
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-lg space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by incident ID, asset, symptom, root cause, repair..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Searchable Dropdown for Asset Selection */}
            <div className="w-56">
              <SearchableDropdown
                options={assetOptions}
                value={activeMachineId}
                onChange={onSelectMachineId}
                labelPrefix="FILTER ASSET:"
                icon={<Cpu className="w-3.5 h-3.5" />}
                showAllOption={true}
                allOptionLabel="ALL ASSETS (Fleet)"
                allOptionValue="ALL"
                placeholder="Filter by Asset..."
                searchPlaceholder="Search machine..."
                align="right"
              />
            </div>

            {/* Status Filter Buttons */}
            <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 font-mono text-xs">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded transition-colors ${
                  statusFilter === 'all'
                    ? 'bg-slate-800 text-slate-200 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All ({totalCount})
              </button>
              <button
                onClick={() => setStatusFilter('verified')}
                className={`px-2.5 py-1 rounded transition-colors ${
                  statusFilter === 'verified'
                    ? 'bg-emerald-950 text-emerald-300 font-bold border border-emerald-800/60'
                    : 'text-slate-400 hover:text-emerald-400'
                }`}
              >
                Verified
              </button>
              <button
                onClick={() => setStatusFilter('resolved')}
                className={`px-2.5 py-1 rounded transition-colors ${
                  statusFilter === 'resolved'
                    ? 'bg-cyan-950 text-cyan-300 font-bold border border-cyan-800/60'
                    : 'text-slate-400 hover:text-cyan-400'
                }`}
              >
                Resolved
              </button>
              <button
                onClick={() => setStatusFilter('investigating')}
                className={`px-2.5 py-1 rounded transition-colors ${
                  statusFilter === 'investigating'
                    ? 'bg-amber-950 text-amber-300 font-bold border border-amber-800/60'
                    : 'text-slate-400 hover:text-amber-400'
                }`}
              >
                In Progress
              </button>
            </div>

            {/* Second New Incident Investigation Button */}
            <button
              onClick={() => onStartNewInvestigation(activeMachineId !== 'ALL' ? activeMachineId : 'M001')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs font-mono transition-colors shadow-md shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>NEW INCIDENT INVESTIGATION</span>
            </button>
          </div>
        </div>

        {/* Active filter count status */}
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-2 border-t border-slate-800/80">
          <span>
            Showing <strong className="text-slate-200">{filteredIncidents.length}</strong> of{' '}
            <strong className="text-slate-200">{totalCount}</strong> investigations
            {activeMachineId !== 'ALL' && (
              <span>
                {' '}
                for <strong className="text-cyan-300">{activeMachineId}</strong>
              </span>
            )}
          </span>
          <span className="flex items-center gap-1 text-slate-500">
            <Clock className="w-3 h-3 text-cyan-400" />
            Sorted by creation date (newest first)
          </span>
        </div>
      </div>

      {/* Investigations List / Cards */}
      {filteredIncidents.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-12 text-center space-y-4">
          <ShieldAlert className="w-12 h-12 text-slate-600 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-200">No matching incident investigations found</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              No investigations match the current search or asset filter criteria. Start a new incident investigation or clear filters to view all records.
            </p>
          </div>
          <button
            onClick={() => onStartNewInvestigation(activeMachineId !== 'ALL' ? activeMachineId : 'M001')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs font-mono transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>START NEW INCIDENT INVESTIGATION</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredIncidents.map((inc, index) => {
            const machine = machineMap[inc.machine_id];
            const hasMedia = Boolean(inc.verification_media);
            const isLatest = index === 0;

            return (
              <div
                key={inc.incident_id}
                className="bg-slate-900/90 border border-slate-800 hover:border-slate-700/80 rounded-xl p-4 sm:p-5 transition-all shadow-md hover:shadow-xl space-y-3.5 group"
              >
                {/* Top Row: Meta, Badges, Date, Action */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                  <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                    {/* Incident ID */}
                    <span className="px-2.5 py-1 rounded-md bg-slate-950 border border-cyan-800/70 font-bold text-cyan-300 flex items-center gap-1.5 shadow-sm">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                      {inc.incident_id}
                    </span>

                    {/* Machine Badge */}
                    <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-200 font-semibold flex items-center gap-1">
                      <Cpu className="w-3 h-3 text-cyan-400" />
                      {inc.machine_id}
                      {machine ? ` · ${machine.name}` : ''}
                    </span>

                    {/* Latest Badge */}
                    {isLatest && (
                      <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-700/70 text-emerald-300 font-bold text-[10px] uppercase tracking-wider flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        LATEST RECORD
                      </span>
                    )}

                    {/* Status Badge */}
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                        inc.status === 'verified'
                          ? 'bg-emerald-950/90 border-emerald-800 text-emerald-400'
                          : inc.status === 'resolved'
                          ? 'bg-cyan-950/90 border-cyan-800 text-cyan-300'
                          : 'bg-amber-950/90 border-amber-800 text-amber-300'
                      }`}
                    >
                      {inc.status}
                    </span>
                  </div>

                  {/* Date & Quick Launch Button */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      <span>{inc.date}</span>
                    </div>

                    <button
                      onClick={() => onOpenInvestigation(inc)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/80 border border-cyan-700/80 text-cyan-300 font-bold text-xs font-mono transition-colors group-hover:border-cyan-500 shadow-sm"
                      title="Open full investigation workflow for this incident"
                    >
                      <span>OPEN INVESTIGATION</span>
                      <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                    </button>
                  </div>
                </div>

                {/* Middle Grid: Symptom, Confirmed Cause, Repair */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-xs font-mono">
                  {/* Reported Symptom */}
                  <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3 space-y-1">
                    <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-amber-400" />
                      REPORTED SYMPTOM
                    </span>
                    <p className="text-slate-200 font-sans leading-relaxed">{inc.symptom}</p>
                  </div>

                  {/* Confirmed Cause */}
                  <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3 space-y-1">
                    <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3 text-cyan-400" />
                      CONFIRMED ROOT CAUSE
                    </span>
                    <p className="text-slate-200 font-sans leading-relaxed font-semibold">{inc.cause}</p>
                  </div>

                  {/* Corrective Repair & Downtime */}
                  <div className="bg-slate-950/70 border border-slate-800/80 rounded-lg p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        CORRECTIVE REPAIR
                      </span>
                      <span className="text-[10px] text-emerald-400 font-bold tabular-nums">
                        {inc.downtime}m DOWNTIME
                      </span>
                    </div>
                    <p className="text-slate-300 font-sans leading-relaxed">{inc.repair}</p>
                  </div>
                </div>

                {/* Bottom Row: Additional Notes & Proof Media */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 text-[11px] font-mono border-t border-slate-800/50">
                  <div className="text-slate-400 truncate max-w-2xl">
                    {inc.notes ? (
                      <span>
                        <strong className="text-slate-300">Notes:</strong> {inc.notes}
                      </span>
                    ) : inc.verified_by ? (
                      <span>
                        <strong className="text-slate-300">Verified by:</strong> {inc.verified_by}
                      </span>
                    ) : (
                      <span className="text-slate-500 italic">Targeted protocol executed and logged to database.</span>
                    )}
                  </div>

                  {/* Proof Media Preview Button */}
                  <div className="flex items-center gap-2 shrink-0">
                    {hasMedia ? (
                      <button
                        onClick={() => setSelectedProofIncident(inc)}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-purple-950/70 hover:bg-purple-900 border border-purple-800/80 text-purple-300 text-[11px] font-bold transition-colors"
                        title="View inspection photos, video clips, and voice sign-off attached to this investigation"
                      >
                        <Camera className="w-3 h-3 text-purple-400" />
                        <span>VIEW MULTIMEDIA PROOF</span>
                      </button>
                    ) : (
                      <span className="text-slate-600 text-[10px]">Logged in memory</span>
                    )}

                    <button
                      onClick={() => onOpenInvestigation(inc)}
                      className="text-cyan-400 hover:text-cyan-300 text-[11px] font-bold flex items-center gap-1 ml-1"
                    >
                      <span>Open Investigation Workflow</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Proof Media Lightbox Modal */}
      {selectedProofIncident && selectedProofIncident.verification_media && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 max-w-2xl w-full space-y-4 font-mono text-xs max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-cyan-400" />
                <span className="font-bold text-slate-100 text-sm">
                  VERIFIED INVESTIGATION PROOF: {selectedProofIncident.incident_id} ({selectedProofIncident.machine_id})
                </span>
              </div>
              <button
                onClick={() => setSelectedProofIncident(null)}
                className="text-slate-400 hover:text-slate-100 px-2 py-1 rounded bg-slate-800 text-xs"
              >
                ✕ CLOSE
              </button>
            </div>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1.5">
              <div>
                <span className="text-slate-500">Incident Date:</span>{' '}
                <strong className="text-slate-200">{selectedProofIncident.date}</strong>
              </div>
              <div>
                <span className="text-slate-500">Confirmed Root Cause:</span>{' '}
                <strong className="text-cyan-300">{selectedProofIncident.cause}</strong>
              </div>
              <div>
                <span className="text-slate-500">Repair Action:</span>{' '}
                <span className="text-slate-300">{selectedProofIncident.repair}</span>
              </div>
              {selectedProofIncident.notes && (
                <div>
                  <span className="text-slate-500">Technician Notes:</span>{' '}
                  <span className="text-slate-300 italic">{selectedProofIncident.notes}</span>
                </div>
              )}
            </div>

            {/* Photos */}
            {selectedProofIncident.verification_media.photos &&
              selectedProofIncident.verification_media.photos.length > 0 && (
                <div className="space-y-2">
                  <span className="text-slate-300 font-bold block flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-cyan-400" />
                    VERIFIED INSPECTION PHOTOS:
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    {selectedProofIncident.verification_media.photos.map((p) => (
                      <div
                        key={p.id}
                        className="bg-slate-950 rounded-lg border border-slate-800 overflow-hidden cursor-pointer group"
                        onClick={() => setActivePhotoModal(p.url)}
                      >
                        <img
                          src={p.url}
                          alt={p.name}
                          className="w-full h-32 object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="p-1.5 text-[10px] text-slate-400 truncate bg-slate-950">
                          {p.caption || p.name || 'Inspection photograph'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {/* Video */}
            {selectedProofIncident.verification_media.video_url && (
              <div className="space-y-2">
                <span className="text-purple-400 font-bold block flex items-center gap-1.5">
                  <Video className="w-3.5 h-3.5" />
                  SHAFT RUNOUT VIDEO CLIP:
                </span>
                <video
                  src={selectedProofIncident.verification_media.video_url}
                  controls
                  className="w-full h-44 bg-black rounded-lg border border-slate-800 object-cover"
                />
              </div>
            )}

            {/* Audio */}
            {selectedProofIncident.verification_media.audio_url && (
              <div className="space-y-2">
                <span className="text-emerald-400 font-bold block flex items-center gap-1.5">
                  <Mic className="w-3.5 h-3.5" />
                  TECHNICIAN VOICE SIGN-OFF MEMO:
                </span>
                <audio
                  src={selectedProofIncident.verification_media.audio_url}
                  controls
                  className="w-full h-9 bg-slate-950 rounded border border-slate-800"
                />
              </div>
            )}

            <div className="pt-2 flex justify-between items-center border-t border-slate-800">
              <button
                onClick={() => {
                  const targetInc = selectedProofIncident;
                  setSelectedProofIncident(null);
                  onOpenInvestigation(targetInc);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs font-mono transition-colors"
              >
                <span>OPEN IN INVESTIGATOR</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => setSelectedProofIncident(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enlarged Photo Modal */}
      {activePhotoModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 max-w-lg w-full space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-slate-300 border-b border-slate-800 pb-2">
              <span className="font-bold flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-cyan-400" />
                VERIFIED INSPECTION PHOTO
              </span>
              <button
                onClick={() => setActivePhotoModal(null)}
                className="text-slate-400 hover:text-slate-100 px-2 py-0.5 rounded bg-slate-800"
              >
                ✕ CLOSE
              </button>
            </div>
            <img
              src={activePhotoModal}
              alt="Inspection Photo"
              className="w-full h-64 object-cover rounded-lg border border-slate-800"
            />
            <p className="text-xs font-mono text-slate-300 text-center">
              Physical inspection proof attached to verified incident resolution.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
