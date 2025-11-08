
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Notification, User, SubscriptionTier } from '@/types';
import { TTS_VOICES, DEFAULT_VOICE, LONG_TEXT_CHUNK_SIZE, TIER_LIMITS } from '@/constants';
import { generateSpeech } from '@/services/geminiService';
import { stitchWavBlobs, decode, createWavBlob } from '@/utils/audioUtils';
import { DownloadIcon, ChevronDownIcon } from '@/components/Icons';
import { reportTtsUsage } from '@/services/apiService';

interface TtsTabProps {
    onSetNotification: (notification: Omit<Notification, 'id'>) => void;
    user: User;
    apiKey: string;
}

const tierStyles: { [key in SubscriptionTier]: string } = {
    [SubscriptionTier.BASIC]: 'bg-gray-600 text-gray-100',
    [SubscriptionTier.PRO]: 'bg-blue-600 text-blue-100',
    [SubscriptionTier.ULTRA]: 'bg-purple-600 text-purple-100',
};


const TtsTab: React.FC<TtsTabProps> = ({ onSetNotification, user, apiKey }) => {
    const [text, setText] = useState('Hello, this is a test of the advanced text to speech system. It can handle long text by splitting it into smaller chunks. Let\'s try some multilingual text. 안녕하세요. こんにちは.');
    const [selectedVoice, setSelectedVoice] = useState(DEFAULT_VOICE);
    const [isLoading, setIsLoading] = useState(false);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [logs, setLogs] = useState<string[]>([]);
    const [isLogsOpen, setIsLogsOpen] = useState(false);
    
    const MAX_TEXT_LENGTH = TIER_LIMITS[user.tier] || TIER_LIMITS[SubscriptionTier.BASIC];

    useEffect(() => {
        // Truncate text if it exceeds the new limit when the tier changes.
        if (text.length > MAX_TEXT_LENGTH) {
            setText(text.slice(0, MAX_TEXT_LENGTH));
            onSetNotification({
                type: 'info',
                message: `Văn bản đã được rút gọn để phù hợp với giới hạn gói của bạn.`,
            });
        }
    }, [user.tier, MAX_TEXT_LENGTH, onSetNotification, text]);

    useEffect(() => {
        return () => {
            if (audioUrl) {
                URL.revokeObjectURL(audioUrl);
            }
        };
    }, [audioUrl]);

    const addLog = (message: string) => {
        setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
    };

    const chunkText = (str: string, size: number) => {
        const numChunks = Math.ceil(str.length / size);
        const chunks = new Array(numChunks);
        for (let i = 0, o = 0; i < numChunks; ++i, o += size) {
            chunks[i] = str.substr(o, size);
        }
        return chunks;
    };

    const handleSynthesize = useCallback(async () => {
        if (!apiKey) {
            onSetNotification({ type: 'error', message: 'Vui lòng nhập API Key của bạn ở góc trên bên phải.' });
            return;
        }
        if (!text.trim()) {
            onSetNotification({ type: 'error', message: 'Vui lòng nhập văn bản để tổng hợp.' });
            return;
        }
        
        setIsLoading(true);
        setAudioBlob(null);
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
        setLogs([]);
        addLog('Bắt đầu quá trình tổng hợp...');

        try {
            const textToSynthesize = text.trim();
            const textChunks = chunkText(textToSynthesize, LONG_TEXT_CHUNK_SIZE);
            addLog(`Văn bản được chia thành ${textChunks.length} phần.`);
            const audioBlobs: Blob[] = [];

            for (const [index, chunk] of textChunks.entries()) {
                addLog(`Đang xử lý phần ${index + 1}/${textChunks.length}...`);
                const audioContent = await generateSpeech(chunk, selectedVoice === 'auto' ? 'Kore' : selectedVoice, apiKey);
                const decoded = decode(audioContent);
                audioBlobs.push(createWavBlob(decoded));
            }
            
            addLog('Ghép các tệp âm thanh...');
            const finalBlob = await stitchWavBlobs(audioBlobs);
            setAudioBlob(finalBlob);
            const newAudioUrl = URL.createObjectURL(finalBlob);
            setAudioUrl(newAudioUrl);
            addLog('Tổng hợp thành công!');
            onSetNotification({ type: 'success', message: 'Tổng hợp giọng nói thành công.' });
            reportTtsUsage(textToSynthesize.length);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Đã xảy ra lỗi không xác định.';
            addLog(`Lỗi: ${message}`);
            onSetNotification({ type: 'error', message: `Tổng hợp thất bại: ${message}` });
        } finally {
            setIsLoading(false);
        }
    }, [text, selectedVoice, onSetNotification, apiKey, audioUrl]);
    
    const handleDownload = () => {
        if (!audioUrl) return;
        const a = document.createElement('a');
        a.href = audioUrl;
        a.download = 'tts_by_kiosoo.wav';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newText = e.target.value;
        if (newText.length <= MAX_TEXT_LENGTH) {
            setText(newText);
        }
    };

    return (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg shadow-xl p-6 md:p-8 space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-2">
                <h2 className="text-xl font-bold text-white">Advanced Text-to-Speech</h2>
                 <span className={`px-3 py-1 text-xs font-semibold rounded-full ${tierStyles[user.tier]}`}>
                    Gói {user.tier}
                </span>
            </div>
            <div className="relative">
                <textarea
                    id="tts-text"
                    value={text}
                    onChange={handleTextChange}
                    placeholder="Nhập văn bản của bạn ở đây..."
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg p-4 resize-y focus:ring-2 focus:ring-purple-500 transition-all duration-200 text-gray-200 placeholder-gray-500 min-h-[200px]"
                    disabled={isLoading}
                    rows={8}
                />
                <div className="absolute bottom-2 right-3 text-xs text-gray-400">
                    {text.length.toLocaleString()} / {MAX_TEXT_LENGTH === Infinity ? 'Vô hạn' : MAX_TEXT_LENGTH.toLocaleString()}
                </div>
            </div>

            <div className="flex flex-wrap items-end gap-4">
                 <div className="flex-grow min-w-[200px]">
                    <label htmlFor="voice-select" className="block text-sm font-medium text-gray-300 mb-1">
                        Voice
                    </label>
                    <select
                        id="voice-select"
                        value={selectedVoice}
                        onChange={(e) => setSelectedVoice(e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded-md p-3 text-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    >
                        {TTS_VOICES.map(voice => (
                            <option key={voice.id} value={voice.id}>{voice.name}</option>
                        ))}
                    </select>
                     <p className="text-xs text-cyan-400 mt-1">Multilingual text detected. 'Automatic' voice is recommended.</p>
                 </div>
                 <button
                    onClick={handleSynthesize}
                    disabled={isLoading || !text.trim()}
                    className="px-6 py-3 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 disabled:bg-gray-600 flex items-center justify-center gap-2 transition-colors duration-200 text-base"
                >
                    {isLoading ? 'Đang tạo...' : 'Generate Audio'}
                </button>
            </div>
            
            <div className="bg-gray-900/70 border border-gray-700 rounded-lg min-h-[90px] p-4 flex flex-col justify-center items-center">
                {isLoading ? (
                    <p className="text-gray-400">Đang tạo âm thanh, vui lòng chờ...</p>
                ) : audioUrl ? (
                    <div className="w-full space-y-3">
                      <audio controls src={audioUrl} ref={audioRef} className="w-full"></audio>
                      <button onClick={handleDownload} className="w-full mt-2 px-4 py-2 text-sm bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 transition-colors duration-200">
                        <DownloadIcon />
                        Tải xuống file .wav
                      </button>
                    </div>
                ) : (
                     <p className="text-gray-500">Your generated audio will appear here.</p>
                )}
            </div>
            
             <div>
                <button 
                    onClick={() => setIsLogsOpen(!isLogsOpen)} 
                    className="w-full flex justify-between items-center p-3 bg-gray-700 hover:bg-gray-600 rounded-md text-sm font-medium"
                >
                    Processing Logs
                    <ChevronDownIcon className={`h-5 w-5 transition-transform ${isLogsOpen ? 'rotate-180' : ''}`} />
                </button>
                {isLogsOpen && (
                    <div className="mt-2 p-4 bg-gray-900 rounded-md border border-gray-700 max-h-48 overflow-y-auto">
                        {logs.length > 0 ? logs.map((log, i) => 
                            <p key={i} className="text-xs text-gray-400 font-mono break-words">{log}</p>
                        ) : <p className="text-xs text-gray-500">No logs yet.</p>}
                    </div>
                )}
            </div>
        </div>
    );
};

export default TtsTab;