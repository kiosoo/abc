import { User, BugReport, SubscriptionTier } from '@/types';

// This service now exclusively calls API endpoints. No more local simulation.

async function fetcher<T>(url: string, options?: RequestInit): Promise<T> {
    const res = await fetch(url, options);
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.message || 'Đã xảy ra lỗi API');
    }
    return data;
}

export const loginUser = (username: string, password: string): Promise<User> => {
    return fetcher<User>('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
    });
};

export const registerUser = (userData: Omit<User, 'id' | 'isAdmin' | 'tier' | 'subscriptionExpiresAt' | 'createdAt' | 'lastLoginAt' | 'ipAddress' | 'usage'>): Promise<User> => {
    return fetcher<User>('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
    });
};

export const fetchCurrentUser = (): Promise<User | null> => {
    return fetcher<User | null>('/api/user');
};

export const logoutUser = (): Promise<void> => {
    return fetcher<void>('/api/auth/logout', { method: 'POST' });
};

export const fetchAllUsers = (): Promise<Omit<User, 'password'>[]> => {
    return fetcher<Omit<User, 'password'>[]>('/api/users');
};

export const updateUserSubscription = (id: string, updates: { tier?: SubscriptionTier, subscriptionExpiresAt?: string | null }): Promise<User> => {
    return fetcher<User>('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
    });
};

export const reportTtsUsage = (characterCount: number): Promise<void> => {
    return fetcher<void>('/api/usage/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterCount }),
    });
};

export const submitBugReport = (message: string): Promise<void> => {
    return fetcher<void>('/api/bugs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
    });
};

export const fetchBugReports = (): Promise<BugReport[]> => {
    return fetcher<BugReport[]>('/api/bugs');
};