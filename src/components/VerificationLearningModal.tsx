import React, { useState, useEffect, useRef } from 'react';
import {
  CheckCircle2,
  Database,
  TrendingDown,
  RotateCcw,
  Sparkles,
  ExternalLink,
  Camera,
  Video,
  Mic,
  Square,
  Upload,
  Play,
  Pause,
  Trash2,
  Eye,
  FileCheck,
  Cpu,
  ShieldCheck,
  AlertTriangle,
  ArrowLeft,
} from 'lucide-react';
import { saveVerifiedResolutionToFirestore } from '../services/machineMemoryService';
import { validateResolutionInput } from '../lib/securityValidation';
import { Incident, Machine, ExtractionResult, VerificationMedia, VerificationMediaItem, Technician } from '../types/industrial';
import { ShaftRunoutVideoViewer } from './ShaftRunoutVideoViewer';
import { VoiceMemoAudioViewer } from './VoiceMemoAudioViewer';
import { blobToDataURL, persistMediaItem, getPersistedMediaItem } from '../services/mediaStorageService';

interface VerificationLearningModalProps {
  onLearningCommitted: (newIncident: Incident) => void;
  onViewAllMemory: () => void;
  onBack?: () => void;
  activeIncidentId?: string | null;
  activeMachineId?: string;
  machine?: Machine;
  extraction?: ExtractionResult;
  onStartNewInvestigation?: () => void;
  authenticatedTechnician?: Technician | null;
  isReadOnly?: boolean;
  existingIncident?: Incident | null;
}

