import React, { useState, useEffect } from 'react';
import { User, Notification } from '@/types';
import { BugIcon, ChatBubbleIcon } from '@/components/Icons';
import BugReportModal from '@/components/BugReportModal';

// --- Start of inner component: ApiKeyManager ---
interface ApiKeyManagerProps {
    apiKey: string;
    setApiKey: (key: string) => void;
    onSetNotification: (notification: Omit<Notification, 'id'>) => void;
}

const ApiKeyManager: React.FC<ApiKeyManagerProps> = ({ apiKey, setApiKey, onSetNotification }) => {
    const [inputValue, setInputValue] = useState(apiKey);
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        setInputValue(apiKey);
        if (!apiKey) {
            setIsEditing(true);
        }
    }, [apiKey]);

    const handleSave = () => {
        if (inputValue.trim()) {
            setApiKey(inputValue.trim());
            setIsEditing(false);
            onSetNotification({ type: 'success', message: 'API Key đã được lưu.' });
        } else {
            setApiKey('');
            setIsEditing(true); // Stay in editing mode if key is cleared
            onSetNotification({ type: 'info', message: 'API Key đã được xóa.' });
        }
    };
    
    if (!isEditing && apiKey) {
        return (
             <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">API Key: ****{apiKey.slice(-4)}</span>
                <button onClick={() => setIsEditing(true)} className="text-sm text-cyan-400 hover:underline">Sửa</button>
            </div>
        )
    }

    return (
        <div className="flex items-center gap-2">
            <input
                type="password"
                placeholder="Nhập Gemini API Key"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="bg-gray-700 border border-gray-600 rounded-md py-1 px-2 text-sm w-56 text-white placeholder-gray-400 focus:ring-purple-500 focus:border-purple-500"
                aria-label="Gemini API Key"
            />
            <button
                onClick={handleSave}
                className="bg-purple-600 hover:bg-purple-700 text-white py-1 px-3 rounded text-sm"
            >
                Lưu
            </button>
             {isEditing && apiKey && (
                <button
                    onClick={() => {
                        setIsEditing(false);
                        setInputValue(apiKey); // Revert changes
                    }}
                    className="text-sm text-gray-400 hover:underline"
                >
                    Hủy
                </button>
            )}
        </div>
    );
};
// --- End of inner component: ApiKeyManager ---

interface HeaderProps {
    user: User;
    onLogout: () => void;
    apiKey: string;
    setApiKey: (key: string) => void;
    onSetNotification: (notification: Omit<Notification, 'id'>) => void;
}

const Header: React.FC<HeaderProps> = ({ user, onLogout, apiKey, setApiKey, onSetNotification }) => {
    const [isBugModalOpen, setIsBugModalOpen] = useState(false);

    return (
        <>
            <header className="bg-gray-900/50 border-b border-gray-700/50">
                <div className="container mx-auto px-4 py-3 flex justify-between items-center relative">
                    <span className="text-gray-300">Welcome, {user.firstName}</span>
                    
                    <h1 className="text-2xl md:text-3xl font-bold text-center bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500 absolute left-1/2 -translate-x-1/2">
                    TTS by LÝ VĂN HIỆP ( KIOSOO )
                    </h1>

                    <div className="flex items-center gap-4">
                        <ApiKeyManager apiKey={apiKey} setApiKey={setApiKey} onSetNotification={onSetNotification} />
                        
                        <a href="https://zalo.me/0985351304" target="_blank" rel="noopener noreferrer" title="Liên hệ qua Zalo" className="p-2 rounded-full hover:bg-gray-700">
                            <ChatBubbleIcon className="h-6 w-6 text-gray-300" />
                        </a>

                        <button onClick={() => setIsBugModalOpen(true)} title="Báo cáo lỗi" className="p-2 rounded-full hover:bg-gray-700">
                            <BugIcon className="h-6 w-6 text-gray-300" />
                        </button>
                        
                        <button onClick={onLogout} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded text-sm">Logout</button>
                    </div>
                </div>
            </header>
            {isBugModalOpen && (
                <BugReportModal 
                    onClose={() => setIsBugModalOpen(false)} 
                    onSetNotification={onSetNotification} 
                />
            )}
        </>
    );
};

export default Header;