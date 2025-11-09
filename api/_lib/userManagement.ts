import { createClient, VercelKV } from '@vercel/kv';
import { User, SubscriptionTier, Project } from './types.js';
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


// Helper to correctly parse a user object from KV's string-only hash values
const parseUserFromKv = (rawUser: Record<string, any> | null): User | null => {
    if (!rawUser) return null;
    try {
        const defaultUsage = { ttsCharacters: 0, usageDate: new Date().toISOString().split('T')[0] };
        // Manually construct the user object to ensure all types are correct,
        // preventing crashes from unexpected data types or missing fields.
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
            // Explicitly parse boolean and JSON strings from KV
            isAdmin: String(rawUser.isAdmin).toLowerCase() === 'true',
            usage: typeof rawUser.usage === 'string' ? JSON.parse(rawUser.usage) : defaultUsage,
            managedApiKeys: typeof rawUser.managedApiKeys === 'string' ? JSON.parse(rawUser.managedApiKeys) : [],
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
        // We throw here so the calling handler can catch it and return a proper error response.
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
            usageDate: new Date().toISOString().split('T')[0],
        },
    };

    // Explicitly convert complex/boolean types to strings before storing in KV hash.
    // This prevents data type mismatches between the application and the database.
    const userForKv: Record<string, any> = {
        ...newUser,
        isAdmin: String(newUser.isAdmin),
        usage: JSON.stringify(newUser.usage),
        managedApiKeys: JSON.stringify(newUser.managedApiKeys),
    };
    
    // Sanitize null values before sending to KV to prevent "ERR null args" error.
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

    const pipeline = kv.pipeline();
    userIds.forEach(id => pipeline.hgetall(`user:${id}`));
    const rawUsers = await pipeline.exec<Record<string, unknown>[]>();

    return rawUsers
        .map(rawUser => parseUserFromKv(rawUser))
        .filter((u): u is User => u !== null)
        .map(({ password, ...user }) => user);
}

export async function updateUser(id: string, updates: Partial<Omit<User, 'id' | 'password'>>): Promise<Omit<User, 'password'> | null> {
    const kv = getKv();
    const user = await findUserById(id);
    if (!user) {
        return null;
    }
    
    if (user.username === 'admin' && updates.isAdmin === false) {
        return null;
    }

    const updatedData = { ...user, ...updates };

    // Explicitly convert complex/boolean types to strings before storing in KV hash.
    const dataForKv: { [key: string]: any } = { ...updatedData };
    if (typeof dataForKv.isAdmin !== 'undefined') {
        dataForKv.isAdmin = String(dataForKv.isAdmin);
    }
     if (typeof dataForKv.usage !== 'undefined') {
        dataForKv.usage = JSON.stringify(dataForKv.usage);
    }
    if (typeof dataForKv.managedApiKeys !== 'undefined') {
        dataForKv.managedApiKeys = JSON.stringify(dataForKv.managedApiKeys);
    }

    // Sanitize null values before sending to KV to prevent "ERR null args" error.
    for (const key in dataForKv) {
        if (dataForKv[key] === null) {
            delete dataForKv[key];
        }
    }

    await kv.hset(`user:${id}`, dataForKv);

    const { password, ...updatedUser } = updatedData;
    return updatedUser;
}

export async function logTtsUsage(userId: string, characterCount: number): Promise<void> {
    const kv = getKv();
    const user = await findUserById(userId);
    if (user) {
        const todayStr = new Date().toISOString().split('T')[0];
        let currentUsage = user.usage || { ttsCharacters: 0, usageDate: todayStr };
        
        // Reset if it's a new day
        if (currentUsage.usageDate !== todayStr) {
            currentUsage = { ttsCharacters: 0, usageDate: todayStr };
        }

        const newCount = (currentUsage.ttsCharacters || 0) + characterCount;
        const newUsage = { ...currentUsage, ttsCharacters: newCount, usageDate: todayStr };
        await kv.hset(`user:${userId}`, { usage: JSON.stringify(newUsage) });
    }
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

// --- Project Management Functions ---

const PROJECTS_LIST_KEY = (userId: string) => `projects:${userId}`;
const PROJECT_KEY = (projectId: string) => `project:${projectId}`;

export async function getProjectsForUser(userId: string): Promise<Project[]> {
    const kv = getKv();
    const projectIds = await kv.smembers(PROJECTS_LIST_KEY(userId));
    if (!projectIds || projectIds.length === 0) return [];
    
    const pipeline = kv.pipeline();
    projectIds.forEach(id => pipeline.hgetall(PROJECT_KEY(id)));
    const results = await pipeline.exec<Record<string, any>[]>();

    return results.filter(p => p).map(p => p as Project).sort((a,b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function createProject(userId: string, data: { name: string, text: string, voice: string }): Promise<Project> {
    const kv = getKv();
    const now = new Date().toISOString();
    const projectId = `proj_${Date.now()}`;
    
    const newProject: Project = {
        id: projectId,
        userId,
        name: data.name,
        text: data.text,
        voice: data.voice,
        createdAt: now,
        updatedAt: now,
    };
    
    await kv.sadd(PROJECTS_LIST_KEY(userId), projectId);
    // FIX: Cast project object to a type with an index signature to satisfy kv.hset.
    await kv.hset(PROJECT_KEY(projectId), newProject as any);
    
    return newProject;
}

export async function deleteProject(userId: string, projectId: string): Promise<boolean> {
    const kv = getKv();
    const project = await kv.hgetall(PROJECT_KEY(projectId));

    if (!project || project.userId !== userId) {
        return false; // User does not own this project
    }

    await kv.del(PROJECT_KEY(projectId));
    await kv.srem(PROJECTS_LIST_KEY(userId), projectId);
    
    return true;
}