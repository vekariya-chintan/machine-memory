import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Upload,
  Thermometer,
  Zap,
  RotateCw,
  FileSpreadsheet,
  ZoomIn,
  ZoomOut,
  Calendar,
  Clock,
  Layers,
  ChevronRight,
  Database,
  CheckCircle2,
} from 'lucide-react';
import { SensorReading, Machine, ExtractionResult, IncidentTelemetry } from '../types/industrial';
import {
  fetchIncidentTelemetry,
  saveIncidentTelemetryToFirestore,
} from '../services/machineMemoryService';

interface SensorTelemetryChartProps {
  onProceed: () => void;
  onBack?: () => void;
  activeMachineId?: string;
  activeIncidentId?: string;
  machine?: Machine;
  extraction?: ExtractionResult;
  telemetry?: {
    rows: SensorReading[];
    csv: string;
    fileName?: string;
  };
  isReadOnly?: boolean;
  onTelemetryUpdated?: (telemetry: { rows: SensorReading[]; csv: string; fileName?: string }) => void;
}

type ZoomLevel = 'day' | 'hour' | '5min';

interface ProcessedReading {
  raw: SensorReading;
  dateStr: string; // YYYY-MM-DD
  dayLabel: string; // e.g. "Sep 08"
  hourNum: number; // 0..23
  hourStr: string; // e.g. "08:00"
  minNum: number; // 0..59
  timeStr: string; // e.g. "08:05"
}

interface ChartPoint {
  id: string;
  date?: string;
  time?: string;
  label: string;
  secondaryLabel?: string;
  vibration: number;
  temperature: number;
  rpm: number;
  power: number;
  count: number;
  isBreach: boolean;
  originalDay?: string;
  originalHour?: number;
}

