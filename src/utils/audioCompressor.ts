/**
 * Audio Compression Utility
 * Downsamples recorded microphone audio or uploaded audio files to 16kHz mono WebM/WAV
 * before Base64 serialization, reducing HTTP payload size from ~15MB to ~300-600KB.
 */

export interface CompressedAudioResult {
  base64: string;
  mimeType: string;
  originalSizeKb: number;
  compressedSizeKb: number;
}

/**
 * Converts a Blob to a Base64 string.
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
      resolve(base64);
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(blob);
  });
}

/**
 * Downsamples and compresses an audio Blob using browser Web Audio API to 16kHz mono.
 * If compression fails or is unsupported for the given audio container format,
 * falls back to direct Base64 encoding of the original Blob.
 */
export async function compressAudioBlob(audioBlob: Blob): Promise<CompressedAudioResult> {
  const originalSizeKb = Math.round(audioBlob.size / 1024);

  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioCtx = new AudioContextClass();
      
      // Decode audio data to AudioBuffer
      const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer).catch(() => null);

      if (decodedBuffer) {
        // Target specifications: 16kHz sample rate, 1 channel (mono)
        const targetSampleRate = 16000;
        const duration = decodedBuffer.duration;
        const targetLength = Math.ceil(duration * targetSampleRate);

        const OfflineAudioContextClass =
          window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;

        if (OfflineAudioContextClass) {
          const offlineCtx = new OfflineAudioContextClass(1, targetLength, targetSampleRate);
          
          // Create audio buffer source
          const source = offlineCtx.createBufferSource();
          source.buffer = decodedBuffer;
          source.connect(offlineCtx.destination);
          source.start(0);

          // Render downsampled audio
          const renderedBuffer = await offlineCtx.startRendering();
          await audioCtx.close().catch(() => {});

          // Convert rendered AudioBuffer into a WAV PCM blob
          const wavBlob = audioBufferToWavBlob(renderedBuffer);
          const compressedSizeKb = Math.round(wavBlob.size / 1024);
          const base64 = await blobToBase64(wavBlob);

          return {
            base64,
            mimeType: 'audio/wav',
            originalSizeKb,
            compressedSizeKb,
          };
        }
        await audioCtx.close().catch(() => {});
      }
    }
  } catch (err) {
    console.warn('Audio downsampling optimization fallback:', err);
  }

  // Fallback: direct Base64 encoding
  const base64 = await blobToBase64(audioBlob);
  return {
    base64,
    mimeType: audioBlob.type || 'audio/webm',
    originalSizeKb,
    compressedSizeKb: originalSizeKb,
  };
}

/**
 * Encodes an AudioBuffer to a standard 16-bit PCM WAV Blob.
 */
function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = 1;
  const sampleRate = buffer.sampleRate;
  const format = 1; // 16-bit PCM
  const bitDepth = 16;
  const channelData = buffer.getChannelData(0);
  const numSamples = channelData.length;

  const headerLength = 44;
  const dataLength = numSamples * 2;
  const wavBuffer = new ArrayBuffer(headerLength + dataLength);
  const view = new DataView(wavBuffer);

  /* RIFF chunk descriptor */
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, 'WAVE');

  /* fmt sub-chunk */
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // SubChunk1Size (16 for PCM)
  view.setUint16(20, format, true); // AudioFormat
  view.setUint16(22, numChannels, true); // NumChannels
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true); // ByteRate
  view.setUint16(32, numChannels * (bitDepth / 8), true); // BlockAlign
  view.setUint16(34, bitDepth, true); // BitsPerSample

  /* data sub-chunk */
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  // Write 16-bit PCM samples
  let offset = 44;
  for (let i = 0; i < numSamples; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, channelData[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([wavBuffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
