import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Notification, User, ApiKeyEntry, Project, SubscriptionTier } from '@/types';
import { TTS_VOICES, DEFAULT_VOICE, LONG_TEXT_CHUNK_SIZE, TIER_LIMITS, TTS_DAILY_API_LIMIT } from '@/constants';
import { generateSpeech } from '@/services/geminiService';
import { stitchWavBlobs, decode, createWavBlob } from '@/utils/audioUtils';
import { getValidatedApiKeyPool } from '@/utils/apiKeyUtils';
import { ChevronDownIcon, LoadingSpinner, DownloadIcon, ErrorIcon, DocumentTextIcon } from '@/components/Icons';
import { reportTtsUsage, fetchProjects, saveProject, deleteProject, generateManagedSpeech } from '@/services/apiService';
import SubscriptionModal from '@/components/SubscriptionModal';

interface TtsTabProps {
    onSetNotification: (notification: Omit<Notification, 'id'>) => void;
    user: User;
    apiKeyPool: ApiKeyEntry[];
    setApiKeyPool: (pool: ApiKeyEntry[]) => void;
}

const TtsTab: React.FC<TtsTabProps> = ({ onSetNotification, user, apiKeyPool, setApiKeyPool }) => {
    const [text, setText] = useState('');
    const [selectedVoice, setSelectedVoice] = useState(DEFAULT_VOICE);
    const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
    
    const [isLoading, setIsLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [statusMessage, setStatusMessage] = useState('');
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [error, setError] = useState<string | null>(null);
    
    const [projects, setProjects] = useState<Project[]>([]);
    const [isLoadingProjects, setIsLoadingProjects] = useState(true);

    const audioRef = useRef<HTMLAudioElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const isManagedUser = [SubscriptionTier.STAR, SubscriptionTier.SUPER_STAR, SubscriptionTier.VVIP].includes(user.tier);

    useEffect(() => {
        if (!isManagedUser) {
            setApiKeyPool(getValidatedApiKeyPool(apiKeyPool));
        }
        
        const loadProjects = async () => {
            setIsLoadingProjects(true);
            try {
                const userProjects = await fetchProjects();
                setProjects(userProjects);
            } catch (error) {
                onSetNotification({ type: 'error', message: 'Không thể tải các dự án.' });
            } finally {
                setIsLoadingProjects(false);
            }
        };
        loadProjects();
    }, [isManagedUser]);


    const characterLimit = TIER_LIMITS[user.tier];
    const isOverCharacterLimit = characterLimit === Infinity ? false : text.length > characterLimit;

    const requiredChunks = text.length > 0 ? Math.ceil(text.length / LONG_TEXT_CHUNK_SIZE) : 0;
    
    const totalRemainingCalls = apiKeyPool.reduce((total, entry) => {
        return total + (TTS_DAILY_API_LIMIT - entry.usage.count);
    }, 0);
    
    const isOverApiLimit = requiredChunks > totalRemainingCalls;

    useEffect(() => {
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
        if(event.target) event.target.value = '';
    };

    const handleGenerateSpeech = useCallback(async () => {
        setIsLoading(true);
        setProgress(0);
        setStatusMessage('Bắt đầu quá trình tổng hợp...');
        setAudioBlob(null);
        setError(null);

        try {
            if (isManagedUser) {
                // --- Managed User Flow ---
                setStatusMessage('Đang xử lý trên server, vui lòng chờ...');
                const finalBlob = await generateManagedSpeech(text, selectedVoice);
                setAudioBlob(finalBlob);
                setProgress(100);
            } else {
                // --- Self-managed API Key Flow ---
                const validatedPool = getValidatedApiKeyPool(apiKeyPool);
                setApiKeyPool(validatedPool);

                if (validatedPool.length === 0) {
                    throw new Error('Vui lòng thêm ít nhất một API Key trong phần Quản lý API Keys.');
                }
                if (isOverCharacterLimit) {
                    throw new Error(`Bạn đã vượt quá giới hạn ${characterLimit.toLocaleString()} ký tự của gói ${user.tier}.`);
                }

                const chunks: string[] = [];
                for (let i = 0; i < text.length; i += LONG_TEXT_CHUNK_SIZE) {
                    chunks.push(text.substring(i, i + LONG_TEXT_CHUNK_SIZE));
                }
                
                const currentTotalRemaining = validatedPool.reduce((total, entry) => total + (TTS_DAILY_API_LIMIT - entry.usage.count), 0);

                if (chunks.length > currentTotalRemaining) {
                    throw new Error(`Không đủ hạn ngạch. Cần ${chunks.length} lần gọi, nhưng tổng hạn ngạch còn lại là ${currentTotalRemaining}.`);
                }

                const transientPool = JSON.parse(JSON.stringify(validatedPool));
                const audioBlobs: Blob[] = [];
                const failedKeys = new Set<string>();

                for (let i = 0; i < chunks.length; i++) {
                    const chunk = chunks[i];
                    let chunkProcessed = false;

                    while (!chunkProcessed) {
                        const keyEntryIndex = transientPool.findIndex((entry: ApiKeyEntry) => entry.usage.count < TTS_DAILY_API_LIMIT);
                        
                        if (keyEntryIndex === -1) {
                            throw new Error("Đã hết hạn ngạch trên tất cả các key hợp lệ. Không thể hoàn thành.");
                        }
                        
                        const keyToUse = transientPool[keyEntryIndex];
                        setStatusMessage(`Đang xử lý phần ${i + 1}/${chunks.length} với key ...${keyToUse.key.slice(-4)}`);
                        
                        try {
                            const { base64Audio } = await generateSpeech(keyToUse.key, chunk, selectedVoice === 'auto' ? undefined : selectedVoice);
                            audioBlobs.push(createWavBlob(decode(base64Audio)));
                            
                            transientPool[keyEntryIndex].usage.count++;
                            setProgress(((i + 1) / chunks.length) * 100);
                            chunkProcessed = true; // Success, move to next chunk
                        } catch (e) {
                            console.error(`Key ...${keyToUse.key.slice(-4)} failed:`, e);
                            failedKeys.add(`...${keyToUse.key.slice(-4)}`);
                            
                            // Mark the key as fully used for this session to skip it next time
                            transientPool[keyEntryIndex].usage.count = TTS_DAILY_API_LIMIT;
                            onSetNotification({ type: 'error', message: `Key ...${keyToUse.key.slice(-4)} lỗi. Đang thử key tiếp theo.` });
                            setStatusMessage(`Key ...${keyToUse.key.slice(-4)} lỗi. Đang thử key tiếp theo...`);
                            
                            // Brief pause to allow notification to be seen
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        }
                    }
                }
                
                setStatusMessage('Đang ghép các file âm thanh...');
                const finalBlob = await stitchWavBlobs(audioBlobs);
                setAudioBlob(finalBlob);
                setApiKeyPool(transientPool);

                let successMessage = 'Tổng hợp giọng nói thành công!';
                if (failedKeys.size > 0) {
                    successMessage += `\nLưu ý: Đã tự động bỏ qua ${failedKeys.size} key lỗi (${Array.from(failedKeys).join(', ')}).`;
                }
                onSetNotification({ type: 'success', message: successMessage });
            }
            
            await reportTtsUsage(text.length);

        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'Đã xảy ra lỗi không xác định.';
            setError(errorMessage);
            onSetNotification({ type: 'error', message: errorMessage });
        } finally {
            setIsLoading(false);
            setStatusMessage('');
        }
    }, [text, apiKeyPool, setApiKeyPool, selectedVoice, isOverCharacterLimit, characterLimit, user.tier, onSetNotification, isManagedUser]);
    
    // --- Project Handlers ---
    const handleSaveProject = async () => {
        const name = prompt("Đặt tên cho dự án của bạn:");
        if (name && name.trim()) {
            try {
                const newProject = await saveProject({ name, text, voice: selectedVoice });
                setProjects(prev => [newProject, ...prev]);
                onSetNotification({ type: 'success', message: `Đã lưu dự án "${name}"` });
            } catch (error) {
                onSetNotification({ type: 'error', message: 'Lưu dự án thất bại.' });
            }
        }
    };
    
    const handleLoadProject = (project: Project) => {
        setText(project.text);
        setSelectedVoice(project.voice);
        onSetNotification({ type: 'info', message: `Đã tải dự án "${project.name}"` });
    };
    
    const handleDeleteProject = async (projectId: string) => {
        if (window.confirm("Bạn có chắc chắn muốn xóa dự án này?")) {
            try {
                await deleteProject(projectId);
                setProjects(prev => prev.filter(p => p.id !== projectId));
                onSetNotification({ type: 'success', message: 'Đã xóa dự án.' });
            } catch (error) {
                 onSetNotification({ type: 'error', message: 'Xóa dự án thất bại.' });
            }
        }
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

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-200">Advanced Text-to-Speech</h2>
            
            {/* Project Management Section */}
            <div className="p-4 bg-gray-800/30 border border-gray-700/50 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-300 mb-3">Dự án của bạn</h3>
                {isLoadingProjects ? <div className="text-center text-gray-400">Đang tải dự án...</div> :
                projects.length > 0 ? (
                    <div className="max-h-40 overflow-y-auto space-y-2 pr-2">
                        {projects.map(p => (
                            <div key={p.id} className="flex items-center justify-between bg-gray-900/50 p-2 rounded-md">
                                <div>
                                    <p className="font-medium text-white">{p.name}</p>
                                    <p className="text-xs text-gray-400">{p.text.substring(0, 40)}...</p>
                                </div>
                                <div className="space-x-2 flex-shrink-0">
                                    <button onClick={() => handleLoadProject(p)} className="text-sm text-cyan-400 hover:underline">Tải</button>
                                    <button onClick={() => handleDeleteProject(p.id)} className="text-sm text-red-400 hover:underline">Xóa</button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-gray-500 text-center py-4">Chưa có dự án nào. Lưu văn bản hiện tại để bắt đầu.</p>
                )}
            </div>

            <div className="p-6 bg-gray-800/50 border border-gray-700 rounded-lg space-y-4">
                 <div className="flex justify-between items-center">
                    <button
                        onClick={handleSaveProject}
                        disabled={isLoading || !text.trim()}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50"
                    >
                        Lưu dự án hiện tại
                    </button>
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

                    <div className="text-right w-full sm:w-auto space-y-1">
                        {!isManagedUser && (
                            <>
                            <div>
                                <p className={`font-mono text-sm ${isOverCharacterLimit ? 'text-red-400' : 'text-gray-400'}`}>
                                    Ký tự: {text.length.toLocaleString()} / {characterLimit === Infinity ? '∞' : characterLimit.toLocaleString()}
                                </p>
                                <p className="text-xs text-gray-500">
                                    Gói của bạn: <span className="font-semibold text-cyan-400">{user.tier}</span>
                                    <button onClick={() => setIsSubscriptionModalOpen(true)} className="ml-1 text-cyan-500 hover:underline text-xs">(Xem chi tiết)</button>
                                </p>
                            </div>
                            <div>
                                <p className={`font-mono text-sm ${isOverApiLimit ? 'text-red-400' : 'text-gray-400'}`}>
                                    Lần gọi API yêu cầu / Tổng còn lại: {requiredChunks} / {totalRemainingCalls}
                                </p>
                                {isOverApiLimit && requiredChunks > 0 && (
                                    <p className="text-xs text-red-400">Vượt quá tổng hạn ngạch. Rút ngắn văn bản hoặc thêm API key.</p>
                                )}
                            </div>
                            </>
                        )}
                        {isManagedUser && (
                             <div>
                                <p className="font-mono text-sm text-gray-400">
                                    Ký tự: {text.length.toLocaleString()} / {characterLimit === Infinity ? '∞' : characterLimit.toLocaleString()}
                                </p>
                                <p className="text-xs text-gray-500">
                                    Gói của bạn: <span className="font-semibold text-cyan-400">{user.tier}</span>
                                     <button onClick={() => setIsSubscriptionModalOpen(true)} className="ml-1 text-cyan-500 hover:underline text-xs">(Xem chi tiết)</button>
                                </p>
                            </div>
                        )}
                    </div>
                </div>
                 <button
                    onClick={handleGenerateSpeech}
                    disabled={isLoading || !text.trim() || (!isManagedUser && (isOverCharacterLimit || isOverApiLimit))}
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