import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { User, Notification, SubscriptionTier, BugReport } from '@/types';
import { LoadingSpinner, ArrowUpIcon, ArrowDownIcon, ChevronDownIcon } from '@/components/Icons';
import { fetchAllUsers, updateUserSubscription, fetchBugReports, deleteUser as deleteUserService } from '@/services/apiService';
import { TIER_LIMITS, TIER_COLORS } from '@/constants';

const timeAgo = (dateString: string | null): string => {
    if (!dateString) return 'Chưa có';
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
    const minutes = Math.round(seconds / 60);
    const hours = Math.round(minutes / 60);
    const days = Math.round(hours / 24);

    if (seconds < 60) return `${seconds} giây trước`;
    if (minutes < 60) return `${minutes} phút trước`;
    if (hours < 24) return `${hours} giờ trước`;
    return `${days} ngày trước`;
};

const DashboardMetrics: React.FC<{ users: Omit<User, 'password'>[] }> = ({ users }) => {
    const totalUsers = users.length;

    const activeUsersLast24h = useMemo(() => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return users.filter(user => user.lastLoginAt && new Date(user.lastLoginAt) > yesterday).length;
    }, [users]);

    const { newUsersLast7Days, newUsersToday } = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        const newLast7 = users.filter(user => new Date(user.createdAt) >= sevenDaysAgo).length;
        const newToday = users.filter(user => new Date(user.createdAt) >= today).length;
        
        return { newUsersLast7Days: newLast7, newUsersToday: newToday };
    }, [users]);
    
    return (
        <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-800/50 p-6 rounded-lg border border-gray-700">
                <h3 className="text-gray-400 text-sm font-medium">Tổng người dùng</h3>
                <p className="text-3xl font-bold text-white mt-1">{totalUsers}</p>
            </div>
            <div className="bg-gray-800/50 p-6 rounded-lg border border-gray-700">
                <h3 className="text-gray-400 text-sm font-medium">Hoạt động trong 24h</h3>
                <p className="text-3xl font-bold text-white mt-1">{activeUsersLast24h}</p>
            </div>
             <div className="bg-gray-800/50 p-6 rounded-lg border border-gray-700">
                <h3 className="text-gray-400 text-sm font-medium">Người dùng mới (7 ngày)</h3>
                <p className="text-3xl font-bold text-white mt-1">{newUsersLast7Days}</p>
                {newUsersToday > 0 && <p className="text-sm text-green-400 font-medium mt-1">Hôm nay: +{newUsersToday}</p>}
            </div>
        </div>
    );
};

interface UserRowProps {
    user: Omit<User, 'password'>;
    onSave: (id: string, updates: Partial<User>) => void;
    onViewDetails: (user: Omit<User, 'password'>) => void;
    onDelete: (id: string, username: string) => void;
    isSaving: boolean;
}

