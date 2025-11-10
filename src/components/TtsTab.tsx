import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { Notification, User, ApiKeyEntry, SubscriptionTier, LogEntry } from '@/types.ts';
import { TTS_VOICES, DEFAULT_VOICE, TIER_LIMITS, TIER_REQUEST_LIMITS, LONG_TEXT_CHUNK_SIZE, TTS_DAILY_API_LIMIT } from '@/constants.js';
import { ChevronDownIcon, LoadingSpinner, DownloadIcon, ErrorIcon, DocumentTextIcon, SystemIcon, InfoIcon, SuccessIcon } from '@/components/Icons.tsx';
import { reportTtsUsage } from '@/services/apiService.ts';
import SubscriptionModal from '@/components/SubscriptionModal.tsx';
import { decode, createWavBlob, stitchWavBlobs, stitchPcmChunks } from '@/utils/audioUtils.ts';
import { smartSplit } from '@/utils/textUtils.ts';
import { getValidatedApiKeyPool } from '@/utils/apiKeyUtils.ts';

// A simple worker to offload audio stitching from the main thread
const audioStitcherCode = `
  self.onmessage = async (event) => {
    const { blobsAsArrayBuffers } = event.data;
    const blobs = blobsAsArrayBuffers.map(b => new Blob([b], { type: 'audio/wav' }));
    
    if (blobs.length === 0) {
        postMessage(new Blob([], { type: 'audio/wav' }));
        return;
    }
    if (blobs.length === 1) {
        postMessage(blobs[0]);
        return;
    }

    const pcmChunksPromises = blobs.map(blob => {
        const headerSize = 44;
        return blob.arrayBuffer().then(b => new Uint8Array(b.slice(headerSize)));
    });

    const pcmChunks = await Promise.all(pcmChunksPromises);
    
    const totalLength = pcmChunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const combinedPcm = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of pcmChunks) {
        combinedPcm.set(chunk, offset);
        offset += chunk.length;
    }
    
    const sampleRate = 24000;
    const numChannels = 1;
    const header = writeWavHeader(combinedPcm, sampleRate, numChannels);
    const wavBytes = new Uint8Array(header.length + combinedPcm.length);
    wavBytes.set(header, 0);
    wavBytes.set(combinedPcm, header.length);

    postMessage(new Blob([wavBytes], { type: 'audio/wav' }));
  };

  const writeWavHeader = (samples, sampleRate, numChannels) => {
    const dataSize = samples.length;
    const buffer = new ArrayBuffer(44);
    const view = new DataView(buffer);

    const writeString = (offset, str) => {
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
`;
const audioStitcherBlob = new Blob([audioStitcherCode], { type: 'application/javascript' });
const audioStitcherUrl = URL.createObjectURL(audioStitcherBlob);


interface TtsTabProps {
    onSetNotification: (notification: Omit<Notification, 'id'>) => void;
    user: User;
    apiKeyPool: ApiKeyEntry[];
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
    const [isMultilingual, setIsMultilingual] = useState(false);
    

    const fileInputRef = useRef<HTMLInputElement>(null);
    const isCancelledRef = useRef(false);
    
    const isManagedUser = [SubscriptionTier.STAR, SubscriptionTier.SUPER_STAR, SubscriptionTier.VVIP].includes(user.tier);
    
    useEffect(() => {
        const nonLatinRegex = /[^\u0000-\u007F]+/;
        const detected = nonLatinRegex.test(text);
        if (detected !== isMultilingual) {
            setIsMultilingual(detected);
        }
    }, [text, isMultilingual]);

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
            addLog(`Bắt đầu xử lý song song...`, 'system');

            const pcmChunksMap = new Map<number, Uint8Array>();
            let settledCount = 0;
            
