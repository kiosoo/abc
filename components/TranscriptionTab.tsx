import React, { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Blob as GenAIBlob } from '@google/genai';
import { Notification } from '@/types';
import { MicIcon } from '@/components/Icons';
import { encode } from '@/utils/audioUtils';

interface LiveSession {
    close(): void;
    sendRealtimeInput(input: { media: GenAIBlob }): void;
}

const TranscriptionTab: React.FC<{ onSetNotification: (notification: Omit<Notification, 'id'>) => void; }> = ({ onSetNotification }) => {
    const [isListening, setIsListening] = useState(false);
    const [interimTranscription, setInterimTranscription] = useState('');
    const [finalizedTranscription, setFinalizedTranscription] = useState<string[]>([]);
    
    const currentInterimRef = useRef('');
    const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

    const stopListening = useCallback(() => {
        sessionPromiseRef.current?.then(session => session.close());
        sessionPromiseRef.current = null;
        
        streamRef.current?.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        
        processorRef.current?.disconnect();
        processorRef.current = null;

        sourceRef.current?.disconnect();
        sourceRef.current = null;
        
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close();
            audioContextRef.current = null;
        }
        setIsListening(false);
    }, []);

    useEffect(() => {
      // Cleanup on component unmount
      return () => {
        stopListening();
      };
    }, [stopListening]);
    
    const handleMessage = (message: LiveServerMessage) => {
        if (message.serverContent?.inputTranscription) {
            const { text } = message.serverContent.inputTranscription;
            currentInterimRef.current += text;
            setInterimTranscription(currentInterimRef.current);
        }

        if (message.serverContent?.turnComplete) {
            if (currentInterimRef.current.trim()) {
                setFinalizedTranscription(prev => [...prev, currentInterimRef.current.trim()]);
            }
            currentInterimRef.current = '';
            setInterimTranscription('');
        }
    };
    
    const startListening = async () => {
        if (isListening) return;

        currentInterimRef.current = '';
        setIsListening(true);
        setInterimTranscription('');
        setFinalizedTranscription([]);

        try {
            const apiKey = process.env.API_KEY;
            if (!apiKey) throw new Error("API key chưa được cấu hình.");
            
            const ai = new GoogleGenAI({ apiKey });

            const sessionPromise = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: () => console.log('Live session opened'),
                    onmessage: handleMessage,
                    onerror: (e: ErrorEvent) => {
                        console.error('Live session error:', e);
                        onSetNotification({ type: 'error', message: 'Đã xảy ra lỗi kết nối.' });
                        stopListening();
                    },
                    onclose: () => console.log('Live session closed'),
                },
                config: {
                    inputAudioTranscription: {},
                },
            });
            sessionPromiseRef.current = sessionPromise;

            streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            sourceRef.current = audioContextRef.current.createMediaStreamSource(streamRef.current);
            processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
            
            processorRef.current.onaudioprocess = (audioProcessingEvent) => {
                const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                const l = inputData.length;
                const int16 = new Int16Array(l);
                for (let i = 0; i < l; i++) {
                    int16[i] = inputData[i] * 32768;
                }
                const pcmBlob: GenAIBlob = {
                    data: encode(new Uint8Array(int16.buffer)),
                    mimeType: 'audio/pcm;rate=16000',
                };
                sessionPromiseRef.current?.then(session => session.sendRealtimeInput({ media: pcmBlob }));
            };
            
            sourceRef.current.connect(processorRef.current);
            processorRef.current.connect(audioContextRef.current.destination);

        } catch (error) {
            const message = error instanceof Error ? error.message : 'Đã xảy ra lỗi không xác định.';
            onSetNotification({ type: 'error', message: `Không thể bắt đầu ghi âm: ${message}` });
            stopListening();
        }
    };

    const toggleListening = () => {
        if (isListening) {
            stopListening();
        } else {
            startListening();
        }
    };

    return (
        <div className="text-center">
            <h2 className="text-xl font-semibold mb-4 text-gray-200">Ghi âm trực tiếp</h2>
            <p className="text-gray-400 mb-6">Nhấn vào micro để bắt đầu và dừng ghi âm giọng nói của bạn theo thời gian thực.</p>
            
            <button
                onClick={toggleListening}
                className={`mx-auto flex items-center justify-center w-24 h-24 rounded-full transition-colors duration-300 focus:outline-none focus:ring-4 focus:ring-opacity-50 ${
                    isListening
                        ? 'bg-red-600 hover:bg-red-700 focus:ring-red-400'
                        : 'bg-purple-600 hover:bg-purple-700 focus:ring-purple-400'
                }`}
            >
                {isListening ? <div className="w-8 h-8 bg-white rounded-sm animate-pulse"></div> : <MicIcon className="w-12 h-12 text-white" />}
            </button>
            
            <div className="mt-8 p-6 bg-gray-800/50 border border-gray-700 rounded-lg min-h-[200px] text-left whitespace-pre-wrap text-lg">
                {finalizedTranscription.map((line, index) => (
                    <p key={index}>{line}</p>
                ))}
                <p className="text-gray-400">{interimTranscription}</p>
                {!isListening && finalizedTranscription.length === 0 && interimTranscription.length === 0 && (
                    <p className="text-gray-500 text-center text-base">Bản ghi âm sẽ xuất hiện ở đây.</p>
                )}
            </div>
        </div>
    );
};

export default TranscriptionTab;