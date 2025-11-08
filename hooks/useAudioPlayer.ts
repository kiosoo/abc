
import { useRef, useCallback } from 'react';
import { decode, decodeAudioData } from '@/utils/audioUtils';

export const useAudioPlayer = () => {
  const audioContextRef = useRef<AudioContext | null>(null);

  const playAudio = useCallback(async (base64Audio: string) => {
    if (!audioContextRef.current) {
      // Sample rate must match the TTS API output
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    const audioContext = audioContextRef.current;
    
    // Ensure context is running (can be suspended on page load)
    if (audioContext.state === 'suspended') {
        await audioContext.resume();
    }

    const decodedData = decode(base64Audio);
    const audioBuffer = await decodeAudioData(decodedData, audioContext, 24000, 1);

    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    source.start();

    return new Promise<void>((resolve) => {
        source.onended = () => {
            resolve();
        };
    });
  }, []);

  return { playAudio };
};