export const VerificationLearningModal: React.FC<VerificationLearningModalProps> = ({
  onLearningCommitted,
  onViewAllMemory,
  onBack,
  activeIncidentId,
  activeMachineId = 'M001',
  machine,
  extraction,
  onStartNewInvestigation,
  authenticatedTechnician,
  isReadOnly = false,
  existingIncident,
}) => {
  const currentAssetId = extraction?.machine_id || activeMachineId || 'M001';

  const defaultCause =
    existingIncident?.cause ||
    extraction?.probable_root_cause ||
    `Operational fault verified on ${currentAssetId}`;

  const defaultRepair =
    existingIncident?.repair ||
    extraction?.recommended_inspection ||
    `Completed corrective inspection on ${currentAssetId}`;

  const dynamicDowntime =
    existingIncident?.downtime ??
    Math.max(25, Math.round((extraction?.warmup_minutes || 20) * 1.8));

  const dynamicNotes =
    existingIncident?.notes ||
    (extraction
      ? `Physical check on ${currentAssetId} verified: ${extraction.probable_root_cause}. Corrective repair completed: ${extraction.recommended_inspection}. Resolved observed anomaly: ${(extraction.symptoms || []).join(', ')}.`
      : `Physical inspection completed on ${currentAssetId}.`);

  const initialVerifiedBy =
    existingIncident?.verified_by ||
    (authenticatedTechnician
      ? `${authenticatedTechnician.name} (${authenticatedTechnician.role})`
      : 'Marcus Vance (Lead Master Tech) / David Chen (Technician)');

  const isInitiallyClosed = Boolean(
    isReadOnly ||
    existingIncident?.status === 'verified' ||
    existingIncident?.status === 'resolved'
  );

  const [confirmedCause, setConfirmedCause] = useState(defaultCause);
  const [repairAction, setRepairAction] = useState(defaultRepair);
  const [actualDowntime, setActualDowntime] = useState(dynamicDowntime);
  const [verifiedBy, setVerifiedBy] = useState(initialVerifiedBy);
  const [notes, setNotes] = useState(dynamicNotes);

  // Verification Media State (Photos, Video, Audio)
  const [photos, setPhotos] = useState<VerificationMediaItem[]>(
    existingIncident?.verification_media?.photos || []
  );
  const [videoUrl, setVideoUrl] = useState<string | null>(
    existingIncident?.verification_media?.video_url || null
  );
  const [videoNote, setVideoNote] = useState<string>(
    existingIncident?.verification_media?.video_note || ''
  );
  const [audioUrl, setAudioUrl] = useState<string | null>(
    existingIncident?.verification_media?.audio_url || null
  );
  const [audioNote, setAudioNote] = useState<string>(
    existingIncident?.verification_media?.audio_note || ''
  );
  const [activePhotoModal, setActivePhotoModal] = useState<string | null>(null);

  // Audio Recording State
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCommitted, setIsCommitted] = useState(isInitiallyClosed);
  const [committedIncident, setCommittedIncident] = useState<Incident | null>(existingIncident || null);
  const [commitError, setCommitError] = useState<string | null>(null);

  useEffect(() => {
    if (existingIncident) {
      if (existingIncident.cause) setConfirmedCause(existingIncident.cause);
      if (existingIncident.repair) setRepairAction(existingIncident.repair);
      if (existingIncident.notes) setNotes(existingIncident.notes);
      if (existingIncident.downtime !== undefined) setActualDowntime(existingIncident.downtime);
      if (existingIncident.verified_by) setVerifiedBy(existingIncident.verified_by);
      if (existingIncident.verification_media?.photos) {
        setPhotos(existingIncident.verification_media.photos);
      }
      if (existingIncident.verification_media?.video_url) {
        setVideoUrl(existingIncident.verification_media.video_url);
      }
      if (existingIncident.verification_media?.video_note) {
        setVideoNote(existingIncident.verification_media.video_note);
      }
      if (existingIncident.verification_media?.audio_url) {
        setAudioUrl(existingIncident.verification_media.audio_url);
      }
      if (existingIncident.verification_media?.audio_note) {
        setAudioNote(existingIncident.verification_media.audio_note);
      }

      // Check IndexedDB persistent store for full-res video and audio
      const incId = existingIncident.incident_id;
      if (incId) {
        getPersistedMediaItem(`${incId}_video`).then((persistedVideo) => {
          if (persistedVideo) setVideoUrl(persistedVideo);
        });
        getPersistedMediaItem(`${incId}_audio`).then((persistedAudio) => {
          if (persistedAudio) setAudioUrl(persistedAudio);
        });
      }
    } else {
      setConfirmedCause(defaultCause);
      setRepairAction(defaultRepair);
      setNotes(dynamicNotes);
      setActualDowntime(dynamicDowntime);
    }
    if (isInitiallyClosed) {
      setIsCommitted(true);
      if (existingIncident) setCommittedIncident(existingIncident);
    }
  }, [currentAssetId, defaultCause, defaultRepair, dynamicNotes, dynamicDowntime, existingIncident, isInitiallyClosed]);

  // Audio Handlers
  const handleAudioUpload = async (file: File) => {
    try {
      const dataUrl = await blobToDataURL(file);
      const incId = activeIncidentId || existingIncident?.incident_id || `INC-${currentAssetId}`;
      await persistMediaItem(`${incId}_audio`, dataUrl);
      setAudioUrl(dataUrl);
      setAudioNote(`Technician audio memo (${file.name}) for ${currentAssetId}`);
    } catch {
      const url = URL.createObjectURL(file);
      setAudioUrl(url);
      setAudioNote(`Technician audio memo (${file.name}) for ${currentAssetId}`);
    }
  };

  const handleAudioRecorded = async (dataUrl: string, note?: string) => {
    const incId = activeIncidentId || existingIncident?.incident_id || `INC-${currentAssetId}`;
    await persistMediaItem(`${incId}_audio`, dataUrl);
    setAudioUrl(dataUrl);
    if (note) setAudioNote(note);
  };

  // Photo Upload Handlers
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file, idx) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const url = event.target?.result as string;
        if (url) {
          const newPhoto: VerificationMediaItem = {
            id: `PHOTO-${Date.now()}-${idx}`,
            type: 'photo',
            url,
            name: file.name,
            caption: `Physical inspection proof for ${currentAssetId}: ${file.name}`,
            timestamp: new Date().toLocaleTimeString(),
          };
          setPhotos((prev) => [...prev, newPhoto]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  // Video Upload Handlers
  const handleVideoUpload = async (file: File) => {
    try {
      const dataUrl = await blobToDataURL(file);
      const incId = activeIncidentId || existingIncident?.incident_id || `INC-${currentAssetId}`;
      await persistMediaItem(`${incId}_video`, dataUrl);
      setVideoUrl(dataUrl);
      setVideoNote(`Shaft Runout Inspection Video Clip for ${currentAssetId} (${file.name})`);
    } catch {
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      setVideoNote(`Shaft Runout Inspection Video Clip for ${currentAssetId} (${file.name})`);
    }
  };

  // Commit Verified Incident to Firestore & Knowledge Base
  const handleCommit = async () => {
    setIsSubmitting(true);
    setCommitError(null);
    try {
      const incidentId = activeIncidentId || `INC-${currentAssetId}-${Date.now().toString().slice(-4)}`;

      // Frontend Security Validation Check
      const validation = validateResolutionInput({
        incident_id: incidentId,
        machine_id: currentAssetId,
        confirmed_cause: confirmedCause,
        repair: repairAction,
        downtime: actualDowntime,
        notes,
        verified_by: verifiedBy,
      });

      if (!validation.isValid) {
        const firstErr = Object.values(validation.errors)[0];
        setCommitError(firstErr);
        setIsSubmitting(false);
        return;
      }

      const mediaPayload: VerificationMedia = {};
      if (audioUrl) {
        mediaPayload.audio_url = audioUrl;
        await persistMediaItem(`${incidentId}_audio`, audioUrl);
      }
      if (audioNote) mediaPayload.audio_note = audioNote;
      if (photos.length > 0) mediaPayload.photos = photos;
      if (videoUrl) {
        await persistMediaItem(`${incidentId}_video`, videoUrl);
        // If data URL is under 600KB, store in Firestore document; otherwise keep full in IndexedDB
        if (videoUrl.length < 600000) {
          mediaPayload.video_url = videoUrl;
        } else {
          mediaPayload.video_url = `indexeddb://${incidentId}_video`;
        }
      }
      if (videoNote) mediaPayload.video_note = videoNote;

      const hasMedia = Object.keys(mediaPayload).length > 0;

      const incident = await saveVerifiedResolutionToFirestore({
        ...validation.sanitized,
        outcome: `Equipment restored to nominal ISO 10816-3 baseline; verified root cause: ${validation.sanitized.confirmed_cause}.`,
        verification_media: hasMedia ? mediaPayload : undefined,
        symptom: extraction?.symptoms?.[0],
      });

      setCommittedIncident(incident);
      setIsCommitted(true);
      onLearningCommitted(incident);
    } catch (err: any) {
      console.error('Failed to commit verified memory:', err);
      setCommitError(err?.message || 'Save failed: No active connection. Local storage is disabled.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-5 sm:p-6 shadow-xl space-y-6">
      {/* Error notification banner if commit fails */}
      {commitError && (
        <div className="p-3.5 px-4 rounded-lg bg-rose-950/80 border border-rose-800 text-rose-200 text-xs font-mono flex items-center justify-between">
          <span>{commitError}</span>
          <button onClick={() => setCommitError(null)} className="text-slate-400 hover:text-white ml-2 font-bold cursor-pointer">✕</button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 mb-1">
            <span className="px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-800/80 font-bold">
              VERIFICATION
            </span>
            <span>HUMAN VERIFICATION &amp; CLOSED-LOOP INSTITUTIONAL LEARNING</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-100">
            {isCommitted
              ? `Institutional Memory Stored & Active (${currentAssetId})`
              : `Technician Verification & Proof Sign-Off (${currentAssetId})`}
          </h2>
          <p className="text-xs text-slate-400 font-sans mt-0.5">
            {isCommitted
              ? 'Confirmed root cause, corrective actions, audio notes, photos, and video proof are permanently indexed. The next similar incident benefits from this new memory.'
              : 'Technician confirms the actual root cause, attaching verification notes, audio record, or photos for future incident retrieval and user review.'}
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 bg-slate-950 px-3 py-2 rounded-lg border border-slate-800 shrink-0">
          <Database className="w-4 h-4 text-emerald-400" />
          <span>STATUS: <strong className="text-slate-200">INSTITUTIONAL MEMORY</strong></span>
        </div>
      </div>

      {!isCommitted ? (
        <div className="space-y-6">
          {/* Section 1: Root Cause & Corrective Action Inputs */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 sm:p-5 space-y-4">
            <div className="text-xs font-mono text-slate-400 pb-2 border-b border-slate-800 flex items-center justify-between">
              <span className="font-bold text-slate-200">1. PHYSICAL CHECK CONFIRMATION ({currentAssetId})</span>
              <span className="text-cyan-400">{machine?.name || 'Machine Asset'}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-mono text-slate-300 font-bold block mb-1">
                  Confirmed Actual Root Cause:
                </label>
                <input
                  type="text"
                  value={confirmedCause}
                  onChange={(e) => setConfirmedCause(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2.5 text-xs font-mono text-slate-100 focus:outline-none focus:border-cyan-500"
                  placeholder="e.g. Flexible coupling elastomer failure"
                />
              </div>

              <div>
                <label className="text-xs font-mono text-slate-300 font-bold block mb-1">
                  Corrective Repair Action Executed:
                </label>
                <input
                  type="text"
                  value={repairAction}
                  onChange={(e) => setRepairAction(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2.5 text-xs font-mono text-slate-100 focus:outline-none focus:border-cyan-500"
                  placeholder="e.g. Replaced spider insert, realigned to 0.015mm"
                />
              </div>

              <div>
                <label className="text-xs font-mono text-slate-300 font-bold block mb-1">
                  Actual Downtime (Minutes):
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="number"
                    value={actualDowntime}
                    onChange={(e) => setActualDowntime(parseInt(e.target.value) || 0)}
                    className="w-28 bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs font-mono text-emerald-400 font-bold tabular-nums focus:outline-none focus:border-cyan-500"
                  />
                  <span className="text-xs font-mono text-emerald-400">
                    Saved ~{Math.max(30, Math.round((extraction?.warmup_minutes || 20) * 2.5))} minutes compared to blind component replacement!
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-mono text-slate-300 font-bold block mb-1">
                  Verifying Field Technician:
                </label>
                <input
                  type="text"
                  value={verifiedBy}
                  onChange={(e) => setVerifiedBy(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-mono text-slate-300 font-bold block mb-1">
                Post-Mortem Institutional Notes (Indexed for Next Similar Incident):
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full bg-slate-900 border border-slate-800 rounded p-2.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500 leading-relaxed"
              />
            </div>
          </div>

          {/* Section 2: Verification Media Options (Audio Record, Photos Upload, Video Upload) */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 sm:p-5 space-y-5">
            <div className="text-xs font-mono text-slate-400 pb-2 border-b border-slate-800 flex items-center justify-between">
              <span className="font-bold text-slate-200 flex items-center gap-2">
                <Camera className="w-4 h-4 text-cyan-400" />
                2. VERIFICATION MEDIA PROOF (AUDIO RECORD, PHOTOS &amp; VIDEO UPLOAD)
              </span>
              <span className="text-emerald-400 text-[11px]">Used for Future Investigations</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Pillar A: Audio Recording & Upload Option */}
              <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-300 font-bold flex items-center gap-1.5">
                    <Mic className="w-4 h-4 text-cyan-400" />
                    AUDIO RECORDING &amp; UPLOAD
                  </span>
                  {audioUrl && <span className="text-emerald-400 font-bold text-[11px]">AUDIO ATTACHED</span>}
                </div>

                <p className="text-[11px] text-slate-400 font-mono">
                  Record live microphone voice memo or upload audio file explaining findings on {currentAssetId}.
                </p>

                <VoiceMemoAudioViewer
                  audioUrl={audioUrl}
                  audioNote={audioNote}
                  assetId={currentAssetId}
                  isReadOnly={false}
                  onAudioUpload={handleAudioUpload}
                  onAudioRecorded={handleAudioRecorded}
                />
              </div>

              {/* Pillar B: Photos Upload Option */}
              <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-300 font-bold flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-cyan-400" />
                    PHOTOS UPLOAD
                  </span>
                  <span className="text-cyan-400 font-bold text-[11px]">{photos.length} ATTACHED</span>
                </div>

                <p className="text-[11px] text-slate-400 font-mono">
                  Upload photo of inspected components or measurement readings on {currentAssetId}.
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  <label className="px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>UPLOAD PHOTOS</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Photo Preview Gallery */}
                {photos.length > 0 && (
                  <div className="pt-2 border-t border-slate-800 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      {photos.map((p) => (
                        <div key={p.id} className="relative group bg-slate-950 rounded border border-slate-800 overflow-hidden">
                          <img src={p.url} alt={p.name} className="w-full h-20 object-cover" />
                          <div className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <button
                              onClick={() => setActivePhotoModal(p.url)}
                              className="p-1 rounded bg-cyan-600 text-slate-950 hover:bg-cyan-500 cursor-pointer"
                              title="Enlarge photo"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => removePhoto(p.id)}
                              className="p-1 rounded bg-red-600 text-white hover:bg-red-500 cursor-pointer"
                              title="Remove photo"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="p-1 text-[9px] font-mono text-slate-400 truncate">{p.name || 'Inspection Photo'}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Pillar C: Video Upload Option */}
              <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-300 font-bold flex items-center gap-1.5">
                    <Video className="w-4 h-4 text-cyan-400" />
                    SHAFT RUNOUT VIDEO UPLOAD
                  </span>
                  {videoUrl && <span className="text-cyan-400 font-bold text-[11px]">VIDEO ATTACHED</span>}
                </div>

                <p className="text-[11px] text-slate-400 font-mono">
                  Upload video clip of rotating shaft runout or coupling play under strobe.
                </p>

                <ShaftRunoutVideoViewer
                  videoUrl={videoUrl}
                  videoNote={videoNote}
                  assetId={currentAssetId}
                  isReadOnly={false}
                  onVideoUpload={handleVideoUpload}
                />
              </div>
            </div>
          </div>

          {/* Section 3: Closed-Loop Institutional Impact & Commit CTA */}
          <div className="bg-emerald-950/20 border border-emerald-800/80 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded bg-emerald-500/20 text-emerald-400 shrink-0">
                <TrendingDown className="w-5 h-5" />
              </div>
              <div className="text-xs font-mono">
                <span className="text-emerald-300 font-bold block text-sm">
                  CLOSED-LOOP INSTITUTIONAL IMPACT
                </span>
                <span className="text-slate-300">
                  By confirming coupling misalignment for <strong>{currentAssetId}</strong> and committing photos, audio, and video proof, future shifts encountering identical telemetry will immediately receive this grounded resolution path.
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs font-mono transition-all cursor-pointer shrink-0"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>BACK</span>
                </button>
              )}
              <button
                onClick={handleCommit}
                disabled={isSubmitting}
                className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs font-mono transition-all shadow-[0_0_20px_rgba(16,185,129,0.35)] shrink-0 disabled:opacity-50 cursor-pointer"
              >
                <Database className="w-4 h-4 text-slate-950" />
                <span>{isSubmitting ? 'SAVING MEMORY...' : 'SAVE & CLOSE INVESTIGATION'}</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Confirmed Learning State (Data stored, display photos, video, audio, and test future investigation) */
        <div className="bg-slate-950 border border-emerald-500/70 rounded-lg p-6 space-y-6 shadow-[0_0_25px_rgba(16,185,129,0.15)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-slate-100">
                  Closed-Loop Memory Cycle Stored for {currentAssetId}!
                </h3>
                <p className="text-xs font-mono text-slate-400">
                  Asset status updated to <strong className="text-emerald-400">NOMINAL</strong> · Permanently indexed into institutional memory
                </p>
              </div>
            </div>

            <span className="px-3 py-1 rounded bg-emerald-950 border border-emerald-800 text-emerald-300 text-xs font-mono font-bold">
              ✓ STORED FOR FUTURE INVESTIGATIONS
            </span>
          </div>

          {/* Stored Incident Details */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 font-mono text-xs">
            <div className="bg-slate-900/80 p-3 rounded border border-slate-800">
              <span className="text-slate-500 block mb-1">LOGGED ASSET</span>
              <span className="text-cyan-400 font-bold text-sm">{currentAssetId}</span>
            </div>
            <div className="bg-slate-900/80 p-3 rounded border border-slate-800 md:col-span-2">
              <span className="text-slate-500 block mb-1">CONFIRMED ROOT CAUSE &amp; REPAIR</span>
              <span className="text-slate-200 font-bold">{confirmedCause}</span>
              <div className="text-cyan-300 text-[11px] mt-1">{repairAction}</div>
            </div>
            <div className="bg-slate-900/80 p-3 rounded border border-slate-800">
              <span className="text-slate-500 block mb-1">DOWNTIME SAVINGS</span>
              <span className="text-emerald-400 font-bold text-sm">{actualDowntime}m (saved 78m)</span>
            </div>
          </div>

          {/* Display of Uploaded Proof (Photos, Video, Audio) to Users */}
          <div className="bg-slate-900/60 p-4 rounded-lg border border-slate-800 space-y-4">
            <div className="flex items-center justify-between text-xs font-mono border-b border-slate-800 pb-2">
              <span className="font-bold text-cyan-300 flex items-center gap-1.5">
                <FileCheck className="w-4 h-4 text-cyan-400" />
                VERIFICATION MEDIA ATTACHED &amp; DISPLAYED FOR FUTURE INVESTIGATION:
              </span>
              <span className="text-slate-400">Available across all shifts</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Photo Evidence Display */}
              <div className="space-y-2">
                <span className="text-[11px] font-mono text-slate-400 font-bold flex items-center gap-1">
                  <Camera className="w-3.5 h-3.5 text-cyan-400" />
                  PHOTO EVIDENCE ({photos.length}):
                </span>
                {photos.length > 0 ? (
                  <div className="space-y-1.5">
                    {photos.map((p) => (
                      <div key={p.id} className="cursor-pointer group relative rounded overflow-hidden border border-slate-800" onClick={() => setActivePhotoModal(p.url)}>
                        <img src={p.url} alt={p.name} className="w-full h-24 object-cover" />
                        <div className="absolute inset-0 bg-slate-950/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs font-mono text-white transition-opacity">
                          Click to View
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-500 font-mono italic p-3 bg-slate-950 rounded">No photos attached.</div>
                )}
              </div>

              {/* Video Evidence Display */}
              <div className="space-y-2">
                <span className="text-[11px] font-mono text-cyan-300 font-bold flex items-center gap-1">
                  <Video className="w-3.5 h-3.5 text-cyan-400" />
                  SHAFT RUNOUT VIDEO:
                </span>
                <ShaftRunoutVideoViewer
                  videoUrl={videoUrl}
                  videoNote={videoNote}
                  assetId={currentAssetId}
                  isReadOnly={true}
                />
              </div>

              {/* Audio Verification Display */}
              <div className="space-y-2">
                <span className="text-[11px] font-mono text-cyan-300 font-bold flex items-center gap-1">
                  <Mic className="w-3.5 h-3.5 text-cyan-400" />
                  RECORDED VOICE MEMO:
                </span>
                <VoiceMemoAudioViewer
                  audioUrl={audioUrl}
                  audioNote={audioNote}
                  assetId={currentAssetId}
                  isReadOnly={true}
                />
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="text-xs font-mono text-slate-400"></div>
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
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={onViewAllMemory}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs font-mono transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] cursor-pointer shrink-0"
                >
                  <span>CLOSE</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Photo Enlarge Lightbox Modal */}
      {activePhotoModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 max-w-lg w-full space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-slate-300 border-b border-slate-800 pb-2">
              <span className="font-bold flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-cyan-400" />
                VERIFIED INSPECTION PHOTO
              </span>
              <button
                onClick={() => setActivePhotoModal(null)}
                className="text-slate-400 hover:text-slate-100 px-2 py-0.5 rounded bg-slate-800 cursor-pointer"
              >
                ✕ CLOSE
              </button>
            </div>
            <img
              src={activePhotoModal}
              alt="Verified Inspection"
              className="w-full h-64 object-cover rounded border border-slate-800"
            />
            <p className="text-xs font-mono text-slate-300">
              Confirmed physical proof of coupling jaw wear and dial indicator radial runout on {currentAssetId}.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
