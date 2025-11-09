import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { Notification, User, ApiKeyEntry, SubscriptionTier, LogEntry } from '@/types.ts';
import { TTS_VOICES, DEFAULT_VOICE, TIER_LIMITS, TIER_REQUEST_LIMITS, LONG_TEXT_CHUNK_SIZE, TTS_DAILY_API_LIMIT } from '@/constants.js';
import { ChevronDownIcon, LoadingSpinner, DownloadIcon, ErrorIcon, DocumentTextIcon, SystemIcon, InfoIcon, SuccessIcon } from '@/components/Icons.tsx';
import { reportTtsUsage } from '@/services/apiService.ts';
import SubscriptionModal from '@/components/SubscriptionModal.tsx';
import { decode, createWavBlob, stitchPcmChunks } from '@/utils/audioUtils.ts';
import { smartSplit } from '@/utils/textUtils.ts';
import { getValidatedApiKeyPool } from '@/utils/apiKeyUtils.ts';


interface TtsTabProps {
    onSetNotification: (notification: Omit<Notification, 'id'>) => void;
    user: User;
    apiKeyPool: ApiKeyEntry[];
    // FIX: Corrected typo from ApiKeykeyEntry to ApiKeyEntry.
    setApiKeyPool: (pool: ApiKeyEntry[]) => void;
    onUsageUpdate: (newUsage: User['usage']) => void;
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


const TtsTab: React.FC<TtsTabProps> = ({ onSetNotification, user, apiKeyPool, setApiKeyPool, onUsageUpdate }) => {
    const [text, setText] = useState('');
    const [selectedVoice, setSelectedVoice] = useState(DEFAULT_VOICE);
    const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
    
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [progressStatus, setProgressStatus] = useState('');
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [audioUrl, setAudioUrl] = useState<string>('');
    const [finalAudioBlob, setFinalAudioBlob] = useState<Blob | null>(null);
    const [error, setError] = useState<string | null>(null);
    

    const fileInputRef = useRef<HTMLInputElement>(null);
    const isCancelledRef = useRef(false);
    
    const isManagedUser = [SubscriptionTier.STAR, SubscriptionTier.SUPER_STAR, SubscriptionTier.VVIP].includes(user.tier);
    
    const addLog = (message: string, type: LogEntry['type']) => {
        const timestamp = new Date().toLocaleTimeString('vi-VN', { hour12: false });
        setLogs(prev => [...prev, { id: Date.now() + Math.random(), message, type, timestamp }]);
    };
    
    const resetState = useCallback(() => {
        setIsProcessing(false);
        setProgress(0);
        setProgressStatus('');
        setError(null);
        setFinalAudioBlob(null);
        setLogs([]);
        isCancelledRef.current = false;
    }, []);

    useEffect(() => {
        if (finalAudioBlob) {
            const url = URL.createObjectURL(finalAudioBlob);
            setAudioUrl(url);
            return () => URL.revokeObjectURL(url);
        }
        setAudioUrl('');
    }, [finalAudioBlob]);


    const handleGenerateSpeechManaged = useCallback(async () => {
        resetState();
        setIsProcessing(true);
        addLog('Bắt đầu quá trình tổng hợp (API được quản lý)...', 'system');
    
        let currentJobId: string | null = null;
    
        try {
            // 1. Start job to get chunk info
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
            currentJobId = newJobId;
            
            addLog(`Tác vụ đã được tạo. Tổng số phần: ${totalChunks}.`, 'info');
            
    
            // 2. Process chunks sequentially
            const concurrencyLimit = 1;
            addLog(`Bắt đầu xử lý tuần tự...`, 'system');

            const pcmChunksMap = new Map<number, Uint8Array>();
            let chunksProcessedCount = 0;
            let successfulChunksCount = 0;
            
            const chunkIndices = Array.from({ length: totalChunks }, (_, i) => i);
            const taskQueue = [...chunkIndices];
    
            const worker = async () => {
                 while (true) {
                    if (isCancelledRef.current) break;
                    const chunkIndex = taskQueue.shift();
                    if (chunkIndex === undefined) break;

                    try {
                        const res = await fetch('/api/tts?action=processSingleChunk', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ jobId: newJobId, chunkIndex }),
                        });
    
                        if (!res.ok) {
                            const errorData = await res.json();
                            throw new Error(errorData.message || `Lỗi không xác định`);
                        }
    
                        const { base64Audio } = await res.json();
                        pcmChunksMap.set(chunkIndex, decode(base64Audio));
                        addLog(`Xử lý thành công phần ${chunkIndex + 1}.`, 'success');
                        successfulChunksCount++;
    
                    } catch (e) {
                        const errorMsg = e instanceof Error ? e.message : `Xử lý thất bại.`;
                        addLog(`Phần ${chunkIndex + 1}: ${errorMsg}`, 'error');
                        
                        // Add helpful hint for quota errors
                        const lowerErrorMsg = errorMsg.toLowerCase();
                        if (lowerErrorMsg.includes('hạn ngạch') || lowerErrorMsg.includes('quota')) {
                            addLog(`Gợi ý: Các API key từ cùng một dự án Google Cloud sẽ chia sẻ chung một hạn ngạch. Hãy cân nhắc bật thanh toán trên dự án để gỡ bỏ giới hạn.`, 'info');
                        }

                        setError(prev => prev ? `${prev}\n- ${errorMsg}` : `- ${errorMsg}`);
                    } finally {
                        chunksProcessedCount++;
                        setProgressStatus(`Đang xử lý phần ${chunksProcessedCount}/${totalChunks}...`);
                        setProgress((chunksProcessedCount / totalChunks) * 100);
                    }
                }
            };
    
            const workers = Array(concurrencyLimit).fill(null).map(() => worker());
            await Promise.all(workers);
    
            if (isCancelledRef.current) {
                throw new Error('Đã hủy tác vụ.');
            }
    
            // 3. Report usage based on successful chunks
            if (successfulChunksCount > 0) {
                addLog(`Ghi nhận ${successfulChunksCount} yêu cầu thành công vào mức sử dụng...`, 'system');
                try {
                    const { usage: newUsage } = await reportTtsUsage(0, successfulChunksCount);
                    onUsageUpdate(newUsage);
                } catch (usageError) {
                    addLog('Không thể ghi nhận mức sử dụng. Vui lòng kiểm tra lại sau.', 'error');
                }
            }
    
            if (successfulChunksCount === 0) {
                throw new Error("Tất cả các phần đều xử lý thất bại. Không thể tạo file âm thanh.");
            }
    
            // 4. Stitch audio
            addLog(`Đã xử lý ${successfulChunksCount}/${totalChunks} phần thành công. Đang ghép âm thanh...`, 'system');
            setProgressStatus('Đang hoàn tất...');
    
            const orderedPcmChunks: Uint8Array[] = [];
            for(let i=0; i<totalChunks; i++) {
                if (pcmChunksMap.has(i)) {
                    orderedPcmChunks.push(pcmChunksMap.get(i)!);
                }
            }
    
            const combinedPcm = stitchPcmChunks(orderedPcmChunks);
            const wavBlob = createWavBlob(combinedPcm);
            setFinalAudioBlob(wavBlob);
            addLog('Âm thanh đã sẵn sàng!', 'success');
    
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'Đã xảy ra lỗi không xác định.';
            if (!isCancelledRef.current) {
                setError(errorMessage);
                addLog(`Thất bại: ${errorMessage}`, 'error');
                onSetNotification({ type: 'error', message: errorMessage });
            } else {
                addLog('Quá trình đã bị hủy bởi người dùng.', 'info');
            }
        } finally {
            setIsProcessing(false);
            if (currentJobId) {
                addLog('Đang dọn dẹp tài nguyên trên server...', 'system');
                try {
                    await fetch('/api/tts?action=cleanup', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ jobId: currentJobId }),
                    });
                    addLog('Dọn dẹp hoàn tất.', 'info');
                } catch (cleanupError) {
                    addLog('Dọn dẹp tài nguyên thất bại.', 'error');
                }
            }
        }
    }, [text, selectedVoice, onSetNotification, resetState, onUsageUpdate, user.managedApiKeys]);


    const handleGenerateSpeechSelfManaged = useCallback(async () => {
        resetState();
        setIsProcessing(true);
        addLog('Bắt đầu tổng hợp (sử dụng keys cá nhân)...', 'system');
    
        try {
            const characterLimit = TIER_LIMITS[user.tier];
            if (characterLimit !== Infinity && text.length > characterLimit) {
                throw new Error(`Văn bản của bạn (${text.length.toLocaleString()} ký tự) vượt quá giới hạn ${characterLimit.toLocaleString()} ký tự cho gói ${user.tier}.`);
            }
    
            const initialKeyPool = getValidatedApiKeyPool(apiKeyPool);
            const availableKeys = initialKeyPool.filter(k => k.usage.count < TTS_DAILY_API_LIMIT);
    
            if (availableKeys.length === 0) {
                throw new Error('Tất cả các API key của bạn đã hết hạn ngạch hôm nay hoặc bạn chưa thêm key nào.');
            }
    
            const chunks = smartSplit(text, LONG_TEXT_CHUNK_SIZE);
            addLog(`Văn bản được chia thành ${chunks.length} phần.`, 'info');
    
            const pcmChunksMap = new Map<number, Uint8Array>();
            let chunksProcessedCount = 0;
            let successfulChunksCount = 0;
            
            const keyPoolRef = { current: JSON.parse(JSON.stringify(initialKeyPool)) as ApiKeyEntry[] };
            const taskQueue = [...chunks.entries()]; 
            
            let nextKeyIndex = 0;
    
            const worker = async () => {
                while (true) {
                    if (isCancelledRef.current) break;
                    const task = taskQueue.shift();
                    if (!task) break;
    
                    const [chunkIndex, chunkText] = task;
                    let processed = false;
                    let finalError = 'Tất cả các key đều không thể xử lý chunk này.';
    
                    const keyStartIndex = nextKeyIndex;
                    nextKeyIndex = (nextKeyIndex + 1) % availableKeys.length;

                    for (let i = 0; i < availableKeys.length; i++) {
                        if (isCancelledRef.current) break;
                        
                        const keyToTry = availableKeys[(keyStartIndex + i) % availableKeys.length];
                        const liveKeyEntry = keyPoolRef.current.find(k => k.key === keyToTry.key)!;
    
                        if (liveKeyEntry.usage.count >= TTS_DAILY_API_LIMIT) continue;
    
                        try {
                            const ai = new GoogleGenAI({ apiKey: liveKeyEntry.key });
                            const response = await ai.models.generateContent({
                                model: "gemini-2.5-flash-preview-tts",
                                contents: [{ parts: [{ text: chunkText }] }],
                                config: {
                                    responseModalities: [Modality.AUDIO],
                                    speechConfig: {
                                        voiceConfig: {
                                            prebuiltVoiceConfig: { voiceName: selectedVoice === 'auto' ? 'Kore' : selectedVoice },
                                        },
                                    },
                                },
                            });
    
                            const audioPart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
                            const base64Audio = audioPart?.inlineData?.data;
    
                            if (!base64Audio) throw new Error('API không trả về dữ liệu âm thanh.');
                            
                            pcmChunksMap.set(chunkIndex, decode(base64Audio));
                            liveKeyEntry.usage.count++;
                            successfulChunksCount++;
                            addLog(`Phần ${chunkIndex + 1}: Thành công với key ...${liveKeyEntry.key.slice(-4)}. Lượt dùng: ${liveKeyEntry.usage.count}/${TTS_DAILY_API_LIMIT}.`, 'success');
                            processed = true;
                            break;
    
                        } catch (e: any) {
                            const errorString = e.toString();
                             let keyErrorMsg = '';
                            if (errorString.includes('RESOURCE_EXHAUSTED') || errorString.includes('429')) {
                                keyErrorMsg = `Key ...${liveKeyEntry.key.slice(-4)} đã hết hạn ngạch.`;
                                liveKeyEntry.usage.count = TTS_DAILY_API_LIMIT;
                            } else {
                                keyErrorMsg = `Lỗi với key ...${liveKeyEntry.key.slice(-4)}: ${e.message}`;
                            }
                            addLog(`Phần ${chunkIndex + 1}: ${keyErrorMsg} Đang thử key tiếp theo...`, 'info');
                            finalError = keyErrorMsg;
                        }
                    } 
    
                    if (!processed && !isCancelledRef.current) {
                        const finalLogMessage = `Phần ${chunkIndex + 1}: Xử lý thất bại. Lỗi cuối cùng: ${finalError}`;
                        addLog(finalLogMessage, 'error');
                        
                        const lowerFinalError = finalError.toLowerCase();
                        if (lowerFinalError.includes('hạn ngạch') || lowerFinalError.includes('quota')) {
                             addLog(`Gợi ý: Các API key từ cùng một dự án Google Cloud sẽ chia sẻ chung một hạn ngạch. Hãy cân nhắc bật thanh toán trên dự án để gỡ bỏ giới hạn.`, 'info');
                        }

                        setError(prev => (prev ? prev + `\n- ${finalLogMessage}` : `- ${finalLogMessage}`));
                    }
    
                    chunksProcessedCount++;
                    setProgressStatus(`Đang xử lý phần ${chunksProcessedCount}/${chunks.length}...`);
                    setProgress((chunksProcessedCount / chunks.length) * 100);
                }
            };
    
            const concurrencyLimit = 1; // Always sequential
            addLog(`Bắt đầu xử lý tuần tự...`, 'system');
            
            const workers = Array(concurrencyLimit).fill(null).map(() => worker());
            await Promise.all(workers);
    
            if (isCancelledRef.current) throw new Error('Đã hủy tác vụ.');
    
            setApiKeyPool([...keyPoolRef.current]);
    
            if (successfulChunksCount === 0) {
                throw new Error("Tất cả các phần đều xử lý thất bại. Không thể tạo file âm thanh.");
            }
            
            addLog(`Đã xử lý ${successfulChunksCount}/${chunks.length} phần thành công. Đang ghép âm thanh...`, 'system');
            setProgressStatus('Đang hoàn tất...');
    
            const orderedPcmChunks: Uint8Array[] = [];
            for(let i=0; i<chunks.length; i++) {
                if (pcmChunksMap.has(i)) {
                    orderedPcmChunks.push(pcmChunksMap.get(i)!);
                }
            }
    
            const combinedPcm = stitchPcmChunks(orderedPcmChunks);
            const wavBlob = createWavBlob(combinedPcm);
            setFinalAudioBlob(wavBlob);
            addLog('Âm thanh đã sẵn sàng!', 'success');
    
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'Đã xảy ra lỗi không xác định.';
            if (!isCancelledRef.current) {
                setError(errorMessage);
                addLog(`Thất bại: ${errorMessage}`, 'error');
                onSetNotification({ type: 'error', message: errorMessage });
            } else {
                addLog('Quá trình đã bị hủy bởi người dùng.', 'info');
            }
        } finally {
            setIsProcessing(false);
        }
    }, [text, selectedVoice, onSetNotification, resetState, user, apiKeyPool, setApiKeyPool]);

    const handleGenerateSpeech = () => {
        if (isManagedUser) {
            handleGenerateSpeechManaged();
        } else {
            handleGenerateSpeechSelfManaged();
        }
    };
    
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

    const handleCancel = () => {
        if (isProcessing) {
            isCancelledRef.current = true;
        } else {
            resetState();
        }
    }

    const characterLimit = TIER_LIMITS[user.tier];
    const requestLimit = TIER_REQUEST_LIMITS[user.tier];
    const todaysUsage = user.usage || { ttsCharacters: 0, ttsRequests: 0 };

    const isOverCharLimit = isManagedUser && todaysUsage.ttsCharacters >= characterLimit;
    const isOverRequestLimit = isManagedUser && (todaysUsage.ttsRequests || 0) >= requestLimit;
    const isManagedLimitReached = isOverCharLimit || isOverRequestLimit;

    const getLimitText = () => {
        if (isManagedUser) {
            return `${(characterLimit === Infinity ? '∞' : characterLimit.toLocaleString())}/ngày`;
        }
        if (characterLimit === Infinity) {
            return 'Không giới hạn/lần nhập';
        }
        return `${characterLimit.toLocaleString()}/lần nhập`;
    };
    
    const disabledReason = (() => {
        if (!isManagedUser) {
            if (apiKeyPool.length === 0) return "Bạn cần thêm ít nhất một API key trong 'Quản lý API Keys' để sử dụng.";
            const characterLimit = TIER_LIMITS[user.tier];
            if (characterLimit !== Infinity && text.length > characterLimit) {
                return `Văn bản (${text.length.toLocaleString()}) vượt quá giới hạn ${characterLimit.toLocaleString()} ký tự của gói ${user.tier}.`;
            }
        } else { // isManagedUser
            if (isManagedLimitReached) {
                return "Bạn đã đạt đến giới hạn sử dụng hàng ngày cho gói của mình. Vui lòng nâng cấp hoặc thử lại vào ngày mai.";
            }
        }
        return null;
    })();

    const isDisabled = isProcessing || !text.trim() || !!disabledReason;

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
                <div className="text-right text-xs text-gray-400 -mt-2 pr-1">
                    {text.length > 0 && `Ước tính: ${Math.ceil(text.length / LONG_TEXT_CHUNK_SIZE)} phần`}
                 </div>
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
                            Ký tự: {isManagedUser ? todaysUsage.ttsCharacters.toLocaleString() : text.length.toLocaleString()} / {getLimitText()}
                        </p>
                        {isManagedUser && (
                            <p className="font-mono text-sm text-gray-400">
                                Lượt tạo: {(todaysUsage.ttsRequests || 0).toLocaleString()} / {(requestLimit === Infinity ? '∞' : requestLimit.toLocaleString())}
                            </p>
                        )}
                        <p className="text-xs text-gray-500">
                            Gói của bạn: <span className="font-semibold text-cyan-400">{user.tier}</span>
                            <button onClick={() => setIsSubscriptionModalOpen(true)} className="ml-1 text-cyan-500 hover:underline text-xs">(Xem chi tiết)</button>
                        </p>
                    </div>
                </div>

                 <div className="pt-2 border-t border-gray-700/50">
                    <button
                        onClick={handleGenerateSpeech}
                        disabled={isDisabled}
                        className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors"
                    >
                        {isProcessing ? <LoadingSpinner /> : null}
                        {isProcessing ? 'Đang xử lý...' : 'Tạo âm thanh'}
                    </button>
                </div>
                 {disabledReason && (
                    <p className={`text-xs text-center -mt-2 ${!isManagedUser && text.length > TIER_LIMITS[user.tier] ? 'text-red-400' : 'text-yellow-400'}`}>
                        {disabledReason}
                    </p>
                )}
            </div>
            
            {(isProcessing || finalAudioBlob || error || logs.length > 0) && (
                <div className="p-6 bg-gray-800/50 border border-gray-700 rounded-lg space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-semibold text-gray-300">Kết quả & Nhật ký</h3>
                        {(isProcessing || finalAudioBlob || error) && (
                             <button 
                                onClick={handleCancel}
                                className="px-3 py-1 text-sm bg-red-600 text-white rounded-md hover:bg-red-700"
                            >
                                {isProcessing ? 'Hủy' : 'Xóa'}
                            </button>
                        )}
                    </div>
                    {isProcessing && (
                        <div className="space-y-3">
                             <p className="text-sm text-center text-purple-300">{progressStatus}</p>
                            <div className="w-full bg-gray-700 rounded-full h-2.5">
                                <div className="bg-purple-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                            </div>
                        </div>
                    )}
                    {error && (
                         <div className="flex items-start p-4 bg-red-900/30 border border-red-700 rounded-md">
                            <ErrorIcon className="h-6 w-6 text-red-400 mr-3 flex-shrink-0" />
                            <div>
                                <h4 className="font-bold text-red-400">Một hoặc nhiều phần đã xử lý thất bại</h4>
                                <pre className="text-sm text-red-300 mt-1 whitespace-pre-wrap font-mono">{error}</pre>
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