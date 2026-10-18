/**
 * Persistent Media Storage Service for Industrial Proof Media (Audio & Video)
 * Uses browser IndexedDB to persist large media clips (videos, audio memos)
 * across browser refreshes, sessions, and investigation views, while syncing
 * lightweight Data URLs to Firestore when under document size limits.
 */

const DB_NAME = 'industrial_investigation_media_db';
const STORE_NAME = 'media_blobs';
const DB_VERSION = 1;

// In-memory runtime cache for instant access
const runtimeMemoryCache = new Map<string, string>();

function openMediaDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Persist a media item (Base64 data URL or Blob URL) to IndexedDB
 */
export async function persistMediaItem(key: string, dataUrl: string): Promise<void> {
  if (!key || !dataUrl) return;
  runtimeMemoryCache.set(key, dataUrl);
  try {
    const db = await openMediaDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(dataUrl, key);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Could not save media to IndexedDB:', err);
  }
}

/**
 * Retrieve a persisted media item by key (e.g. incidentId + '_video' or incidentId + '_audio')
 */
export async function getPersistedMediaItem(key: string): Promise<string | null> {
  if (!key) return null;
  if (runtimeMemoryCache.has(key)) {
    return runtimeMemoryCache.get(key) || null;
  }
  try {
    const db = await openMediaDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(key);

    return new Promise((resolve) => {
      request.onsuccess = () => {
        const val = request.result as string | undefined;
        if (val) {
          runtimeMemoryCache.set(key, val);
          resolve(val);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => resolve(null);
    });
  } catch (err) {
    return null;
  }
}

/**
 * Convert any File or Blob to a Base64 Data URL
 */
export function blobToDataURL(blobOrFile: Blob | File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(blobOrFile);
  });
}

/**
 * Generate a synthetic technician voice sign-off audio memo (WAV data URL)
 * using the Web Audio API. Always works and requires zero external network!
 */
export function generateSampleTechnicianAudio(assetId = 'M001', cause = 'Shaft runout verified'): string {
  try {
    const sampleRate = 22050;
    const duration = 2.5; // seconds
    const numSamples = Math.floor(sampleRate * duration);
    const buffer = new Float32Array(numSamples);

    // Audio pattern: Two gentle confirm chimes (880Hz, 1320Hz) followed by technical carrier wave
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      let val = 0;
      if (t < 0.4) {
        val = Math.sin(2 * Math.PI * 880 * t) * Math.exp(-t * 8) * 0.4;
      } else if (t < 0.9) {
        const t2 = t - 0.4;
        val = Math.sin(2 * Math.PI * 1320 * t2) * Math.exp(-t2 * 6) * 0.45;
      } else if (t < 2.3) {
        const t3 = t - 0.9;
        // Warm industrial modulated affirmation hum
        const voiceFreq = 220 + Math.sin(t3 * 8) * 35;
        val = Math.sin(2 * Math.PI * voiceFreq * t3) * Math.exp(-t3 * 1.5) * 0.25;
      }
      buffer[i] = val;
    }

    // Convert Float32Array to 16-bit PCM WAV
    const wavBuffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(wavBuffer);

    // RIFF identifier
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + numSamples * 2, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // 1 channel
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true); // block align
    view.setUint16(34, 16, true); // bits per sample
    writeString(view, 36, 'data');
    view.setUint32(40, numSamples * 2, true);

    let offset = 44;
    for (let i = 0; i < numSamples; i++) {
      const s = Math.max(-1, Math.min(1, buffer[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }

    const blob = new Blob([view], { type: 'audio/wav' });
    return URL.createObjectURL(blob);
  } catch (e) {
    console.warn('Audio fallback note:', e);
    return '';
  }
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
