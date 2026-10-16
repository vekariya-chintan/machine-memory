import React from 'react';
import {
  Activity,
  Cpu,
  Database,
  RotateCcw,
  ShieldAlert,
  CheckCircle2,
  BrainCircuit,
  Radio,
  LayoutDashboard,
  BookOpen,
  RefreshCw,
  Sliders,
  ArrowLeft,
  Plus,
  Lock,
  LogOut,
  User,
  Users,
} from 'lucide-react';
import { Machine, Technician } from '../types/industrial';
import { SearchableDropdown, DropdownOption } from './SearchableDropdown';

export type PipelineStep =
  | 'capture'
  | 'extract'
  | 'telemetry'
  | 'retrieve'
  | 'investigate'
  | 'learn';

export type NavigationMode = 'dashboard' | 'investigation' | 'repository' | 'assets' | 'technicians';

interface HeaderProps {
  currentMode: NavigationMode;
  onModeChange: (mode: NavigationMode) => void;
  currentStep: PipelineStep;
  onStepChange: (step: PipelineStep) => void;
  onReset: () => void;
  activeMachineId: string;
  onSelectMachineId: (id: string) => void;
  machines: Machine[];
  isFirestoreConnected: boolean;
  investigationSubView?: 'list' | 'workflow';
  onBackToInvestigationsList?: () => void;
  onStartNewInvestigation?: () => void;
  isStep1Completed?: boolean;
  authenticatedTechnician?: Technician | null;
  onLogout?: () => void;
}

const STEPS: { id: PipelineStep; label: string; shortLabel: string; number: string; icon: React.ReactNode }[] = [
  { id: 'capture', label: 'Incident Report', shortLabel: 'Report', number: '01', icon: <Radio className="w-3.5 h-3.5 shrink-0" /> },
  { id: 'extract', label: 'Fact Extraction', shortLabel: 'Extraction', number: '02', icon: <BrainCircuit className="w-3.5 h-3.5 shrink-0" /> },
  { id: 'telemetry', label: 'Sensor Telemetry', shortLabel: 'Telemetry', number: '03', icon: <Activity className="w-3.5 h-3.5 shrink-0" /> },
  { id: 'retrieve', label: 'Evidence Retrieval', shortLabel: 'Retrieval', number: '04', icon: <Database className="w-3.5 h-3.5 shrink-0" /> },
  { id: 'investigate', label: 'Investigate & Explain', shortLabel: 'Investigate', number: '05', icon: <ShieldAlert className="w-3.5 h-3.5 shrink-0" /> },
  { id: 'learn', label: 'Verify & Learn', shortLabel: 'Verify', number: '06', icon: <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> },
];