export const SensorTelemetryChart: React.FC<SensorTelemetryChartProps> = ({
  onProceed,
  onBack,
  activeMachineId = 'M001',
  activeIncidentId,
  machine,
  extraction,
  telemetry,
  isReadOnly = false,
  onTelemetryUpdated,
}) => {
  const currentAssetId = extraction?.machine_id || activeMachineId;

  const [data, setData] = useState<SensorReading[]>(telemetry?.rows || []);
  const [csvText, setCsvText] = useState(telemetry?.csv || '');
  const [fileName, setFileName] = useState(telemetry?.fileName || '');
  const [isLoadingFromFirebase, setIsLoadingFromFirebase] = useState(false);
  const [isSavedToFirebase, setIsSavedToFirebase] = useState(false);

  // Zoom & Grouping State
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('day');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedHour, setSelectedHour] = useState<number | null>(null);

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [showCsvModal, setShowCsvModal] = useState(false);

  // 1. Fetch real telemetry from Firebase Firestore if not already passed via props
  useEffect(() => {
    if (telemetry && telemetry.rows && telemetry.rows.length > 0) {
      setData(telemetry.rows);
      setCsvText(telemetry.csv);
      setFileName(telemetry.fileName || '');
      setIsSavedToFirebase(true);
      return;
    }

    if (activeIncidentId) {
      setIsLoadingFromFirebase(true);
      fetchIncidentTelemetry(activeIncidentId)
        .then((record: IncidentTelemetry | null) => {
          if (record && record.rows && record.rows.length > 0) {
            setData(record.rows);
            setCsvText(record.raw_csv || '');
            setFileName(record.file_name || `${activeIncidentId}_telemetry.csv`);
            setIsSavedToFirebase(true);
            onTelemetryUpdated?.({
              rows: record.rows,
              csv: record.raw_csv || '',
              fileName: record.file_name || `${activeIncidentId}_telemetry.csv`,
            });
          }
        })
        .finally(() => {
          setIsLoadingFromFirebase(false);
        });
    }
  }, [activeIncidentId, telemetry]);

  // 2. Parse sensor readings into standardized date/time objects
  const processedReadings = useMemo<ProcessedReading[]>(() => {
    return data.map((r, idx) => {
      let dateStr = '2026-09-14';
      let hourNum = 8;
      let minNum = (idx * 5) % 60;
      let timeStr = '08:00';

      const ts = (r.timestamp || '').trim();

      // Case A: Full ISO or YYYY-MM-DD HH:mm
      const fullDateMatch = ts.match(/^(\d{4}-\d{2}-\d{2})[T\s](\d{1,2}):(\d{2})/);
      if (fullDateMatch) {
        dateStr = fullDateMatch[1];
        hourNum = parseInt(fullDateMatch[2], 10);
        minNum = parseInt(fullDateMatch[3], 10);
        timeStr = `${String(hourNum).padStart(2, '0')}:${String(minNum).padStart(2, '0')}`;
      } else {
        // Case B: Time only HH:mm
        const timeMatch = ts.match(/^(\d{1,2}):(\d{2})/);
        if (timeMatch) {
          hourNum = parseInt(timeMatch[1], 10);
          minNum = parseInt(timeMatch[2], 10);
          timeStr = `${String(hourNum).padStart(2, '0')}:${String(minNum).padStart(2, '0')}`;
          if (r.minute !== undefined && r.minute >= 1440) {
            const dayOffset = Math.floor(r.minute / 1440);
            const baseDate = new Date('2026-09-08T00:00:00Z');
            dateStr = new Date(baseDate.getTime() + dayOffset * 86400000).toISOString().split('T')[0];
          }
        }
      }

      // Format clean Month Day label e.g. "Sep 08"
      let dayLabel = dateStr;
      try {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
          const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
          dayLabel = d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
        }
      } catch (e) {
        dayLabel = dateStr;
      }

      return {
        raw: r,
        dateStr,
        dayLabel,
        hourNum,
        hourStr: `${String(hourNum).padStart(2, '0')}:00`,
        minNum,
        timeStr,
      };
    });
  }, [data]);

  // Unique days list in dataset
  const uniqueDays = useMemo(() => {
    const set = new Set<string>();
    processedReadings.forEach((r) => set.add(r.dateStr));
    return Array.from(set).sort();
  }, [processedReadings]);

  // Auto-determine initial zoom level when data loads or changes
  useEffect(() => {
    if (processedReadings.length === 0) return;

    if (uniqueDays.length > 1) {
      setZoomLevel('day');
      setSelectedDay(null);
      setSelectedHour(null);
    } else if (processedReadings.length > 36) {
      setZoomLevel('hour');
      setSelectedDay(uniqueDays[0] || null);
      setSelectedHour(null);
    } else {
      setZoomLevel('5min');
      setSelectedDay(uniqueDays[0] || null);
      setSelectedHour(null);
    }
  }, [uniqueDays, processedReadings.length]);

  const isoLimit = machine?.baseline_metrics?.iso_vibration_limit ?? 2.2;

  // 3. Compute Group-Wise Aggregated Display Points
  const displayPoints = useMemo<ChartPoint[]>(() => {
    if (processedReadings.length === 0) return [];

    // LEVEL 1: DAY LEVEL (Aggregated per day if dataset spans multiple days)
    if (zoomLevel === 'day') {
      return uniqueDays.map((day) => {
        const dayReadings = processedReadings.filter((r) => r.dateStr === day);
        const maxVib = dayReadings.reduce((max, r) => Math.max(max, r.raw.vibration), 0);
        const avgTemp = dayReadings.reduce((sum, r) => sum + r.raw.temperature, 0) / Math.max(1, dayReadings.length);
        const avgRpm = dayReadings.reduce((sum, r) => sum + r.raw.rpm, 0) / Math.max(1, dayReadings.length);
        const avgPower = dayReadings.reduce((sum, r) => sum + r.raw.power, 0) / Math.max(1, dayReadings.length);

        const sample = dayReadings[0];
        return {
          id: `day-${day}`,
          date: sample ? sample.dayLabel : day,
          label: sample ? sample.dayLabel : day,
          secondaryLabel: `${dayReadings.length} pts`,
          vibration: parseFloat(maxVib.toFixed(2)),
          temperature: parseFloat(avgTemp.toFixed(1)),
          rpm: Math.round(avgRpm),
          power: parseFloat(avgPower.toFixed(1)),
          count: dayReadings.length,
          isBreach: maxVib > isoLimit,
          originalDay: day,
        };
      });
    }

    // Filter to selected day or default to first day
    const targetDay = selectedDay || uniqueDays[0];
    const filteredByDay = processedReadings.filter((r) => !targetDay || r.dateStr === targetDay);

    // LEVEL 2: HOURLY LEVEL (Aggregated per hour)
    if (zoomLevel === 'hour') {
      const hoursMap = new Map<number, ProcessedReading[]>();
      filteredByDay.forEach((r) => {
        const list = hoursMap.get(r.hourNum) || [];
        list.push(r);
        hoursMap.set(r.hourNum, list);
      });

      const sortedHours = Array.from(hoursMap.keys()).sort((a, b) => a - b);
      return sortedHours.map((hour) => {
        const hourReadings = hoursMap.get(hour) || [];
        const maxVib = hourReadings.reduce((max, r) => Math.max(max, r.raw.vibration), 0);
        const avgTemp = hourReadings.reduce((sum, r) => sum + r.raw.temperature, 0) / Math.max(1, hourReadings.length);
        const avgRpm = hourReadings.reduce((sum, r) => sum + r.raw.rpm, 0) / Math.max(1, hourReadings.length);
        const avgPower = hourReadings.reduce((sum, r) => sum + r.raw.power, 0) / Math.max(1, hourReadings.length);

        const label = `${String(hour).padStart(2, '0')}:00`;
        return {
          id: `hour-${targetDay}-${hour}`,
          date: targetDay,
          time: label,
          label,
          secondaryLabel: `${hourReadings.length} pts`,
          vibration: parseFloat(maxVib.toFixed(2)),
          temperature: parseFloat(avgTemp.toFixed(1)),
          rpm: Math.round(avgRpm),
          power: parseFloat(avgPower.toFixed(1)),
          count: hourReadings.length,
          isBreach: maxVib > isoLimit,
          originalDay: targetDay,
          originalHour: hour,
        };
      });
    }

    // LEVEL 3: 5-MINUTE RAW LEVEL (Granular inspection)
    let filteredReadings = filteredByDay;
    if (selectedHour !== null) {
      filteredReadings = filteredByDay.filter((r) => r.hourNum === selectedHour);
    }

    return filteredReadings.map((r, idx) => ({
      id: `5min-${r.dateStr}-${r.timeStr}-${idx}`,
      date: r.dateStr,
      time: r.timeStr,
      label: r.timeStr,
      secondaryLabel: `+${r.raw.minute}m`,
      vibration: r.raw.vibration,
      temperature: r.raw.temperature,
      rpm: r.raw.rpm,
      power: r.raw.power,
      count: 1,
      isBreach: r.raw.vibration > isoLimit,
      originalDay: r.dateStr,
      originalHour: r.hourNum,
    }));
  }, [processedReadings, uniqueDays, zoomLevel, selectedDay, selectedHour, isoLimit]);

  // Handle Zoom In on Point Click
  const handlePointClick = (pt: ChartPoint) => {
    if (zoomLevel === 'day' && pt.originalDay) {
      setSelectedDay(pt.originalDay);
      setZoomLevel('hour');
      setHoveredIndex(null);
    } else if (zoomLevel === 'hour' && pt.originalHour !== undefined) {
      setSelectedHour(pt.originalHour);
      setZoomLevel('5min');
      setHoveredIndex(null);
    }
  };

  // Handle Zoom Out
  const handleZoomOut = () => {
    if (zoomLevel === '5min') {
      if (uniqueDays.length > 1 || processedReadings.length > 48) {
        setZoomLevel('hour');
        setSelectedHour(null);
      } else {
        setZoomLevel('hour');
        setSelectedHour(null);
      }
    } else if (zoomLevel === 'hour') {
      if (uniqueDays.length > 1) {
        setZoomLevel('day');
        setSelectedDay(null);
        setSelectedHour(null);
      }
    }
    setHoveredIndex(null);
  };

  // SVG Chart Geometry
  const width = 640;
  const height = 260;
  const padding = { top: 25, right: 35, bottom: 45, left: 45 };
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;

  const getX = (idx: number) => {
    if (displayPoints.length <= 1) return padding.left + graphWidth / 2;
    return padding.left + (idx / (displayPoints.length - 1)) * graphWidth;
  };

  const getVibrationY = (v: number) => {
    const min = 0.5;
    const max = 3.5;
    const norm = Math.max(0, Math.min(1, (v - min) / (max - min)));
    return padding.top + (1 - norm) * graphHeight;
  };

  const getTempY = (t: number) => {
    const min = 40;
    const max = 80;
    const norm = Math.max(0, Math.min(1, (t - min) / (max - min)));
    return padding.top + (1 - norm) * graphHeight;
  };

  const vibrationPath = displayPoints.reduce((acc, pt, i) => {
    const x = getX(i);
    const y = getVibrationY(pt.vibration);
    return i === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
  }, '');

  const tempPath = displayPoints.reduce((acc, pt, i) => {
    const x = getX(i);
    const y = getTempY(pt.temperature);
    return i === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
  }, '');

  const isoThresholdY = getVibrationY(isoLimit);

  // Smart non-overlapping tick label indices calculation
  const tickIndices = useMemo<number[]>(() => {
    const count = displayPoints.length;
    if (count === 0) return [];
    const maxTicks = Math.min(6, count);
    if (count <= maxTicks) {
      return Array.from({ length: count }, (_, i) => i);
    }
    const step = (count - 1) / (maxTicks - 1);
    const indices: number[] = [];
    for (let i = 0; i < maxTicks; i++) {
      indices.push(Math.round(i * step));
    }
    return Array.from(new Set(indices)).sort((a, b) => a - b);
  }, [displayPoints.length]);

  // Smart CSV Upload Handler & Direct Firestore Persistence
  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      if (content) {
        setCsvText(content);
        setFileName(file.name);
        const parsedRows = parseCustomCsv(content);
        if (parsedRows.length > 0) {
          setData(parsedRows);

          // Persist directly to Firebase Firestore incident_telemetry collection if incident ID is known
          if (activeIncidentId) {
            try {
              await saveIncidentTelemetryToFirestore(activeIncidentId, {
                rows: parsedRows,
                csv: content,
                fileName: file.name,
                machineId: currentAssetId,
              });
              setIsSavedToFirebase(true);
            } catch (err) {
              console.warn('Telemetry save note:', err);
            }
          }

          onTelemetryUpdated?.({
            rows: parsedRows,
            csv: content,
            fileName: file.name,
          });
        }
      }
    };
    reader.readAsText(file);
  };

  const parseCustomCsv = (text: string): SensorReading[] => {
    try {
      const lines = text.trim().split('\n').filter((l) => l.trim().length > 0);
      if (lines.length < 2) return [];

      const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
      const timeIdx = header.findIndex((h) => h.includes('time') || h.includes('date') || h.includes('timestamp'));
      const machIdx = header.findIndex((h) => h.includes('machine') || h.includes('asset'));
      const tempIdx = header.findIndex((h) => h.includes('temp'));
      const vibIdx = header.findIndex((h) => h.includes('vib'));
      const rpmIdx = header.findIndex((h) => h.includes('rpm') || h.includes('speed'));
      const pwrIdx = header.findIndex((h) => h.includes('pow') || h.includes('pwr') || h.includes('kw'));

      const rows: SensorReading[] = [];
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',').map((p) => p.trim());
        if (parts.length >= 4) {
          const t = timeIdx !== -1 ? parts[timeIdx] : parts[0];
          const mId = machIdx !== -1 ? parts[machIdx] : currentAssetId;
          const temp = tempIdx !== -1 ? parseFloat(parts[tempIdx]) : parseFloat(parts[2] || '45');
          const vib = vibIdx !== -1 ? parseFloat(parts[vibIdx]) : parseFloat(parts[3] || '1.1');
          const rpm = rpmIdx !== -1 ? parseFloat(parts[rpmIdx]) : parseFloat(parts[4] || '3000');
          const pwr = pwrIdx !== -1 ? parseFloat(parts[pwrIdx]) : parseFloat(parts[5] || '15');

          if (!isNaN(vib) && !isNaN(temp)) {
            rows.push({
              timestamp: t,
              minute: (i - 1) * 5,
              machine_id: mId || currentAssetId,
              temperature: isNaN(temp) ? 45.0 : temp,
              vibration: isNaN(vib) ? 1.0 : vib,
              rpm: isNaN(rpm) ? 3000 : rpm,
              power: isNaN(pwr) ? 15.0 : pwr,
            });
          }
        }
      }
      return rows;
    } catch (e) {
      console.warn('CSV parsing failed:', e);
      return [];
    }
  };

  const defaultPoint: ChartPoint = {
    id: 'empty',
    label: '--',
    vibration: 0,
    temperature: 0,
    rpm: 0,
    power: 0,
    count: 0,
    isBreach: false,
  };

  const latest = displayPoints[displayPoints.length - 1] || defaultPoint;
  const hovered = hoveredIndex !== null && displayPoints[hoveredIndex] ? displayPoints[hoveredIndex] : latest;

  if (isLoadingFromFirebase) {
    return (
      <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-12 text-center space-y-4 shadow-xl">
        <div className="w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <div className="text-sm font-mono text-cyan-400 font-bold">
          LOADING REAL SENSOR TELEMETRY FROM FIREBASE...
        </div>
        <p className="text-xs text-slate-500 font-mono">
          Retrieving linked sensor stream records from Firestore collection /incident_telemetry
        </p>
      </div>
    );
  }

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
              NO SENSOR CSV TELEMETRY ATTACHED
            </h3>
            <p className="text-xs text-slate-400 font-mono max-w-lg mx-auto leading-relaxed">
              {isReadOnly
                ? 'No sensor telemetry CSV file was attached to this closed investigation.'
                : 'No sensor telemetry CSV file was attached in Step 1. Telemetry curves and charts are displayed only from actual uploaded or stored CSV records in Firebase. Upload a CSV file below to persist to Firestore, or proceed directly to Semantic Memory Retrieval.'}
            </p>
          </div>

          {!isReadOnly && (
            <label className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs font-mono transition-colors cursor-pointer shadow-md mx-auto w-fit">
              <Upload className="w-4 h-4" />
              <span>UPLOAD SENSOR CSV FILE NOW</span>
              <input type="file" accept=".csv,text/csv" onChange={handleCsvUpload} className="hidden" />
            </label>
          )}
        </div>

        {/* Action Footer */}
        <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="text-xs font-mono text-slate-400">
            Proceeding without sensor CSV telemetry. Analysis will rely on technician observation text.
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
              <span>PROCEED TO MEMORY RETRIEVAL</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
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
              {currentAssetId} ({machine?.name || extraction?.machine_name || 'Machine Asset'}):{' '}
              {extraction?.symptoms?.length ? extraction.symptoms.join(' & ') : 'Vibration Threshold Breach'} (
              {hovered.vibration} mm/s)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Operating telemetry indicates anomaly onset {extraction?.time_condition || 'during warm-up run'}.
              Correlated with {extraction?.probable_root_cause || 'ISO vibration threshold breach'}.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-center">
          <button
            onClick={() => setShowCsvModal(!showCsvModal)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-mono transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-cyan-400" />
            <span>{showCsvModal ? 'HIDE CSV' : isReadOnly ? 'VIEW CSV' : 'VIEW/UPLOAD CSV'}</span>
          </button>
        </div>
      </div>

      {/* CSV Raw Data Drawer / Modal */}
      {showCsvModal && (
        <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span className="flex items-center gap-2">
              <span>RAW SENSOR TELEMETRY CSV ({data.length} records in Firestore)</span>
              {fileName && <span className="text-slate-300 font-bold">[{fileName}]</span>}
            </span>
            {!isReadOnly && (
              <label className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 cursor-pointer">
                <Upload className="w-3 h-3" />
                <span>UPLOAD REPLACEMENT CSV</span>
                <input type="file" accept=".csv" onChange={handleCsvUpload} className="hidden" />
              </label>
            )}
          </div>
          <textarea
            value={csvText}
            readOnly={isReadOnly}
            disabled={isReadOnly}
            onChange={(e) => {
              if (isReadOnly) return;
              setCsvText(e.target.value);
              const rows = parseCustomCsv(e.target.value);
              if (rows.length > 0) setData(rows);
            }}
            rows={6}
            className={`w-full bg-slate-900 border rounded p-2.5 text-xs font-mono text-slate-200 ${
              isReadOnly
                ? 'border-slate-800/80 bg-slate-900/50 cursor-default select-text'
                : 'border-slate-800 focus:outline-none focus:border-cyan-500'
            }`}
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
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded border ${
                hovered.isBreach
                  ? 'text-red-400 bg-red-950/60 border-red-800/80'
                  : 'text-emerald-400 bg-emerald-950/60 border-emerald-800/80'
              }`}
            >
              {hovered.isBreach ? 'THRESHOLD BREACH' : 'NOMINAL'}
            </span>
          </div>
          <div className="text-2xl font-bold text-amber-400 tabular-nums">
            {hovered.vibration.toFixed(2)}{' '}
            <span className="text-xs font-normal text-slate-400">mm/s</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            ISO Limit: {isoLimit} mm/s · Nominal: {machine?.baseline_metrics?.normal_vibration_mms || 1.2} mm/s
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
            Normal: {machine?.baseline_metrics?.normal_temp_c || 45}°C · Max: {machine?.baseline_metrics?.max_temp_c || 75}°C
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
              OPERATIONAL
            </span>
          </div>
          <div className="text-2xl font-bold text-emerald-400 tabular-nums">
            {hovered.power.toFixed(1)}{' '}
            <span className="text-xs font-normal text-slate-400">kW</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Rated Baseline: {machine?.baseline_metrics?.power_baseline_kw || 15.0} kW
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
              SYNCHRONIZED
            </span>
          </div>
          <div className="text-2xl font-bold text-purple-400 tabular-nums">
            {hovered.rpm}{' '}
            <span className="text-xs font-normal text-slate-400">RPM</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Rated Speed: {machine?.baseline_metrics?.rated_rpm || 3000} RPM
          </div>
        </div>
      </div>

      {/* SVG Multi-Parameter Time-Series Telemetry Display with Grouping & Zoom */}
      <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3">
        {/* Header Bar: Grouping Resolution & Channel Legends */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-3 border-b border-slate-800 gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-slate-400 font-bold">SYNCHRONIZED TELEMETRY CHANNELS</span>
              <span className="text-slate-600">|</span>
              <span className="text-cyan-400">{activeMachineId} SENSOR STREAM</span>
              <span className="text-[10px] text-slate-500">({data.length} CSV rows from Firebase)</span>
            </div>

            {/* Breadcrumb Navigation & View Level Switcher */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono pt-1">
              <span className="text-slate-500 text-[11px]">ZOOM LEVEL:</span>

              {/* Day Level Button */}
              <button
                type="button"
                onClick={() => {
                  setZoomLevel('day');
                  setSelectedDay(null);
                  setSelectedHour(null);
                  setHoveredIndex(null);
                }}
                className={`px-2 py-0.5 rounded border text-[11px] font-semibold transition-colors cursor-pointer ${
                  zoomLevel === 'day'
                    ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                📅 DAY ({uniqueDays.length} Days)
              </button>

              {/* Hour Level Button */}
              <button
                type="button"
                onClick={() => {
                  setZoomLevel('hour');
                  if (!selectedDay && uniqueDays[0]) setSelectedDay(uniqueDays[0]);
                  setSelectedHour(null);
                  setHoveredIndex(null);
                }}
                className={`px-2 py-0.5 rounded border text-[11px] font-semibold transition-colors cursor-pointer ${
                  zoomLevel === 'hour'
                    ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                🕒 HOURLY {selectedDay ? `(${selectedDay})` : ''}
              </button>

              {/* 5-Min Granular Button */}
              <button
                type="button"
                onClick={() => {
                  setZoomLevel('5min');
                  setHoveredIndex(null);
                }}
                className={`px-2 py-0.5 rounded border text-[11px] font-semibold transition-colors cursor-pointer ${
                  zoomLevel === '5min'
                    ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                ⏱ 5-MIN RAW {selectedHour !== null ? `(${String(selectedHour).padStart(2, '0')}:00)` : ''}
              </button>

              {/* Zoom Out Button */}
              {(zoomLevel !== 'day' || selectedDay !== null) && (
                <button
                  type="button"
                  onClick={handleZoomOut}
                  className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-[11px] font-mono transition-colors cursor-pointer ml-1"
                  title="Zoom out to previous aggregation frame"
                >
                  <ZoomOut className="w-3 h-3" />
                  <span>ZOOM OUT</span>
                </button>
              )}
            </div>
          </div>

          {/* Legends */}
          <div className="flex items-center gap-3 text-xs font-mono self-start lg:self-center shrink-0">
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

        {/* Interaction Hint */}
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 bg-slate-900/60 px-3 py-1.5 rounded border border-slate-800/80">
          <div className="flex items-center gap-1.5 text-cyan-300">
            <ZoomIn className="w-3 h-3 text-cyan-400" />
            <span>
              {zoomLevel === 'day' && 'Showing per-day peak telemetry. Click any Day point to zoom into Hourly data.'}
              {zoomLevel === 'hour' && 'Showing hourly telemetry. Click any Hour point to zoom into 5-minute intervals.'}
              {zoomLevel === '5min' && 'Showing granular 5-minute frames. Click Zoom Out above to return to hourly or daily view.'}
            </span>
          </div>
          <span className="text-slate-500 hidden sm:inline">
            Rendering {displayPoints.length} points
          </span>
        </div>

        {/* Responsive SVG Chart */}
        <div className="w-full overflow-x-auto">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto select-none">
            {/* Grid Horizontal Lines */}
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
              strokeWidth="1.5"
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

            {/* Interactive Data Points & Vertical Hover Line */}
            {displayPoints.map((pt, i) => {
              const x = getX(i);
              const vibY = getVibrationY(pt.vibration);
              const isHovered = hoveredIndex === i;

              return (
                <g
                  key={pt.id || i}
                  className="cursor-pointer"
                  onClick={() => {
                    setHoveredIndex(i);
                    handlePointClick(pt);
                  }}
                  onMouseEnter={() => setHoveredIndex(i)}
                >
                  {/* Vertical Hover Guideline */}
                  {isHovered && (
                    <line
                      x1={x}
                      y1={padding.top}
                      x2={x}
                      y2={padding.top + graphHeight}
                      stroke="#38bdf8"
                      strokeWidth="1.5"
                      strokeDasharray="2 2"
                    />
                  )}

                  {/* Click Target Area for touch / click */}
                  <rect
                    x={x - 12}
                    y={padding.top}
                    width={24}
                    height={graphHeight}
                    fill="transparent"
                  />

                  {/* Outer Glow Ring on Hover */}
                  {isHovered && (
                    <circle
                      cx={x}
                      cy={vibY}
                      r={9}
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="1.5"
                      className="animate-pulse"
                    />
                  )}

                  {/* Data Point Node */}
                  <circle
                    cx={x}
                    cy={vibY}
                    r={isHovered ? 6 : pt.isBreach ? 5 : 4}
                    fill={pt.isBreach ? '#ef4444' : '#f59e0b'}
                    stroke="#090d16"
                    strokeWidth="2"
                    className="transition-all"
                  />
                </g>
              );
            })}

            {/* Clean, Non-Overlapping X-Axis Labels (Date & Time Tiers) */}
            {tickIndices.map((idx) => {
              const pt = displayPoints[idx];
              if (!pt) return null;
              const x = getX(idx);
              const isHovered = hoveredIndex === idx;

              // Extract date & time components cleanly
              const hasDate = Boolean(pt.date);
              const hasTime = Boolean(pt.time);

              return (
                <g key={`tick-${idx}`}>
                  {/* Subtle tick indicator mark */}
                  <line
                    x1={x}
                    y1={padding.top + graphHeight}
                    x2={x}
                    y2={padding.top + graphHeight + 4}
                    stroke="#475569"
                    strokeWidth="1.2"
                  />

                  {/* Case 1: Day View (Shows Date clearly, e.g. "Sep 08") */}
                  {zoomLevel === 'day' ? (
                    <text
                      x={x}
                      y={height - 18}
                      textAnchor="middle"
                      fill={isHovered ? '#38bdf8' : '#94a3b8'}
                      fontSize="10"
                      fontFamily="monospace"
                      fontWeight={isHovered ? 'bold' : 'normal'}
                    >
                      {pt.label}
                    </text>
                  ) : hasDate && hasTime ? (
                    /* Case 2: Multi-tier Date + Time to completely avoid overlap */
                    <>
                      <text
                        x={x}
                        y={height - 22}
                        textAnchor="middle"
                        fill={isHovered ? '#38bdf8' : '#94a3b8'}
                        fontSize="9"
                        fontFamily="monospace"
                        fontWeight="bold"
                      >
                        {pt.date}
                      </text>
                      <text
                        x={x}
                        y={height - 9}
                        textAnchor="middle"
                        fill={isHovered ? '#67e8f9' : '#64748b'}
                        fontSize="8.5"
                        fontFamily="monospace"
                      >
                        {pt.time}
                      </text>
                    </>
                  ) : (
                    /* Case 3: Single clean time label e.g. "08:15" */
                    <text
                      x={x}
                      y={height - 18}
                      textAnchor="middle"
                      fill={isHovered ? '#38bdf8' : '#94a3b8'}
                      fontSize="9.5"
                      fontFamily="monospace"
                    >
                      {pt.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Selected Data Point Inspector */}
        <div className="mt-3 p-3 rounded bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between text-xs font-mono gap-2">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">POINT INSPECTION ({activeMachineId}):</span>
            <span className="text-cyan-400 font-bold">
              {hovered.date ? `${hovered.date} ` : ''}
              {hovered.time || hovered.label}
            </span>
            {hovered.count > 1 && (
              <span className="text-[10px] text-slate-500 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                {hovered.count} readings aggregated
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 text-slate-300">
            <span>
              Vib:{' '}
              <b className={hovered.vibration > isoLimit ? 'text-red-400' : 'text-amber-400'}>
                {hovered.vibration} mm/s
              </b>
            </span>
            <span>Temp: <b className="text-cyan-400">{hovered.temperature}°C</b></span>
            <span>RPM: <b className="text-purple-400">{hovered.rpm}</b></span>
            <span>Power: <b className="text-emerald-400">{hovered.power} kW</b></span>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="text-xs font-mono text-slate-400 flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>
            {isSavedToFirebase
              ? 'Telemetry dataset persisted in Firestore /incident_telemetry and linked to this investigation.'
              : 'Sensor telemetry stream active. Querying historical machine failure memory & technician heuristics.'}
          </span>
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
            <span>RETRIEVE HISTORICAL EVIDENCE</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
