import React from 'react';
import {
  BrainCircuit,
  CheckCircle2,
  Code,
  ShieldCheck,
  Clock,
  Wrench,
  AlertOctagon,
  ArrowRight,
  ArrowLeft,
  Database,
} from 'lucide-react';
import { ExtractionResult } from '../types/industrial';

interface KnowledgeExtractionViewProps {
  extraction: ExtractionResult;
  rawText: string;
  onProceed: () => void;
  onBack?: () => void;
  isReadOnly?: boolean;
}

export const KnowledgeExtractionView: React.FC<KnowledgeExtractionViewProps> = ({
  extraction,
  rawText,
  onProceed,
  onBack,
  isReadOnly = false,
}) => {

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-6 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-2">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 mb-1">
            <span className="px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-800/80">STEP 02</span>
            <span>STRUCTURED INSTITUTIONAL KNOWLEDGE EXTRACTION</span>
          </div>
          <h2 className="text-xl font-bold text-slate-100">Institutional Fact Representation</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-mono text-emerald-400 bg-slate-950 px-3 py-1.5 rounded border border-slate-800">
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            <span>FACTS EXTRACTED FROM REPORT</span>
          </div>
        </div>
      </div>

      {/* Raw Audio Note vs Extracted Telemetry Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Source Technician Voice Memo Context */}
        <div className="md:col-span-4 bg-slate-950 border border-slate-800 rounded-lg p-4 flex flex-col justify-between">
          <div>
            <div className="text-xs font-mono text-slate-400 mb-2">INPUT VOICE TRANSCRIPT / REPORT</div>
            <p className="text-sm font-mono text-slate-300 italic bg-slate-900/80 p-3 rounded border border-slate-800">
              "{rawText}"
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800/80 text-xs font-mono text-slate-400 space-y-1.5">
            <div className="flex justify-between">
              <span>Source:</span>
              <span className="text-slate-200">Technician Report</span>
            </div>
            <div className="flex justify-between">
              <span>Analysis Engine:</span>
              <span className="text-cyan-400">Diagnostic Intelligence</span>
            </div>
            <div className="flex justify-between">
              <span>Extraction Confidence:</span>
              <span className="text-emerald-400 font-bold tabular-nums">
                {Math.round(extraction.confidence_score * 100)}%
              </span>
            </div>
          </div>
        </div>

        {/* Structured Semantic Entity Grid */}
        <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Machine Target */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
            <div className="text-xs font-mono text-slate-400 mb-1">TARGET ASSET</div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold font-mono text-cyan-400">{extraction.machine_id}</span>
              <span className="text-xs text-slate-400">({extraction.machine_name})</span>
            </div>
          </div>

          {/* Time Condition */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
            <div className="text-xs font-mono text-slate-400 mb-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>OPERATING THRESHOLD</span>
            </div>
            <div className="text-sm font-semibold text-amber-300 font-mono">
              {extraction.time_condition}
            </div>
          </div>

          {/* Extracted Symptoms */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
            <div className="text-xs font-mono text-slate-400 mb-1.5">IDENTIFIED SYMPTOMS</div>
            <div className="flex flex-wrap gap-1.5">
              {extraction.symptoms.map((symptom, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300 font-mono text-xs"
                >
                  {symptom}
                </span>
              ))}
            </div>
          </div>

          {/* Proscribed Wasteful Action */}
          <div className="bg-slate-950 border border-red-950/80 rounded-lg p-4 bg-red-950/10">
            <div className="text-xs font-mono text-red-400 mb-1 flex items-center gap-1.5">
              <AlertOctagon className="w-3.5 h-3.5 text-red-400" />
              <span>AVOID COSTLY MISTAKE</span>
            </div>
            <div className="text-xs text-red-200 font-mono">
              {extraction.proscribed_action}
            </div>
          </div>

          {/* Recommended Priority Inspection */}
          <div className="sm:col-span-2 bg-slate-950 border border-cyan-900/60 rounded-lg p-4 bg-cyan-950/20">
            <div className="text-xs font-mono text-cyan-400 mb-1 flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5 text-cyan-400" />
              <span>RECOMMENDED FIRST INSPECTION</span>
            </div>
            <div className="text-sm font-semibold text-slate-100 font-mono">
              {extraction.recommended_inspection}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              Probable Root Cause Hypothesis: <span className="text-cyan-300">{extraction.probable_root_cause}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="text-xs font-mono text-slate-400">
          Knowledge is recorded. Proceed to ingest the incident sensor telemetry.
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
            className="flex items-center justify-center gap-2 px-6 py-2.5 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs font-mono transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] cursor-pointer shrink-0"
          >
            <span>PROCEED TO SENSOR CSV TELEMETRY</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
