import { createClient, VercelKV } from '@vercel/kv';
import { User, SubscriptionTier, ManagedApiKeyEntry } from './types.js';
import { ADMIN_USER_SEED } from './users.js';

let kv: VercelKV | null = null;

// Lazy-initialized KV client to prevent module-level crashes on Vercel.
// The client is created only on the first database access within a request.
function getKv(): VercelKV {
    if (kv) {
        return kv;
    }

    const kvUrl = process.env.KV_REST_API_URL;
    const kvToken = process.env.KV_REST_API_TOKEN;

    if (!kvUrl || !kvToken) {
        // This error will be thrown within an API handler's try/catch block,
        // allowing a proper JSON error response instead of a platform crash.
        throw new Error("Server configuration error: Missing KV_REST_API_URL or KV_REST_API_TOKEN.");
    }

    try {
        kv = createClient({
            url: kvUrl,
            token: kvToken,
        });
        return kv;
    } catch (e) {
        console.error("Fatal error initializing KV client:", e);
        // Re-throw to ensure the API handler catches it and returns a 500 error.
        throw new Error("Failed to connect to the database.");
    }
}

const getQuotaDayString = () => {
    const now = new Date();
    now.setUTCHours(now.getUTCHours() - 8);
    return now.toISOString().split('T')[0];
};

// Helper to correctly parse a user object from KV's string-only hash values
const parseUserFromKv = (rawUser: Record<string, any> | null): User | null => {
    if (!rawUser) return null;
    try {
        const defaultUsage = { ttsCharacters: 0, ttsRequests: 0, usageDate: new Date().toISOString().split('T')[0] };
        
        let parsedUsage = defaultUsage;
        if (typeof rawUser.usage === 'string') {
            try {
                const tempUsage = JSON.parse(rawUser.usage);
                parsedUsage = { ...defaultUsage, ...tempUsage };
            } catch (e) { /* use default if parsing fails */ }
        }

        let parsedManagedApiKeys: ManagedApiKeyEntry[] = [];
        const rawKeys = rawUser.managedApiKeys;
        const quotaDayStr = getQuotaDayString();
        
        if (typeof rawKeys === 'string') {
            try {
                const parsed = JSON.parse(rawKeys);
                if (Array.isArray(parsed)) {
                    // Check if it's the old format (string[]) or new format (ManagedApiKeyEntry[])
                    if (parsed.length > 0 && typeof parsed[0] === 'string') {
                        // Old format: Convert string[] to ManagedApiKeyEntry[], initialize usage
                        parsedManagedApiKeys = parsed.map(key => ({
                            key,
                            usage: { count: 0, date: quotaDayStr }
                        }));
                    } else if (parsed.length > 0 && typeof parsed[0] === 'object') {
                        // New format, initialize usage for display. Actual usage is fetched separately.
                        parsedManagedApiKeys = parsed.filter(item => typeof item.key === 'string').map(item => ({
                            ...item,
                            usage: { count: 0, date: quotaDayStr }
                        }));
                    }
                }
            } catch (e) {
                console.warn('Could not parse managedApiKeys from string, defaulting to empty array.', rawKeys);
            }
        } else if (Array.isArray(rawKeys)) {
            // Handle case where @vercel/kv might have auto-parsed the JSON string.
             if (rawKeys.length > 0 && typeof rawKeys[0] === 'object') {
                parsedManagedApiKeys = rawKeys.filter(item => typeof item.key === 'string').map(item => ({
                    ...item,
                    usage: { count: 0, date: quotaDayStr }
                }));
             }
        }

        const user: User = {
            id: rawUser.id,
            username: rawUser.username,
            password: rawUser.password,
            firstName: rawUser.firstName,
            lastName: rawUser.lastName,
            tier: rawUser.tier as SubscriptionTier,
            subscriptionExpiresAt: rawUser.subscriptionExpiresAt || null,
            createdAt: rawUser.createdAt,
            lastLoginAt: rawUser.lastLoginAt || null,
            ipAddress: rawUser.ipAddress || null,
            activeSessionToken: rawUser.activeSessionToken || null,
            isAdmin: String(rawUser.isAdmin).toLowerCase() === 'true',
            usage: parsedUsage,
            managedApiKeys: parsedManagedApiKeys,
        };
        return user;
    } catch (e) {
        console.error("Failed to parse user from KV:", rawUser, e);
        return null;
    }
}

export const ensureAdminExists = async () => {
    const kv = getKv();
    try {
        const adminId: string | null = await kv.get('username:admin');
        if (!adminId) {
            console.log("Admin user not found, creating one...");
            const adminData = { ...ADMIN_USER_SEED };
            await createUser(adminData, 'system');
            console.log("Admin user created.");
        }
    } catch (error) {
        console.error("KV Error: Failed to ensure admin user exists. This might be a transient connection issue.", error);
        throw new Error("Failed to verify system admin user. Database might be unreachable.");
    }
};

export async function findUserByUsername(username: string): Promise<User | null> {
    const kv = getKv();
    const userId: string | null = await kv.get(`username:${username}`);
    if (!userId) {
        return null;
    }
    return await findUserById(userId);
}

export async function findUserById(id: string): Promise<User | null> {
    const kv = getKv();
    const rawUser = await kv.hgetall(`user:${id}`);
    return parseUserFromKv(rawUser);
}

