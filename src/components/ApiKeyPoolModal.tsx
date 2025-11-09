import React, { useState } from 'react';
// FIX: Add file extensions to imports to resolve module loading errors.
import { Notification, ApiKeyEntry } from '@/types.ts';
import { InfoIcon, LoadingSpinner } from '@/components/Icons.tsx';
import { TTS_DAILY_API_LIMIT } from '@/constants.ts';

interface ApiKeyPoolModalProps {
    onClose: () => void;
    onSetNotification: (notification: Omit<Notification, 'id'>) => void;
    apiKeyPool: ApiKeyEntry[];
    setApiKeyPool: (pool: ApiKeyEntry[]) => void;
}

const ApiKeyPoolModal: React.FC<ApiKeyPoolModalProps> = ({ onClose, onSetNotification, apiKeyPool, setApiKeyPool }) => {
    const [keysToAdd, setKeysToAdd] = useState('');

    const handleAddKeys = () => {
        const newKeys = keysToAdd
            .split(/[\n\s,]+/) // Split by newlines, spaces, or commas
            .map(k => k.trim())
            .filter(k => k.length > 10); // Basic validation

        if (newKeys.length === 0) {
            onSetNotification({ type: 'error', message: 'Không tìm thấy key hợp lệ để thêm.' });
            return;
        }

        // Use the same quota day logic as in validation
        const now = new Date();
        now.setUTCHours(now.getUTCHours() - 8);
        const quotaDayStr = now.toISOString().split('T')[0];

        const currentKeyStrings = new Set(apiKeyPool.map(entry => entry.key));
        let addedCount = 0;

        const updatedPool = [...apiKeyPool];

        newKeys.forEach(key => {
            if (!currentKeyStrings.has(key)) {
                updatedPool.push({
                    key: key,
                    usage: { count: 0, date: quotaDayStr }
                });
                addedCount++;
            }
        });

        if (addedCount > 0) {
            setApiKeyPool(updatedPool);
            onSetNotification({ type: 'success', message: `Đã thêm thành công ${addedCount} key mới.` });
            setKeysToAdd('');
        } else {
            onSetNotification({ type: 'info', message: 'Tất cả các key nhập vào đã tồn tại.' });
        }
    };

    const handleDeleteKey = (keyToDelete: string) => {
        const updatedPool = apiKeyPool.filter(entry => entry.key !== keyToDelete);
        setApiKeyPool(updatedPool);
        onSetNotification({ type: 'info', message: 'Đã xóa API key.' });
    };

    return (
         <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl w-full max-w-3xl relative" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-gray-700">
                    <h3 className="text-xl font-bold text-white">Quản lý Vùng chứa API Key</h3>
                    <p className="text-sm text-gray-400 mt-1">
                        Thêm nhiều Gemini API key để tăng giới hạn sử dụng hàng ngày của bạn.
                    </p>
                </div>
                
                <div className="p-6 max-h-[70vh] overflow-y-auto">
                    <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4 text-sm mb-6 flex items-start gap-3">
                        <InfoIcon className="h-6 w-6 text-blue-400 flex-shrink-0 mt-0.5" />
                        <div>
                            <h4 className="font-bold text-blue-300">Lưu ý quan trọng về Hạn ngạch</h4>
                            <p className="text-blue-200 mt-1">
                                Tất cả các API key được tạo từ <strong className="font-semibold">cùng một dự án Google Cloud</strong> sẽ chia sẻ chung một hạn ngạch.
                                Gói miễn phí thường bị giới hạn ở <strong>15 yêu cầu/ngày cho mỗi dự án</strong>.
                            </p>
                            <p className="text-blue-200 mt-2">
                                Để tăng giới hạn, bạn cần <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-cyan-400 font-semibold hover:underline">kích hoạt thanh toán</a> trên dự án Google Cloud của mình.
                            </p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Add Keys Section */}
                        <div className="space-y-3">
                            <h4 className="font-semibold text-gray-200">Thêm Keys mới</h4>
                            <p className="text-xs text-gray-400">Dán một hoặc nhiều key vào đây, mỗi key trên một dòng mới.</p>
                            <textarea
                                value={keysToAdd}
                                onChange={(e) => setKeysToAdd(e.target.value)}
                                placeholder="...key1&#10;...key2"
                                className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 resize-y focus:ring-2 focus:ring-purple-500 transition-all duration-200 text-gray-200 placeholder-gray-500 min-h-[150px] font-mono text-sm"
                                rows={6}
                            />
                            <button
                                onClick={handleAddKeys}
                                disabled={!keysToAdd.trim()}
                                className="w-full px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 disabled:bg-gray-500 flex items-center justify-center gap-2 transition-colors duration-200 text-sm"
                            >
                                Thêm Keys
                            </button>
                        </div>

                        {/* Current Keys Section */}
                        <div className="space-y-3">
                            <h4 className="font-semibold text-gray-200">Keys Hiện có ({apiKeyPool.length})</h4>
                            <div className="space-y-2 pr-2">
                                {apiKeyPool.length > 0 ? (
                                    apiKeyPool.map(entry => (
                                        <div key={entry.key} className="flex items-center justify-between bg-gray-900 p-2 rounded-md border border-gray-700">
                                            <span className="font-mono text-sm text-gray-300">
                                                <span className="text-cyan-400">...</span>{entry.key.slice(-4)}
                                            </span>
                                            <span className="text-xs text-gray-500 font-semibold">
                                                Đã dùng: {entry.usage.count}/{TTS_DAILY_API_LIMIT}
                                            </span>
                                            <button
                                                onClick={() => handleDeleteKey(entry.key)}
                                                className="text-red-400 hover:text-red-300 text-xs font-bold"
                                            >
                                                Xóa
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-center text-gray-500 py-8 text-sm">Chưa có API key nào.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-gray-900/50 flex justify-end items-center gap-4 rounded-b-lg">
                    <a 
                        href="https://aistudio.google.com/app/apikey" 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-sm text-cyan-400 hover:underline font-semibold"
                    >
                        Lấy key miễn phí
                    </a>
                    <button type="button" onClick={onClose} className="px-5 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500 text-sm font-medium">
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ApiKeyPoolModal;