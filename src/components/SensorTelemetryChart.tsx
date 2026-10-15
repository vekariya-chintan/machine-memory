import React, { useState, useEffect } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Download,
  Upload,
  Gauge,
  Thermometer,
  Zap,
  RotateCw,
  FileSpreadsheet,
  Cpu,
} from 'lucide-react';
import { SensorReading, Machine } from '../types/industrial';
import {
  MACHINE_TELEMETRY_DATASETS,
  DEMO_SENSOR_CSV,
  DEMO_SENSOR_ROWS,
  getMachineDataset,
  generateTelemetryFromExtraction,
} from '../services/machineMemoryService';
import { ExtractionResult } from '../types/industrial';

interface SensorTelemetryChartProps {
  onProceed: () => void;
  activeMachineId?: string;
  machine?: Machine;
  extraction?: ExtractionResult;
  telemetry?: {
    rows: SensorReading[];
    csv: string;
    fileName?: string;
  };
}

export const SensorTelemetryChart: React.FC<SensorTelemetryChartProps> = ({
  onProceed,
  activeMachineId = 'M001',
  machine,
  extraction,
  telemetry,
}) => {
  const currentAssetId = extraction?.machine_id || activeMachineId;

  const [data, setData] = useState<SensorReading[]>(telemetry?.rows || []);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(
    telemetry?.rows && telemetry.rows.length > 0 ? telemetry.rows.length - 1 : null
  );
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvText, setCsvText] = useState(telemetry?.csv || '');

  // Update telemetry dataset when Step 1 telemetry prop changes
  useEffect(() => {
    if (telemetry && telemetry.rows && telemetry.rows.length > 0) {
      setData(telemetry.rows);
      setCsvText(telemetry.csv);
      setHoveredIndex(telemetry.rows.length - 1);
    } else {
      setData([]);
      setCsvText('');
      setHoveredIndex(null);
    }
  }, [telemetry]);

  // SVG Chart dimensions
  const width = 640;
  const height = 240;
  const padding = { top: 20, right: 30, bottom: 35, left: 45 };
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;

  const isoLimit = machine?.baseline_metrics?.iso_vibration_limit ?? 2.2;

  const getX = (idx: number) => padding.left + (idx / Math.max(1, data.length - 1)) * graphWidth;

  const getVibrationY = (v: number) => {
    const min = 0.5;
    const max = 3.5;
    const norm = Math.max(0, Math.min(1, (v - min) / (max - min)));
    return padding.top + (1 - norm) * graphHeight;
  };

  const getTempY = (t: number) => {
    const min = 45;
    const max = 80;
    const norm = Math.max(0, Math.min(1, (t - min) / (max - min)));
    return padding.top + (1 - norm) * graphHeight;
  };

  const vibrationPath = data.reduce((acc, pt, i) => {
    const x = getX(i);
    const y = getVibrationY(pt.vibration);
    return i === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
  }, '');

  const tempPath = data.reduce((acc, pt, i) => {
    const x = getX(i);
    const y = getTempY(pt.temperature);
    return i === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
  }, '');

  const isoThresholdY = getVibrationY(isoLimit);

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setCsvText(content);
        parseCustomCsv(content);
      }
    };
    reader.readAsText(file);
  };

  const parseCustomCsv = (text: string) => {
    try {
      const lines = text.trim().split('\n');
      const rows: SensorReading[] = [];
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',');
        if (parts.length >= 6) {
          rows.push({
            timestamp: parts[0].trim(),
            minute: (i - 1) * 5,
            machine_id: parts[1].trim(),
            temperature: parseFloat(parts[2]),
            vibration: parseFloat(parts[3]),
            rpm: parseFloat(parts[4]),
            power: parseFloat(parts[5]),
          });
        }
      }
      if (rows.length > 0) {
        setData(rows);
        setHoveredIndex(rows.length - 1);
      }
    } catch (e) {
      console.warn('CSV parsing failed:', e);
    }
  };

  const latest = data[data.length - 1] || { vibration: 0, temperature: 0, power: 0, rpm: 0, timestamp: '08:20', minute: 20 };
  const hovered = hoveredIndex !== null && data[hoveredIndex] ? data[hoveredIndex] : latest;

  if (data.length === 0) {
    return (
      <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-6 sm:p-8 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 mb-1">
              <span className="px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-800/80">STEP 03</span>
              <span>SENSOR TELEMETRY CURVES ({currentAssetId})</span>
            </div>
            <h2 className="text-xl font-bold text-slate-100">Sensor CSV Telemetry Overview</h2>
          </div>
        </div>

        <div className="bg-slate-950 border border-slate-800 rounded-xl p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-400">
            <FileSpreadsheet className="w-6 h-6 text-slate-500" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-slate-200 font-mono">
              NO SENSOR CSV TELEMETRY ATTACHED IN STEP 01
            </h3>
            <p className="text-xs text-slate-400 font-mono max-w-lg mx-auto leading-relaxed">
              No sensor telemetry CSV file was attached during incident creation in Step 1. Telemetry curves and charts are displayed only when an actual CSV file is attached. You can upload a CSV file below, or proceed directly to Semantic Memory Retrieval (Step 04).
            </p>
          </div>

            <label className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs font-mono transition-colors cursor-pointer shadow-md">
              <Upload className="w-4 h-4" />
              <span>UPLOAD SENSOR CSV FILE NOW</span>
              <input type="file" accept=".csv,text/csv" onChange={handleCsvUpload} className="hidden" />
            </label>
        </div>

        {/* Action Footer */}
        <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="text-xs font-mono text-slate-400">
            Proceeding without sensor CSV telemetry. Analysis will rely on technician observation text.
          </div>
          <button
            onClick={onProceed}
            className="flex items-center justify-center gap-2 px-6 py-2.5 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs font-mono transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)]"
          >
            <span>PROCEED TO MEMORY RETRIEVAL</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-6 shadow-xl space-y-6">
      {/* Incident Alert Banner */}
      <div className="bg-amber-950/30 border border-amber-800/80 rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded bg-amber-500/20 text-amber-400 shrink-0">
            <AlertTriangle className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-amber-400 font-bold">
              <span>SHIFT TELEMETRY ALERT</span>
              <span>·</span>
              <span>ASSET: {currentAssetId}</span>
              <span>·</span>
              <span className="text-slate-300">{machine?.location || 'Plant Floor'}</span>
            </div>
            <h3 className="text-base font-bold text-slate-100">
              {currentAssetId} ({machine?.name || extraction?.machine_name || 'Machine Asset'}): {extraction?.symptoms?.length ? extraction.symptoms.join(' & ') : 'Vibration Threshold Breach'} ({hovered.vibration} mm/s)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Operating telemetry indicates anomaly onset {extraction?.time_condition || 'during warm-up run'}. Correlated with {extraction?.probable_root_cause || 'ISO vibration threshold breach'}.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-center">
          <button
            onClick={() => setShowCsvModal(!showCsvModal)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-mono transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-cyan-400" />
            <span>{showCsvModal ? 'HIDE CSV' : 'VIEW/UPLOAD CSV'}</span>
          </button>
        </div>
      </div>

      {/* CSV Raw Data Drawer / Modal */}
      {showCsvModal && (
        <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span>RAW SENSOR TELEMETRY CSV ({activeMachineId})</span>
            <label className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 cursor-pointer">
              <Upload className="w-3 h-3" />
              <span>UPLOAD REPLACEMENT CSV</span>
              <input type="file" accept=".csv" onChange={handleCsvUpload} className="hidden" />
            </label>
          </div>
          <textarea
            value={csvText}
            onChange={(e) => {
              setCsvText(e.target.value);
              parseCustomCsv(e.target.value);
            }}
            rows={6}
            className="w-full bg-slate-900 border border-slate-800 rounded p-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
          />
        </div>
      )}

      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
        {/* Vibration Metric */}
        <div className="bg-slate-950 border border-amber-900/60 rounded-lg p-3.5 relative overflow-hidden">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-amber-400" />
              VIBRATION (RMS)
            </span>
            <span className="text-[10px] text-red-400 bg-red-950/60 px-1.5 py-0.5 rounded border border-red-800/80">
              THRESHOLD BREACH
            </span>
          </div>
          <div className="text-2xl font-bold text-amber-400 tabular-nums">
            {hovered.vibration.toFixed(2)}{' '}
            <span className="text-xs font-normal text-slate-400">mm/s</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            ISO Limit: {isoLimit} mm/s · Nominal: {machine?.baseline_metrics.normal_vibration_mms || 1.5} mm/s
          </div>
        </div>

        {/* Temperature Metric */}
        <div className="bg-slate-950 border border-cyan-900/60 rounded-lg p-3.5">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="flex items-center gap-1">
              <Thermometer className="w-3.5 h-3.5 text-cyan-400" />
              OPERATING TEMP
            </span>
            <span className="text-[10px] text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/80">
              WARMUP ACTIVE
            </span>
          </div>
          <div className="text-2xl font-bold text-cyan-400 tabular-nums">
            {hovered.temperature.toFixed(1)}{' '}
            <span className="text-xs font-normal text-slate-400">°C</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Normal: {machine?.baseline_metrics.normal_temp_c || 65}°C · Max: {machine?.baseline_metrics.max_temp_c || 75}°C
          </div>
        </div>

        {/* Power Draw Metric */}
        <div className="bg-slate-950 border border-emerald-900/60 rounded-lg p-3.5">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              DRIVE POWER
            </span>
            <span className="text-[10px] text-amber-400 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/80">
              ELEVATED LOAD
            </span>
          </div>
          <div className="text-2xl font-bold text-emerald-400 tabular-nums">
            {hovered.power.toFixed(1)}{' '}
            <span className="text-xs font-normal text-slate-400">kW</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Rated Baseline: {machine?.baseline_metrics.power_baseline_kw || 8.0} kW
          </div>
        </div>

        {/* RPM Metric */}
        <div className="bg-slate-950 border border-purple-900/60 rounded-lg p-3.5">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="flex items-center gap-1">
              <RotateCw className="w-3.5 h-3.5 text-purple-400" />
              ROTATIONAL SPEED
            </span>
            <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/80">
              STABLE
            </span>
          </div>
          <div className="text-2xl font-bold text-purple-400 tabular-nums">
            {hovered.rpm}{' '}
            <span className="text-xs font-normal text-slate-400">RPM</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Rated Speed: {machine?.baseline_metrics.rated_rpm || 3000} RPM
          </div>
        </div>
      </div>

      {/* SVG Multi-Parameter Time-Series Telemetry Display */}
      <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-2 border-b border-slate-800/80 gap-2">
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-slate-400">SYNCHRONIZED TELEMETRY CHANNELS</span>
            <span className="text-slate-600">|</span>
            <span className="text-cyan-400">{activeMachineId} SENSOR STREAM</span>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <span className="text-slate-300">Vibration (mm/s)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
              <span className="text-slate-300">Temp (°C)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 border-t border-dashed border-red-500" />
              <span className="text-red-400">ISO {isoLimit} Limit</span>
            </div>
          </div>
        </div>

        {/* Responsive SVG Chart */}
        <div className="w-full overflow-x-auto">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto select-none">
            {/* Grid Lines */}
            <line
              x1={padding.left}
              y1={padding.top}
              x2={width - padding.right}
              y2={padding.top}
              stroke="#1e293b"
              strokeDasharray="2 2"
            />
            <line
              x1={padding.left}
              y1={padding.top + graphHeight / 2}
              x2={width - padding.right}
              y2={padding.top + graphHeight / 2}
              stroke="#1e293b"
              strokeDasharray="2 2"
            />
            <line
              x1={padding.left}
              y1={padding.top + graphHeight}
              x2={width - padding.right}
              y2={padding.top + graphHeight}
              stroke="#334155"
            />

            {/* ISO 10816-3 Threshold Alarm Line */}
            <line
              x1={padding.left}
              y1={isoThresholdY}
              x2={width - padding.right}
              y2={isoThresholdY}
              stroke="#ef4444"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
            <text
              x={width - padding.right - 4}
              y={isoThresholdY - 4}
              textAnchor="end"
              fill="#ef4444"
              fontSize="9"
              fontFamily="monospace"
              fontWeight="bold"
            >
              ISO ALARM ({isoLimit} mm/s)
            </text>

            {/* Curves */}
            <path d={tempPath} fill="none" stroke="#06b6d4" strokeWidth="2.5" />
            <path d={vibrationPath} fill="none" stroke="#f59e0b" strokeWidth="3" />

            {/* Data Points */}
            {data.map((pt, i) => {
              const x = getX(i);
              const vibY = getVibrationY(pt.vibration);
              const isBreach = pt.vibration > isoLimit;
              const isHovered = hoveredIndex === i;

              return (
                <g
                  key={i}
                  className="cursor-pointer"
                  onClick={() => setHoveredIndex(i)}
                  onMouseEnter={() => setHoveredIndex(i)}
                >
                  {isHovered && (
                    <line
                      x1={x}
                      y1={padding.top}
                      x2={x}
                      y2={padding.top + graphHeight}
                      stroke="#475569"
                      strokeWidth="1"
                      strokeDasharray="2 2"
                    />
                  )}

                  <circle
                    cx={x}
                    cy={vibY}
                    r={isHovered ? 6 : 4}
                    fill={isBreach ? '#ef4444' : '#f59e0b'}
                    stroke="#090d16"
                    strokeWidth="2"
                    className="transition-all"
                  />

                  <text
                    x={x}
                    y={height - 12}
                    textAnchor="middle"
                    fill={isHovered ? '#38bdf8' : '#94a3b8'}
                    fontSize="10"
                    fontFamily="monospace"
                    fontWeight={isHovered ? 'bold' : 'normal'}
                  >
                    {pt.timestamp}
                  </text>
                  <text
                    x={x}
                    y={height - 2}
                    textAnchor="middle"
                    fill="#64748b"
                    fontSize="8"
                    fontFamily="monospace"
                  >
                    +{pt.minute}m
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Selected Data Point Inspector */}
        <div className="mt-3 p-2.5 rounded bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">POINT INSPECTION ({activeMachineId}):</span>
            <span className="text-cyan-400 font-bold">{hovered.timestamp} (+{hovered.minute}m)</span>
          </div>
          <div className="flex items-center gap-4 text-slate-300">
            <span>Vib: <b className={hovered.vibration > isoLimit ? 'text-red-400' : 'text-amber-400'}>{hovered.vibration} mm/s</b></span>
            <span>Temp: <b className="text-cyan-400">{hovered.temperature}°C</b></span>
            <span>RPM: <b className="text-purple-400">{hovered.rpm}</b></span>
            <span>Power: <b className="text-emerald-400">{hovered.power} kW</b></span>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="text-xs font-mono text-slate-400">
          Sensor telemetry loaded for asset {activeMachineId}. Querying historical machine failure memory &amp; technician heuristics.
        </div>
        <button
          onClick={onProceed}
          className="flex items-center justify-center gap-2 px-6 py-2.5 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs font-mono transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)]"
        >
          <span>RETRIEVE HISTORICAL EVIDENCE</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
