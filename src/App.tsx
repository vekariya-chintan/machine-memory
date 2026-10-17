import React, { useState, useEffect } from 'react';
import { ArrowLeft, RotateCcw, Plus, Activity, Lock, Radio, ShieldAlert, WifiOff, AlertTriangle } from 'lucide-react';
import { Header, PipelineStep, NavigationMode } from './components/Header';
import { AudioCaptureCard } from './components/AudioCaptureCard';
import { KnowledgeExtractionView } from './components/KnowledgeExtractionView';
import { SensorTelemetryChart } from './components/SensorTelemetryChart';
import { MemoryRetrievalMatrix } from './components/MemoryRetrievalMatrix';
import { RootCauseInvestigator } from './components/RootCauseInvestigator';
import { VerificationLearningModal } from './components/VerificationLearningModal';
import { InstitutionalMemoryBrowser } from './components/InstitutionalMemoryBrowser';
import { DashboardView } from './components/DashboardView';
import { AssetFormModal } from './components/AssetFormModal';
import { AssetManagementView } from './components/AssetManagementView';
import { InvestigationsListView } from './components/InvestigationsListView';
import { TechniciansManagementView } from './components/TechniciansManagementView';
import {
  initializeFirestoreDatabase,
  clearAndResetFleetToM001,
  fetchMachines,
  fetchIncidents,
  fetchKnowledge,
  saveExtractedKnowledgeToFirestore,
  addMachineToFirestore,
  updateMachineInFirestore,
  deleteMachineFromFirestore,
  addIncidentToFirestore,
  getMachineDataset,
  generateTelemetryFromExtraction,
} from './services/machineMemoryService';
import {
  testFirestoreConnection,
  ClassifiedFirestoreError,
  classifyFirestoreError,
} from './lib/firebase';
import { Machine, Incident, KnowledgeItem, ExtractionResult, SensorReading, Technician } from './types/industrial';
import { LoginScreen } from './components/LoginScreen';
import { getActiveTechnicianSession, logoutTechnician, verifySessionWithBackend } from './services/authService';

