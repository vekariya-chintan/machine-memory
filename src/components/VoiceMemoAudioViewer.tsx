import React, { useState, useRef, useEffect } from 'react';
import { Mic, Play, Pause, RotateCcw, Upload, Square } from 'lucide-react';

interface VoiceMemoAudioViewerProps {
  audioUrl?: string | null;
  audioNote?: string;
  assetId?: string;
  isReadOnly?: boolean;
  onAudioUpload?: (file: File) => void;
  onAudioRecorded?: (dataUrl: string, note?: string) => void;
}

export const VoiceMemoAudioViewer: React.FC<VoiceMemoAudioViewerProps> = ({
  audioUrl,
  audioNote,
  assetId = 'M001',
  isReadOnly = false,
  onAudioUpload,
  onAudioRecorded,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activeUrl, setActiveUrl] = useState<string | null>(audioUrl || null);

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setActiveUrl(audioUrl || null);
    setIsPlaying(false);
    setCurrentTime(0);
  }, [audioUrl]);

  // Audio Playback
  const togglePlay = () => {
    if (!activeUrl || !audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.src = activeUrl;
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.warn('Audio play note:', err);
          setIsPlaying(false);
        });
    }
  };

  const handleRestart = () => {
    if (audioRef.current && activeUrl) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  // Live Microphone Recording
  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Mic not supported');
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mr.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          setActiveUrl(dataUrl);
          if (onAudioRecorded) {
            onAudioRecorded(dataUrl, `Technician live voice sign-off on ${assetId} physical check.`);
          }
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((t) => t.stop());
      };

      mr.start(250);
      setIsRecording(true);
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.warn('Microphone recording unavailable:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onAudioUpload) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        setActiveUrl(dataUrl);
        if (onAudioRecorded) {
          onAudioRecorded(dataUrl, `Technician voice memo (${file.name}) for ${assetId}`);
        }
      };
      reader.readAsDataURL(file);
      onAudioUpload(file);
    }
  };

  return (
    <div className="bg-slate-950 rounded-lg border border-slate-800 p-3 space-y-3 shadow-lg font-mono">
      {/* Hidden audio element for reliable native engine playback */}
      {activeUrl && (
        <audio
          ref={audioRef}
          src={activeUrl}
          preload="auto"
          onTimeUpdate={() => {
            if (audioRef.current) {
              setCurrentTime(audioRef.current.currentTime);
              setDuration(audioRef.current.duration || 0);
            }
          }}
          onEnded={() => setIsPlaying(false)}
        />
      )}

      {/* When audio is recorded or uploaded: Render Player */}
      {activeUrl ? (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 p-3 rounded-lg">
            {/* Play / Pause button & Waveform */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <button
                type="button"
                onClick={togglePlay}
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all shadow-md cursor-pointer shrink-0 ${
                  isPlaying
                    ? 'bg-cyan-400 text-slate-950 animate-pulse shadow-[0_0_18px_rgba(6,182,212,0.7)]'
                    : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_14px_rgba(6,182,212,0.4)]'
                }`}
                title={isPlaying ? 'Pause voice memo' : 'Play recorded voice memo audio'}
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 ml-0.5 fill-current" />}
              </button>

              {/* Equalizer Frequency Bars Animation */}
              <div className="flex items-center gap-1 h-6 shrink-0">
                {[40, 75, 55, 90, 60, 85, 45, 95, 70, 50].map((h, i) => (
                  <span
                    key={i}
                    className={`w-1 rounded-full transition-all duration-150 ${
                      isPlaying ? 'bg-cyan-400' : 'bg-slate-700'
                    }`}
                    style={{
                      height: isPlaying ? `${Math.max(15, (h * (i % 2 === 0 ? 0.9 : 1.2)) % 100)}%` : '20%',
                    }}
                  />
                ))}
              </div>

              {/* Scrubber & Progress */}
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span className="text-cyan-400 font-bold">
                    {isPlaying ? 'PLAYING VOICE MEMO' : 'READY TO PLAY'}
                  </span>
                  <span>
                    {Math.floor(currentTime)}s / {duration ? `${Math.floor(duration)}s` : '3s'}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cyan-500 transition-all"
                    style={{
                      width: duration > 0 ? `${(currentTime / duration) * 100}%` : isPlaying ? '60%' : '0%',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Restart Button */}
            <button
              type="button"
              onClick={handleRestart}
              className="p-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer shrink-0 self-center"
              title="Restart audio from beginning"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {!isReadOnly && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <div className="flex items-center gap-2">
                {!isRecording ? (
                  <button
                    type="button"
                    onClick={startRecording}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 transition-colors cursor-pointer"
                  >
                    <Mic className="w-3 h-3" />
                    <span>RE-RECORD MIC</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopRecording}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-red-600 hover:bg-red-500 text-white font-bold animate-pulse transition-colors cursor-pointer"
                  >
                    <Square className="w-3 h-3" />
                    <span>STOP ({recordingSeconds}s)</span>
                  </button>
                )}

                {onAudioUpload && (
                  <label className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 cursor-pointer transition-colors">
                    <Upload className="w-3 h-3 text-cyan-400" />
                    <span>REPLACE AUDIO</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="audio/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
              <span className="text-emerald-400 text-[10px]">✓ Audio attached</span>
            </div>
          )}
        </div>
      ) : (
        /* Empty State: No Audio Recorded or Uploaded */
        <div className="p-4 bg-slate-900/50 rounded-lg border border-dashed border-slate-800 text-center space-y-3">
          <p className="text-[11px] text-slate-500">
            No audio voice memo attached. Record mic audio or upload an audio file to attach proof.
          </p>

          {!isReadOnly && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              {!isRecording ? (
                <button
                  type="button"
                  onClick={startRecording}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span>RECORD MIC</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-red-600 hover:bg-red-500 text-white font-bold text-xs animate-pulse transition-colors cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5" />
                  <span>STOP RECORDING ({recordingSeconds}s)</span>
                </button>
              )}

              {onAudioUpload && (
                <label className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs cursor-pointer transition-colors">
                  <Upload className="w-3.5 h-3.5 text-cyan-400" />
                  <span>UPLOAD AUDIO</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          )}
        </div>
      )}

      {/* Audio Memo Note Caption */}
      {audioNote && activeUrl && (
        <div className="text-[10px] text-slate-400 truncate italic">
          "{audioNote}"
        </div>
      )}
    </div>
  );
};
