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

    const todayStr = new Date().toISOString().split('T')[0];

    return pool.map(entry => {
        // Basic validation for entry structure
        if (typeof entry !== 'object' || !entry.key || typeof entry.usage !== 'object') {
            return null;
        }

        if (entry.usage.date !== todayStr) {
            // It's a new day, reset the count.
            return {
                ...entry,
                usage: {
                    count: 0,
                    date: todayStr,
                },
            };
        }
        // It's the same day, return as is.
        return entry;
    }).filter((entry): entry is ApiKeyEntry => entry !== null); // Filter out any malformed entries
};