export const Header: React.FC<HeaderProps> = ({
  currentMode,
  onModeChange,
  currentStep,
  onStepChange,
  onReset,
  activeMachineId,
  onSelectMachineId,
  machines = [],
  isFirestoreConnected,
  investigationSubView = 'list',
  onBackToInvestigationsList,
  onStartNewInvestigation,
  isStep1Completed = false,
  authenticatedTechnician,
  onLogout,
}) => {
  const safeMachines = Array.isArray(machines)
    ? machines.filter((m): m is Machine => Boolean(m && typeof m === 'object' && m.machine_id))
    : [];

  // Dropdown options with search capabilities
  const assetDropdownOptions: DropdownOption[] = safeMachines.map((m) => {
    const isAlert = m.status === 'warning' || m.status === 'critical';
    return {
      value: m.machine_id,
      label: `${m.machine_id} - ${m.name || m.machine_id}`,
      subLabel: `${m.subsystem_type ? m.subsystem_type.replace('_', ' ').toUpperCase() : 'SUBSYSTEM'} · ${m.location || 'CNC Bay'}`,
      badge: m.status || 'nominal',
      badgeColor: isAlert ? 'amber' : 'emerald',
      icon: <Cpu className="w-3.5 h-3.5" />,
    };
  });

  return (
    <header className="border-b border-slate-800 bg-slate-950/95 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        {/* Top Navbar Row */}
        <div className="flex flex-row items-center justify-between py-2 sm:py-2.5 gap-2 sm:gap-3 border-b border-slate-900 flex-nowrap">
          {/* Logo & Operational Subtitle */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <button
              onClick={() => onModeChange('dashboard')}
              className="flex items-center gap-2.5 text-left hover:opacity-95 transition-opacity group cursor-pointer"
              title="Team Prompt Nova - MachineMemory Fleet Dashboard"
            >
              {/* PromptNova Uploaded Brand Logo */}
              <div className="relative flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-slate-900/90 border border-purple-500/40 p-0.5 shadow-[0_0_12px_rgba(168,85,247,0.3)] shrink-0 overflow-hidden group-hover:border-purple-400 transition-colors">
                <img
                  src="/PromptNova.png"
                  alt="PromptNova Logo"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    // Fallback to vector SVG if png load fails
                    (e.target as HTMLImageElement).src = '/promptnova-logo.svg';
                  }}
                />
                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-fuchsia-400 animate-pulse border border-slate-950" />
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold tracking-wider text-slate-100 text-xs sm:text-sm leading-none flex items-center gap-1">
                  MACHINE<span className="text-cyan-400">MEMORY</span>
                </span>
                <span className="text-[9px] font-mono text-cyan-400/95 font-bold tracking-widest uppercase mt-0.5 flex items-center gap-1">
                  TEAM PROMPT NOVA
                </span>
              </div>
            </button>
            <span className="text-slate-800 hidden lg:inline">|</span>
            <div className="hidden lg:flex flex-col text-[10px] xl:text-[11px] font-mono leading-tight text-slate-400">
              <span className="font-semibold text-slate-300 tracking-tight">INDUSTRIAL RELIABILITY &amp;</span>
              <span className="text-slate-400 tracking-tight">INCIDENT INVESTIGATION ENGINE</span>
            </div>
          </div>

          {/* Quick Actions & Status in requested sequence */}
          <div className="flex items-center flex-nowrap gap-1.5 sm:gap-2.5 font-mono text-[11px] shrink-0 ml-auto">
            {/* 1. Searchable Asset Selector Dropdown with responsive width */}
            <div className="w-[130px] sm:w-[170px] md:w-[200px] lg:w-[240px] shrink-0">
              <SearchableDropdown
                options={assetDropdownOptions}
                value={activeMachineId}
                onChange={onSelectMachineId}
                labelPrefix="ASSET:"
                icon={<Cpu className="w-3.5 h-3.5" />}
                showAllOption={true}
                allOptionLabel="ALL ASSETS (Fleet Overview)"
                allOptionValue="ALL"
                placeholder="Select Asset..."
                searchPlaceholder="Search asset by ID or name..."
                align="left"
                className="w-full"
                buttonClassName="w-full"
              />
            </div>

            {/* 2. Reset Step Walkthrough Button placed next to Asset Dropdown */}
            <button
              onClick={onReset}
              className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-cyan-300 transition-colors shrink-0 whitespace-nowrap shadow-sm cursor-pointer"
              title="Reset walkthrough demonstration"
            >
              <RotateCcw className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="hidden sm:inline font-bold">RESET</span>
            </button>

            {/* 3. Connection Indicator */}
            <div
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-800 shrink-0"
              title="Connection status"
            >
              <Database className={`w-3.5 h-3.5 shrink-0 ${isFirestoreConnected ? 'text-emerald-400' : 'text-rose-400'}`} />
              <span className={`text-[10px] sm:text-[11px] font-semibold ${isFirestoreConnected ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isFirestoreConnected ? 'CONNECTED' : 'DISCONNECTED'}
              </span>
            </div>

            {/* 4. Authenticated Technician Pill & Sign Out */}
            {authenticatedTechnician && (
              <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 shrink-0">
                <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-cyan-600 to-purple-600 flex items-center justify-center font-bold text-[9px] text-white shrink-0">
                  {authenticatedTechnician.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="flex flex-col text-left hidden md:flex min-w-0 max-w-[120px] lg:max-w-[160px]">
                  <span className="text-[10px] text-slate-200 font-bold truncate leading-tight">
                    {authenticatedTechnician.name}
                  </span>
                  <span className="text-[8px] text-slate-400 truncate leading-tight">
                    {authenticatedTechnician.role}
                  </span>
                </div>
                {onLogout && (
                  <button
                    onClick={onLogout}
                    className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-rose-400 transition-colors ml-0.5 cursor-pointer"
                    title={`Sign out (${authenticatedTechnician.email})`}
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Primary View Modes Nav (Dashboard vs Investigation vs Memory vs Assets) */}
        <div className="flex items-center py-2 border-b border-slate-900/80 overflow-x-auto scrollbar-none gap-1 sm:gap-2">
          <div className="flex items-center gap-1.5 font-mono text-xs whitespace-nowrap">
            <button
              onClick={() => onModeChange('dashboard')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded transition-all ${
                currentMode === 'dashboard'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>FLEET DASHBOARD</span>
            </button>

            <button
              onClick={() => {
                onModeChange('investigation');
                if (onBackToInvestigationsList) {
                  onBackToInvestigationsList();
                }
              }}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded transition-all ${
                currentMode === 'investigation'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>INCIDENT INVESTIGATION</span>
            </button>

            <button
              onClick={() => onModeChange('assets')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded transition-all ${
                currentMode === 'assets'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>ASSETS MANAGEMENT (ISO 10816-3)</span>
            </button>

            <button
              onClick={() => onModeChange('repository')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded transition-all ${
                currentMode === 'repository'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>INSTITUTIONAL MEMORY</span>
            </button>

            <button
              onClick={() => onModeChange('technicians')}
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded transition-all ${
                currentMode === 'technicians'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>TECHNICIANS</span>
            </button>
          </div>
        </div>

        {/* Investigation Pipeline Sub-Bar */}
        {currentMode === 'investigation' && (
          <nav className="py-2 overflow-x-auto scrollbar-none w-full border-t border-slate-900/80">
            {investigationSubView === 'workflow' ? (
              <div className="flex items-center justify-between gap-1 sm:gap-1.5 text-[11px] xl:text-xs font-mono whitespace-nowrap w-full">
                <div className="flex items-center justify-between gap-1 sm:gap-1.5 w-full">
                  {onBackToInvestigationsList && (
                    <button
                      onClick={onBackToInvestigationsList}
                      className="flex items-center gap-1 sm:gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-cyan-800 text-cyan-300 font-bold transition-colors shrink-0 shadow-sm cursor-pointer"
                      title="Return to list of all investigations"
                    >
                      <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
                      <span className="hidden md:inline">ALL INVESTIGATIONS</span>
                      <span className="md:hidden">← ALL</span>
                    </button>
                  )}

                  {STEPS.map((step, idx) => {
                    const isActive = currentStep === step.id;
                    const stepIndex = STEPS.findIndex((s) => s.id === currentStep);
                    const isCompleted = idx < stepIndex;
                    const isAccessible = step.id === 'capture' || Boolean(isStep1Completed);

                    if (!isAccessible) {
                      return (
                        <button
                          key={step.id}
                          disabled={true}
                          className="flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded text-left opacity-35 cursor-not-allowed text-slate-500 border border-transparent select-none shrink-0"
                          title="Step 1 data required: Complete Step 1 (Incident Report) before opening Step 2"
                        >
                          <span className="text-slate-600 shrink-0">{step.icon}</span>
                          <span>
                            {idx + 1}. <span className="hidden xl:inline">{step.label}</span>
                            <span className="xl:hidden">{step.shortLabel}</span>
                          </span>
                          <Lock className="w-2.5 h-2.5 text-slate-600 shrink-0" />
                        </button>
                      );
                    }

                    return (
                      <button
                        key={step.id}
                        onClick={() => onStepChange(step.id)}
                        className={`flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded transition-colors text-left shrink-0 cursor-pointer ${
                          isActive
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold shadow-sm'
                            : isCompleted
                            ? 'text-slate-300 hover:text-cyan-300 hover:bg-slate-900 border border-slate-800/80'
                            : 'text-slate-400 hover:text-slate-300 hover:bg-slate-900 border border-transparent'
                        }`}
                      >
                        <span className="text-slate-400 shrink-0">{step.icon}</span>
                        <span>
                          {idx + 1}. <span className="hidden xl:inline">{step.label}</span>
                          <span className="xl:hidden">{step.shortLabel}</span>
                        </span>
                        {isCompleted && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between text-xs font-mono py-0.5 w-full">
                <div className="flex items-center gap-2 text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  <span className="font-bold text-slate-200">INCIDENT INVESTIGATIONS DIRECTORY</span>
                  <span className="text-slate-600 hidden sm:inline">|</span>
                  <span className="text-slate-400 hidden sm:inline">
                    Chronologically descending by creation date
                  </span>
                </div>
              </div>
            )}
          </nav>
        )}
      </div>
    </header>
  );
};
