// This is a Node.js-compatible version of the audio utilities.
// It uses Buffers instead of browser-specific Blobs.

const writeWavHeader = (samples: Uint8Array, sampleRate: number, numChannels: number): Uint8Array => {
    const dataSize = samples.length;
    const buffer = new ArrayBuffer(44);
    const view = new DataView(buffer);

    const writeString = (offset: number, str: string) => {
        for (let i = 0; i < str.length; i++) {
            view.setUint8(offset + i, str.charCodeAt(i));
        }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * 2, true);
    view.setUint16(32, numChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
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

export const createWavBuffer = (pcmData: Uint8Array): Buffer => {
    const sampleRate = 24000;
    const numChannels = 1;
    const header = writeWavHeader(pcmData, sampleRate, numChannels);
    return Buffer.concat([Buffer.from(header), Buffer.from(pcmData)]);
};

export const stitchPcmChunks = (pcmChunks: Uint8Array[]): Uint8Array => {
    if (pcmChunks.length === 0) return new Uint8Array(0);
    if (pcmChunks.length === 1) return pcmChunks[0];

    const totalLength = pcmChunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const combinedPcm = new Uint8Array(totalLength);

    let offset = 0;
    for (const chunk of pcmChunks) {
        combinedPcm.set(chunk, offset);
        offset += chunk.length;
    }

    return combinedPcm;
};