            const chunkPromises = Array.from({ length: totalChunks }, (_, chunkIndex) => {
                return (async () => {
                    if (isCancelledRef.current) return;

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

                        const { base64Audio, usage: newUsage, chunkIndex: processedIndex } = await res.json();
                        let pcmData = decode(base64Audio);
                        if (pcmData.length % 2 !== 0) {
                            const logMsg = `Phần ${processedIndex + 1}: Dữ liệu âm thanh có số byte lẻ (${pcmData.length}). Đang thêm byte đệm.`;
                            console.warn(logMsg); // Also log to console for debugging
                            const paddedPcmData = new Uint8Array(pcmData.length + 1);
                            paddedPcmData.set(pcmData, 0);
                            pcmData = paddedPcmData;
                        }

                        if (newUsage) onUsageUpdate(newUsage);
                        return { status: 'fulfilled', value: { pcmData, index: processedIndex } };
                    } catch (e) {
                        const errorMsg = e instanceof Error ? e.message : `Xử lý thất bại.`;
                        return { status: 'rejected', reason: `Phần ${chunkIndex + 1}: ${errorMsg}`, index: chunkIndex };
                    } finally {
                         // Update progress inside the promise
                        settledCount++;
                        setProgress((settledCount / totalChunks) * 100);
                        setProgressStatus(`Đang xử lý ${settledCount}/${totalChunks} phần...`);
                    }
                })();
            });

            const results = await Promise.all(chunkPromises);
            
            if (isCancelledRef.current) throw new Error('Đã hủy tác vụ.');

            let successfulChunksCount = 0;
            results.forEach(result => {
                if (result?.status === 'fulfilled') {
                    pcmChunksMap.set(result.value.index, result.value.pcmData);
                    addLog(`Xử lý thành công phần ${result.value.index + 1}.`, 'success');
                    successfulChunksCount++;
                } else if (result?.status === 'rejected') {
                    addLog(result.reason, 'error');
                    setError(prev => prev ? `${prev}\n- ${result.reason}` : `- ${result.reason}`);
                }
            });

            if (successfulChunksCount === 0) {
                throw new Error("Tất cả các phần đều xử lý thất bại. Không thể tạo file âm thanh.");
            }

            addLog(`Đã xử lý ${successfulChunksCount}/${totalChunks} phần thành công. Đang ghép âm thanh...`, 'system');
            setProgressStatus('Đang hoàn tất...');

            const orderedPcmChunks = Array.from({ length: totalChunks }, (_, i) => pcmChunksMap.get(i)).filter(Boolean) as Uint8Array[];
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
                fetch('/api/tts?action=cleanup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ jobId: currentJobId }),
                }).then(() => addLog('Dọn dẹp hoàn tất.', 'info')).catch(() => addLog('Dọn dẹp tài nguyên thất bại.', 'error'));
            }
        }
    }, [text, selectedVoice, onSetNotification, resetState, onUsageUpdate]);


    const handleGenerateSpeechSelfManaged = useCallback(async () => {
        resetState();
        setIsProcessing(true);
        addLog('Bắt đầu tổng hợp (client-side, sử dụng keys cá nhân)...', 'system');
    
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
    
            const audioBlobs: Blob[] = [];
            const keyPoolRef = { current: JSON.parse(JSON.stringify(initialKeyPool)) as ApiKeyEntry[] };
            let nextKeyStartIndex = 0;
            let totalCharsProcessed = 0;

            for (const [chunkIndex, chunkText] of chunks.entries()) {
                if (isCancelledRef.current) break;
                
                setProgressStatus(`Đang xử lý phần ${chunkIndex + 1}/${chunks.length}...`);
                let processed = false;
                let finalError = 'Tất cả các key có sẵn đều không thể xử lý phần này.';

                for (let i = 0; i < availableKeys.length; i++) {
                    if (isCancelledRef.current) break;

                    const keyTryIndex = (nextKeyStartIndex + i) % availableKeys.length;
                    const keyToTry = availableKeys[keyTryIndex];
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
                        
                        let pcmData = decode(base64Audio);
                        // Odd byte count check for PCM data integrity.
                        if (pcmData.length % 2 !== 0) {
                            addLog(`Phần ${chunkIndex + 1}: Dữ liệu âm thanh có số byte lẻ (${pcmData.length}). Đang thêm byte đệm để tránh lỗi.`, 'info');
                            const paddedPcmData = new Uint8Array(pcmData.length + 1);
                            paddedPcmData.set(pcmData, 0);
                            pcmData = paddedPcmData;
                        }
                        
                        const wavBlob = createWavBlob(pcmData);
                        audioBlobs.push(wavBlob);
                        
                        liveKeyEntry.usage.count++;
                        totalCharsProcessed += chunkText.length;
                        addLog(`Phần ${chunkIndex + 1}: Thành công với key ...${liveKeyEntry.key.slice(-4)}. Lượt dùng: ${liveKeyEntry.usage.count}/${TTS_DAILY_API_LIMIT}.`, 'success');
                        processed = true;
                        nextKeyStartIndex = (keyTryIndex + 1) % availableKeys.length;
                        break; 

                    } catch (e: any) {
                        const errorString = e.toString();
                        finalError = e instanceof Error ? e.message : String(e);
                        if (errorString.includes('RESOURCE_EXHAUSTED') || errorString.includes('429') || errorString.includes('API key not valid')) {
                            liveKeyEntry.usage.count = TTS_DAILY_API_LIMIT;
                            finalError = errorString.includes('API key not valid') ? `Key ...${liveKeyEntry.key.slice(-4)} không hợp lệ.` :`Key ...${liveKeyEntry.key.slice(-4)} đã hết hạn ngạch.`;
                        }
                        addLog(`Phần ${chunkIndex + 1}: ${finalError} Đang thử key tiếp theo...`, 'info');
                    }
                }

                if (!processed && !isCancelledRef.current) {
                    const finalLogMessage = `Phần ${chunkIndex + 1}: Xử lý thất bại. ${finalError}`;
                    addLog(finalLogMessage, 'error');
                    setError(prev => (prev ? prev + `\n- ${finalLogMessage}` : `- ${finalLogMessage}`));
                }

                setProgress(((chunkIndex + 1) / chunks.length) * 100);
                await new Promise(resolve => setTimeout(resolve, 200)); // Rate limit buffer
            }
    
            if (isCancelledRef.current) throw new Error('Đã hủy tác vụ.');
    
            setApiKeyPool([...keyPoolRef.current]);

            if (audioBlobs.length > 0) {
                reportTtsUsage(totalCharsProcessed, audioBlobs.length).then(({ usage }) => onUsageUpdate(usage));
            } else {
                 throw new Error("Tất cả các phần đều xử lý thất bại. Không thể tạo file âm thanh.");
            }
            
            addLog(`Đã xử lý ${audioBlobs.length}/${chunks.length} phần thành công. Đang ghép âm thanh...`, 'system');
            setProgressStatus('Đang hoàn tất...');

            if (window.Worker) {
                const worker = new Worker(audioStitcherUrl);
                const blobsAsArrayBuffers = await Promise.all(audioBlobs.map(b => b.arrayBuffer()));
                worker.postMessage({ blobsAsArrayBuffers });
                
                worker.onmessage = (event) => {
                    setFinalAudioBlob(event.data);
                    addLog('Âm thanh đã sẵn sàng!', 'success');
                    worker.terminate();
                };
            } else {
                 const finalBlob = await stitchWavBlobs(audioBlobs);
                 setFinalAudioBlob(finalBlob);
                 addLog('Âm thanh đã sẵn sàng (fallback)!', 'success');
            }
    
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
    }, [text, selectedVoice, onSetNotification, resetState, user, apiKeyPool, setApiKeyPool, onUsageUpdate]);

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
                        {isMultilingual && <p className="text-xs text-cyan-400 mt-1.5 px-1">Đã phát hiện văn bản đa ngôn ngữ. Giọng 'Tự động' được khuyến nghị.</p>}
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