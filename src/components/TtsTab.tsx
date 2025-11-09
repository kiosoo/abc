
import React, { useState, useCallback, useRef, useEffect } from 'react';
// FIX: Add file extensions to imports to resolve module loading errors.
import { Notification, User, ApiKeyEntry, SubscriptionTier, LogEntry } from '@/types.ts';
import { TTS_VOICES, DEFAULT_VOICE, TIER_LIMITS } from '@/constants.ts';
import { ChevronDownIcon, LoadingSpinner, DownloadIcon, ErrorIcon, DocumentTextIcon, SystemIcon, InfoIcon, SuccessIcon } from '@/components/Icons.tsx';
import { reportTtsUsage } from '@/services/apiService.ts';
import SubscriptionModal from '@/components/SubscriptionModal.tsx';

interface TtsTabProps {
    onSetNotification: (notification: Omit<Notification, 'id'>) => void;
    user: User;
    apiKeyPool: ApiKeyEntry[];
    setApiKeyPool: (pool: ApiKeyEntry[]) => void;
}

const LogIcon: React.FC<{ type: LogEntry['type'] }> = ({ type }) => {
    const commonClass = "h-4 w-4 mr-2 flex-shrink-0";
    switch (type) {
        case 'system': return <SystemIcon className={`${commonClass} text-gray-400`} />;
        case 'info': return <InfoIcon className={`${commonClass} text-blue-400`} />;
        case 'success': return <SuccessIcon className={`${commonClass} text-green-400`} />;
        case 'error': return <ErrorIcon className={`${commonClass} text-red-400`} />;
        default: return null;
    }
};


