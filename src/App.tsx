import React, { useState, useEffect } from 'react';
import { ArrowLeft, RotateCcw, Plus, Activity, Lock } from 'lucide-react';
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
  SEED_MACHINES,
  SEED_INCIDENTS,
  SEED_KNOWLEDGE,
} from './services/machineMemoryService';
import { testFirestoreConnection } from './lib/firebase';
import { Machine, Incident, KnowledgeItem, ExtractionResult, SensorReading, Technician } from './types/industrial';
import { LoginScreen } from './components/LoginScreen';
import { getActiveTechnicianSession, logoutTechnician, verifySessionWithBackend } from './services/authService';

export default function App() {
  const [authenticatedTechnician, setAuthenticatedTechnician] = useState<Technician | null>(() => getActiveTechnicianSession());
  const [currentMode, setCurrentMode] = useState<NavigationMode>('dashboard');
  const [investigationSubView, setInvestigationSubView] = useState<'list' | 'workflow'>('list');
  const [currentStep, setCurrentStep] = useState<PipelineStep>('capture');
  const [isFirestoreConnected, setIsFirestoreConnected] = useState(false);

  // By default, Fleet dashboard displays general data of ALL assets ('ALL')
  const [activeMachineId, setActiveMachineId] = useState('ALL');
  const [isAddMachineOpen, setIsAddMachineOpen] = useState(false);

  // Database state primed with seed defaults before async database load
  const [machines, setMachines] = useState<Machine[]>(SEED_MACHINES);
  const [incidents, setIncidents] = useState<Incident[]>(SEED_INCIDENTS);
  const [knowledge, setKnowledge] = useState<KnowledgeItem[]>(SEED_KNOWLEDGE);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Workflow state (clean and empty by default for new incidents)
  const [rawMemoText, setRawMemoText] = useState('');
  const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null);
  const [investigationTelemetry, setInvestigationTelemetry] = useState<{
    rows: SensorReading[];
    csv: string;
    fileName?: string;
  } | null>(null);

  // Prime central database on initial load
  useEffect(() => {
    async function init() {
      setIsLoadingData(true);
      const isConnected = await testFirestoreConnection();
      setIsFirestoreConnected(isConnected);

      await initializeFirestoreDatabase();
      const [machList, incList, knowList] = await Promise.all([
        fetchMachines(),
        fetchIncidents(),
        fetchKnowledge(),
      ]);

      const safeMachList = (machList || []).filter((m): m is Machine => Boolean(m && m.machine_id));
      setMachines(safeMachList.length > 0 ? safeMachList : SEED_MACHINES);
      setIncidents((incList || []).filter((i): i is Incident => Boolean(i && i.incident_id)));
      setKnowledge((knowList || []).filter((k): k is KnowledgeItem => Boolean(k && k.knowledge_id)));

      // By default Fleet Dashboard displays general data of all assets
      setActiveMachineId('ALL');
      setIsLoadingData(false);

      // Verify token with backend if present
      verifySessionWithBackend().then((verifiedTech) => {
        if (verifiedTech) {
          setAuthenticatedTechnician(verifiedTech);
        }
      });
    }
    init();
  }, []);

  // When active machine selector changes
  const handleSelectMachineId = (id: string) => {
    setActiveMachineId(id);
  };

  // Human in the loop confirmation adds incident and resolution to state
  const handleLearningCommitted = (newIncident: Incident) => {
    setIncidents((prev) => [newIncident, ...prev.filter((i) => i.incident_id !== newIncident.incident_id)]);
  };

  // Handle adding new machine asset to central database
  const handleMachineAdded = async (newMachine: Machine) => {
    try {
      await addMachineToFirestore(newMachine);
      setMachines((prev) => [newMachine, ...prev]);
      setActiveMachineId(newMachine.machine_id);
    } catch (err) {
      console.error('Failed to register machine in database:', err);
    }
  };

  // Handle updating machine asset specifications in central database
  const handleMachineUpdated = async (updatedMachine: Machine) => {
    try {
      await updateMachineInFirestore(updatedMachine);
      setMachines((prev) =>
        prev.map((m) => (m.machine_id === updatedMachine.machine_id ? updatedMachine : m))
      );
      if (activeMachineId === updatedMachine.machine_id) {
        handleSelectMachineId(updatedMachine.machine_id);
      }
    } catch (err) {
      console.error('Failed to update machine in database:', err);
    }
  };

  // Handle deleting machine asset from central database
  const handleMachineDeleted = async (machineId: string) => {
    try {
      await deleteMachineFromFirestore(machineId);
      setMachines((prev) => prev.filter((m) => m.machine_id !== machineId));
      if (activeMachineId === machineId) {
        setActiveMachineId('ALL');
      }
    } catch (err) {
      console.error('Failed to delete machine from database:', err);
    }
  };

  // Reset database records to fresh M001-M005 CNC automated machine assets
  const handleResetFleetData = async () => {
    try {
      setIsLoadingData(true);
      await clearAndResetFleetToM001();
      const [machList, incList, knowList] = await Promise.all([
        fetchMachines(),
        fetchIncidents(),
        fetchKnowledge(),
      ]);
      setMachines(machList);
      setIncidents(incList);
      setKnowledge(knowList);
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

  const isM001 = activeMachineId === 'M001';
  const validFleet = (machines || []).filter((m): m is Machine => Boolean(m && m.machine_id));
  const activeMachine =
    (activeMachineId !== 'ALL' && validFleet.find((m) => m.machine_id === activeMachineId)) ||
    validFleet[0] ||
    SEED_MACHINES[0];

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
            onOpenAddMachine={() => setIsAddMachineOpen(true)}
            onManageAssets={() => setCurrentMode('assets')}
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
                    <span>← ALL INVESTIGATIONS</span>
                  </button>
                  <span className="text-slate-600 hidden sm:inline">|</span>
                  <span className="text-slate-300 font-semibold truncate">
                    INVESTIGATING: <strong className="text-cyan-400">{activeMachine.machine_id}</strong> ({activeMachine.name})
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-slate-400">ACTIVE STEP:</span>
                  <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 font-bold uppercase">
                    {currentStep}
                  </span>
                  <button
                    onClick={() => {
                      handleSelectMachineId(activeMachine.machine_id);
                      setCurrentStep('capture');
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors ml-1"
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
                  activeMachineId={activeMachine.machine_id}
                  machineName={activeMachine.name}
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
                  activeMachineId={activeMachine.machine_id}
                  machine={activeMachine}
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
                  activeMachineId={activeMachine.machine_id}
                  extraction={extractionResult || undefined}
                />
              )}

              {/* Step 5: Grounded Multi-Evidence Autonomous Investigation */}
              {currentStep === 'investigate' && (
                <RootCauseInvestigator
                  onProceedToVerification={() => setCurrentStep('learn')}
                  activeMachineId={activeMachine.machine_id}
                  machine={activeMachine}
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
                  activeMachineId={activeMachine.machine_id}
                  machine={activeMachine}
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
            <span>Developed by <strong className="text-cyan-400 font-bold">Team PromtNova</strong></span>
            <span className="text-slate-800 hidden sm:inline">|</span>
            <span className="text-slate-500 text-[11px] hidden md:inline">ISO 10816-3 COMPLIANT ENGINE</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
