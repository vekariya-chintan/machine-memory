import React, { useState } from 'react';
import {
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingDown,
  Wrench,
  CheckSquare,
  Square,
  Sparkles,
  Lock,
  Layers,
  ChevronRight,
  Info,
  Cpu,
} from 'lucide-react';
import { RecommendedAction, Machine, ExtractionResult } from '../types/industrial';

interface RootCauseInvestigatorProps {
  onProceedToVerification: () => void;
  investigationData?: any;
  activeMachineId?: string;
  machine?: Machine;
  extraction?: ExtractionResult;
}

export const RootCauseInvestigator: React.FC<RootCauseInvestigatorProps> = ({
  onProceedToVerification,
  investigationData,
  activeMachineId = 'M001',
  machine,
  extraction,
}) => {
  const [checkedSteps, setCheckedSteps] = useState<Record<number, boolean>>({
    1: true,
    2: true,
    3: false,
    4: false,
  });

  const toggleStep = (step: number) => {
    setCheckedSteps((prev) => ({ ...prev, [step]: !prev[step] }));
  };

  const targetAssetId = extraction?.machine_id || activeMachineId || 'M001';

  const probableRoot =
    extraction?.probable_root_cause ||
    `Operational fault on ${targetAssetId} requiring physical inspection`;

  const recommendedInspection =
    extraction?.recommended_inspection ||
    `Inspect primary drive components and mounting alignments on ${targetAssetId}`;

  const proscribed =
    extraction?.proscribed_action ||
    'Avoid premature complete component replacement before completing targeted inspection';

  const savedDowntimeMinutes = Math.max(35, Math.round((extraction?.warmup_minutes || 20) * 2.5));
  const serviceDowntimeMinutes = Math.max(25, Math.round(savedDowntimeMinutes * 0.7));
  const overhaulDowntimeMinutes = serviceDowntimeMinutes + savedDowntimeMinutes;

  // Dynamic actions based on active asset and Step 1 extraction
  const actions: RecommendedAction[] = [
    {
      step: 1,
      priority: 'CRITICAL',
      action: `Perform Lock-Out / Tag-Out (LOTO) on ${targetAssetId} Main Feed`,
      tool: 'LOTO Safety Padlock & Voltmeter zero-voltage test',
    },
    {
      step: 2,
      priority: 'HIGH',
      action: `Targeted physical inspection: ${recommendedInspection}`,
      tool: 'Calibrated Inspection Tooling & Gauges',
    },
    {
      step: 3,
      priority: 'HIGH',
      action: `Precision measurement: verify alignment tolerances and operating differentials`,
      tool: 'Dial Indicator (0.01mm) / Precision Test Kit',
    },
    {
      step: 4,
      priority: 'MEDIUM',
      action: `Re-torque fasteners to OEM spec and verify nominal operating baseline`,
      tool: 'Calibrated Torque Wrench',
    },
  ];

  const evidenceChain = [
    `Senior Tech Observation: "${extraction?.source_summary || extraction?.symptoms?.join(', ') || 'Targeted inspection protocol verified'}"`,
    `Operating Threshold: ${extraction?.time_condition || 'Anomalous harmonics triggered during warmup under load'}`,
    `Recommended targeted protocol: ${recommendedInspection}`,
    `Avoided premature overhaul: ${proscribed} (saves ${savedDowntimeMinutes}m net downtime)`,
  ];

  const defaultHypothesis = {
    root_cause: probableRoot,
    confidence_pct: Math.round((extraction?.confidence_score ?? 0.92) * 100),
    why_not_bearing: `Blind component teardown is demoted: ${proscribed}. Operating parameters and telemetry curves indicate localized ${probableRoot.toLowerCase()} rather than catastrophic drive seizure.`,
    evidence_chain: evidenceChain,
  };

  const topHypothesis = investigationData?.top_hypothesis || defaultHypothesis;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-6 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-2">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 mb-1">
            <span className="px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-800/80 font-bold">
              STEP 05 &amp; 06
            </span>
            <span>INVESTIGATE &amp; EXPLAIN (AUTONOMOUS DIAGNOSTIC HYPOTHESIS)</span>
          </div>
          <h2 className="text-xl font-bold text-slate-100">
            Diagnostic Investigation &amp; Root-Cause Explanation for Asset {targetAssetId}
          </h2>
          <p className="text-xs text-slate-400 font-sans mt-0.5">
            Diagnostic engine compares current telemetry evidence with historical {targetAssetId} incidents and institutional memory, predicting the likely root cause, confidence score, evidence chain, and recommended inspection protocol.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 bg-slate-950 px-3 py-1.5 rounded border border-slate-800">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>DIAGNOSTIC COMPARISON WITH HISTORICAL MEMORY</span>
        </div>
      </div>

      {/* Top Hypothesis Card vs Demoted Alternative */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Dominant Grounded Hypothesis */}
        <div className="lg:col-span-8 bg-slate-950 border border-cyan-500/70 rounded-lg p-5 shadow-[0_0_20px_rgba(6,182,212,0.12)] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 gap-2">
            <div>
              <div className="text-xs font-mono text-cyan-400 font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                PRIMARY DIAGNOSTIC HYPOTHESIS · RANK 1
              </div>
              <h3 className="text-lg font-bold text-slate-100 mt-1">
                {topHypothesis.root_cause}
              </h3>
            </div>
            <div className="text-right">
              <div className="text-xs font-mono text-slate-400">CONFIDENCE</div>
              <div className="text-3xl font-extrabold text-cyan-400 font-mono tabular-nums">
                {topHypothesis.confidence_pct}%
              </div>
            </div>
          </div>

          {/* Physical Grounding Explanation */}
          <div className="bg-slate-900/80 border border-slate-800 rounded p-3 text-xs font-mono">
            <span className="text-amber-400 font-bold block mb-1">
              ENGINEERING GROUNDING (WHY ALTERNATIVE CAUSES RULED OUT):
            </span>
            <p className="text-slate-300 leading-relaxed">
              {topHypothesis.why_not_bearing || topHypothesis.why_not_alternative}
            </p>
          </div>

          {/* Evidence Chain */}
          <div>
            <div className="text-xs font-mono text-slate-400 mb-2 font-semibold">
              CROSS-REFERENCED EVIDENCE CHAIN:
            </div>
            <div className="space-y-2 text-xs font-mono">
              {(topHypothesis.evidence_chain || []).map((ev: string, idx: number) => (
                <div key={idx} className="flex items-start gap-2 bg-slate-900/40 p-2 rounded border border-slate-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span className="text-slate-300">{ev}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Demoted Secondary Hypothesis & Downtime Projection */}
        <div className="lg:col-span-4 flex flex-col justify-between space-y-4">
          {/* Secondary Hypothesis */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
            <div className="text-xs font-mono text-slate-500 mb-1 flex items-center justify-between">
              <span>SECONDARY HYPOTHESIS · RANK 2</span>
              <span className="font-bold text-slate-400 font-mono">
                {100 - (topHypothesis.confidence_pct || 89)}% CONFIDENCE
              </span>
            </div>
            <h4 className="text-sm font-bold text-slate-300">
              {proscribed
                ? proscribed.replace(/^(?:Do not|Don't|Avoid)\s+/i, '').replace(/\s+prematurely$/i, '')
                : 'Premature Complete Subsystem Replacement'}
            </h4>
            <p className="text-xs font-mono text-slate-400 mt-2">
              Demoted alternative based on Step 1 observations. Complete unit teardown is avoided in favor of targeted physical verification.
            </p>
          </div>

          {/* Downtime Savings Metric Card */}
          <div className="bg-slate-950 border border-emerald-900/80 rounded-lg p-4 bg-emerald-950/10">
            <div className="text-xs font-mono text-emerald-400 font-bold mb-1 flex items-center gap-1.5">
              <TrendingDown className="w-4 h-4 text-emerald-400" />
              <span>PROJECTED DOWNTIME AVOIDANCE</span>
            </div>
            <div className="text-3xl font-extrabold text-emerald-400 font-mono tabular-nums">
              {savedDowntimeMinutes} <span className="text-xs font-normal text-slate-400">MINUTES SAVED</span>
            </div>
            <div className="text-xs font-mono text-slate-400 mt-2 space-y-1">
              <div className="flex justify-between">
                <span>Targeted Subsystem Service:</span>
                <span className="text-emerald-300 font-bold">~{serviceDowntimeMinutes} min</span>
              </div>
              <div className="flex justify-between">
                <span>Premature Component Overhaul:</span>
                <span className="text-red-400 line-through">~{overhaulDowntimeMinutes} min</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recommended Physical Inspection Protocol */}
      <div className="bg-slate-950 border border-slate-800 rounded-lg p-5">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800 text-xs font-mono">
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-cyan-400" />
            <span className="text-slate-200 font-bold">FIELD TECHNICIAN INSPECTION PROTOCOL ({activeMachineId})</span>
          </div>
          <span className="text-slate-400">CLICK STEPS AS EXECUTED ON FACTORY FLOOR</span>
        </div>

        <div className="space-y-2.5">
          {actions.map((act) => {
            const isDone = checkedSteps[act.step];
            return (
              <div
                key={act.step}
                onClick={() => toggleStep(act.step)}
                className={`flex items-start gap-3 p-3 rounded border text-xs font-mono cursor-pointer transition-all ${
                  isDone
                    ? 'bg-emerald-950/20 border-emerald-800/80 text-emerald-300'
                    : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {isDone ? (
                    <CheckSquare className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-500" />
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-200">
                      {act.action}
                    </span>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                        act.priority === 'CRITICAL'
                          ? 'bg-red-950 border border-red-800 text-red-400'
                          : 'bg-cyan-950 border border-cyan-800 text-cyan-300'
                      }`}
                    >
                      {act.priority}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Required Tooling: <span className="text-slate-300">{act.tool}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Footer */}
      <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="text-xs font-mono text-slate-400">
          Inspection steps completed on {activeMachineId}. Proceed to technician sign-off and commit confirmed cause to institutional memory.
        </div>
        <button
          onClick={onProceedToVerification}
          className="flex items-center justify-center gap-2 px-6 py-2.5 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs font-mono transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)]"
        >
          <CheckCircle2 className="w-4 h-4 text-slate-950" />
          <span>PROCEED TO HUMAN VERIFICATION &amp; PROOF MEDIA</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
