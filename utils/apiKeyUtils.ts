import { ApiKeyEntry } from '@/types';

/**
 * Validates an array of API key entries from storage.
 * It checks the date for each entry and resets the usage count if it's a new day.
 * @param pool The array of ApiKeyEntry objects, likely from localStorage.
 * @returns A validated and updated array of ApiKeyEntry objects.
 */
export const getValidatedApiKeyPool = (pool: ApiKeyEntry[]): ApiKeyEntry[] => {
    if (!Array.isArray(pool)) {
        return [];
    }

    // The quota day resets at approximately 15:00 Vietnam time (UTC+7), which is 08:00 UTC.
    // We adjust the current time by subtracting 8 hours to get the correct "quota day".
    const now = new Date();
    now.setUTCHours(now.getUTCHours() - 8);
    const quotaDayStr = now.toISOString().split('T')[0];


    return pool.map(entry => {
        // Basic validation for entry structure
        if (typeof entry !== 'object' || !entry.key || typeof entry.usage !== 'object') {
            return null;
        }

        if (entry.usage.date !== quotaDayStr) {
            // It's a new quota day, reset the count.
            return {
                ...entry,
                usage: {
                    count: 0,
                    date: quotaDayStr,
                },
            };
        }
        // It's the same day, return as is.
        return entry;
    }).filter((entry): entry is ApiKeyEntry => entry !== null); // Filter out any malformed entries
};