const TtsTab: React.FC<TtsTabProps> = ({ onSetNotification, user, apiKeyPool, setApiKeyPool }) => {
    const [text, setText] = useState('');
    const [selectedVoice, setSelectedVoice] = useState(DEFAULT_VOICE);
    const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
    
    // --- New state for async processing ---
    const [isProcessing, setIsProcessing] = useState(false);
    const [jobId, setJobId] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);
    const [progressStatus, setProgressStatus] = useState('');
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [audioUrl, setAudioUrl] = useState<string>('');
    const [finalAudioBlob, setFinalAudioBlob] = useState<Blob | null>(null);
    const [error, setError] = useState<string | null>(null);
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const pollingIntervalRef = useRef<number | null>(null);
    
    const isManagedUser = [SubscriptionTier.STAR, SubscriptionTier.SUPER_STAR, SubscriptionTier.VVIP].includes(user.tier);
    
    const addLog = (message: string, type: LogEntry['type']) => {
        const timestamp = new Date().toLocaleTimeString('vi-VN', { hour12: false });
        setLogs(prev => [...prev, { id: Date.now() + Math.random(), message, type, timestamp }]);
    };
    
    const resetState = () => {
        setIsProcessing(false);
        setJobId(null);
        setProgress(0);
        setProgressStatus('');
        setError(null);
        setFinalAudioBlob(null);
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
        }
    };

    // --- Polling logic for async job ---
    useEffect(() => {
        if (!jobId) return;

        pollingIntervalRef.current = window.setInterval(async () => {
            try {
                const res = await fetch(`/api/tts?action=status&jobId=${jobId}`);
                if (!res.ok) {
                    throw new Error('Không thể kiểm tra trạng thái tác vụ.');
                }
                const data = await res.json();
                
                const newProgress = data.totalChunks > 0 ? (data.processedChunks / data.totalChunks) * 100 : 0;
                setProgress(newProgress);
                setProgressStatus(`Đang xử lý phần ${data.processedChunks} / ${data.totalChunks}...`);

                if (data.status === 'failed') {
                    setError(data.error || 'Tác vụ thất bại mà không có thông báo lỗi cụ thể.');
                    addLog(`Thất bại: ${data.error}`, 'error');
                    resetState();
                } else if (newProgress >= 100 && data.processedChunks === data.totalChunks) {
                    addLog('Đã xử lý tất cả các phần. Đang ghép âm thanh...', 'system');
                    setProgressStatus('Đang hoàn tất...');
                    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);

                    // Fetch the final result
                    const resultRes = await fetch(`/api/tts?action=result&jobId=${jobId}`);
                    if (!resultRes.ok) {
                        const errorData = await resultRes.json();
                        throw new Error(errorData.message || 'Không thể tải xuống kết quả âm thanh cuối cùng.');
                    }
                    const blob = await resultRes.blob();
                    setFinalAudioBlob(blob);
                    addLog('Âm thanh đã sẵn sàng!', 'success');
                    setIsProcessing(false);
                }
            } catch (e) {
                const errorMessage = e instanceof Error ? e.message : 'Lỗi không xác định khi thăm dò.';
                setError(errorMessage);
                addLog(errorMessage, 'error');
                resetState();
            }
        }, 3000); // Poll every 3 seconds

        return () => {
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
            }
        };
    }, [jobId]);


    useEffect(() => {
        if (finalAudioBlob) {
            const url = URL.createObjectURL(finalAudioBlob);
            setAudioUrl(url);
            return () => URL.revokeObjectURL(url);
        }
        setAudioUrl('');
    }, [finalAudioBlob]);


    const handleGenerateSpeech = useCallback(async () => {
        resetState();
        setIsProcessing(true);
        setLogs([]);
        addLog('Bắt đầu quá trình tổng hợp...', 'system');

        try {
            if (!isManagedUser) {
                 addLog('Chế độ API được quản lý không khả dụng cho gói của bạn. Tính năng này yêu cầu nâng cấp.', 'error');
                 throw new Error("Tính năng này yêu cầu gói Star trở lên.");
            }

            const startRes = await fetch('/api/tts?action=start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, voice: selectedVoice }),
            });

            if (!startRes.ok) {
                const errorData = await startRes.json();
                throw new Error(errorData.message || 'Không thể bắt đầu tác vụ TTS.');
            }

            const { jobId: newJobId, totalChunks } = await startRes.json();
            addLog(`Tác vụ đã được tạo với ID: ${newJobId}. Tổng số phần: ${totalChunks}.`, 'info');
            setProgressStatus(`Đã gửi ${totalChunks} phần để xử lý...`);
            setJobId(newJobId);
            await reportTtsUsage(text.length);

        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'Đã xảy ra lỗi không xác định.';
            setError(errorMessage);
            addLog(`Thất bại: ${errorMessage}`, 'error');
            onSetNotification({ type: 'error', message: errorMessage });
            resetState();
        }
    }, [text, selectedVoice, onSetNotification, isManagedUser]);
    
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
        if(event.target) event.target.value = '';
    };

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

    const characterLimit = TIER_LIMITS[user.tier];

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-200">Advanced Text-to-Speech</h2>

            <div className="p-6 bg-gray-800/50 border border-gray-700 rounded-lg space-y-4">
                 <div className="flex justify-end items-center">
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".txt" className="hidden" />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isProcessing}
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
                    disabled={isProcessing}
                />
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                     <div className="relative w-full sm:w-64">
                        <select
                            value={selectedVoice}
                            onChange={e => setSelectedVoice(e.target.value)}
                            className="w-full appearance-none bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                            disabled={isProcessing}
                        >
                            {TTS_VOICES.map(voice => (
                                <option key={voice.id} value={voice.id}>{voice.name}</option>
                            ))}
                        </select>
                        <ChevronDownIcon className="h-5 w-5 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <p className="text-xs text-gray-500 mt-1.5 px-1">Tất cả giọng đọc đều hỗ trợ Tiếng Việt, Anh, Nhật, Hàn, Trung.</p>
                    </div>

                    <div className="text-right w-full sm:w-auto space-y-1">
                        <p className="font-mono text-sm text-gray-400">
                            Ký tự: {text.length.toLocaleString()} / {isManagedUser ? `${(characterLimit === Infinity ? '∞' : characterLimit.toLocaleString())}/ngày` : 'Gói tự quản'}
                        </p>
                        <p className="text-xs text-gray-500">
                            Gói của bạn: <span className="font-semibold text-cyan-400">{user.tier}</span>
                            <button onClick={() => setIsSubscriptionModalOpen(true)} className="ml-1 text-cyan-500 hover:underline text-xs">(Xem chi tiết)</button>
                        </p>
                    </div>
                </div>
                 <button
                    onClick={handleGenerateSpeech}
                    disabled={isProcessing || !text.trim() || !isManagedUser}
                    className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors"
                >
                    {isProcessing ? <LoadingSpinner /> : null}
                    {isProcessing ? 'Đang xử lý...' : 'Tạo âm thanh (Không đồng bộ)'}
                </button>
                 {!isManagedUser && (
                    <p className="text-xs text-center text-yellow-400 mt-2">Tính năng xử lý văn bản dài yêu cầu gói Star, Super Star, hoặc VVIP.</p>
                )}
            </div>
            
            {(isProcessing || finalAudioBlob || error || logs.length > 0) && (
                <div className="p-6 bg-gray-800/50 border border-gray-700 rounded-lg space-y-4">
                    <h3 className="text-lg font-semibold text-gray-300">Kết quả & Nhật ký</h3>
                    {isProcessing && (
                        <div className="space-y-3">
                             <p className="text-sm text-center text-purple-300">{progressStatus}</p>
                            <div className="w-full bg-gray-700 rounded-full h-2.5">
                                <div className="bg-purple-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                            </div>
                        </div>
                    )}
                    {error && (
                         <div className="flex items-center p-4 bg-red-900/30 border border-red-700 rounded-md">
                            <ErrorIcon className="h-6 w-6 text-red-400 mr-3 flex-shrink-0" />
                            <div>
                                <h4 className="font-bold text-red-400">Tạo âm thanh thất bại</h4>
                                <p className="text-sm text-red-300 mt-1">{error}</p>
                            </div>
                        </div>
                    )}
                    {finalAudioBlob && (
                        <div className="space-y-4 p-3 bg-gray-900 rounded-lg">
                            <audio src={audioUrl} controls className="w-full h-12">
                                Trình duyệt của bạn không hỗ trợ phát âm thanh.
                            </audio>
                            <div className="flex items-center justify-end gap-2">
                                <button 
                                    onClick={() => handleDownload(finalAudioBlob, `tts_output_${Date.now()}.wav`)} 
                                    className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 rounded-md transition-colors"
                                >
                                    <DownloadIcon />
                                    Tải xuống (.wav)
                                </button>
                            </div>
                        </div>
                    )}
                     {logs.length > 0 && (
                        <div className="bg-gray-900/70 border border-gray-700 rounded-md p-3 max-h-48 overflow-y-auto">
                            <h4 className="text-md font-semibold mb-2 text-gray-400">Nhật ký xử lý</h4>
                            <div className="text-xs font-mono space-y-1.5">
                                {logs.map((log) => (
                                    <div key={log.id} className={`flex items-start ${log.type === 'error' ? 'text-red-400' : log.type === 'success' ? 'text-green-400' : 'text-gray-400'}`}>
                                        <LogIcon type={log.type} />
                                        <span className="text-gray-500 mr-2 flex-shrink-0">[{log.timestamp}]</span>
                                        <span className="flex-grow break-words">{log.message}</span>
                                    </div>
                                ))}
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