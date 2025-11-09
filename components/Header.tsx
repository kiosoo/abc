import React, { useState } from 'react';
import { User, Notification, ApiKeyEntry, SubscriptionTier } from '@/types';
import { BugIcon, ChatBubbleIcon, TtsIcon } from '@/components/Icons';
import BugReportModal from '@/components/BugReportModal';
import ApiKeyPoolModal from '@/components/ApiKeyPoolModal';

interface HeaderProps {
    user: User;
    onLogout: () => void;
    apiKeyPool: ApiKeyEntry[];
    setApiKeyPool: (pool: ApiKeyEntry[]) => void;
    onSetNotification: (notification: Omit<Notification, 'id'>) => void;
}

const Header: React.FC<HeaderProps> = ({ user, onLogout, apiKeyPool, setApiKeyPool, onSetNotification }) => {
    const [isBugModalOpen, setIsBugModalOpen] = useState(false);
    const [isKeyPoolModalOpen, setIsKeyPoolModalOpen] = useState(false);

    const isManagedUser = [SubscriptionTier.STAR, SubscriptionTier.SUPER_STAR, SubscriptionTier.VVIP].includes(user.tier);

    return (
        <>
            <header className="bg-gray-900/50 border-b border-gray-700/50">
                <div className="container mx-auto px-4 py-3 flex justify-between items-center relative">
                    <span className="text-gray-300">Welcome, {user.firstName}</span>
                    
                    <h1 className="text-2xl md:text-3xl font-bold text-center bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500 absolute left-1/2 -translate-x-1/2">
                    TTS by LÝ VĂN HIỆP ( KIOSOO )
                    </h1>

                    <div className="flex items-center gap-4">
                        {!isManagedUser && (
                            <button 
                                onClick={() => setIsKeyPoolModalOpen(true)}
                                className="bg-gray-700 hover:bg-gray-600 text-white py-2 px-3 rounded text-sm flex items-center gap-2"
                            >
                                <TtsIcon className="h-4 w-4" />
                            <span>Quản lý API Keys ({apiKeyPool.length})</span>
                            </button>
                        )}
                        
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
            {isKeyPoolModalOpen && !isManagedUser && (
                <ApiKeyPoolModal
                    onClose={() => setIsKeyPoolModalOpen(false)}
                    onSetNotification={onSetNotification}
                    apiKeyPool={apiKeyPool}
                    setApiKeyPool={setApiKeyPool}
                />
            )}
        </>
    );
};

export default Header;