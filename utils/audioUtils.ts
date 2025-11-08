
// A minimalist WAV file header writer
// Based on: http://soundfile.sapp.org/doc/WaveFormat/
// This is sufficient for the PCM data returned by the Gemini API.
const writeWavHeader = (samples: Uint8Array, sampleRate: number, numChannels: number): Uint8Array => {
    const dataSize = samples.length;
    const buffer = new ArrayBuffer(44);
    const view = new DataView(buffer);

    const writeString = (offset: number, str: string) => {
        for (let i = 0; i < str.length; i++) {
            view.setUint8(offset + i, str.charCodeAt(i));
        }
    };

    // RIFF identifier
    writeString(0, 'RIFF');
    // RIFF chunk size
    view.setUint32(4, 36 + dataSize, true);
    // RIFF type
    writeString(8, 'WAVE');
    // FMT identifier
    writeString(12, 'fmt ');
    // FMT chunk size
    view.setUint32(16, 16, true);
    // Audio format (1 for PCM)
    view.setUint16(20, 1, true);
    // Number of channels
    view.setUint16(22, numChannels, true);
    // Sample rate
    view.setUint32(24, sampleRate, true);
    // Byte rate (SampleRate * NumChannels * BitsPerSample/8)
    view.setUint32(28, sampleRate * numChannels * 2, true);
    // Block align (NumChannels * BitsPerSample/8)
    view.setUint16(32, numChannels * 2, true);
    // Bits per sample
    view.setUint16(34, 16, true);
    // DATA identifier
    writeString(36, 'data');
    // DATA chunk size
    view.setUint32(40, dataSize, true);

    return new Uint8Array(buffer);
};

export const decode = (base64: string): Uint8Array => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
};

// FIX: Add encode function for use in TranscriptionTab
export const encode = (bytes: Uint8Array) => {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// FIX: Add missing 'decodeAudioData' function to fix import error in useAudioPlayer.ts.
export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export const createWavBlob = (pcmData: Uint8Array): Blob => {
    const sampleRate = 24000; // Gemini TTS standard sample rate
    const numChannels = 1; // Mono
    const header = writeWavHeader(pcmData, sampleRate, numChannels);
    const wavBytes = new Uint8Array(header.length + pcmData.length);
    wavBytes.set(header, 0);
    wavBytes.set(pcmData, header.length);

    return new Blob([wavBytes], { type: 'audio/wav' });
};

// FIX: Made function asynchronous to use blob.arrayBuffer() which is async,
// replacing FileReaderSync which is only available in workers.
export const stitchWavBlobs = async (blobs: Blob[]): Promise<Blob> => {
    if (blobs.length === 0) {
        return new Blob([], { type: 'audio/wav' });
    }
    if (blobs.length === 1) {
        return blobs[0];
    }

    const pcmChunksPromises = blobs.map(blob => {
        // Simple and slightly risky assumption: header is 44 bytes.
        // This works for our controlled `createWavBlob` output.
        const headerSize = 44;
        return blob.arrayBuffer().then(buffer => new Uint8Array(buffer.slice(headerSize)));
    });

    const pcmChunks = await Promise.all(pcmChunksPromises);

    const totalLength = pcmChunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const combinedPcm = new Uint8Array(totalLength);

    let offset = 0;
    for (const chunk of pcmChunks) {
        combinedPcm.set(chunk, offset);
        offset += chunk.length;
    }

    return createWavBlob(combinedPcm);
};
