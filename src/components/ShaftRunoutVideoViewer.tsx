import React, { useState, useRef, useEffect } from 'react';
import { Video, Play, Pause, RotateCcw, Upload } from 'lucide-react';

interface ShaftRunoutVideoViewerProps {
  videoUrl?: string | null;
  videoNote?: string;
  assetId?: string;
  isReadOnly?: boolean;
  onVideoUpload?: (file: File) => void;
}

export const ShaftRunoutVideoViewer: React.FC<ShaftRunoutVideoViewerProps> = ({
  videoUrl,
  videoNote,
  assetId = 'M001',
  isReadOnly = false,
  onVideoUpload,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setIsPlaying(false);
  }, [videoUrl]);

  // Video playback controls
  const togglePlay = () => {
    if (videoUrl && videoRef.current) {
      if (videoRef.current.paused) {
        videoRef.current
          .play()
          .then(() => setIsPlaying(true))
          .catch((err) => {
            console.warn('Video play note:', err);
            setIsPlaying(false);
          });
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  const handleRestart = () => {
    if (videoUrl && videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onVideoUpload) {
      onVideoUpload(file);
    }
  };

  return (
    <div className="bg-slate-950 rounded-lg border border-slate-800 overflow-hidden shadow-lg space-y-2 font-mono">
      {videoUrl ? (
        <div className="space-y-2">
          {/* Video Screen Container */}
          <div className="relative w-full h-44 sm:h-48 bg-black flex items-center justify-center overflow-hidden group">
            <video
              ref={videoRef}
              src={videoUrl}
              playsInline
              controls={false}
              preload="auto"
              onTimeUpdate={() => {
                if (videoRef.current) {
                  setCurrentTime(videoRef.current.currentTime);
                  setDuration(videoRef.current.duration || 0);
                }
              }}
              onEnded={() => setIsPlaying(false)}
              className="w-full h-full object-contain"
            />

            {/* Center Play/Pause Overlay Button */}
            <button
              type="button"
              onClick={togglePlay}
              className={`absolute inset-0 m-auto w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                isPlaying
                  ? 'bg-slate-950/50 hover:bg-slate-950/80 text-cyan-400 opacity-0 group-hover:opacity-100'
                  : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.7)] scale-100 opacity-100'
              }`}
              title={isPlaying ? 'Pause shaft runout video' : 'Play shaft runout video'}
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 ml-0.5 fill-current" />}
            </button>

            {/* Top Floating Badge */}
            <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-950/80 border border-slate-700/80 text-[10px] text-cyan-300 backdrop-blur-sm">
              <span className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-cyan-400 animate-pulse' : 'bg-slate-500'}`} />
              <span>RECORDED RUNOUT VIDEO ({assetId})</span>
            </div>

            {/* Bottom Floating Time Bar */}
            {duration > 0 && (
              <div className="absolute bottom-0 inset-x-0 bg-slate-950/80 px-3 py-1 flex items-center justify-between text-[10px] text-slate-300">
                <span>{Math.floor(currentTime)}s / {Math.floor(duration)}s</span>
                <div className="flex-1 mx-3 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cyan-500 transition-all"
                    style={{ width: `${(currentTime / duration) * 100}%` }}
                  />
                </div>
                <button onClick={handleRestart} className="hover:text-white" title="Restart video">
                  <RotateCcw className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {/* Video Control Bar & Upload Trigger */}
          <div className="p-2.5 bg-slate-900/80 flex flex-wrap items-center justify-between gap-2 text-xs border-t border-slate-800">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={togglePlay}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold transition-all cursor-pointer shadow-[0_0_12px_rgba(6,182,212,0.4)]"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                <span>{isPlaying ? 'PAUSE' : 'PLAY VIDEO'}</span>
              </button>

              <button
                type="button"
                onClick={handleRestart}
                className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                title="Restart playback from beginning"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Upload / Replace Action if not read only */}
            {!isReadOnly && onVideoUpload && (
              <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[11px] cursor-pointer transition-colors">
                <Upload className="w-3 h-3 text-purple-400" />
                <span>REPLACE VIDEO</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>
      ) : (
        /* Empty State: No Video File Uploaded */
        <div className="p-5 bg-slate-900/50 rounded-lg border border-dashed border-slate-800 text-center space-y-3">
          <div className="flex flex-col items-center justify-center text-slate-500 text-xs">
            <Video className="w-8 h-8 text-slate-700 mb-2" />
            <span className="text-slate-400 font-medium">No video proof attached yet.</span>
            <span className="text-[11px] text-slate-500 mt-0.5">Upload a video clip of inspection or shaft runout.</span>
          </div>

          {!isReadOnly && onVideoUpload && (
            <div className="flex justify-center pt-1">
              <label className="flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold cursor-pointer transition-colors">
                <Upload className="w-3.5 h-3.5 text-cyan-400" />
                <span>UPLOAD VIDEO FILE</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>
          )}
        </div>
      )}

      {/* Video Caption Note */}
      {videoNote && videoUrl && (
        <div className="px-3 pb-2 text-[10px] text-slate-400 truncate italic">
          "{videoNote}"
        </div>
      )}
    </div>
  );
};
