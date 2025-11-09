
// Project cleanup: Removed unused component and API files.
import React, { useState, useEffect } from 'react';
// FIX: Add file extensions to imports to resolve module loading errors.
import Header from '@/components/Header.tsx';
import TtsTab from '@/components/TtsTab.tsx';
import AdminTab from '@/components/AdminTab.tsx';
import Login from '@/components/Login.tsx';
import { User, Notification as NotificationType, ApiKeyEntry } from '@/types.ts';
import { NotificationContainer } from '@/components/Notification.tsx';
import { fetchCurrentUser, logoutUser } from '@/services/apiService.ts';
import { TtsIcon, UsersIcon } from '@/components/Icons.tsx';
import { getValidatedApiKeyPool } from '@/utils/apiKeyUtils.ts';


const App: React.FC = () => {
    const [user, setUser] = useState<User | null>(null);
    const [activeTab, setActiveTab] = useState('tts');
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);
    const [notifications, setNotifications] = useState<NotificationType[]>([]);
    const [apiKeyPool, setApiKeyPool] = useState<ApiKeyEntry[]>(() => {
        const storedPool = localStorage.getItem('gemini_api_keys_pool');
        return storedPool ? getValidatedApiKeyPool(JSON.parse(storedPool)) : [];
    });

    useEffect(() => {
        localStorage.setItem('gemini_api_keys_pool', JSON.stringify(apiKeyPool));
    }, [apiKeyPool]);

    const addNotification = (notification: Omit<NotificationType, 'id'>) => {
        setNotifications(prev => [...prev, { ...notification, id: Date.now() }]);
    };

    const removeNotification = (id: number) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    };
    
    useEffect(() => {
        const checkAuth = async () => {
            try {
                const currentUser = await fetchCurrentUser();
                setUser(currentUser);
            } catch (error) {
                console.error("Auth check failed", error);
                setUser(null);
            } finally {
                setIsCheckingAuth(false);
            }
        };
        checkAuth();
    }, []);

    const handleLogout = async () => {
        await logoutUser();
        setUser(null);
        setActiveTab('tts');
        addNotification({ type: 'info', message: 'Bạn đã được đăng xuất.' });
    };
    
    if (isCheckingAuth) {
        return <div className="bg-gray-900 min-h-screen flex items-center justify-center text-white">Đang tải...</div>;
    }

    if (!user) {
        return (
            <>
                <NotificationContainer notifications={notifications} onDismiss={removeNotification} />
                <Login onLoginSuccess={setUser} onSetNotification={addNotification} />
            </>
        );
    }
    
    const tabs = [
        { id: 'tts', name: 'Advanced TTS', icon: <TtsIcon /> },
    ];
    if (user.isAdmin) {
        tabs.push({ id: 'admin', name: 'Quản trị', icon: <UsersIcon /> });
    }

    const renderTabContent = () => {
        switch (activeTab) {
            case 'admin':
                return user.isAdmin ? <AdminTab onSetNotification={addNotification} /> : null;
            case 'tts':
            default:
                return <TtsTab 
                    onSetNotification={addNotification} 
                    user={user} 
                    apiKeyPool={apiKeyPool}
                    setApiKeyPool={setApiKeyPool}
                />;
        }
    };

    return (
        <div className="bg-gray-900 min-h-screen text-white font-sans">
            <NotificationContainer notifications={notifications} onDismiss={removeNotification} />
            <Header 
                user={user} 
                onLogout={handleLogout}
                apiKeyPool={apiKeyPool}
                setApiKeyPool={setApiKeyPool}
                onSetNotification={addNotification}
            />
            <main className="container mx-auto p-4 md:p-8">
                <div className="max-w-4xl mx-auto">
                    {tabs.length > 1 && (
                         <div className="mb-6 border-b border-gray-700">
                            <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                                {tabs.map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                                            activeTab === tab.id
                                                ? 'border-purple-500 text-purple-400'
                                                : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'
                                        }`}
                                    >
                                        {tab.icon}
                                        {tab.name}
                                    </button>
                                ))}
                            </nav>
                        </div>
                    )}
                    {renderTabContent()}
                </div>
            </main>
        </div>
    );
};
export default App;