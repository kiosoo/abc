import { apiHandler } from '../_lib/apiHandler.js';
import { findUserById, updateUser } from '../_lib/userManagement.js';
import { generateSpeech, GeminiApiError } from '../_lib/geminiService.js';
import { decode, createWavBuffer, stitchPcmChunks } from '../_lib/audioUtils.js';
import { LONG_TEXT_CHUNK_SIZE, TIER_LIMITS, TTS_DAILY_API_LIMIT } from '../../constants.js';
import { ManagedApiKeyEntry } from '../_lib/types.js';

// Helper to get the current "quota day" string.
// Quota resets at 00:00 PST, which is 08:00 UTC. We adjust for this.
const getQuotaDayString = () => {
    const now = new Date();
    now.setUTCHours(now.getUTCHours() - 8);
    return now.toISOString().split('T')[0];
};

export default apiHandler({
    POST: async (req, res, session) => {
        if (!session.id) {
            // FIX: Add a void return to match the ApiHandler's expected `Promise<void>` signature.
            res.status(401).json({ message: 'Chưa được xác thực' });
            return;
        }

        const user = await findUserById(session.id);
        if (!user) {
            // FIX: Add a void return.
            res.status(404).json({ message: 'Không tìm thấy người dùng' });
            return;
        }
        
        const { text, voice } = req.body;
        if (!text) {
            // FIX: Add a void return.
            res.status(400).json({ message: 'Yêu cầu nhập văn bản' });
            return;
        }

        // Daily character limit check
        const dailyLimit = TIER_LIMITS[user.tier];
        if (dailyLimit !== Infinity) {
            const todayStr = new Date().toISOString().split('T')[0];
            const usageData = user.usage || { ttsCharacters: 0, usageDate: todayStr };
            const currentUsage = usageData.usageDate === todayStr ? usageData.ttsCharacters : 0;
            if (currentUsage + text.length > dailyLimit) {
                 const message = `Yêu cầu ${text.length.toLocaleString()} ký tự sẽ vượt quá giới hạn hàng ngày của bạn. (Đã dùng: ${currentUsage.toLocaleString()}/${dailyLimit.toLocaleString()})`;
                // FIX: Add a void return.
                res.status(403).json({ message });
                return;
            }
        }

        if (!user.managedApiKeys || user.managedApiKeys.length === 0) {
            // FIX: Add a void return.
            res.status(403).json({ message: 'Tài khoản của bạn chưa được cấu hình. Vui lòng liên hệ quản trị viên.' });
            return;
        }

        // --- Start of new persistent quota logic ---
        const todayQuotaStr = getQuotaDayString();
        let hasChanges = false;
        
        // 1. Validate and reset daily quotas for the key pool
        const keyPool: ManagedApiKeyEntry[] = (user.managedApiKeys || []).map(entry => {
            if (entry.usage.date !== todayQuotaStr) {
                hasChanges = true; // Mark that we need to save this reset
                return {
                    ...entry,
                    usage: { count: 0, date: todayQuotaStr }
                };
            }
            return entry;
        });
        
        // A mutable copy for this request's processing
        const transientPool = JSON.parse(JSON.stringify(keyPool));

        try {
            const chunks: string[] = [];
            for (let i = 0; i < text.length; i += LONG_TEXT_CHUNK_SIZE) {
                chunks.push(text.substring(i, i + LONG_TEXT_CHUNK_SIZE));
            }
            
            const pcmChunks: Uint8Array[] = [];
            
            for (const chunk of chunks) {
                let chunkProcessed = false;
                let lastError: Error | null = null;
                
                // Find the first available key
                const keyEntryIndex = transientPool.findIndex((entry: ManagedApiKeyEntry) => entry.usage.count < TTS_DAILY_API_LIMIT);
                
                if (keyEntryIndex === -1) {
                    throw new Error("Tất cả các API key có sẵn đều đã hết hạn ngạch cho hôm nay.");
                }

                // Try available keys in order until one succeeds or all fail
                for (let i = keyEntryIndex; i < transientPool.length; i++) {
                    const keyEntry = transientPool[i];

                    if (keyEntry.usage.count >= TTS_DAILY_API_LIMIT) {
                        continue; // Skip already exhausted keys
                    }
                    
                    try {
                        const { base64Audio } = await generateSpeech(keyEntry.key, chunk, voice);
                        pcmChunks.push(decode(base64Audio));
                        keyEntry.usage.count++; // Increment usage on success
                        chunkProcessed = true;
                        break; // Success, move to the next chunk
                    } catch (error) {
                        lastError = error as Error;
                        console.warn(`Key ...${keyEntry.key.slice(-4)} failed: ${lastError.message}`);
                        if (error instanceof GeminiApiError && error.isQuotaError) {
                            keyEntry.usage.count = TTS_DAILY_API_LIMIT; // Mark as exhausted for the day
                        }
                    }
                }
                
                if (!chunkProcessed) {
                     const finalErrorMessage = lastError ? lastError.message : "Tất cả các API key có sẵn đều không thành công.";
                    throw new Error(`Không thể xử lý một phần văn bản. Lỗi cuối cùng: ${finalErrorMessage}`);
                }
            }

            const combinedPcm = stitchPcmChunks(pcmChunks);
            const finalWavBuffer = createWavBuffer(combinedPcm);

            res.setHeader('Content-Type', 'audio/wav');
            res.setHeader('Content-Length', finalWavBuffer.length);
            res.send(finalWavBuffer);

        } catch (error) {
            const message = error instanceof Error ? error.message : 'Đã xảy ra lỗi không xác định khi tạo âm thanh.';
            console.error("Managed TTS Error:", message);
            // FIX: Add a void return.
            res.status(500).json({ message });
            return;
        } finally {
            // 3. Persist the updated usage counts back to the database
            await updateUser(user.id, { managedApiKeys: transientPool });
        }
    }
});