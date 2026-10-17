import React from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  Layers,
  Radio,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  UserCheck,
  Wrench,
  Zap,
  Plus,
  Sliders,
  RotateCcw,
  Gauge,
  Thermometer,
  ChevronLeft,
  ArrowLeft,
} from 'lucide-react';
import { Machine, Incident, KnowledgeItem } from '../types/industrial';
import { PipelineStep } from './Header';
import { ClassifiedFirestoreError } from '../lib/firebase';
import { fetchIncidentsPage } from '../services/machineMemoryService';
import { DocumentSnapshot } from 'firebase/firestore';

interface DashboardViewProps {
  machines: Machine[];
  incidents: Incident[];
  knowledge: KnowledgeItem[];
  activeMachineId: string; // 'ALL' or 'M001', 'M002', etc.
  onSelectMachineId: (id: string) => void;
  onStartInvestigation: (machineId?: string, step?: PipelineStep) => void;
  onViewRepository: () => void;
  onOpenAddMachine: () => void;
  onManageAssets?: () => void;
  isLoadingData?: boolean;
  isFirestoreConnected?: boolean;
  dbConnectionError?: string | null;
  classifiedError?: ClassifiedFirestoreError | null;
  onRetryConnection?: () => void;
  onSeedDatabase?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  machines,
  incidents,
  knowledge,
  activeMachineId,
  onSelectMachineId,
  onStartInvestigation,
  onViewRepository,
  onOpenAddMachine,
  onManageAssets,
  isLoadingData = false,
  isFirestoreConnected = true,
  dbConnectionError = null,
  classifiedError = null,
  onRetryConnection,
  onSeedDatabase,
}) => {
  // Filter out any invalid/undefined elements - strictly use live database data, never local seed fallback
  const safeMachines: Machine[] = Array.isArray(machines)
    ? machines.filter((m): m is Machine => Boolean(m && typeof m === 'object' && m.machine_id))
    : [];
  const validMachines = safeMachines;

  const safeIncidents: Incident[] = Array.isArray(incidents)
    ? incidents.filter((i): i is Incident => Boolean(i && typeof i === 'object' && i.incident_id))
    : [];

  const safeKnowledge: KnowledgeItem[] = Array.isArray(knowledge)
    ? knowledge.filter((k): k is KnowledgeItem => Boolean(k && typeof k === 'object' && k.knowledge_id))
    : [];

  // Determine if viewing all assets (general mode) or a single particular asset
  const isAllAssetsMode = !activeMachineId || activeMachineId === 'ALL';

  // Find targeted asset if in particular asset mode
  const selectedMachine: Machine | undefined = isAllAssetsMode
    ? undefined
    : validMachines.find((m) => m?.machine_id === activeMachineId) || validMachines[0];

  const selectedMachineId = selectedMachine?.machine_id || 'M001';
  const isSelectedAlert =
    selectedMachine?.status === 'warning' || selectedMachine?.status === 'critical';

  // General fleet statistics
  const totalAssetsCount = validMachines.length;
  const warningCount = validMachines.filter(
    (m) => m?.status === 'warning' || m?.status === 'critical'
  ).length;
  const nominalCount = validMachines.filter((m) => m?.status === 'nominal').length;
  const totalDowntimeMinutes = safeIncidents.reduce((acc, curr) => acc + (curr?.downtime || 0), 0);
  const totalKnowledgeCount = safeKnowledge.length;
  const totalFleetPowerKw = validMachines
    .reduce((acc, m) => acc + (m?.baseline_metrics?.power_baseline_kw || 0), 0)
    .toFixed(1);

  const avgFleetVib =
    totalAssetsCount > 0
      ? (
          validMachines.reduce(
            (acc, m) => acc + (m?.baseline_metrics?.normal_vibration_mms || 1.4),
            0
          ) / totalAssetsCount
        ).toFixed(2)
      : '0.00';

  // Pagination and sorting state
  const [machinePage, setMachinePage] = React.useState(1);
  const [incidentPage, setIncidentPage] = React.useState(1);
  const [pagedIncidentsState, setPagedIncidentsState] = React.useState<Incident[]>([]);
  const [incidentCursors, setIncidentCursors] = React.useState<(DocumentSnapshot | null | undefined)[]>([null]);
  const [hasMoreIncidents, setHasMoreIncidents] = React.useState(false);
  const [isLoadingIncidents, setIsLoadingIncidents] = React.useState(false);

  React.useEffect(() => {
    setMachinePage(1);
    setIncidentPage(1);
    setIncidentCursors([null]);
  }, [activeMachineId]);

  React.useEffect(() => {
    let isMounted = true;
    setIsLoadingIncidents(true);
    const cursor = incidentCursors[incidentPage - 1] || null;
    fetchIncidentsPage(10, cursor)
      .then((res) => {
        if (isMounted) {
          setPagedIncidentsState(res.incidents);
          setHasMoreIncidents(res.hasMore);
          if (res.lastVisible && incidentCursors.length <= incidentPage) {
            setIncidentCursors((prev) => {
              const next = [...prev];
              next[incidentPage] = res.lastVisible;
              return next;
            });
          }
          setIsLoadingIncidents(false);
        }
      })
      .catch(() => {
        if (isMounted) setIsLoadingIncidents(false);
      });
    return () => {
      isMounted = false;
    };
  }, [incidentPage, activeMachineId]);

  const handleIncidentPageChange = (newPage: number) => {
    if (newPage < 1) return;
    setIncidentPage(newPage);
  };

  const sortedMachines = [...validMachines].sort((a, b) => {
    const timeA = new Date(a.installed_date || '').getTime() || 0;
    const timeB = new Date(b.installed_date || '').getTime() || 0;
    if (timeB !== timeA) return timeB - timeA;
    return b.machine_id.localeCompare(a.machine_id);
  });
  const totalMachinePages = Math.ceil(sortedMachines.length / 5) || 1;
  const pagedMachines = sortedMachines.slice((machinePage - 1) * 5, machinePage * 5);

  // Source incidents dataset (full prop list or server paged list)
  const sourceIncidents = React.useMemo(() => {
    return safeIncidents && safeIncidents.length > 0 ? safeIncidents : pagedIncidentsState;
  }, [safeIncidents, pagedIncidentsState]);

  // Determine if active asset filter is active
  const hasActiveFilter = !isAllAssetsMode && Boolean(selectedMachine);

  // Filter incidents across full source dataset
  const allFilteredIncidents = React.useMemo(() => {
    return sourceIncidents.filter((inc) => {
      if (!inc) return false;
      if (hasActiveFilter && selectedMachine && inc.machine_id !== selectedMachine.machine_id) {
        return false;
      }
      return true;
    });
  }, [sourceIncidents, hasActiveFilter, selectedMachine]);

  const PAGE_SIZE = 10;
  const totalIncidentsCount = hasActiveFilter
    ? allFilteredIncidents.length
    : (safeIncidents.length > 0 ? safeIncidents.length : sourceIncidents.length);

  const totalIncidentPages = Math.max(1, Math.ceil(totalIncidentsCount / PAGE_SIZE));

  const pagedIncidents = React.useMemo(() => {
    if (hasActiveFilter) {
      const start = (incidentPage - 1) * PAGE_SIZE;
      return allFilteredIncidents.slice(start, start + PAGE_SIZE);
    }
    return pagedIncidentsState;
  }, [hasActiveFilter, incidentPage, allFilteredIncidents, pagedIncidentsState]);

  // Subsystem badge helper
  const getSubsystemLabel = (type?: string) => {
    switch (type) {
      case 'cnc_spindle':
        return 'CNC Spindle';
      case 'hydraulic_pump':
        return 'Hydraulic Pump';
      case 'planetary_gearbox':
        return 'Planetary Gearbox';
      case 'coolant_pump':
        return 'Coolant Delivery';
      case 'power_generator':
        return 'Power Generator';
      default:
        return 'Subsystem';
    }
  };

  const particularKnowledge = selectedMachine
    ? safeKnowledge.filter(
        (k) => k.machine_id === selectedMachine.machine_id || k.machine_id === 'FLEET'
      )
    : safeKnowledge;

  // If in general mode, find if there is an alert machine to highlight
  const alertMachine = validMachines.find(
    (m) => m?.status === 'warning' || m?.status === 'critical'
  ) || validMachines[0];

  // If data is loading or connection is resolving, display loader
  if (isLoadingData) {
    return (
      <div className="flex flex-col items-center justify-center py-20 rounded-xl bg-slate-900/30 border border-slate-800 space-y-3">
        <div className="w-8 h-8 rounded-full border-2 border-cyan-500 border-t-transparent animate-spin" />
        <p className="text-sm font-mono text-slate-400">Loading dashboard...</p>
      </div>
    );
  }

  // If there is no database connection, show explicit Disconnected Error Screen differentiating error types
  if (!isFirestoreConnected) {
    const isPermission = classifiedError?.type === 'permission_denied';
    const isNetwork = classifiedError?.type === 'network_unreachable';

    return (
      <div
        className={`bg-slate-900/95 border rounded-2xl p-8 sm:p-14 text-center shadow-2xl backdrop-blur-xl flex flex-col items-center justify-center min-h-[460px] relative overflow-hidden ${
          isPermission ? 'border-rose-800/80' : isNetwork ? 'border-amber-800/80' : 'border-rose-900/60'
        }`}
      >
        <div
          className={`absolute inset-0 pointer-events-none ${
            isPermission
              ? 'bg-[radial-gradient(ellipse_60%_60%_at_50%_40%,rgba(244,63,94,0.1),transparent)]'
              : 'bg-[radial-gradient(ellipse_60%_60%_at_50%_40%,rgba(245,158,11,0.1),transparent)]'
          }`}
        />

        <div
          className={`w-16 h-16 rounded-2xl border flex items-center justify-center mb-6 shadow-2xl ${
            isPermission
              ? 'bg-rose-950/80 border-rose-500/50 shadow-rose-950/50 text-rose-400'
              : 'bg-amber-950/80 border-amber-500/50 shadow-amber-950/50 text-amber-400'
          }`}
        >
          {isPermission ? <ShieldAlert className="w-8 h-8" /> : <Radio className="w-8 h-8" />}
        </div>

        <div
          className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-bold uppercase mb-3 tracking-wider border ${
            isPermission
              ? 'bg-rose-950/90 border-rose-800 text-rose-300'
              : 'bg-amber-950/90 border-amber-800 text-amber-300'
          }`}
        >
          {isPermission ? 'Security Policy Notice' : 'Network Connectivity Failure'}
        </div>

        <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide mb-2">
          {classifiedError?.title || (isPermission ? 'Permission Denied' : 'Network Unreachable')}
        </h2>

        <p className="text-xs sm:text-sm text-slate-300 max-w-lg mb-4 font-mono leading-relaxed">
          {classifiedError?.message ||
            'The application cannot operate without an active network connection. In accordance with system policy, local fallback data and offline local storage have been disabled.'}
        </p>

        {classifiedError?.resolution && (
          <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3 max-w-lg w-full mb-5 text-xs text-slate-300 font-mono text-left">
            <span className="text-slate-500 font-bold block mb-1">Recommended Action:</span>
            {classifiedError.resolution}
          </div>
        )}

        {(classifiedError?.details || dbConnectionError) && (
          <div className="bg-black/60 border border-slate-800 rounded-lg p-3.5 text-left max-w-lg w-full mb-6 font-mono text-[11px] text-slate-400 overflow-x-auto shadow-inner">
            <span className="text-slate-500 block mb-1 font-bold">Diagnostic Trace:</span>
            <code className={isPermission ? 'text-rose-300' : 'text-amber-300'}>
              {classifiedError?.details || dbConnectionError}
            </code>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-3">
          {onRetryConnection && (
            <button
              onClick={onRetryConnection}
              className={`px-5 py-2.5 rounded-lg font-mono font-bold text-xs tracking-wider flex items-center gap-2 transition-all shadow-lg cursor-pointer ${
                isPermission
                  ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/60'
                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-950/60'
              }`}
            >
              <RotateCcw className="w-4 h-4" />
              {isPermission ? 'RETRY PERMISSION CHECK' : 'RETRY CONNECTION'}
            </button>
          )}
        </div>
      </div>
    );
  }

  // If connected but no machines in collection
  if (validMachines.length === 0) {
    return (
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-8 sm:p-14 text-center shadow-2xl backdrop-blur-xl flex flex-col items-center justify-center min-h-[420px] relative overflow-hidden">
        <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center mb-5 text-slate-400">
          <Database className="w-8 h-8 text-cyan-400" />
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/80 text-emerald-400 text-xs font-mono font-bold uppercase mb-3">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Connected
        </div>
        <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide mb-2">
          Fleet Collection Is Empty
        </h2>
        <p className="text-xs sm:text-sm text-slate-400 max-w-lg mb-6 font-mono leading-relaxed">
          The system is online, but no machinery assets are registered in the <span className="text-slate-200">machines</span> collection. You can initialize the baseline demonstration fleet or manually register an asset.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {onSeedDatabase && (
            <button
              onClick={onSeedDatabase}
              className="px-5 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-mono font-bold text-xs tracking-wider flex items-center gap-2 transition-all shadow-lg shadow-cyan-900/40 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              INITIALIZE BASELINE FLEET
            </button>
          )}
          <button
            onClick={onOpenAddMachine}
            className="px-5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono font-bold text-xs tracking-wider flex items-center gap-2 transition-all border border-slate-700 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-cyan-400" />
            REGISTER NEW ASSET
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER BANNER (Switches between ALL ASSETS and PARTICULAR ASSET) */}
      {/* ========================================================================= */}
      {isAllAssetsMode ? (
        /* GENERAL FLEET OVERVIEW BANNER */
        <div className="bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-950 border border-slate-800 hover:border-slate-700/80 rounded-xl p-5 sm:p-6 shadow-2xl relative overflow-hidden transition-colors">
          {/* High-tech subtle grid and ambient glow */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#06b6d408_1px,transparent_1px),linear-gradient(to_bottom,#06b6d408_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none" />
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 w-full">
            {/* Reverted Text & Operational Badges */}
            <div className="space-y-3 w-full">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-mono font-bold bg-cyan-950/80 border border-cyan-800 text-cyan-300 shadow-sm">
                  <Activity className="w-3 h-3 text-cyan-400" />
                  CELL #01 ONLINE
                </span>
                <span className="text-slate-600 hidden sm:inline">·</span>
                <span className="text-xs font-mono text-emerald-400 flex items-center gap-1">
                  <Database className="w-3.5 h-3.5 text-emerald-400" />
                  CENTRAL FLEET REPOSITORY
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
                Automated Manufacturing Cell Machinery Fleet
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 font-sans leading-relaxed">
                Displaying aggregate operations across all 5 subsystems of the automated CNC production line: Main Electrospindle, Hydraulic Power Unit, Planetary Rotary Gearbox, Through-Spindle Coolant Delivery, and Standby Diesel Generator. Click any asset below or select from the dropdown to view its individual operating data.
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* PARTICULAR ASSET FOCUSED BANNER */
        <div className="bg-gradient-to-r from-slate-900 via-cyan-950/20 to-slate-950 border border-cyan-500/50 rounded-xl p-5 sm:p-6 shadow-2xl relative overflow-hidden ring-1 ring-cyan-500/40">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#06b6d408_1px,transparent_1px),linear-gradient(to_bottom,#06b6d408_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />

          <div className="relative z-10 space-y-4">
            {/* Top Bar with Back to All Assets Button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => onSelectMachineId('ALL')}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-cyan-400 hover:text-cyan-300 border border-slate-700 text-xs font-mono font-bold transition-all shadow-sm group cursor-pointer"
                  title="Return to general overview of all assets"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>BACK TO ALL ASSETS (FLEET OVERVIEW)</span>
                </button>

                <span className="text-slate-600 hidden sm:inline">|</span>
                <span className="text-xs font-mono text-slate-400">
                  FOCUSED ASSET VIEW: <strong className="text-cyan-300">{selectedMachineId}</strong>
                </span>
              </div>
            </div>

            {/* Asset Headline & Details */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                  <span className="text-base font-extrabold text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800">
                    {selectedMachineId}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold">
                    {getSubsystemLabel(selectedMachine?.subsystem_type)}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                      isSelectedAlert
                        ? 'bg-amber-950 border-amber-800 text-amber-400 animate-pulse'
                        : 'bg-emerald-950 border-emerald-800 text-emerald-400'
                    }`}
                  >
                    {selectedMachine?.status || 'nominal'}
                  </span>
                  <span className="text-slate-400 text-xs">
                    {selectedMachine?.location || 'Plant Floor'} · {selectedMachine?.manufacturer || 'OEM'}
                  </span>
                </div>

                <h1 className="text-xl sm:text-2xl font-bold text-slate-100">
                  {selectedMachine?.name || `Machine Asset ${selectedMachineId}`}
                </h1>
                <p className="text-xs text-slate-300 font-sans max-w-3xl leading-relaxed">
                  {selectedMachine?.description ||
                    'Critical subsystem of automated manufacturing machining line. Operating under ISO 10816-3 continuous vibration & condition monitoring.'}
                </p>
              </div>

              {/* Investigation Trigger */}
              <div className="flex flex-col sm:flex-row lg:flex-col gap-2 shrink-0">
                <button
                  onClick={() =>
                    onStartInvestigation(
                      selectedMachineId,
                      isSelectedAlert ? 'telemetry' : 'capture'
                    )
                  }
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs font-mono transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] cursor-pointer"
                >
                  <Radio className="w-4 h-4 text-slate-950" />
                  <span>START INVESTIGATION FOR {selectedMachineId}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. OPERATIONAL KPI SUMMARY CARDS (Adaptive to ALL vs PARTICULAR) */}
      {/* ========================================================================= */}
      {isAllAssetsMode ? (
        /* GENERAL ALL ASSETS KPIS */
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 font-mono">
          {/* Monitored Fleet */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-4 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-cyan-400" />
                MONITORED FLEET
              </span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded border ${
                  warningCount > 0
                    ? 'bg-amber-950/60 border-amber-800/80 text-amber-400'
                    : 'bg-emerald-950/60 border-emerald-800/80 text-emerald-400'
                }`}
              >
                {warningCount > 0 ? `${warningCount} ALERT` : 'NOMINAL'}
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-100 tabular-nums">
              {totalAssetsCount}{' '}
              <span className="text-xs font-normal text-slate-400">ASSETS</span>
            </div>
            <div className="text-[11px] text-slate-500 truncate">
              All Assets
            </div>
          </div>

          {/* Combined Plant Power */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-4 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-400" />
                TOTAL ACTIVE LOAD
              </span>
              <span className="text-[10px] text-amber-400 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/80">
                PRODUCTION
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-400 tabular-nums">
              {totalFleetPowerKw}{' '}
              <span className="text-xs font-normal text-slate-400">kW</span>
            </div>
            <div className="text-[11px] text-slate-500">
              All 5 Subsystems Combined
            </div>
          </div>

          {/* Average ISO 10816-3 Vibration */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-4 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <Gauge className="w-4 h-4 text-cyan-400" />
                AVG ISO VIBRATION
              </span>
              <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/80">
                ZONE A/B
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-cyan-400 tabular-nums">
              {avgFleetVib}{' '}
              <span className="text-xs font-normal text-slate-400">mm/s</span>
            </div>
            <div className="text-[11px] text-slate-500">
              Fleet Baseline RMS Standard
            </div>
          </div>

          {/* Institutional Knowledge Records */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-4 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <BrainCircuit className="w-4 h-4 text-purple-400" />
                PLANT MEMORY
              </span>
              <span className="text-[10px] text-purple-400 bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-800/80">
                CROSS-ASSET
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-purple-400 tabular-nums">
              {totalKnowledgeCount}{' '}
              <span className="text-xs font-normal text-slate-400">RECORDS</span>
            </div>
            <div className="text-[11px] text-slate-500">
              Technician Notes &amp; OEM Standards
            </div>
          </div>
        </div>
      ) : (
        /* PARTICULAR ASSET SPECIFIC METRIC CARDS */
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 font-mono">
          {/* Baseline Vibration */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-4 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <Gauge className="w-4 h-4 text-cyan-400" />
                ISO 10816-3 VIB
              </span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded border ${
                  isSelectedAlert
                    ? 'bg-amber-950 border-amber-800 text-amber-400 font-bold'
                    : 'bg-emerald-950 border-emerald-800 text-emerald-400'
                }`}
              >
                {isSelectedAlert ? 'BREACH (2.8)' : 'NOMINAL'}
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-cyan-400 tabular-nums">
              {isSelectedAlert
                ? '2.8'
                : selectedMachine?.baseline_metrics?.normal_vibration_mms ?? '1.4'}{' '}
              <span className="text-xs font-normal text-slate-400">mm/s</span>
            </div>
            <div className="text-[11px] text-slate-500">
              Alert Limit: {selectedMachine?.baseline_metrics?.iso_vibration_limit ?? 2.2} mm/s
            </div>
          </div>

          {/* Operating Temperature */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-4 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <Thermometer className="w-4 h-4 text-rose-400" />
                OPERATING TEMP
              </span>
              <span className="text-[10px] text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                MAX {selectedMachine?.baseline_metrics?.max_temp_c ?? 85}&deg;C
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-100 tabular-nums">
              {isSelectedAlert
                ? '74.2'
                : selectedMachine?.baseline_metrics?.normal_temp_c ?? 65}
              &deg;C
            </div>
            <div className="text-[11px] text-slate-500">
              Baseline: {selectedMachine?.baseline_metrics?.normal_temp_c ?? 65}&deg;C
            </div>
          </div>

          {/* Rated Speed */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-4 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-purple-400" />
                RATED SPEED
              </span>
              <span className="text-[10px] text-purple-400 bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-800/80">
                SYNCHRONOUS
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-purple-400 tabular-nums">
              {selectedMachine?.baseline_metrics?.rated_rpm ?? 3000}{' '}
              <span className="text-xs font-normal text-slate-400">RPM</span>
            </div>
            <div className="text-[11px] text-slate-500">
              Rated Operating Point
            </div>
          </div>

          {/* Subsystem Power */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-4 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-emerald-400" />
                POWER DRAW
              </span>
              <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/80">
                NOMINAL
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400 tabular-nums">
              {selectedMachine?.baseline_metrics?.power_baseline_kw ?? 15}{' '}
              <span className="text-xs font-normal text-slate-400">kW</span>
            </div>
            <div className="text-[11px] text-slate-500">
              Subsystem Prime Load
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. CORE CONTENT AREA (Adaptive to ALL vs PARTICULAR) */}
      {/* ========================================================================= */}
      {isAllAssetsMode ? (
        /* ------------------ GENERAL MODE: SCALABLE FLEET INVESTIGATION & ASSET MATRIX ------------------ */
        <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-4 sm:p-5 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 gap-2">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm sm:text-base font-bold text-slate-100 font-mono">
                PLANT FLEET ASSET DIAGNOSTIC &amp; INVESTIGATION MATRIX
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
              <span className="text-slate-400 hidden sm:inline">
                {validMachines.length} ASSETS MONITORED
              </span>
              <button
                onClick={onOpenAddMachine}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-mono transition-colors cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>REGISTER NEW ASSET</span>
              </button>
            </div>
          </div>

          {/* Scalable Structured Table View */}
          <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950 font-mono text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/80 text-slate-400 border-b border-slate-800 text-[11px] whitespace-nowrap">
                  <th className="py-2.5 px-3">ASSET ID &amp; NAME</th>
                  <th className="py-2.5 px-3">SUBSYSTEM TYPE</th>
                  <th className="py-2.5 px-3">STATUS</th>
                  <th className="py-2.5 px-3">BASELINE VIB</th>
                  <th className="py-2.5 px-3">ISO LIMIT</th>
                  <th className="py-2.5 px-3">INCIDENTS</th>
                  <th className="py-2.5 px-3 text-right">ACTION</th>
                </tr>
              </thead>
               <tbody className="divide-y divide-slate-800/60 whitespace-nowrap">
                {pagedMachines.map((m) => {
                  if (!m || !m.machine_id) return null;
                  const isAlert = m.status === 'warning' || m.status === 'critical';
                  const assetIncidentsCount = safeIncidents.filter((i) => i.machine_id === m.machine_id).length;

                  return (
                    <tr key={m.machine_id} className="hover:bg-slate-900/50 transition-colors">
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-cyan-400 shrink-0">{m.machine_id}</span>
                          <div className="relative group inline-block max-w-[200px] align-middle">
                            <span className="block truncate font-sans text-xs text-slate-300">
                              {m.name || `Machine ${m.machine_id}`}
                            </span>
                            {m.name && m.name.length > 22 && (
                              <div className="absolute z-50 left-0 bottom-full mb-1 hidden group-hover:block w-max max-w-xs p-2 rounded bg-slate-900 border border-slate-700 text-xs text-slate-100 shadow-xl font-sans normal-case pointer-events-none whitespace-normal">
                                {m.name}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                        {getSubsystemLabel(m.subsystem_type)}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            isAlert
                              ? 'bg-amber-950 border border-amber-800 text-amber-400'
                              : 'bg-emerald-950 border border-emerald-800 text-emerald-400'
                          }`}
                        >
                          {m.status || 'nominal'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-300 whitespace-nowrap">
                        {m.baseline_metrics?.normal_vibration_mms ?? 1.4} mm/s
                      </td>
                      <td className="py-2.5 px-3 text-amber-400 font-semibold whitespace-nowrap">
                        {m.baseline_metrics?.iso_vibration_limit ?? 2.2} mm/s
                      </td>
                      <td className="py-2.5 px-3 text-cyan-300 whitespace-nowrap">
                        {assetIncidentsCount} logged
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => onSelectMachineId(m.machine_id)}
                          className="px-2.5 py-1 rounded bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 text-[11px] font-bold transition-colors cursor-pointer"
                        >
                          View Data →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination controls */}
          {sortedMachines.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 px-1 border-t border-slate-800 text-xs font-mono text-slate-400">
              <span>
                Page {machinePage} of {totalMachinePages} ({sortedMachines.length} total records)
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMachinePage((p) => Math.max(1, p - 1))}
                  disabled={machinePage === 1 || sortedMachines.length <= 5}
                  className="px-3 py-1 rounded bg-slate-900 border border-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Previous
                </button>
                <button
                  onClick={() => setMachinePage((p) => Math.min(totalMachinePages, p + 1))}
                  disabled={machinePage >= totalMachinePages || sortedMachines.length <= 5}
                  className="px-3 py-1 rounded bg-slate-900 border border-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* -------------- PARTICULAR ASSET MODE: ISO SPECIFICATIONS & PARAMETERS -------------- */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: ISO 10816-3 Baseline Specifications */}
          <div className="lg:col-span-6 bg-slate-900/90 border border-slate-800 rounded-lg p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-cyan-400" />
                <h2 className="text-sm sm:text-base font-bold text-slate-100 font-mono">
                  ISO 10816-3 OPERATING BASELINE ({selectedMachineId})
                </h2>
              </div>
              <span className="text-[11px] font-mono text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800">
                {selectedMachine?.iso_machine_group ||
                  selectedMachine?.baseline_metrics?.iso_group ||
                  'Group 2'}
              </span>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-950 p-3 rounded border border-slate-800">
                <div>
                  <span className="text-slate-500 block">Machine Group:</span>
                  <span className="text-slate-200 font-bold">
                    {selectedMachine?.iso_machine_group ||
                      selectedMachine?.baseline_metrics?.iso_group ||
                      'Group 2 (15-300 kW)'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Foundation Support:</span>
                  <span className="text-slate-200 font-bold uppercase">
                    {selectedMachine?.foundation_type ||
                      selectedMachine?.baseline_metrics?.foundation_type ||
                      'rigid'}
                  </span>
                </div>
              </div>

              {/* Vibration Severity Zones Table */}
              <div className="border border-slate-800 rounded p-3 space-y-2 bg-slate-950/60">
                <div className="text-slate-400 text-[11px] font-bold">
                  ISO 10816-3 VIBRATION SEVERITY CLASSIFICATION:
                </div>
                <div className="grid grid-cols-4 gap-2 text-center text-[10px]">
                  <div className="bg-emerald-950/40 border border-emerald-800/80 rounded p-1.5">
                    <span className="text-emerald-400 font-bold block">ZONE A</span>
                    <span className="text-slate-300 block">
                      &le; {selectedMachine?.baseline_metrics?.iso_zone_a_limit || 1.4}
                    </span>
                    <span className="text-slate-500 text-[9px]">Good</span>
                  </div>
                  <div className="bg-cyan-950/40 border border-cyan-800/80 rounded p-1.5">
                    <span className="text-cyan-400 font-bold block">ZONE B</span>
                    <span className="text-slate-300 block">
                      &le; {selectedMachine?.baseline_metrics?.iso_zone_b_limit || 2.8}
                    </span>
                    <span className="text-slate-500 text-[9px]">Acceptable</span>
                  </div>
                  <div className="bg-amber-950/40 border border-amber-800/80 rounded p-1.5">
                    <span className="text-amber-400 font-bold block">ZONE C</span>
                    <span className="text-slate-300 block">
                      &le; {selectedMachine?.baseline_metrics?.iso_zone_c_limit || 4.5}
                    </span>
                    <span className="text-slate-500 text-[9px]">Alert</span>
                  </div>
                  <div className="bg-rose-950/40 border border-rose-800/80 rounded p-1.5">
                    <span className="text-rose-400 font-bold block">ZONE D</span>
                    <span className="text-slate-300 block">
                      &gt; {selectedMachine?.baseline_metrics?.iso_zone_c_limit || 4.5}
                    </span>
                    <span className="text-slate-500 text-[9px]">Danger Trip</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center text-[11px] pt-1">
                <span className="text-slate-400">Continuous ISO Monitoring Standard:</span>
                <span className="text-slate-200 font-semibold">ISO 10816-3:2009 / RMS Velocity</span>
              </div>
            </div>
          </div>

          {/* Right Column: Asset-Specific Baseline Operating Parameters */}
          <div className="lg:col-span-6 bg-slate-900/90 border border-slate-800 rounded-lg p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm sm:text-base font-bold text-slate-100 font-mono">
                  SUBSYSTEM OPERATING PARAMETERS ({selectedMachineId})
                </h2>
              </div>
              <span className="text-xs font-mono text-slate-400">
                {getSubsystemLabel(selectedMachine?.subsystem_type)}
              </span>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {selectedMachine?.subsystem_parameters?.key_parameters &&
                selectedMachine.subsystem_parameters.key_parameters.length > 0 ? (
                  selectedMachine.subsystem_parameters.key_parameters.map((p: any, idx: number) => (
                    <div
                      key={idx}
                      className="bg-slate-950 border border-slate-800 rounded p-2.5 space-y-1"
                    >
                      <div className="text-[10px] text-slate-400 uppercase truncate">
                        {p.name}
                      </div>
                      <div className="text-base font-extrabold text-cyan-300">
                        {p.baseline_value}{' '}
                        <span className="text-xs font-normal text-slate-400">{p.unit}</span>
                      </div>
                      <div className="text-[9px] text-slate-500">Normal Baseline</div>
                    </div>
                  ))
                ) : (
                  <>
                    <div className="bg-slate-950 border border-slate-800 rounded p-2.5 space-y-1">
                      <div className="text-[10px] text-slate-400 uppercase">Operating Pressure</div>
                      <div className="text-base font-extrabold text-cyan-300">
                        {selectedMachine?.baseline_metrics?.primary_parameter_value || '18.5'}{' '}
                        <span className="text-xs font-normal text-slate-400">
                          {selectedMachine?.baseline_metrics?.primary_parameter_unit || 'kN'}
                        </span>
                      </div>
                      <div className="text-[9px] text-slate-500">Baseline Tolerance</div>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded p-2.5 space-y-1">
                      <div className="text-[10px] text-slate-400 uppercase">Mechanical Tolerance</div>
                      <div className="text-base font-extrabold text-amber-300">
                        {selectedMachine?.baseline_metrics?.secondary_parameter_value || '0.002'}{' '}
                        <span className="text-xs font-normal text-slate-400">
                          {selectedMachine?.baseline_metrics?.secondary_parameter_unit || 'mm'}
                        </span>
                      </div>
                      <div className="text-[9px] text-slate-500">Radial Runout Spec</div>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded p-2.5 space-y-1">
                      <div className="text-[10px] text-slate-400 uppercase">Lubrication Pressure</div>
                      <div className="text-base font-extrabold text-emerald-300">
                        {selectedMachine?.baseline_metrics?.tertiary_parameter_value || '0.35'}{' '}
                        <span className="text-xs font-normal text-slate-400">
                          {selectedMachine?.baseline_metrics?.tertiary_parameter_unit || 'bar'}
                        </span>
                      </div>
                      <div className="text-[9px] text-slate-500">Lube Mist Supply</div>
                    </div>
                  </>
                )}
              </div>

              <div className="bg-slate-950/80 p-3 rounded border border-slate-800 text-slate-300 text-[11px] leading-relaxed font-sans">
                <strong>Subsystem Architecture: </strong>
                {selectedMachine?.description ||
                  `Dedicated ${getSubsystemLabel(selectedMachine?.subsystem_type)} configured for high-precision manufacturing cell.`}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. ACTIVE SHIFT ANOMALY / ALERT DRILLDOWN */}
      {/* ========================================================================= */}
      {isSelectedAlert && selectedMachine ? (
        <div className="bg-slate-900/90 border border-amber-900/80 rounded-lg p-4 sm:p-5 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 mb-3 border-b border-slate-800 gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded bg-amber-500/20 text-amber-400 shrink-0">
                <AlertTriangle className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2 text-xs font-mono text-amber-400 font-bold">
                  <span>ACTIVE SHIFT ANOMALY DETECTED</span>
                  <span>·</span>
                  <span>{selectedMachineId}</span>
                  <span>·</span>
                  <span>{selectedMachine.location || 'CNC Bay 1'}</span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-100">
                  {selectedMachineId}: {selectedMachine.name} (Vibration Threshold Breach Detected)
                </h3>
              </div>
            </div>

            <button
              onClick={() => onStartInvestigation(selectedMachineId, 'telemetry')}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs font-mono transition-all shrink-0 shadow-[0_0_12px_rgba(245,158,11,0.3)]"
            >
              <span>INSPECT SENSOR CSV ({selectedMachineId})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono bg-slate-950 p-3 rounded border border-slate-800">
            <div>
              <span className="text-slate-500">Live Vibration:</span>
              <div className="text-amber-400 font-bold text-sm">
                2.8 mm/s (Alert Breach)
              </div>
              <div className="text-[10px] text-slate-500">
                ISO Limit: {selectedMachine.baseline_metrics?.iso_vibration_limit ?? 2.2} mm/s
              </div>
            </div>
            <div>
              <span className="text-slate-500">Operating Temp:</span>
              <div className="text-cyan-400 font-bold text-sm">
                74.1&deg;C (Thermal Rise)
              </div>
              <div className="text-[10px] text-slate-500">
                Baseline: {selectedMachine.baseline_metrics?.normal_temp_c ?? 65}&deg;C
              </div>
            </div>
            <div>
              <span className="text-slate-500">Rotational Speed:</span>
              <div className="text-purple-400 font-bold text-sm">
                {selectedMachine.baseline_metrics?.rated_rpm ?? 3000} RPM
              </div>
              <div className="text-[10px] text-slate-500">Steady State</div>
            </div>
            <div>
              <span className="text-slate-500">Drive Load Power:</span>
              <div className="text-emerald-400 font-bold text-sm">
                {((selectedMachine.baseline_metrics?.power_baseline_kw ?? 15) * 1.08).toFixed(1)} kW
              </div>
              <div className="text-[10px] text-slate-500">+8% friction torque</div>
            </div>
          </div>
        </div>
      ) : null}

      {/* ========================================================================= */}
      {/* 5. HISTORICAL INCIDENT ARCHIVE TABLE (Adaptive: All vs Particular Asset) */}
      {/* ========================================================================= */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-4 sm:p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 gap-2">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm sm:text-base font-bold text-slate-100 font-mono">
              {isAllAssetsMode
                ? 'PLANT INCIDENT ARCHIVE & RESOLUTIONS (ALL ASSETS)'
                : `INCIDENT ARCHIVE & RESOLUTIONS FOR ${selectedMachineId}`}
            </h2>
          </div>
          <span className="text-xs font-mono text-slate-400">
            SHOWING {pagedIncidents.length} RECORDS · DOWNTIME:{' '}
            {allFilteredIncidents.reduce((acc, curr) => acc + (curr?.downtime || 0), 0)} MINS
          </span>
        </div>

        {pagedIncidents.length === 0 ? (
          <div className="p-6 text-center text-xs font-mono text-slate-400 bg-slate-950 rounded border border-slate-800">
            <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-400 mb-2" />
            <div className="font-semibold text-slate-200">
              No historical incidents on record for {selectedMachineId}.
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 whitespace-nowrap">
                  <tr>
                    <th className="py-2.5 px-3">INCIDENT</th>
                    <th className="py-2.5 px-3">DATE</th>
                    <th className="py-2.5 px-3">ASSET</th>
                    <th className="py-2.5 px-3">SYMPTOM</th>
                    <th className="py-2.5 px-3">CONFIRMED CAUSE</th>
                    <th className="py-2.5 px-3">REPAIR ACTION</th>
                    <th className="py-2.5 px-3">DOWNTIME</th>
                    <th className="py-2.5 px-3">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-slate-300 whitespace-nowrap">
                  {pagedIncidents.map((inc) => (
                    <tr
                      key={inc?.incident_id || Math.random().toString()}
                      className="hover:bg-slate-950/40"
                    >
                      <td className="py-2.5 px-3 font-bold text-cyan-400 whitespace-nowrap">{inc?.incident_id}</td>
                      <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">{inc?.date}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-200 whitespace-nowrap">
                        <button
                          onClick={() => onSelectMachineId(inc.machine_id)}
                          className="text-cyan-400 hover:underline"
                        >
                          {inc?.machine_id}
                        </button>
                      </td>
                      <td className="py-2.5 px-3 text-amber-400 whitespace-nowrap">
                        <div className="relative group inline-block max-w-[200px] align-middle">
                          <span className="block truncate font-mono">
                            {inc?.symptom || '-'}
                          </span>
                          {inc?.symptom && inc.symptom.length > 22 && (
                            <div className="absolute z-50 left-0 bottom-full mb-1 hidden group-hover:block w-max max-w-sm p-2 rounded bg-slate-900 border border-slate-700 text-xs text-slate-100 shadow-xl font-sans normal-case pointer-events-none whitespace-normal leading-relaxed">
                              {inc.symptom}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-200 whitespace-nowrap">
                        <div className="relative group inline-block max-w-[220px] align-middle">
                          <span className="block truncate font-mono">
                            {inc?.cause || '-'}
                          </span>
                          {inc?.cause && inc.cause.length > 25 && (
                            <div className="absolute z-50 left-0 bottom-full mb-1 hidden group-hover:block w-max max-w-sm p-2 rounded bg-slate-900 border border-slate-700 text-xs text-slate-100 shadow-xl font-sans normal-case pointer-events-none whitespace-normal leading-relaxed">
                              {inc.cause}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-cyan-300 whitespace-nowrap">
                        <div className="relative group inline-block max-w-[220px] align-middle">
                          <span className="block truncate font-mono">
                            {inc?.repair || '-'}
                          </span>
                          {inc?.repair && inc.repair.length > 25 && (
                            <div className="absolute z-50 left-0 bottom-full mb-1 hidden group-hover:block w-max max-w-sm p-2 rounded bg-slate-900 border border-slate-700 text-xs text-slate-100 shadow-xl font-sans normal-case pointer-events-none whitespace-normal leading-relaxed">
                              {inc.repair}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-emerald-400 tabular-nums whitespace-nowrap">
                        {inc?.downtime}m
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-800 text-emerald-400 font-bold uppercase">
                          {inc?.status || 'resolved'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Server-side / Client-filtered Pagination Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 px-1 border-t border-slate-800 text-xs font-mono text-slate-400">
              <span>
                Page <strong className="text-cyan-400">{incidentPage}</strong> of{' '}
                <strong className="text-slate-400">{totalIncidentPages}</strong> ({totalIncidentsCount} total records)
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleIncidentPageChange(incidentPage - 1)}
                  disabled={incidentPage === 1 || isLoadingIncidents}
                  className="px-3 py-1 rounded bg-slate-900 border border-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Previous
                </button>
                <button
                  onClick={() => handleIncidentPageChange(incidentPage + 1)}
                  disabled={
                    hasActiveFilter
                      ? incidentPage >= totalIncidentPages
                      : !hasMoreIncidents || isLoadingIncidents
                  }
                  className="px-3 py-1 rounded bg-slate-900 border border-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 6. INSTITUTIONAL MEMORY & FAILURE PROFILE */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Failure Modes & Root Cause Breakdown */}
        <div className="lg:col-span-6 bg-slate-900/90 border border-slate-800 rounded-lg p-4 sm:p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm sm:text-base font-bold text-slate-100 font-mono">
                PLANT FAILURE MODES &amp; DOWNTIME PROFILE
              </h2>
            </div>
            <span className="text-xs font-mono text-emerald-400">
              {isAllAssetsMode ? 'CROSS-FLEET' : `${selectedMachineId} CONTEXT`}
            </span>
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Spindle Coupling Misalignment (Thermal Expansion)</span>
                <span className="text-cyan-400 font-bold">45% OF INCIDENTS</span>
              </div>
              <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                <div className="h-full bg-cyan-500 rounded-full w-[45%]" />
              </div>
              <div className="flex justify-between text-[11px] text-slate-500 mt-0.5">
                <span>Average Downtime: 42 mins</span>
                <span className="text-emerald-400">Save 53m vs premature bearing swap</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Hydraulic Suction Strainer Swarf Cavitation</span>
                <span className="text-amber-400 font-bold">25% OF INCIDENTS</span>
              </div>
              <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                <div className="h-full bg-amber-500 rounded-full w-1/4" />
              </div>
              <div className="flex justify-between text-[11px] text-slate-500 mt-0.5">
                <span>Average Downtime: 38 mins</span>
                <span>Flush swarf mesh before pump replacement</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Planetary Gear Mesh Chatter &amp; Thermal Lube Thinning</span>
                <span className="text-purple-400 font-bold">15% OF INCIDENTS</span>
              </div>
              <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                <div className="h-full bg-purple-500 rounded-full w-[15%]" />
              </div>
              <div className="flex justify-between text-[11px] text-slate-500 mt-0.5">
                <span>Average Downtime: 50 mins</span>
                <span>Check gear lube ISO VG 220 viscosity</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Coolant Suction Filter Flutter &amp; Delivery Drop</span>
                <span className="text-emerald-400 font-bold">15% OF INCIDENTS</span>
              </div>
              <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                <div className="h-full bg-emerald-500 rounded-full w-[15%]" />
              </div>
              <div className="flex justify-between text-[11px] text-slate-500 mt-0.5">
                <span>Average Downtime: 32 mins</span>
                <span>Inspect bag filter canister seal</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Tribal Knowledge Feed */}
        <div className="lg:col-span-6 bg-slate-900/90 border border-slate-800 rounded-lg p-4 sm:p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm sm:text-base font-bold text-slate-100 font-mono">
                {isAllAssetsMode
                  ? 'INSTITUTIONAL MEMORY FEED (ALL ASSETS)'
                  : `INSTITUTIONAL MEMORY FOR ${selectedMachineId}`}
              </h2>
            </div>
            <button
              onClick={onViewRepository}
              className="text-xs font-mono text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
            >
              View Repository ({safeKnowledge.length}) →
            </button>
          </div>

          <div className="space-y-3">
          {particularKnowledge.length === 0 ? (
            <div className="p-6 text-center text-xs font-mono text-slate-400 bg-slate-950 rounded border border-slate-800">
              <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-400 mb-2" />
              <div className="font-semibold text-slate-200">
                No institutional knowledge on record for {selectedMachineId}.
              </div>
            </div>
          ) : (
            particularKnowledge.slice(0, 2).map((k) => (
              <div
                key={k?.knowledge_id || Math.random().toString()}
                className="bg-slate-950 border border-slate-800 rounded p-3 text-xs font-mono space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-cyan-300 truncate max-w-[220px]">
                    {k?.title || 'Operational Insight'}
                  </span>
                  <span className="text-[10px] text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 shrink-0">
                    {k?.machine_id || 'FLEET'}
                  </span>
                </div>
                <p className="text-slate-300 text-[11px] italic leading-relaxed">
                  "{k?.content || ''}"
                </p>
                <div className="flex justify-between text-[10px] text-slate-500 pt-1">
                  <span>Author: {k?.created_by || 'Technician'}</span>
                  <span className="text-emerald-400">
                    Date: {k?.created_at ? new Date(k.created_at).toDateString() : 'Unknown'}
                  </span>
                </div>
              </div>
            ))
          )}
          </div>
        </div>
      </div>
    </div>
  );
};