const UserRow: React.FC<UserRowProps> = ({ user, onSave, onViewDetails, onDelete, isSaving }) => {
    const [tier, setTier] = useState(user.tier);
    
    const formatDateForInput = (isoDate: string | null) => {
        if (!isoDate) return '';
        try {
            return new Date(isoDate).toISOString().split('T')[0];
        } catch {
            return '';
        }
    };

    const [expiresAt, setExpiresAt] = useState(formatDateForInput(user.subscriptionExpiresAt));
    
    useEffect(() => {
        setTier(user.tier);
        setExpiresAt(formatDateForInput(user.subscriptionExpiresAt));
    }, [user]);


    const handleSave = () => {
        const expiresAtValue = expiresAt ? new Date(expiresAt).toISOString() : null;
        onSave(user.id, { tier, subscriptionExpiresAt: expiresAtValue });
    };
    
    const isChanged = tier !== user.tier || expiresAt !== formatDateForInput(user.subscriptionExpiresAt);
    const isExpired = user.subscriptionExpiresAt && new Date(user.subscriptionExpiresAt) < new Date();
    const usernameColorClass = isExpired ? 'text-red-400 font-bold' : TIER_COLORS[user.tier];

    return (
        <tr className={`transition-colors ${isExpired ? 'bg-red-900/20 hover:bg-red-900/30' : 'hover:bg-gray-800/60'}`}>
            <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${usernameColorClass}`}>{user.username}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                <select 
                    value={tier} 
                    onChange={e => setTier(e.target.value as SubscriptionTier)}
                    className="bg-gray-700 border border-gray-600 rounded-md p-1"
                    disabled={user.isAdmin || isSaving}
                >
                    {Object.values(SubscriptionTier).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                <input
                    type="date"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    className="w-40 bg-gray-700 border border-gray-600 rounded-md p-1"
                    disabled={user.isAdmin || isSaving}
                />
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 font-mono">{user.usage.ttsCharacters.toLocaleString()}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{timeAgo(user.lastLoginAt)}</td>
            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                <button
                    onClick={() => onViewDetails(user)}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                    Chi tiết
                </button>
                <button
                    onClick={handleSave}
                    disabled={!isChanged || isSaving}
                    className="px-3 py-1 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-500 disabled:cursor-not-allowed min-w-[50px] flex justify-center items-center"
                >
                    {isSaving ? <LoadingSpinner className="h-4 w-4" /> : 'Lưu'}
                </button>
                {!user.isAdmin && (
                    <button
                        onClick={() => onDelete(user.id, user.username)}
                        className="px-3 py-1 text-sm bg-red-600 text-white rounded-md hover:bg-red-700"
                    >
                        Xóa
                    </button>
                )}
            </td>
        </tr>
    );
};

const UserDetailsModal: React.FC<{ 
    user: Omit<User, 'password'>;
    onClose: () => void;
    onSave: (id: string, updates: Partial<User>) => Promise<void>;
}> = ({ user, onClose, onSave }) => {
    const limit = TIER_LIMITS[user.tier];
    const usagePercentage = limit === Infinity ? 0 : Math.min((user.usage.ttsCharacters / limit) * 100, 100);
    const [isLoading, setIsLoading] = useState(false);
    
    const [managedKeys, setManagedKeys] = useState((user.managedApiKeys || []).join('\n'));

    useEffect(() => {
        setManagedKeys((user.managedApiKeys || []).join('\n'));
    }, [user.managedApiKeys]);

    const isManagedTier = [SubscriptionTier.STAR, SubscriptionTier.SUPER_STAR, SubscriptionTier.VVIP].includes(user.tier);

    const handleSaveChanges = async () => {
        setIsLoading(true);
        try {
            const keys = managedKeys.split('\n').map(k => k.trim()).filter(Boolean);
            await onSave(user.id, { managedApiKeys: keys });
        } finally {
            setIsLoading(false);
        }
    };

    return (
         <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl w-full max-w-lg relative" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-gray-700">
                    <h3 className="text-xl font-bold text-white">{user.firstName} {user.lastName}</h3>
                    <p className="text-sm text-gray-400">@{user.username}</p>
                </div>
                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                    <div>
                        <h4 className="text-sm font-medium text-gray-400 mb-2">Thông tin Gói</h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div><span className="text-gray-500">Gói:</span> <span className={`font-semibold ${TIER_COLORS[user.tier]}`}>{user.tier}</span></div>
                            <div><span className="text-gray-500">Hết hạn:</span> <span className="text-white font-semibold">{user.subscriptionExpiresAt ? new Date(user.subscriptionExpiresAt).toLocaleDateString('vi-VN') : 'Không bao giờ'}</span></div>
                        </div>
                    </div>
                     <div>
                        <h4 className="text-sm font-medium text-gray-400 mb-2">Hoạt động</h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div><span className="text-gray-500">Đăng nhập cuối:</span> <span className="text-white font-semibold">{timeAgo(user.lastLoginAt)}</span></div>
                            <div><span className="text-gray-500">Địa chỉ IP:</span> <span className="text-white font-semibold font-mono">{user.ipAddress || 'N/A'}</span></div>
                        </div>
                    </div>

                    <div>
                        <h4 className="text-sm font-medium text-gray-400 mb-2">Mức sử dụng TTS</h4>
                        <div className="space-y-1">
                            <div className="flex justify-between text-sm font-medium">
                                <span className="text-purple-300">{user.usage.ttsCharacters.toLocaleString()}</span>
                                <span className="text-gray-400">
                                    <span className={`font-semibold ${TIER_COLORS[user.tier]}`}>{user.tier}</span>
                                    {limit === Infinity ? ' / Vô hạn' : ` / ${limit.toLocaleString()} ký tự`}
                                </span>
                            </div>
                            <div className="w-full bg-gray-700 rounded-full h-2.5">
                                <div className="bg-purple-600 h-2.5 rounded-full" style={{ width: `${usagePercentage}%` }}></div>
                            </div>
                        </div>
                    </div>

                    {isManagedTier && (
                        <div>
                            <h4 className="text-sm font-medium text-gray-400 mb-2">API Keys được Quản lý</h4>
                            
                            <div className="mb-3 p-3 bg-gray-900 rounded-md border border-gray-700">
                                <h5 className="text-xs font-semibold text-gray-300 mb-2">Các Keys đang hoạt động ({user.managedApiKeys?.length || 0}):</h5>
                                {user.managedApiKeys && user.managedApiKeys.length > 0 ? (
                                    <ul className="space-y-1">
                                        {user.managedApiKeys.map((key, index) => (
                                            <li key={index} className="font-mono text-xs text-cyan-400 bg-gray-800/50 px-2 py-1 rounded-sm">
                                                {key.length > 6 ? `${key.substring(0, 2)}...${key.slice(-4)}` : key}
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-xs text-gray-500">Chưa có key nào được gán.</p>
                                )}
                            </div>

                            <textarea
                                value={managedKeys}
                                onChange={(e) => setManagedKeys(e.target.value)}
                                placeholder="Dán các API key vào đây để cập nhật hoặc thêm mới, mỗi key một dòng."
                                className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 resize-y focus:ring-2 focus:ring-purple-500 font-mono text-sm"
                                rows={4}
                            />
                             <p className="text-xs text-gray-500 mt-1">Lưu ý: Việc lưu sẽ ghi đè toàn bộ danh sách key hiện có bằng nội dung bên trên.</p>
                        </div>
                    )}
                </div>
                <div className="p-4 bg-gray-900/50 flex justify-end gap-3 items-center rounded-b-lg">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500 text-sm">Đóng</button>
                    {isManagedTier && (
                        <button 
                            onClick={handleSaveChanges} 
                            disabled={isLoading}
                            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 text-sm flex items-center gap-2 disabled:bg-gray-500"
                        >
                            {isLoading && <LoadingSpinner className="h-4 w-4" />}
                            Lưu API Keys
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};


interface AdminTabProps {
    onSetNotification: (notification: Omit<Notification, 'id'>) => void;
}

const AdminTab: React.FC<AdminTabProps> = ({ onSetNotification }) => {
    const [users, setUsers] = useState<Omit<User, 'password'>[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [savingUserId, setSavingUserId] = useState<string | null>(null);
    const [tierFilter, setTierFilter] = useState<string>('all');
    const [usernameFilter, setUsernameFilter] = useState<string>('');
    const [sortColumn, setSortColumn] = useState<string>('username');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [selectedUser, setSelectedUser] = useState<Omit<User, 'password'> | null>(null);
    const [bugReports, setBugReports] = useState<BugReport[]>([]);
    const [isLoadingReports, setIsLoadingReports] = useState(true);
    const [isReportsOpen, setIsReportsOpen] = useState(false);

    const getUsers = useCallback(async () => {
        setIsLoading(true);
        try {
            const usersData = await fetchAllUsers();
            setUsers(usersData);
        } catch (error) {
            onSetNotification({ type: 'error', message: error instanceof Error ? error.message : 'Đã xảy ra lỗi không xác định' });
        } finally {
            setIsLoading(false);
        }
    }, [onSetNotification]);
    
    const getReports = useCallback(async () => {
        setIsLoadingReports(true);
        try {
            const reports = await fetchBugReports();
            setBugReports(reports);
        } catch (error) {
            console.error("Failed to fetch bug reports:", error);
        } finally {
            setIsLoadingReports(false);
        }
    }, []);

    useEffect(() => {
        getUsers();
        getReports();
    }, [getUsers, getReports]);

    const handleSort = (column: string) => {
        if (sortColumn === column) {
            setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
    };
    
    const filteredAndSortedUsers = useMemo(() => {
        return users
            .filter(user => {
                const tierMatch = tierFilter === 'all' || user.tier === tierFilter;
                const usernameMatch = user.username.toLowerCase().includes(usernameFilter.toLowerCase());
                return tierMatch && usernameMatch;
            })
            .sort((a, b) => {
                const getSortValue = (user: Omit<User, 'password'>, column: string) => {
                    if (column === 'usage') return user.usage.ttsCharacters;
                    if (column === 'lastLoginAt') return user.lastLoginAt ? new Date(user.lastLoginAt).getTime() : 0;
                    if (column === 'subscriptionExpiresAt') return user.subscriptionExpiresAt ? new Date(user.subscriptionExpiresAt).getTime() : 0;
                    return user[column as keyof Omit<User, 'password'>];
                }
                
                const valA = getSortValue(a, sortColumn);
                const valB = getSortValue(b, sortColumn);

                if (valA === null || valA === 0) return 1;
                if (valB === null || valB === 0) return -1;
                
                let comparison = 0;
                if (valA > valB) {
                    comparison = 1;
                } else if (valA < valB) {
                    comparison = -1;
                }
                return sortDirection === 'asc' ? comparison : -comparison;
            });
    }, [users, tierFilter, usernameFilter, sortColumn, sortDirection]);

    const handleSaveUser = async (id: string, updates: Partial<User>) => {
        setSavingUserId(id);
        try {
           const updatedUser = await updateUserSubscription(id, updates);
           onSetNotification({ type: 'success', message: 'Cập nhật người dùng thành công' });
           
           setUsers(prevUsers => 
               prevUsers.map(u => (u.id === id ? updatedUser : u))
           );

        } catch (error) {
            onSetNotification({ type: 'error', message: error instanceof Error ? error.message : 'Cập nhật người dùng thất bại' });
        } finally {
            setSavingUserId(null);
        }
    };

    const handleDeleteUser = async (id: string, username: string) => {
        if (window.confirm(`Bạn có chắc chắn muốn xóa người dùng "${username}"? Hành động này không thể hoàn tác.`)) {
            try {
                await deleteUserService(id);
                setUsers(prevUsers => prevUsers.filter(u => u.id !== id));
                onSetNotification({ type: 'success', message: `Đã xóa người dùng ${username}.` });
            } catch (error) {
                onSetNotification({ type: 'error', message: error instanceof Error ? error.message : 'Xóa người dùng thất bại.' });
            }
        }
    };
    
    const SortableHeader: React.FC<{ column: string, title: string }> = ({ column, title }) => (
        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
            <button onClick={() => handleSort(column)} className="flex items-center gap-1 hover:text-white">
                {title}
                {sortColumn === column && (sortDirection === 'asc' ? <ArrowUpIcon /> : <ArrowDownIcon />)}
            </button>
        </th>
    );
    
    const userForModal = selectedUser ? users.find(u => u.id === selectedUser.id) : null;


    if (isLoading) {
        return <div className="flex justify-center items-center p-8"><LoadingSpinner className="h-10 w-10" /></div>;
    }

    return (
        <div>
            <h2 className="text-2xl font-semibold mb-4 text-red-300">Bảng Quản Trị</h2>
            
            <DashboardMetrics users={users} />

            <div className="mb-4 flex flex-wrap gap-4 p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
                <div className="flex-grow">
                    <label htmlFor="username-filter" className="block text-sm font-medium text-gray-300 mb-1">Lọc theo tên đăng nhập</label>
                    <input
                        id="username-filter"
                        type="text"
                        placeholder="Nhập tên..."
                        value={usernameFilter}
                        onChange={e => setUsernameFilter(e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:ring-purple-500 focus:border-purple-500"
                    />
                </div>
                <div className="flex-grow">
                    <label htmlFor="tier-filter" className="block text-sm font-medium text-gray-300 mb-1">Lọc theo gói</label>
                    <select
                        id="tier-filter"
                        value={tierFilter}
                        onChange={e => setTierFilter(e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded-md py-2 px-3 text-white focus:ring-purple-500 focus:border-purple-500"
                    >
                        <option value="all">Tất cả các gói</option>
                        {Object.values(SubscriptionTier).map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
            </div>

            <div className="bg-gray-800/50 border border-gray-700 rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-700">
                    <thead className="bg-gray-800">
                        <tr>
                            <SortableHeader column="username" title="Tên đăng nhập" />
                            <SortableHeader column="tier" title="Gói đăng ký" />
                            <SortableHeader column="subscriptionExpiresAt" title="Ngày hết hạn" />
                            <SortableHeader column="usage" title="Mức sử dụng TTS" />
                            <SortableHeader column="lastLoginAt" title="Hoạt động cuối" />
                            <th scope="col" className="relative px-6 py-3"><span className="sr-only">Hành động</span></th>
                        </tr>
                    </thead>
                    <tbody className="bg-gray-900 divide-y divide-gray-700">
                        {filteredAndSortedUsers.map(user => (
                           <UserRow 
                                key={user.id} 
                                user={user} 
                                onSave={handleSaveUser} 
                                onViewDetails={setSelectedUser} 
                                onDelete={handleDeleteUser} 
                                isSaving={savingUserId === user.id}
                           />
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="mt-8">
                <button 
                    onClick={() => setIsReportsOpen(!isReportsOpen)} 
                    className="w-full flex justify-between items-center p-3 bg-gray-700 hover:bg-gray-600 rounded-md text-sm font-medium"
                >
                    <span>Lịch sử Báo lỗi từ Người dùng <span className="text-xs bg-gray-600 px-2 py-0.5 rounded-full">{bugReports.length}</span></span>
                    <ChevronDownIcon className={`h-5 w-5 transition-transform ${isReportsOpen ? 'rotate-180' : ''}`} />
                </button>
                {isReportsOpen && (
                    <div className="mt-2 p-4 bg-gray-900 rounded-md border border-gray-700 max-h-96 overflow-y-auto">
                        {isLoadingReports ? (
                            <div className="flex justify-center p-4"><LoadingSpinner /></div>
                        ) : bugReports.length > 0 ? (
                            <ul className="space-y-4">
                                {bugReports.map(report => (
                                    <li key={report.id} className="p-4 bg-gray-800/60 rounded-lg border border-gray-700">
                                        <div className="flex justify-between items-center text-sm mb-2">
                                            <span className="font-semibold text-cyan-400">@{report.username}</span>
                                            <span className="text-gray-400">{timeAgo(report.createdAt)}</span>
                                        </div>
                                        <p className="text-gray-300 whitespace-pre-wrap">{report.message}</p>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-center text-gray-500 py-4">Chưa có báo cáo lỗi nào.</p>
                        )}
                    </div>
                )}
            </div>

            {userForModal && <UserDetailsModal user={userForModal} onClose={() => setSelectedUser(null)} onSave={handleSaveUser} />}
        </div>
    );
};

export default AdminTab;