export async function createUser(userData: Partial<Omit<User, 'id'>> & Pick<User, 'username' | 'firstName' | 'lastName'>, ipAddress: string | null): Promise<User> {
    const kv = getKv();
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 30);
    const now = new Date().toISOString();
    const userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const newUserTier = userData.tier || SubscriptionTier.BASIC;

    const newUser: User = {
        ...userData,
        id: userId,
        isAdmin: userData.isAdmin || false,
        tier: newUserTier,
        subscriptionExpiresAt: newUserTier === SubscriptionTier.BASIC
            ? null
            : (userData.subscriptionExpiresAt !== undefined ? userData.subscriptionExpiresAt : trialEndDate.toISOString()),
        createdAt: now,
        lastLoginAt: now,
        ipAddress: ipAddress,
        activeSessionToken: null,
        managedApiKeys: [],
        usage: {
            ttsCharacters: 0,
            ttsRequests: 0,
            usageDate: new Date().toISOString().split('T')[0],
        },
    };

    const userForKv: Record<string, any> = {
        ...newUser,
        isAdmin: String(newUser.isAdmin),
        usage: JSON.stringify(newUser.usage),
        managedApiKeys: JSON.stringify(newUser.managedApiKeys),
    };
    
    for (const key in userForKv) {
        if (userForKv[key] === null) {
            delete userForKv[key];
        }
    }

    await kv.hset(`user:${userId}`, userForKv);
    await kv.set(`username:${newUser.username}`, userId);
    await kv.sadd('users', userId);

    return newUser;
}

export async function getAllUsers(): Promise<Omit<User, 'password'>[]> {
    const kv = getKv();
    const userIds = await kv.smembers('users');
    if (!userIds || userIds.length === 0) return [];

    const userPipeline = kv.pipeline();
    userIds.forEach(id => userPipeline.hgetall(`user:${id}`));
    const rawUsers = await userPipeline.exec<Record<string, unknown>[]>();

    const users = rawUsers
        .map(rawUser => parseUserFromKv(rawUser))
        .filter((u): u is User => u !== null);

    // --- Fetch managed key usage in a second pipeline for efficiency ---
    const todayQuotaStr = getQuotaDayString();
    const usagePipeline = kv.pipeline();
    const usersWithManagedKeys: number[] = []; // Store indices of users to update

    users.forEach((user, index) => {
        if (user.managedApiKeys && user.managedApiKeys.length > 0) {
            usagePipeline.hgetall(`keyusage:${user.id}:${todayQuotaStr}`);
            usersWithManagedKeys.push(index);
        }
    });

    if (usersWithManagedKeys.length > 0) {
        const usageData = await usagePipeline.exec<Record<string, number>[]>();
        
        usersWithManagedKeys.forEach((userIndex, i) => {
            const user = users[userIndex];
            const keyUsages = usageData[i] || {};
            
            if (user.managedApiKeys) {
                user.managedApiKeys = user.managedApiKeys.map(keyEntry => ({
                    ...keyEntry,
                    usage: {
                        count: keyUsages[keyEntry.key] || 0,
                        date: todayQuotaStr
                    }
                }));
            }
        });
    }

    return users.map(({ password, ...user }) => user);
}

export async function updateUser(id: string, updates: Partial<Omit<User, 'id' | 'password'>> & { managedApiKeys?: string[] | ManagedApiKeyEntry[] }): Promise<Omit<User, 'password'> | null> {
    const kv = getKv();
    const currentUser = await findUserById(id);
    if (!currentUser) {
        return null;
    }
    
    if (currentUser.username === 'admin' && updates.isAdmin === false) {
        return null;
    }
    
    const updatesForKv: { [key: string]: any } = {};

    for (const key in updates) {
        if (key !== 'managedApiKeys' && Object.prototype.hasOwnProperty.call(updates, key)) {
            const value = updates[key as keyof typeof updates];
            if (value === null) {
                await kv.hdel(`user:${id}`, key);
            } else if (value !== undefined) {
                 if (key === 'isAdmin') {
                    updatesForKv[key] = String(value);
                } else if (key === 'usage') {
                    updatesForKv[key] = JSON.stringify(value);
                } else {
                    updatesForKv[key] = value;
                }
            }
        }
    }
    
    if (updates.managedApiKeys) {
        // The list from the admin panel is the source of truth.
        // We just store the key, not the usage data, on the user object.
        const newManagedApiEntries = (updates.managedApiKeys as string[]).map(key => ({ key }));
        updatesForKv.managedApiKeys = JSON.stringify(newManagedApiEntries);
    }
    
    if (Object.keys(updatesForKv).length > 0) {
        await kv.hset(`user:${id}`, updatesForKv);
    }
    
    const updatedUserFromDb = await findUserById(id);
    if (!updatedUserFromDb) {
        throw new Error("Failed to retrieve user after update.");
    }
    
    const { password, ...userToReturn } = updatedUserFromDb;
    return userToReturn;
}


export async function logTtsUsage(userId: string, characterCount: number, requestCount: number): Promise<User['usage'] | null> {
    const kv = getKv();
    const user = await findUserById(userId);
    if (user) {
        const todayStr = new Date().toISOString().split('T')[0];
        let currentUsage = user.usage || { ttsCharacters: 0, ttsRequests: 0, usageDate: todayStr };
        
        if (currentUsage.usageDate !== todayStr) {
            currentUsage = { ttsCharacters: 0, ttsRequests: 0, usageDate: todayStr };
        }

        const newCount = (currentUsage.ttsCharacters || 0) + characterCount;
        const newRequests = (currentUsage.ttsRequests || 0) + requestCount;
        const newUsage = { ...currentUsage, ttsCharacters: newCount, ttsRequests: newRequests, usageDate: todayStr };
        await kv.hset(`user:${userId}`, { usage: JSON.stringify(newUsage) });
        return newUsage;
    }
    return null;
}

export async function deleteUser(id: string): Promise<boolean> {
    const kv = getKv();
    const user = await findUserById(id);
    if (!user || user.username === 'admin') {
        return false;
    }
    await kv.del(`user:${id}`);
    await kv.del(`username:${user.username}`);
    await kv.srem('users', id);
    return true;
}