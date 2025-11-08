import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Notification, User } from '@/types';
import { TTS_VOICES, DEFAULT_VOICE, LONG_TEXT_CHUNK_SIZE, TIER_LIMITS, TTS_REQUEST_INTERVAL_MS } from '@/constants';
import { generateSpeech } from '@/services/geminiService';
import { stitchWavBlobs, decode, createWavBlob } from '@/utils/audioUtils';
import { ChevronDownIcon, LoadingSpinner, DownloadIcon, ErrorIcon, DocumentTextIcon } from '@/components/Icons';
import { reportTtsUsage } from '@/services/apiService';
import SubscriptionModal from '@/components/SubscriptionModal';

interface TtsTabProps {
    onSetNotification: (notification: Omit<Notification, 'id'>) => void;
    user: User;
    apiKey: string;
}

const TtsTab: React.FC<TtsTabProps> = ({ onSetNotification, user, apiKey }) => {
    const [text, setText] = useState('');
    const [selectedVoice, setSelectedVoice] = useState(DEFAULT_VOICE);
    const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
    
    // Local state for TTS generation
    const [isLoading, setIsLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusMessage, setStatusMessage] = useState('');
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [error, setError] = useState<string | null>(null);
    
    // Refs
    const audioRef = useRef<HTMLAudioElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const characterLimit = TIER_LIMITS[user.tier];
    const isOverLimit = characterLimit === Infinity ? false : text.length > characterLimit;

    useEffect(() => {
        // When a new audio blob is generated, create a new URL for the audio player.
        // This ensures the audio element updates correctly.
        if (audioBlob && audioRef.current) {
            audioRef.current.src = URL.createObjectURL(audioBlob);
        }
    }, [audioBlob]);
    
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (file.type === 'text/plain') {
            const reader = new FileReader();
            reader.onload = (e) => {
                const fileText = e.target?.result as string;
                setText(fileText);
                onSetNotification({ type: 'success', message: `Đã tải nội dung từ ${file.name}`});
            };
            reader.readAsText(file);
        } else {
            onSetNotification({ type: 'error', message: 'Loại file không được hỗ trợ. Vui lòng tải lên file .txt.' });
        }
        if(event.target) event.target.value = ''; // Reset input to allow re-uploading the same file
    };

    const handleGenerateSpeech = useCallback(async () => {
        if (!apiKey) {
            onSetNotification({ type: 'error', message: 'Vui lòng cung cấp API Key.' });
            return;
        }
        if (isOverLimit) {
            onSetNotification({ type: 'error', message: `Bạn đã vượt quá giới hạn ${characterLimit.toLocaleString()} ký tự của gói ${user.tier}.` });
            return;
        }

        setIsLoading(true);
        setProgress(0);
        setStatusMessage('Bắt đầu quá trình tổng hợp...');
        setAudioBlob(null);
        setError(null);
        
        try {
            const chunks: string[] = [];
            for (let i = 0; i < text.length; i += LONG_TEXT_CHUNK_SIZE) {
                chunks.push(text.substring(i, i + LONG_TEXT_CHUNK_SIZE));
            }

            const audioBlobs: Blob[] = [];

            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                setStatusMessage(`Đang xử lý phần ${i + 1}/${chunks.length}...`);
                
                const { base64Audio } = await generateSpeech(apiKey, chunk, selectedVoice === 'auto' ? undefined : selectedVoice);
                const pcmData = decode(base64Audio);
                audioBlobs.push(createWavBlob(pcmData));
                
                setProgress(((i + 1) / chunks.length) * 100);
                
                if (i < chunks.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, TTS_REQUEST_INTERVAL_MS));
                }
            }
            
            setStatusMessage('Đang ghép các file âm thanh...');
            const finalBlob = await stitchWavBlobs(audioBlobs);
            setAudioBlob(finalBlob);
            
            await reportTtsUsage(text.length);
            onSetNotification({ type: 'success', message: 'Tổng hợp giọng nói thành công!' });
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'Đã xảy ra lỗi không xác định.';
            setError(errorMessage);
            onSetNotification({ type: 'error', message: errorMessage });
        } finally {
            setIsLoading(false);
            setStatusMessage('');
        }
    }, [text, apiKey, selectedVoice, isOverLimit, characterLimit, user.tier, onSetNotification]);
    
    const handleDownload = (blob: Blob, filename: string) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-200">Advanced Text-to-Speech</h2>
            <div className="p-6 bg-gray-800/50 border border-gray-700 rounded-lg space-y-4">
                 <div className="flex justify-end">
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".txt" className="hidden" />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isLoading}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded-md transition-colors disabled:opacity-50"
                    >
                        <DocumentTextIcon />
                        Tải lên .txt
                    </button>
                 </div>
                 <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Nhập văn bản dài của bạn ở đây, hoặc tải lên từ file .txt..."
                    className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 resize-y focus:ring-2 focus:ring-purple-500 transition-all duration-200 text-gray-200 placeholder-gray-500 min-h-[200px]"
                    rows={8}
                    disabled={isLoading}
                />
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                     <div className="relative w-full sm:w-64">
                        <select
                            value={selectedVoice}
                            onChange={e => setSelectedVoice(e.target.value)}
                            className="w-full appearance-none bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                            disabled={isLoading}
                        >
                            {TTS_VOICES.map(voice => (
                                <option key={voice.id} value={voice.id}>{voice.name}</option>
                            ))}
                        </select>
                        <ChevronDownIcon className="h-5 w-5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <p className="text-xs text-gray-500 mt-1.5 px-1">Tất cả giọng đọc đều hỗ trợ Tiếng Việt, Anh, Nhật, Hàn, Trung.</p>
                    </div>

                    <div className="text-right w-full sm:w-auto space-y-2">
                        <div>
                            <p className={`font-mono text-sm ${isOverLimit ? 'text-red-400' : 'text-gray-400'}`}>
                                {text.length.toLocaleString()} / {characterLimit === Infinity ? '∞' : characterLimit.toLocaleString()}
                            </p>
                            <p className="text-xs text-gray-500">
                                Gói của bạn: <span className="font-semibold text-cyan-400">{user.tier}</span>
                                <button onClick={() => setIsSubscriptionModalOpen(true)} className="ml-1 text-cyan-500 hover:underline text-xs">(Xem chi tiết)</button>
                            </p>
                        </div>
                    </div>
                </div>
                 <button
                    onClick={handleGenerateSpeech}
                    disabled={isLoading || !text.trim() || isOverLimit}
                    className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors"
                >
                    {isLoading ? <LoadingSpinner /> : null}
                    {isLoading ? 'Đang tạo âm thanh...' : 'Tạo âm thanh'}
                </button>
            </div>
            
            {(isLoading || audioBlob || error) && (
                <div className="p-6 bg-gray-800/50 border border-gray-700 rounded-lg">
                    <h3 className="text-lg font-semibold mb-4 text-gray-300">Kết quả</h3>
                    {isLoading && (
                        <div className="space-y-3">
                            <div className="w-full bg-gray-700 rounded-full h-2.5">
                                <div className="bg-purple-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                            </div>
                            <p className="text-sm text-center text-purple-300">{statusMessage}</p>
                        </div>
                    )}
                    {error && !isLoading && (
                         <div className="flex items-center p-4 bg-red-900/30 border border-red-700 rounded-md">
                            <ErrorIcon className="h-6 w-6 text-red-400 mr-3 flex-shrink-0" />
                            <div>
                                <h4 className="font-bold text-red-400">Tạo âm thanh thất bại</h4>
                                <p className="text-sm text-red-300 mt-1">{error}</p>
                            </div>
                        </div>
                    )}
                    {audioBlob && !isLoading && (
                        <div className="space-y-4 p-3 bg-gray-900 rounded-lg">
                            <audio ref={audioRef} controls className="w-full h-12">
                                Trình duyệt của bạn không hỗ trợ phát âm thanh.
                            </audio>
                            <div className="flex items-center justify-end gap-2">
                                <button 
                                    onClick={() => handleDownload(audioBlob, `tts_output_${Date.now()}.wav`)} 
                                    className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 rounded-md transition-colors"
                                >
                                    <DownloadIcon />
                                    Tải xuống (.wav)
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
            
            {isSubscriptionModalOpen && (
                <SubscriptionModal onClose={() => setIsSubscriptionModalOpen(false)} userTier={user.tier} />
            )}
        </div>
    );
};

export default TtsTab;