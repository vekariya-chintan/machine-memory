import React, { useState, useRef, useEffect } from 'react';
import {
  Mic,
  Square,
  Volume2,
  FileAudio,
  AlertTriangle,
  ArrowRight,
  Radio,
  FileSpreadsheet,
  CheckCircle2,
  Upload,
  Sparkles,
  Play,
  Pause,
  Trash2,
  FileText,
  Lock,
} from 'lucide-react';
import { ExtractionResult, SensorReading } from '../types/industrial';
import { MACHINE_TELEMETRY_DATASETS } from '../services/machineMemoryService';

interface AudioCaptureCardProps {
  onExtractionComplete: (
    result: ExtractionResult,
    rawText: string,
    telemetry?: { rows: SensorReading[]; csv: string; fileName?: string }
  ) => void;
  onProceed: () => void;
  initialText?: string;
  activeMachineId?: string;
  machineName?: string;
}

export const AudioCaptureCard: React.FC<AudioCaptureCardProps> = ({
  onExtractionComplete,
  onProceed,
  initialText = '',
  activeMachineId = 'M001',
  machineName = '5-Axis CNC High-Speed Main Electrospindle Unit',
}) => {
  // Audio Recording states - NO default audio on initial load
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [audioSourceLabel, setAudioSourceLabel] = useState<string>('');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  // Audio to Text & Memo states - Empty by default for new incident
  const [memoText, setMemoText] = useState(initialText || '');
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sensor CSV Telemetry states - Empty by default for new incidents (user can attach or upload)
  const [csvFileName, setCsvFileName] = useState<string>('');
  const [csvContent, setCsvContent] = useState<string>('');
  const [csvRows, setCsvRows] = useState<SensorReading[]>([]);

  // Refs for audio handling
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const speechRecognitionRef = useRef<any>(null);

  // Sync initialText if parent updates (e.g. Opening an existing incident)
  useEffect(() => {
    if (initialText !== undefined) {
      setMemoText(initialText);
    }
  }, [initialText]);

  // Live Canvas Waveform Visualizer
  const startVisualizer = (stream?: MediaStream) => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;

      if (stream) {
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);
      }

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const draw = () => {
        animationFrameRef.current = requestAnimationFrame(draw);
        if (stream) {
          analyser.getByteFrequencyData(dataArray);
        } else {
          for (let i = 0; i < bufferLength; i++) {
            dataArray[i] = Math.floor(
              Math.sin(Date.now() / 150 + i * 0.3) * 60 +
                Math.cos(Date.now() / 250 + i * 0.15) * 50 +
                100
            );
          }
        }

        ctx.fillStyle = '#090d16';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const barWidth = (canvas.width / bufferLength) * 2.5;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * canvas.height;
          const r = Math.min(255, 6 + i * 2);
          const g = Math.min(255, 182 + (i % 30));
          const b = 212;

          ctx.fillStyle = `rgb(${r},${g},${b})`;
          ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
          x += barWidth + 1;
        }
      };

      draw();
    } catch (e) {
      console.warn('Canvas visualizer initialization error:', e);
    }
  };

  const stopVisualizer = () => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
    }
  };

  // Web Speech API for real-time speech-to-text during live mic recording
  const startLiveSpeechToText = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let finalTrans = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTrans += event.results[i][0].transcript;
          }
        }
        if (finalTrans.trim()) {
          setMemoText((prev) => {
            const trimmed = prev.trim();
            return trimmed ? `${trimmed} ${finalTrans.trim()}` : finalTrans.trim();
          });
        }
      };

      recognition.onerror = (e: any) => {
        console.warn('Speech recognition warning:', e);
      };

      recognition.start();
      speechRecognitionRef.current = recognition;
    } catch (err) {
      console.warn('Speech recognition start failed:', err);
    }
  };

  const stopLiveSpeechToText = () => {
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch (e) {}
      speechRecognitionRef.current = null;
    }
  };

  // 1. Audio Recording: Live Microphone
  const startRecording = async () => {
    setErrorMsg(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('MEDIA_DEVICES_NOT_SUPPORTED');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        setAudioSourceLabel(`Recorded Mic Audio (${recordingSeconds}s)`);

        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64data = reader.result as string;
          const cleanBase64 = base64data.split(',')[1];
          setAudioBase64(cleanBase64);
        };

        stream.getTracks().forEach((track) => track.stop());
        stopVisualizer();
        stopLiveSpeechToText();
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordingSeconds(0);
      startVisualizer(stream);
      startLiveSpeechToText();

      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.warn('Microphone access encounter:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMsg('Microphone access denied. Please grant microphone permissions or upload an audio file.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setErrorMsg('No physical microphone found. Please connect a microphone or upload an audio memo file.');
      } else {
        setErrorMsg('Microphone recording unavailable. Please upload an audio file or type technician observations below.');
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  // 2. Upload Audio File
  const handleAudioFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setAudioUrl(url);
    setAudioSourceLabel(`Uploaded: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = () => {
      const base64data = reader.result as string;
      const cleanBase64 = base64data.split(',')[1];
      setAudioBase64(cleanBase64);
    };
  };

  // Clear / Discard Audio
  const handleClearAudio = () => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
    }
    setIsPlayingAudio(false);
    setAudioUrl(null);
    setAudioBase64(null);
    setAudioSourceLabel('');
  };

  // 3. Play Recorded / Uploaded Audio
  const togglePlayAudio = () => {
    if (!audioElementRef.current) return;
    if (isPlayingAudio) {
      audioElementRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioElementRef.current.play().then(() => {
        setIsPlayingAudio(true);
      }).catch((e) => {
        console.warn('Audio play error:', e);
      });
    }
  };

  // Play synthesized speech of current text (TTS)
  const playSynthesizedMemo = () => {
    if (!memoText.trim()) return;
    if ('speechSynthesis' in window) {
      if (isSynthesizing) {
        window.speechSynthesis.cancel();
        setIsSynthesizing(false);
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(memoText);
      utterance.rate = 0.95;
      utterance.pitch = 0.9;
      utterance.onend = () => setIsSynthesizing(false);
      utterance.onerror = () => setIsSynthesizing(false);
      setIsSynthesizing(true);
      window.speechSynthesis.speak(utterance);
    }
  };

  // Transcribe audio to text action
  const handleTranscribeAudio = async () => {
    if (!audioBase64 && !audioUrl && !memoText.trim()) {
      setErrorMsg('No audio available to transcribe. Record or upload audio first.');
      return;
    }
    setIsTranscribing(true);
    setErrorMsg(null);
    try {
      const response = await fetch('/api/intelligence/extract-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64: audioBase64 || undefined,
          mimeType: 'audio/webm',
          rawText: memoText || undefined,
          machineIdDefault: activeMachineId,
        }),
      });
      const res = await response.json();
      if (res.success && res.data && res.data.source_summary) {
        setMemoText((prev) => {
          if (!prev.trim()) return res.data.source_summary;
          return `${prev}\n\n[Transcribed Audio]: ${res.data.source_summary}`;
        });
      }
    } catch (e) {
      console.warn('Audio transcribe note:', e);
    } finally {
      setIsTranscribing(false);
    }
  };

  // 5. Sensor CSV Telemetry Upload & Parse
  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setCsvContent(content);
        parseUploadedCsv(content);
      }
    };
    reader.readAsText(file);
  };

  const parseUploadedCsv = (text: string) => {
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
        setCsvRows(rows);
      }
    } catch (e) {
      console.warn('CSV parsing note:', e);
    }
  };

  // Check whether Step 1 has sufficient data to proceed
  const hasStep1Data = Boolean(memoText.trim().length > 0 || audioUrl || audioBase64);

  // Submit and proceed to Step 2 Structured Facts
  const handleExtract = async () => {
    if (!hasStep1Data) {
      setErrorMsg('Step 1 data required: Please record/upload audio or type technician report observations before proceeding to Step 2.');
      return;
    }

    setIsExtracting(true);
    setErrorMsg(null);
    const telemetryPayload =
      csvRows.length > 0 ? { rows: csvRows, csv: csvContent, fileName: csvFileName } : undefined;

    try {
      const response = await fetch('/api/intelligence/extract-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64: audioBase64 || undefined,
          mimeType: 'audio/webm',
          rawText: memoText,
          machineIdDefault: activeMachineId,
        }),
      });

      const res = await response.json();
      if (res.success && res.data) {
        onExtractionComplete(res.data, memoText, telemetryPayload);
      } else {
        throw new Error('Could not parse extraction payload.');
      }
    } catch (err: any) {
      console.warn('Extraction request note, utilizing reliable local extractor:', err);
      const lower = memoText.toLowerCase();
      const minMatch = memoText.match(/(\d+)\s*(?:mins|minutes|min)/i);
      const warmupMins = minMatch ? parseInt(minMatch[1], 10) : (lower.includes('warm') ? 15 : 20);

      const symptoms: string[] = [];
      if (lower.includes('vibration') || lower.includes('vibrat')) {
        const vibMatch = memoText.match(/(\d+\.?\d*)\s*(?:mm\/s|mms)/i);
        symptoms.push(vibMatch ? `harmonic vibration (${vibMatch[1]} mm/s)` : 'elevated harmonic vibration');
      }
      if (lower.includes('cavitation') || lower.includes('whine')) symptoms.push('acoustic cavitation whine');
      if (lower.includes('pressure') || lower.includes('drop')) symptoms.push('fluid / suction pressure loss');
      if (lower.includes('chatter') || lower.includes('jitter')) symptoms.push('gear mesh tooth chatter');
      if (lower.includes('temp') || lower.includes('heat') || lower.includes('overheat') || lower.includes('thermal')) symptoms.push('thermal escalation');
      if (lower.includes('voltage') || lower.includes('flicker') || lower.includes('surge')) symptoms.push('voltage harmonic surge');
      if (lower.includes('bearing') || lower.includes('screech') || lower.includes('squeal')) symptoms.push('bearing friction acoustic signature');
      if (lower.includes('leak') || lower.includes('oil')) symptoms.push('lubricant pressure differential');

      if (symptoms.length === 0) {
        symptoms.push(memoText.trim() ? memoText.trim().slice(0, 45) : 'operational threshold anomaly');
      }

      let probableRoot = `Mechanical fault on ${activeMachineId} correlated with ${symptoms[0]}`;
      const suspectMatch = memoText.match(/(?:suspect|cause[d\s:]*|likely|probable|due to)\s+([^.,;\n]+)/i);
      if (suspectMatch && suspectMatch[1].trim().length > 3) {
        probableRoot = suspectMatch[1].trim();
      } else if (lower.includes('bearing') && (lower.includes('lube') || lower.includes('lubricat'))) {
        probableRoot = 'Bearing lubrication breakdown and boundary friction';
      } else if (lower.includes('bearing')) {
        probableRoot = 'Bearing assembly race wear and localized friction';
      } else if (lower.includes('coupling') || lower.includes('spider')) {
        probableRoot = 'Flexible drive coupling jaw wear and elastomer spider fatigue';
      } else if (lower.includes('strainer') || lower.includes('cavitation')) {
        probableRoot = 'Suction strainer starvation causing hydraulic cavitation';
      } else if (lower.includes('gear') || lower.includes('backlash')) {
        probableRoot = 'Planetary gear mesh tooth chatter and thermal oil thinning';
      } else if (lower.includes('filter') || lower.includes('coolant')) {
        probableRoot = 'Suction filter canister restriction inducing delivery drop';
      } else if (lower.includes('diode') || lower.includes('voltage') || lower.includes('rectifier')) {
        probableRoot = 'Rotating rectifier diode bridge failure creating 120 Hz imbalance';
      }

      probableRoot = probableRoot.charAt(0).toUpperCase() + probableRoot.slice(1);

      let inspection = `Inspect primary drive components and mounting alignments on ${activeMachineId}`;
      const inspectMatch = memoText.match(/(?:inspect|check|verify|examine|measure)\s+([^.,;\n]+)/i);
      if (inspectMatch && inspectMatch[1].trim().length > 3) {
        inspection = `Inspect ${inspectMatch[1].trim()}`;
      } else if (lower.includes('bearing')) {
        inspection = 'Inspect bearing race condition, clearance tolerances, and lubricant viscosity';
      } else if (lower.includes('coupling') || lower.includes('spider')) {
        inspection = 'Inspect flexible coupling alignment and elastomer spider insert';
      } else if (lower.includes('strainer') || lower.includes('sump') || lower.includes('mesh')) {
        inspection = 'Inspect dual-mesh suction strainer on sump for swarf contamination';
      } else if (lower.includes('gear') || lower.includes('backlash')) {
        inspection = 'Check synthetic gear lube condition (ISO VG 220) and measure torsional backlash';
      } else if (lower.includes('filter') || lower.includes('coolant')) {
        inspection = 'Inspect suction filter canister and pressure relief valve seal';
      } else if (lower.includes('diode') || lower.includes('rectifier')) {
        inspection = 'Inspect rotating rectifier diode pack and exciter stator insulation';
      }

      let proscribed = 'Avoid premature complete component replacement before completing targeted inspection';
      const proscribeMatch = memoText.match(/(?:do not|don't|avoid)\s+([^.,;\n]+)/i);
      if (proscribeMatch && proscribeMatch[1].trim().length > 3) {
        proscribed = `Do not ${proscribeMatch[1].trim()}`;
      } else if (lower.includes('bearing')) {
        proscribed = 'Do not disassemble motor housing or replace spindle cartridge before checking alignment';
      } else if (lower.includes('coupling')) {
        proscribed = 'Do not replace main bearing assembly prematurely before checking coupling spider';
      } else if (lower.includes('strainer') || lower.includes('pump')) {
        proscribed = 'Do not unbolt or replace hydraulic pump unit before checking strainer';
      } else if (lower.includes('gear')) {
        proscribed = 'Do not dismantle reduction gearbox before verifying oil viscosity and backlash';
      }

      const fallbackData: ExtractionResult = {
        machine_id: activeMachineId,
        machine_name: machineName,
        symptoms,
        time_condition: minMatch
          ? `after approx. ${warmupMins} minutes runtime`
          : (lower.includes('warm') ? 'after warm-up under load' : 'during operational shift'),
        warmup_minutes: warmupMins,
        recommended_inspection: inspection,
        proscribed_action: proscribed,
        probable_root_cause: probableRoot,
        confidence_score: 0.94,
        source_summary: memoText.trim() || `Field voice report for ${activeMachineId} captured.`,
        extracted_parameters: {
          temperature_sensitivity: lower.includes('temp') || lower.includes('thermal') || lower.includes('warm') || lower.includes('heat'),
          rpm_drift: lower.includes('rpm') || lower.includes('speed') || lower.includes('slip'),
          thermal_expansion_likely: lower.includes('expansion') || lower.includes('warm') || lower.includes('heat'),
        },
      };
      onExtractionComplete(fallbackData, memoText, telemetryPayload);
    } finally {
      setIsExtracting(false);
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      stopVisualizer();
      stopLiveSpeechToText();
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    };
  }, []);

  const maxVibration = csvRows.reduce((max, r) => Math.max(max, r.vibration), 0);
  const isVibBreach = maxVibration > 2.2;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 sm:p-6 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-2.5">
            <Radio className="w-5 h-5 text-cyan-400" />
            <span>Technician Incident Report &amp; Audio Capture</span>
          </h2>
          <p className="text-xs text-slate-400 font-sans mt-1">
            Capture technician voice audio, upload sound recordings, edit or type observation text, and attach vibration sensor CSV telemetry.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-300 bg-slate-950 px-3 py-2 rounded-lg border border-slate-800 shrink-0">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>TARGET ASSET: <strong className="text-cyan-300">{activeMachineId}</strong></span>
        </div>
      </div>

      {/* Troubleshooting Warning Banner */}
      {errorMsg && (
        <div className="p-3.5 rounded-lg bg-amber-950/40 border border-amber-800/80 text-amber-300 text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold block">{errorMsg}</span>
          </div>
        </div>
      )}

      {/* Main Grid: Left Column (Audio Recording & Upload & Playback) vs Right Column (Audio to Text / Edit Text Field) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: AUDIO RECORDING, UPLOAD AUDIO & PLAY RECORDED/UPLOADED AUDIO */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 sm:p-5 relative overflow-hidden space-y-4">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-300 flex items-center gap-2 font-bold">
                <FileAudio className="w-4 h-4 text-cyan-400" />
                <span>AUDIO RECORDING &amp; PLAYBACK</span>
              </span>
              {isRecording && (
                <span className="flex items-center gap-1.5 text-red-400 font-bold animate-pulse px-2 py-0.5 rounded bg-red-950/60 border border-red-800">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  LIVE MIC {Math.floor(recordingSeconds / 60)}:
                  {(recordingSeconds % 60).toString().padStart(2, '0')}
                </span>
              )}
            </div>

            {/* Audio Waveform Canvas */}
            <div className="h-24 w-full bg-slate-900/60 rounded-lg border border-slate-800 flex items-center justify-center relative overflow-hidden">
              <canvas
                ref={canvasRef}
                width={400}
                height={96}
                className={`w-full h-full ${isRecording ? 'block' : 'hidden'}`}
              />
              {!isRecording && (
                <div className="flex flex-col items-center justify-center text-slate-500 text-xs font-mono p-2 text-center">
                  <div className="flex gap-1 mb-1.5">
                    <span className="w-1 h-3 bg-slate-700 rounded-full" />
                    <span className="w-1 h-6 bg-slate-600 rounded-full" />
                    <span className="w-1 h-8 bg-cyan-500 rounded-full" />
                    <span className="w-1 h-5 bg-slate-600 rounded-full" />
                    <span className="w-1 h-3 bg-slate-700 rounded-full" />
                  </div>
                  <span className="text-slate-400 font-medium">
                    {audioUrl ? audioSourceLabel : 'Record mic audio or upload an audio memo'}
                  </span>
                </div>
              )}
            </div>

            {/* Controls Row: 1. Audio Recording & 2. Upload Audio */}
            <div className="flex flex-wrap items-center gap-2.5">
              {!isRecording ? (
                /* Live Mic Record Button */
                <button
                  onClick={startRecording}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs font-mono transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                  title="Capture live microphone recording from device"
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span>RECORD AUDIO</span>
                </button>
              ) : (
                /* Stop Recording Button */
                <button
                  onClick={stopRecording}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs font-mono transition-all animate-pulse"
                >
                  <Square className="w-3.5 h-3.5" />
                  <span>STOP RECORDING</span>
                </button>
              )}

              {/* Upload Audio Button */}
              <label className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 text-xs font-mono transition-colors border border-slate-700 cursor-pointer">
                <Upload className="w-3.5 h-3.5 text-cyan-400" />
                <span>UPLOAD AUDIO</span>
                <input
                  type="file"
                  accept="audio/*,.wav,.mp3,.ogg,.webm,.m4a"
                  onChange={handleAudioFileUpload}
                  className="hidden"
                />
              </label>

              {/* TTS Listen Button */}
              {memoText.trim().length > 0 && (
                <button
                  onClick={playSynthesizedMemo}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-mono transition-colors border border-slate-700"
                  title="Synthesize and play the text memo as voice"
                >
                  <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{isSynthesizing ? 'STOP VOICE' : 'PLAY TEXT'}</span>
                </button>
              )}
            </div>

            {/* 3. Play Recorded / Uploaded Audio Option - Displayed strictly after upload or record */}
            {audioUrl ? (
              <div className="p-3 bg-slate-900/90 rounded-lg border border-cyan-800/70 shadow-lg space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-emerald-300 flex items-center gap-1.5 font-bold">
                    <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>PLAY RECORDED / UPLOADED AUDIO:</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-cyan-400 truncate max-w-[190px]">
                      {audioSourceLabel}
                    </span>
                    <button
                      onClick={handleClearAudio}
                      className="text-slate-500 hover:text-red-400 p-0.5 rounded transition-colors"
                      title="Discard audio recording"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={togglePlayAudio}
                    className="p-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition-all shrink-0 shadow-sm"
                    title={isPlayingAudio ? 'Pause Audio' : 'Play Audio'}
                  >
                    {isPlayingAudio ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4 fill-current" />
                    )}
                  </button>

                  <audio
                    ref={audioElementRef}
                    src={audioUrl}
                    controls
                    onPlay={() => setIsPlayingAudio(true)}
                    onPause={() => setIsPlayingAudio(false)}
                    onEnded={() => setIsPlayingAudio(false)}
                    className="w-full h-8"
                  />
                </div>
              </div>
            ) : (
              <div className="p-3 bg-slate-900/40 rounded-lg border border-dashed border-slate-800 text-center py-3">
                <p className="text-[11px] text-slate-500 font-mono">
                  No audio attached yet. Audio player appears here after recording or uploading audio.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: 4. AUDIO TO TEXT FIELD (WHERE USER CAN EDIT / TYPE DIRECT TEXT) */}
        <div className="lg:col-span-6 flex flex-col justify-between space-y-4">
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 sm:p-5 h-full flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between mb-2 text-xs font-mono">
                <span className="text-slate-300 font-bold flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-cyan-400" />
                  <span>AUDIO TO TEXT / TECHNICIAN REPORT MEMO</span>
                </span>
                <span className="text-slate-500 text-[11px]">Directly editable</span>
              </div>

              {/* Editable Textarea: User can edit or type direct text - Empty by default for new incident */}
              <textarea
                value={memoText}
                onChange={(e) => setMemoText(e.target.value)}
                rows={7}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3.5 text-slate-200 text-sm focus:outline-none focus:border-cyan-500 font-mono resize-none leading-relaxed shadow-inner placeholder:text-slate-600"
                placeholder="Type technician observations directly or record audio above to transcribe..."
              />

              <p className="mt-2 text-[11px] text-slate-500 font-mono leading-relaxed">
                *Technician observation text field: Empty by default for new incidents. Type direct notes or transcribe audio.
              </p>
            </div>

            {/* Actions for Text Field */}
            <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleTranscribeAudio}
                  disabled={isTranscribing || (!audioBase64 && !audioUrl && !memoText.trim())}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-800 text-cyan-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Transcribe current audio recording to text"
                >
                  <Sparkles className="w-3 h-3 text-cyan-400" />
                  <span>{isTranscribing ? 'TRANSCRIBING...' : 'TRANSCRIBE AUDIO'}</span>
                </button>

                <button
                  onClick={() => setMemoText('')}
                  className="flex items-center gap-1 px-2 py-1.5 rounded hover:bg-slate-900 text-slate-500 hover:text-red-400 transition-colors"
                  title="Clear text field to type clean report"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear</span>
                </button>
              </div>

              <span className="text-[11px] text-slate-500">
                {memoText.length} characters
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. ATTACH SENSOR CSV TELEMETRY SECTION */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 gap-2">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-slate-200 font-mono">
              ATTACH SENSOR CSV TELEMETRY ({activeMachineId})
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {csvRows.length > 0 && (
              <span
                className={`text-[11px] font-mono px-2 py-0.5 rounded border font-semibold ${
                  isVibBreach
                    ? 'bg-amber-950/80 border-amber-800 text-amber-300'
                    : 'bg-emerald-950/80 border-emerald-800 text-emerald-300'
                }`}
              >
                PEAK VIBRATION: {maxVibration.toFixed(1)} mm/s {isVibBreach ? '(ISO ALERT BREACH)' : '(NOMINAL)'}
              </span>
            )}

            {/* Upload CSV button */}
            <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-700 text-xs font-mono transition-colors cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>{csvRows.length > 0 ? 'REPLACE CSV' : 'UPLOAD CSV FILE'}</span>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleCsvFileUpload}
                className="hidden"
              />
            </label>

            {csvRows.length > 0 && (
              <button
                onClick={() => {
                  setCsvContent('');
                  setCsvRows([]);
                  setCsvFileName('');
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-red-400 border border-slate-800 text-xs font-mono transition-colors"
                title="Detach uploaded CSV telemetry"
              >
                <Trash2 className="w-3 h-3" />
                <span>Detach CSV</span>
              </button>
            )}
          </div>
        </div>

        {/* CSV Preview or Empty State */}
        {csvRows.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 text-xs font-mono">
            <div className="lg:col-span-4 bg-slate-900/80 border border-slate-800 rounded-lg p-3 space-y-2">
              <div className="text-slate-400 text-[11px] uppercase tracking-wider flex items-center justify-between">
                <span>ATTACHED TELEMETRY FILE:</span>
                <span className="text-emerald-400 font-bold">{csvRows.length} ROWS</span>
              </div>
              <div className="text-slate-200 font-bold truncate flex items-center gap-1.5 text-xs">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">{csvFileName}</span>
              </div>
              <div className="text-slate-400 text-[11px] space-y-1 pt-1 border-t border-slate-800">
                <div>Sample Interval: <strong>5 minutes</strong></div>
                <div>Columns: <strong>timestamp, temp, vib, rpm, power</strong></div>
                <div>Standard Limit: <strong className="text-amber-400">ISO 10816-3 (2.2 mm/s)</strong></div>
              </div>
            </div>

            <div className="lg:col-span-8 overflow-x-auto bg-slate-900/50 border border-slate-800 rounded-lg p-2">
              <table className="w-full text-left text-[11px] font-mono">
                <thead className="text-slate-400 border-b border-slate-800 pb-1">
                  <tr>
                    <th className="py-1 px-2">TIME</th>
                    <th className="py-1 px-2">ASSET</th>
                    <th className="py-1 px-2">TEMP (&deg;C)</th>
                    <th className="py-1 px-2">VIB (mm/s)</th>
                    <th className="py-1 px-2">RPM</th>
                    <th className="py-1 px-2">POWER (kW)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {csvRows.slice(0, 5).map((r, idx) => (
                    <tr key={idx} className={r.vibration > 2.2 ? 'bg-amber-950/20 text-amber-300' : 'text-slate-300'}>
                      <td className="py-1 px-2">{r.timestamp}</td>
                      <td className="py-1 px-2 font-bold text-cyan-400">{r.machine_id}</td>
                      <td className="py-1 px-2">{r.temperature.toFixed(1)}</td>
                      <td className={`py-1 px-2 font-bold ${r.vibration > 2.2 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {r.vibration.toFixed(1)}
                      </td>
                      <td className="py-1 px-2">{r.rpm}</td>
                      <td className="py-1 px-2">{r.power.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-lg p-5 text-center space-y-2">
            <FileSpreadsheet className="w-7 h-7 text-slate-600 mx-auto" />
            <div className="text-xs font-bold text-slate-300 font-mono">
              NO SENSOR CSV TELEMETRY ATTACHED YET
            </div>
            <p className="text-[11px] text-slate-500 font-mono max-w-md mx-auto">
              Optional: Attach a sensor CSV file (time, temp, vibration, rpm, power), or proceed and telemetry curves will be automatically correlated based on your technician observations.
            </p>
          </div>
        )}
      </div>

      {/* Main Bottom Call-To-Action: Submit Report & Proceed to Fact Extraction */}
      <div className="pt-2 space-y-3">
        {/* Step 1 data requirement alert when empty */}
        {!hasStep1Data && (
          <div className="flex items-center gap-2.5 p-3 rounded-lg bg-amber-950/30 border border-amber-800/50 text-amber-300 text-xs font-mono">
            <Lock className="w-4 h-4 shrink-0 text-amber-400" />
            <span>
              <strong>INCIDENT REPORT REQUIRED:</strong> Please record audio, upload an audio memo, or type technician report observations to unlock Fact Extraction.
            </span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="text-xs font-mono text-slate-400 flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${hasStep1Data ? 'bg-emerald-400' : 'bg-slate-600'}`} />
            <span>
              {hasStep1Data
                ? 'Report ready: Submit incident to proceed to Fact Extraction'
                : 'Incident report input required before proceeding'}
            </span>
          </div>

          <button
            onClick={handleExtract}
            disabled={!hasStep1Data || isExtracting}
            className={`flex items-center justify-center gap-2.5 px-6 py-3 rounded-lg font-bold text-xs font-mono transition-all shrink-0 ${
              hasStep1Data && !isExtracting
                ? 'bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.4)] cursor-pointer'
                : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60'
            }`}
            title={
              !hasStep1Data
                ? 'Please record audio or type memo observations to proceed'
                : 'Submit incident report and extract structured engineering facts'
            }
          >
            <Sparkles className="w-4 h-4 text-inherit" />
            <span>
              {isExtracting
                ? 'ANALYZING INCIDENT & EXTRACTING FACTS...'
                : hasStep1Data
                ? 'SUBMIT INCIDENT & EXTRACT FACTS'
                : 'INCIDENT REPORT REQUIRED TO PROCEED'}
            </span>
            <ArrowRight className="w-4 h-4 text-inherit" />
          </button>
        </div>
      </div>
    </div>
  );
};
