import React, { useState } from 'react';
import { Notification } from '@/types';
import { submitBugReport } from '@/services/apiService';
import { LoadingSpinner } from '@/components/Icons';

interface BugReportModalProps {
    onClose: () => void;
    onSetNotification: (notification: Omit<Notification, 'id'>) => void;
}

const BugReportModal: React.FC<BugReportModalProps> = ({ onClose, onSetNotification }) => {
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim()) {
            onSetNotification({ type: 'error', message: 'Vui lòng mô tả lỗi bạn gặp phải.' });
            return;
        }
        setIsLoading(true);
        try {
            await submitBugReport(message);
            onSetNotification({ type: 'success', message: 'Cảm ơn bạn! Báo cáo lỗi đã được gửi.' });
            onClose();
        } catch (error) {
            onSetNotification({ type: 'error', message: error instanceof Error ? error.message : 'Không thể gửi báo cáo.' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl w-full max-w-lg relative" onClick={e => e.stopPropagation()}>
                <form onSubmit={handleSubmit}>
                    <div className="p-6 border-b border-gray-700">
                        <h3 className="text-xl font-bold text-white">Báo cáo lỗi</h3>
                        <p className="text-sm text-gray-400 mt-1">
                            Gặp sự cố? Vui lòng mô tả chi tiết vấn đề bạn đang gặp phải.
                        </p>
                    </div>
                    <div className="p-6">
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Mô tả lỗi của bạn ở đây..."
                            className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 resize-y focus:ring-2 focus:ring-purple-500 transition-all duration-200 text-gray-200 placeholder-gray-500 min-h-[150px]"
                            rows={6}
                            disabled={isLoading}
                        />
                    </div>
                    <div className="p-4 bg-gray-900/50 flex justify-end items-center gap-4 rounded-b-lg">
                        <button type="button" onClick={onClose} disabled={isLoading} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500 text-sm">
                            Hủy
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading || !message.trim()}
                            className="px-6 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 disabled:bg-gray-500 flex items-center justify-center gap-2 transition-colors duration-200 text-sm"
                        >
                            {isLoading && <LoadingSpinner className="h-4 w-4" />}
                            {isLoading ? 'Đang gửi...' : 'Gửi báo cáo'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default BugReportModal;