import { createClient, VercelKV } from '@vercel/kv';
import { BugReport } from './types.js';

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
        throw new Error("Server configuration error: Missing KV credentials for bug reports.");
    }
    
    try {
        kv = createClient({
            url: kvUrl,
            token: kvToken,
        });
        return kv;
    } catch (e) {
        console.error("Fatal error initializing bug report KV client:", e);
        // Re-throw to ensure the API handler catches it and returns a 500 error.
        throw new Error("Failed to connect to the bug report database.");
    }
}


const BUG_REPORTS_KEY = 'bug_reports';

/**
 * Creates and stores a new bug report in Vercel KV.
 * @param userId - The ID of the user submitting the report.
 * @param username - The username of the user.
 * @param message - The content of the bug report.
 * @returns The newly created bug report object.
 */
export async function createBugReport(userId: string, username: string, message: string): Promise<BugReport> {
    const kv = getKv();
    const newReport: BugReport = {
        id: `bug_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        userId,
        username,
        message,
        createdAt: new Date().toISOString(),
    };
    // Add to the beginning of the list so newest reports appear first.
    await kv.lpush(BUG_REPORTS_KEY, JSON.stringify(newReport)); 
    return newReport;
}

/**
 * Retrieves all stored bug reports from Vercel KV.
 * @returns An array of all bug reports.
 */
export async function getAllBugReports(): Promise<BugReport[]> {
    const kv = getKv();
    // Fetch all items from the list. For very large lists, consider pagination.
    const rawReports = await kv.lrange(BUG_REPORTS_KEY, 0, -1);
    
    // The @vercel/kv client may automatically parse JSON strings from lists,
    // returning objects. This code handles both strings and pre-parsed objects
    // to prevent JSON parsing errors.
    return rawReports.map(report => {
        if (typeof report === 'string') {
            try {
                return JSON.parse(report);
            } catch (e) {
                console.error('Could not parse bug report from KV, it might be corrupted:', report);
                return null;
            }
        }
        return report as BugReport;
    }).filter((r): r is BugReport => r !== null);
}