export default function App() {
  const [authenticatedTechnician, setAuthenticatedTechnician] = useState<Technician | null>(() => getActiveTechnicianSession());
  const [currentMode, setCurrentMode] = useState<NavigationMode>('dashboard');
  const [investigationSubView, setInvestigationSubView] = useState<'list' | 'workflow'>('list');
  const [currentStep, setCurrentStep] = useState<PipelineStep>('capture');
  const [isFirestoreConnected, setIsFirestoreConnected] = useState<boolean>(false);
  const [dbConnectionError, setDbConnectionError] = useState<string | null>(null);
  const [classifiedError, setClassifiedError] = useState<ClassifiedFirestoreError | null>(null);
  const [inAppNotification, setInAppNotification] = useState<{ message: string; type: 'error' | 'success' | 'info' } | null>(null);

  // By default, Fleet dashboard displays general data of ALL assets ('ALL')
  const [activeMachineId, setActiveMachineId] = useState('ALL');
  const [isAddMachineOpen, setIsAddMachineOpen] = useState(false);

  // Database state initialized as empty - loaded lazily per tab/page
  const [machines, setMachines] = useState<Machine[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeItem[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [loadedResources, setLoadedResources] = useState<{
    machines: boolean;
    incidents: boolean;
    knowledge: boolean;
  }>({
    machines: false,
    incidents: false,
    knowledge: false,
  });

  // Workflow state (clean and empty by default for new incidents)
  const [rawMemoText, setRawMemoText] = useState('');
  const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null);
  const [investigationTelemetry, setInvestigationTelemetry] = useState<{
    rows: SensorReading[];
    csv: string;
    fileName?: string;
  } | null>(null);

  // Lazy tab-based Firestore data loader - fetches ONLY required data for the active tab/page
  const loadDataForTab = async (mode: NavigationMode, step: PipelineStep) => {
    setIsLoadingData(true);
    setDbConnectionError(null);
    setClassifiedError(null);

    try {
      const conn = await testFirestoreConnection();
      if (!conn.connected) {
        const errorInfo = conn.errorInfo || classifyFirestoreError(new Error('Network unreachable'));
        setIsFirestoreConnected(false);
        setClassifiedError(errorInfo);
        setDbConnectionError(errorInfo.details || errorInfo.message);
        setMachines([]);
        setIncidents([]);
        setKnowledge([]);
        setIsLoadingData(false);
        return;
      }

      setIsFirestoreConnected(true);

      // Verify or seed remote database if it is empty
      try {
        await initializeFirestoreDatabase();
      } catch (initErr: any) {
        console.warn('Database initialization note:', initErr);
      }

      if (mode === 'dashboard') {
        // TAB 1: DASHBOARD
        // Fetch required data for Dashboard: machines, incidents, and knowledge feed.
        const machPromise = !loadedResources.machines ? fetchMachines() : Promise.resolve(machines);
        const incPromise = !loadedResources.incidents ? fetchIncidents() : Promise.resolve(incidents);
        const knowPromise = !loadedResources.knowledge ? fetchKnowledge() : Promise.resolve(knowledge);

        const [machList, incList, knowList] = await Promise.all([machPromise, incPromise, knowPromise]);

        const safeMachList = (machList || []).filter((m): m is Machine => Boolean(m && m.machine_id));
        setMachines(safeMachList);
        setIncidents((incList || []).filter((i): i is Incident => Boolean(i && i.incident_id)));
        setKnowledge((knowList || []).filter((k): k is KnowledgeItem => Boolean(k && k.knowledge_id)));
        setLoadedResources((prev) => ({ ...prev, machines: true, incidents: true, knowledge: true }));

      } else if (mode === 'investigation') {
        // TAB 2: INCIDENT INVESTIGATION
        // Fetch incidents and machines. Fetch knowledge ONLY if active step requires it (retrieve, investigate, learn).
        const needKnowledge = (step === 'retrieve' || step === 'investigate' || step === 'learn') && !loadedResources.knowledge;

        const machPromise = !loadedResources.machines ? fetchMachines() : Promise.resolve(machines);
        const incPromise = !loadedResources.incidents ? fetchIncidents() : Promise.resolve(incidents);
        const knowPromise = needKnowledge ? fetchKnowledge() : Promise.resolve(knowledge);

        const [machList, incList, knowList] = await Promise.all([machPromise, incPromise, knowPromise]);

        setMachines((machList || []).filter((m): m is Machine => Boolean(m && m.machine_id)));
        setIncidents((incList || []).filter((i): i is Incident => Boolean(i && i.incident_id)));
        if (needKnowledge && knowList) {
          setKnowledge((knowList || []).filter((k): k is KnowledgeItem => Boolean(k && k.knowledge_id)));
        }

        setLoadedResources((prev) => ({
          machines: true,
          incidents: true,
          knowledge: prev.knowledge || Boolean(needKnowledge && knowList),
        }));

      } else if (mode === 'assets') {
        // TAB 3: ASSET MANAGEMENT
        // Fetch ONLY machines for Asset Management page.
        const machList = !loadedResources.machines ? await fetchMachines() : machines;
        setMachines((machList || []).filter((m): m is Machine => Boolean(m && m.machine_id)));
        setLoadedResources((prev) => ({ ...prev, machines: true }));

      } else if (mode === 'repository') {
        // TAB 4: INSTITUTIONAL MEMORY REPOSITORY
        // Fetch knowledge (and machines/incidents for repository filters if not yet loaded).
        const knowPromise = !loadedResources.knowledge ? fetchKnowledge() : Promise.resolve(knowledge);
        const machPromise = !loadedResources.machines ? fetchMachines() : Promise.resolve(machines);
        const incPromise = !loadedResources.incidents ? fetchIncidents() : Promise.resolve(incidents);

        const [knowList, machList, incList] = await Promise.all([knowPromise, machPromise, incPromise]);

        setKnowledge((knowList || []).filter((k): k is KnowledgeItem => Boolean(k && k.knowledge_id)));
        setMachines((machList || []).filter((m): m is Machine => Boolean(m && m.machine_id)));
        setIncidents((incList || []).filter((i): i is Incident => Boolean(i && i.incident_id)));

        setLoadedResources({ machines: true, incidents: true, knowledge: true });

      } else if (mode === 'technicians') {
        // TAB 5: TECHNICIANS
        // Ensure machines list is available for navigation header
        if (!loadedResources.machines) {
          const machList = await fetchMachines();
          setMachines((machList || []).filter((m): m is Machine => Boolean(m && m.machine_id)));
          setLoadedResources((prev) => ({ ...prev, machines: true }));
        }
      }

      setClassifiedError(null);
    } catch (err: any) {
      console.error(`Failed to load data for tab '${mode}':`, err);
      setIsFirestoreConnected(false);
      const classified = classifyFirestoreError(err);
      setClassifiedError(classified);
      setDbConnectionError(classified.details || classified.message);
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    loadDataForTab(currentMode, currentStep);

    // Verify token with backend if present
    verifySessionWithBackend().then((verifiedTech) => {
      if (verifiedTech) {
        setAuthenticatedTechnician(verifiedTech);
      }
    });
  }, [currentMode, currentStep]);

  // When active machine selector changes
  const handleSelectMachineId = (id: string) => {
    setActiveMachineId(id);
  };

  // Human in the loop confirmation adds incident and resolution to state
  const handleLearningCommitted = (newIncident: Incident) => {
    setIncidents((prev) => [newIncident, ...prev.filter((i) => i.incident_id !== newIncident.incident_id)]);
  };

  // Handle adding new machine asset
  const handleMachineAdded = async (newMachine: Machine) => {
    if (!isFirestoreConnected) {
      setInAppNotification({
        message: 'Action blocked: No active connection. Local storage is disabled.',
        type: 'error',
      });
      return;
    }
    try {
      await addMachineToFirestore(newMachine);
      setMachines((prev) => [newMachine, ...prev]);
      setActiveMachineId(newMachine.machine_id);
      setInAppNotification({
        message: `Asset ${newMachine.machine_id} successfully saved.`,
        type: 'success',
      });
    } catch (err: any) {
      console.error('Failed to register machine in database:', err);
      setInAppNotification({
        message: `Save failed: ${err?.message || 'Could not save asset'}. Local storage is disabled.`,
        type: 'error',
      });
    }
  };

  // Handle updating machine asset specifications
  const handleMachineUpdated = async (updatedMachine: Machine) => {
    if (!isFirestoreConnected) {
      setInAppNotification({
        message: 'Action blocked: No active connection. Local storage is disabled.',
        type: 'error',
      });
      return;
    }
    try {
      await updateMachineInFirestore(updatedMachine);
      setMachines((prev) =>
        prev.map((m) => (m.machine_id === updatedMachine.machine_id ? updatedMachine : m))
      );
      if (activeMachineId === updatedMachine.machine_id) {
        handleSelectMachineId(updatedMachine.machine_id);
      }
      setInAppNotification({
        message: `Asset ${updatedMachine.machine_id} updated.`,
        type: 'success',
      });
    } catch (err: any) {
      console.error('Failed to update machine in database:', err);
      setInAppNotification({
        message: `Update failed: ${err?.message || 'Could not update asset'}. Local storage is disabled.`,
        type: 'error',
      });
    }
  };

  // Handle deleting machine asset
  const handleMachineDeleted = async (machineId: string) => {
    if (!isFirestoreConnected) {
      setInAppNotification({
        message: 'Action blocked: No active connection. Local storage is disabled.',
        type: 'error',
      });
      return;
    }
    try {
      await deleteMachineFromFirestore(machineId);
      setMachines((prev) => prev.filter((m) => m.machine_id !== machineId));
      if (activeMachineId === machineId) {
        setActiveMachineId('ALL');
      }
      setInAppNotification({
        message: `Asset ${machineId} deleted.`,
        type: 'info',
      });
    } catch (err: any) {
      console.error('Failed to delete machine from database:', err);
      setInAppNotification({
        message: `Deletion failed: ${err?.message || 'Could not delete asset'}.`,
        type: 'error',
      });
    }
  };

  // Reset database records to fresh M001-M005 CNC automated machine assets
  const handleResetFleetData = async () => {
    try {
      setIsLoadingData(true);
      await clearAndResetFleetToM001();
      setLoadedResources({ machines: false, incidents: false, knowledge: false });
      await loadDataForTab(currentMode, currentStep);
      setActiveMachineId('ALL');
    } catch (err) {
      console.error('Failed to reset fleet records:', err);
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleExtractionComplete = async (
    result: ExtractionResult,
    memo: string,
    telemetry?: { rows: SensorReading[]; csv: string; fileName?: string }
  ) => {
    setExtractionResult(result);
    setRawMemoText(memo);
    setInvestigationTelemetry(telemetry || null);
    if (result.machine_id && result.machine_id !== activeMachineId) {
      handleSelectMachineId(result.machine_id);
    }

    // Persist incident investigation into Firestore
    const newIncId = `INC-${Date.now().toString().slice(-4)}`;
    const newIncident: Incident = {
      incident_id: newIncId,
      date: new Date().toISOString().split('T')[0],
      machine_id: result.machine_id,
      symptom: result.symptoms?.[0] || 'Anomalous operational vibration',
      cause: result.probable_root_cause || 'Under active investigation',
      repair: result.recommended_inspection || 'Pending physical inspection',
      downtime: Math.round((result.warmup_minutes || 15) * 1.5),
      status: 'investigating',
      notes: memo,
      sensor_snapshot: telemetry?.rows,
    };

    try {
      await addIncidentToFirestore(newIncident);
      setIncidents((prev) => [newIncident, ...prev.filter((i) => i.incident_id !== newIncId)]);
    } catch (err) {
      console.warn('Draft incident save note:', err);
    }

    setCurrentStep('extract');
  };

  const handleResetDemo = () => {
    setActiveMachineId('ALL');
    setRawMemoText('');
    setExtractionResult(null);
    setInvestigationTelemetry(null);
    setCurrentMode('dashboard');
    setCurrentStep('capture');
  };

  const isStep1Completed = Boolean(extractionResult);

  const handleStepChange = (targetStep: PipelineStep) => {
    if (targetStep !== 'capture' && !isStep1Completed) {
      // Without step 1 data it should not move or open step 2
      return;
    }
    setCurrentStep(targetStep);
  };

  const handleStartNewInvestigation = (machId?: string) => {
    const targetId = machId && machId !== 'ALL' ? machId : 'M001';
    setActiveMachineId(targetId);
    setRawMemoText('');
    setExtractionResult(null);
    setInvestigationTelemetry(null);
    setCurrentStep('capture');
    setInvestigationSubView('workflow');
    setCurrentMode('investigation');
  };

  const handleOpenExistingInvestigation = (incident: Incident) => {
    setActiveMachineId(incident.machine_id);
    const memo = incident.notes || (incident.symptom
      ? `Technician Incident Log [${incident.incident_id}]: Asset ${incident.machine_id} exhibited ${incident.symptom}. Confirmed root cause: ${incident.cause}. Corrective repair: ${incident.repair}.`
      : '');
    setRawMemoText(memo);
    const targetMach = (machines || []).find((m) => m && m.machine_id === incident.machine_id);
    const extractedData: ExtractionResult = {
      machine_id: incident.machine_id,
      machine_name: targetMach?.name || `Machine Asset ${incident.machine_id}`,
      symptoms: incident.symptom ? [incident.symptom] : ['anomalous harmonic vibration'],
      time_condition: 'during operational shift',
      warmup_minutes: 15,
      recommended_inspection: incident.repair || 'Inspect components',
      proscribed_action: 'Avoid operating unit before inspection',
      probable_root_cause: incident.cause || 'Mechanical fault',
      confidence_score: 0.95,
      source_summary: memo,
      extracted_parameters: {
        temperature_sensitivity: true,
        rpm_drift: false,
        thermal_expansion_likely: true,
      },
    };
    setExtractionResult(extractedData);
    if (incident.sensor_snapshot && incident.sensor_snapshot.length > 0) {
      const csvHeader = 'timestamp,machine_id,temperature,vibration,rpm,power\n';
      const csvBody = incident.sensor_snapshot
        .map((r) => `${r.timestamp},${r.machine_id},${r.temperature},${r.vibration},${r.rpm},${r.power}`)
        .join('\n');
      setInvestigationTelemetry({
        rows: incident.sensor_snapshot,
        csv: csvHeader + csvBody,
        fileName: `${incident.incident_id}_telemetry.csv`,
      });
    } else {
      setInvestigationTelemetry(generateTelemetryFromExtraction(extractedData, targetMach));
    }
    setCurrentStep('capture');
    setInvestigationSubView('workflow');
    setCurrentMode('investigation');
  };

  const handleStartInvestigation = (machineId?: string, step?: PipelineStep) => {
    const targetId = machineId && machineId !== 'ALL' ? machineId : 'M001';
    setActiveMachineId(targetId);
    setRawMemoText('');
    setExtractionResult(null);
    setInvestigationTelemetry(null);
    setCurrentStep('capture');
    setInvestigationSubView('workflow');
    setCurrentMode('investigation');
  };

  const validFleet = (machines || []).filter((m): m is Machine => Boolean(m && m.machine_id));
  const activeMachine =
    (activeMachineId !== 'ALL' && validFleet.find((m) => m.machine_id === activeMachineId)) ||
    validFleet[0] ||
    null;
  const activeMachineIdResolved = activeMachine?.machine_id || (activeMachineId !== 'ALL' ? activeMachineId : 'M001');
  const activeMachineNameResolved = activeMachine?.name || `Machine Asset ${activeMachineIdResolved}`;

  // If user is not authenticated, present the Login Screen
  if (!authenticatedTechnician) {
    return (
      <LoginScreen
        onLoginSuccess={(tech) => setAuthenticatedTechnician(tech)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Header with Searchable Asset Selector & View Navigation */}
      <Header
        currentMode={currentMode}
        onModeChange={(mode) => {
          setCurrentMode(mode);
          // If switching to investigation, default to list view
          if (mode === 'investigation') {
            setInvestigationSubView('list');
          }
        }}
        currentStep={currentStep}
        onStepChange={handleStepChange}
        isStep1Completed={isStep1Completed}
        onReset={handleResetDemo}
        activeMachineId={activeMachineId}
        onSelectMachineId={handleSelectMachineId}
        machines={machines}
        isFirestoreConnected={isFirestoreConnected}
        investigationSubView={investigationSubView}
        onBackToInvestigationsList={() => setInvestigationSubView('list')}
        onStartNewInvestigation={() => handleStartNewInvestigation(activeMachineId !== 'ALL' ? activeMachineId : 'M001')}
        authenticatedTechnician={authenticatedTechnician}
        onLogout={() => {
          logoutTechnician();
          setAuthenticatedTechnician(null);
        }}
      />

      {/* Main Operational Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        {/* Specific, Clear Warning Banner for Network Unreachable vs Permission Denied */}
        {classifiedError && !isFirestoreConnected && (
          <div
            className={`mb-5 p-4 sm:p-5 rounded-2xl border shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in duration-200 ${
              classifiedError.type === 'permission_denied'
                ? 'bg-rose-950/95 border-rose-600/90 text-rose-100 shadow-rose-950/50'
                : 'bg-amber-950/95 border-amber-500/90 text-amber-100 shadow-amber-950/50'
            }`}
          >
            <div className="flex items-start gap-3.5">
              <div
                className={`p-2.5 rounded-xl shrink-0 mt-0.5 border ${
                  classifiedError.type === 'permission_denied'
                    ? 'bg-rose-900/90 border-rose-500/50 text-rose-300'
                    : 'bg-amber-900/90 border-amber-500/50 text-amber-300'
                }`}
              >
                {classifiedError.type === 'permission_denied' ? (
                  <ShieldAlert className="w-6 h-6" />
                ) : (
                  <WifiOff className="w-6 h-6" />
                )}
              </div>
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`text-[10px] font-mono font-black uppercase px-2.5 py-0.5 rounded tracking-wider border ${
                      classifiedError.type === 'permission_denied'
                        ? 'bg-rose-900/80 border-rose-500 text-rose-200'
                        : 'bg-amber-900/80 border-amber-400 text-amber-200'
                    }`}
                  >
                    {classifiedError.type === 'permission_denied'
                      ? 'SECURITY WARNING: PERMISSION DENIED'
                      : 'CONNECTIVITY WARNING: NETWORK UNREACHABLE'}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {classifiedError.timestamp}
                  </span>
                </div>
                <h3 className="text-sm sm:text-base font-extrabold tracking-tight text-white">
                  {classifiedError.title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-200 max-w-3xl leading-relaxed font-sans">
                  {classifiedError.message} Local fallback data and offline local storage have been disabled.
                </p>
                <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 text-[11px] font-mono text-slate-300 pt-1">
                  <span className="text-cyan-300 font-semibold">Action:</span>
                  <span>{classifiedError.resolution}</span>
                </div>
                {classifiedError.details && (
                  <div className="mt-1 text-[10px] font-mono text-slate-400 max-w-2xl truncate">
                    Trace: <code className={classifiedError.type === 'permission_denied' ? 'text-rose-300' : 'text-amber-300'}>{classifiedError.details}</code>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
              <button
                onClick={() => loadDataForTab(currentMode, currentStep)}
                className={`px-5 py-2.5 rounded-xl font-mono font-black text-xs tracking-wider flex items-center gap-2 transition-all shadow-lg cursor-pointer ${
                  classifiedError.type === 'permission_denied'
                    ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/60 hover:scale-105 active:scale-95'
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-900/60 hover:scale-105 active:scale-95'
                }`}
              >
                <RotateCcw className="w-4 h-4" />
                <span>RETRY CONNECTION</span>
              </button>
            </div>
          </div>
        )}

        {/* In-App System Notification / Operational Alert Banner */}
        {inAppNotification && (
          <div
            className={`mb-4 p-3.5 px-4 rounded-xl border flex items-center justify-between text-xs font-mono shadow-lg transition-all animate-in fade-in duration-200 ${
              inAppNotification.type === 'error'
                ? 'bg-rose-950/80 border-rose-800 text-rose-200'
                : inAppNotification.type === 'success'
                ? 'bg-emerald-950/80 border-emerald-800 text-emerald-200'
                : 'bg-cyan-950/80 border-cyan-800 text-cyan-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="font-bold uppercase tracking-wider">
                [{inAppNotification.type.toUpperCase()}]:
              </span>
              <span>{inAppNotification.message}</span>
            </div>
            <button
              onClick={() => setInAppNotification(null)}
              className="text-slate-400 hover:text-white ml-3 font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* View 1: Fleet Dashboard (General overview of all assets by default; particular asset data when selected) */}
        {currentMode === 'dashboard' && (
          <DashboardView
            machines={machines}
            incidents={incidents}
            knowledge={knowledge}
            activeMachineId={activeMachineId}
            onSelectMachineId={handleSelectMachineId}
            onStartInvestigation={handleStartInvestigation}
            onViewRepository={() => setCurrentMode('repository')}
            onOpenAddMachine={() => {
              if (!isFirestoreConnected) {
                setInAppNotification({
                  message: 'Cannot register asset: No active connection. Local storage is disabled.',
                  type: 'error',
                });
                return;
              }
              setIsAddMachineOpen(true);
            }}
            onManageAssets={() => setCurrentMode('assets')}
            isLoadingData={isLoadingData}
            isFirestoreConnected={isFirestoreConnected}
            dbConnectionError={dbConnectionError}
            classifiedError={classifiedError}
            onRetryConnection={() => loadDataForTab(currentMode, currentStep)}
            onSeedDatabase={handleResetFleetData}
          />
        )}

        {/* View 2: Incident Investigation Tab */}
        {currentMode === 'investigation' && (
          investigationSubView === 'list' ? (
            /* Page A: List all investigations in descending order based on creation date */
            <InvestigationsListView
              incidents={incidents}
              machines={machines}
              activeMachineId={activeMachineId}
              onSelectMachineId={handleSelectMachineId}
              onStartNewInvestigation={handleStartNewInvestigation}
              onOpenInvestigation={handleOpenExistingInvestigation}
            />
          ) : (
            /* Page B: Land on 6 investigation steps workflow */
            <div className="space-y-6">
              {/* Back to list and active investigation summary bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 px-4 shadow-md font-mono text-xs">
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => setInvestigationSubView('list')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold transition-colors shadow-sm"
                    title="Return to the full list of all investigations"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>ALL INVESTIGATIONS</span>
                  </button>
                  <span className="text-slate-600 hidden sm:inline">|</span>
                  <span className="text-slate-300 font-semibold truncate">
                    INVESTIGATING: <strong className="text-cyan-400">{activeMachineIdResolved}</strong> ({activeMachineNameResolved})
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-slate-400">ACTIVE STEP:</span>
                  <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 font-bold uppercase">
                    {currentStep}
                  </span>
                  <button
                    onClick={() => {
                      handleSelectMachineId(activeMachineIdResolved);
                      setCurrentStep('capture');
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors ml-1 cursor-pointer"
                    title="Reset to step 1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>RESTART</span>
                  </button>
                </div>
              </div>

              {/* Step 1: Capture Senior Technician Voice */}
              {currentStep === 'capture' && (
                <AudioCaptureCard
                  onExtractionComplete={handleExtractionComplete}
                  onProceed={() => setCurrentStep('extract')}
                  initialText={rawMemoText}
                  activeMachineId={activeMachineIdResolved}
                  machineName={activeMachineNameResolved}
                />
              )}

              {/* Step 2: Structured Fact Extraction */}
              {currentStep === 'extract' && (
                extractionResult ? (
                  <KnowledgeExtractionView
                    extraction={extractionResult}
                    rawText={rawMemoText}
                    onProceed={() => setCurrentStep('telemetry')}
                  />
                ) : (
                  <div className="bg-slate-900/90 border border-amber-800/80 rounded-xl p-8 text-center space-y-4 shadow-xl">
                    <div className="w-12 h-12 rounded-full bg-amber-950/60 border border-amber-800 flex items-center justify-center mx-auto text-amber-400">
                      <Lock className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-100 font-mono">
                        STEP 1 DATA REQUIRED TO UNLOCK STEP 2
                      </h3>
                      <p className="text-xs text-slate-400 font-mono mt-1 max-w-md mx-auto">
                        Step 2 (Structured Fact Extraction) requires Step 1 incident report data. Please record audio, upload an audio memo, or enter technician observations in Step 1 first.
                      </p>
                    </div>
                    <button
                      onClick={() => setCurrentStep('capture')}
                      className="px-5 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs font-mono transition-colors shadow-md"
                    >
                      ← RETURN TO STEP 1 (INCIDENT REPORT)
                    </button>
                  </div>
                )
              )}

              {/* Step 3: Shift Incident Alert & CSV Telemetry Curves */}
              {currentStep === 'telemetry' && (
                <SensorTelemetryChart
                  onProceed={() => setCurrentStep('retrieve')}
                  activeMachineId={activeMachineIdResolved}
                  machine={activeMachine || undefined}
                  extraction={extractionResult || undefined}
                  telemetry={investigationTelemetry || undefined}
                />
              )}

              {/* Step 4: Semantic Institutional Memory Retrieval */}
              {currentStep === 'retrieve' && (
                <MemoryRetrievalMatrix
                  incidents={incidents}
                  knowledge={knowledge}
                  onProceed={() => setCurrentStep('investigate')}
                  activeMachineId={activeMachineIdResolved}
                  extraction={extractionResult || undefined}
                />
              )}

              {/* Step 5: Grounded Multi-Evidence Autonomous Investigation */}
              {currentStep === 'investigate' && (
                <RootCauseInvestigator
                  onProceedToVerification={() => setCurrentStep('learn')}
                  activeMachineId={activeMachineIdResolved}
                  machine={activeMachine || undefined}
                  extraction={extractionResult || undefined}
                />
              )}

              {/* Step 6: Human Verification & Closed-Loop Learning */}
              {currentStep === 'learn' && (
                <VerificationLearningModal
                  onLearningCommitted={(newInc) => {
                    handleLearningCommitted(newInc);
                  }}
                  onViewAllMemory={() => {
                    setInvestigationSubView('list');
                  }}
                  activeMachineId={activeMachineIdResolved}
                  machine={activeMachine || undefined}
                  extraction={extractionResult || undefined}
                  onStartNewInvestigation={() => {
                    setCurrentStep('capture');
                  }}
                  authenticatedTechnician={authenticatedTechnician}
                />
              )}
            </div>
          )
        )}

        {/* View 3: Dedicated Asset Management Page (ISO 10816-3 Baseline Specifications & CRUD) */}
        {currentMode === 'assets' && (
          <AssetManagementView
            machines={machines}
            activeMachineId={activeMachineId}
            onSelectMachineId={handleSelectMachineId}
            onStartInvestigation={(machId) => handleStartInvestigation(machId)}
            onAddMachine={handleMachineAdded}
            onUpdateMachine={handleMachineUpdated}
            onDeleteMachine={handleMachineDeleted}
          />
        )}

        {/* View 4: Full Institutional Memory Browser */}
        {currentMode === 'repository' && (
          <InstitutionalMemoryBrowser
            machines={machines}
            incidents={incidents}
            knowledge={knowledge}
            onBackToWalkthrough={() => setCurrentMode('investigation')}
            activeMachineId={activeMachineId !== 'ALL' ? activeMachineId : undefined}
            onKnowledgeUpdated={(updatedList) => setKnowledge(updatedList)}
            authenticatedTechnician={authenticatedTechnician}
          />
        )}

        {/* View 5: Technicians Directory & Access Management */}
        {currentMode === 'technicians' && (
          <TechniciansManagementView
            authenticatedTechnician={authenticatedTechnician}
            onNotification={(notif) => setInAppNotification(notif)}
            onSessionTechnicianUpdated={(updatedTech) => setAuthenticatedTechnician(updatedTech)}
          />
        )}
      </main>

      {/* Unified Single Register Machine Asset Modal for the Entire App */}
      <AssetFormModal
        isOpen={isAddMachineOpen}
        onClose={() => setIsAddMachineOpen(false)}
        onSave={handleMachineAdded}
        mode="create"
        existingMachineIds={machines.map((m) => m.machine_id)}
      />

      {/* Industrial Telemetry Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/95 py-4 text-xs font-mono text-slate-400">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
            <span className="font-semibold text-slate-300">MACHINE MEMORY · INDUSTRIAL OPERATIONS PLATFORM</span>
          </div>
          <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 text-slate-400">
            <span>Developed by <strong className="text-cyan-400 font-bold">Team PromptNova</strong></span>
            <span className="text-slate-800 hidden sm:inline">|</span>
            <span className="text-slate-500 text-[11px] hidden md:inline">ISO 10816-3 COMPLIANT ENGINE</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
