
// FIX: Add file extension to import to resolve module loading error.
import { User, SubscriptionTier } from '@/types.ts';

// This service now exclusively calls API endpoints. No more local simulation.

async function fetcher<T>(url: string, options?: RequestInit, responseType: 'json' | 'blob' = 'json'): Promise<T> {
    const res = await fetch(url, options);
    if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Đã xảy ra lỗi API');
    }
    if (responseType === 'blob') {
        return res.blob() as Promise<T>;
    }
    return res.json() as Promise<T>;
}

export const loginUser = (username: string, password: string): Promise<User> => {
    return fetcher<User>('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', username, password }),
    });
};

export const registerUser = (userData: Omit<User, 'id' | 'isAdmin' | 'tier' | 'subscriptionExpiresAt' | 'createdAt' | 'lastLoginAt' | 'ipAddress' | 'usage'>): Promise<User> => {
    return fetcher<User>('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'register', ...userData }),
    });
};

export const fetchCurrentUser = (): Promise<User | null> => {
    return fetcher<User | null>('/api/users?currentUser=true');
};

export const logoutUser = (): Promise<void> => {
    return fetcher<void>('/api/auth', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' }),
    });
};

export const fetchAllUsers = (): Promise<Omit<User, 'password'>[]> => {
    return fetcher<Omit<User, 'password'>[]>('/api/users');
};

export const updateUserSubscription = (id: string, updates: { tier?: SubscriptionTier, subscriptionExpiresAt?: string | null, managedApiKeys?: string[] }): Promise<User> => {
    return fetcher<User>('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...updates }),
    });
};

export const deleteUser = (id: string): Promise<void> => {
    return fetcher<void>('/api/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
    });
};

export const reportTtsUsage = (characterCount: number): Promise<void> => {
    return fetcher<void>('/api/usage?type=tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterCount }),
    });
};