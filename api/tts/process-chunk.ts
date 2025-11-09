
import { apiHandler } from '../_lib/apiHandler.js';
import { findUserById, updateUser } from '../_lib/userManagement.js';
import { generateSpeech, GeminiApiError } from '../_lib/geminiService.js';
import { createClient } from '@vercel/kv';
import { ManagedApiKeyEntry } from '../_lib/types.js';
import { TTS_DAILY_API_LIMIT } from '../../constants.js';

const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

const getQuotaDayString = () => {
    const now = new Date();
    now.setUTCHours(now.getUTCHours() - 8);
    return now.toISOString().split('T')[0];
};

export default apiHandler({
    POST: async (req, res, session) => {
        if (!session.id) {
            res.status(401).json({ message: 'Worker không được xác thực' });
            return;
        }

        const { jobId, chunkIndex } = req.body;
        if (!jobId || typeof chunkIndex !== 'number') {
            res.status(400).json({ message: 'Thiếu jobId hoặc chunkIndex' });
            return;
        }

        try {
            const user = await findUserById(session.id);
            if (!user || !user.managedApiKeys || user.managedApiKeys.length === 0) {
                 await kv.hset(`job:${jobId}`, { status: 'failed', error: 'Không tìm thấy người dùng hoặc key được quản lý.' });
                 res.status(403).json({ message: 'Không có quyền' });
                 return;
            }

            const jobData: any = await kv.hgetall(`job:${jobId}`);
            if (!jobData) {
                 res.status(404).json({ message: 'Không tìm thấy tác vụ' });
                 return;
            }

            const chunkText: string | null = await kv.get(`job:${jobId}:chunk:${chunkIndex}`);
            if (!chunkText) {
                await kv.hset(`job:${jobId}`, { status: 'failed', error: `Không tìm thấy văn bản cho chunk ${chunkIndex}` });
                res.status(404).json({ message: `Không tìm thấy văn bản chunk` });
                return;
            }
            
            const todayQuotaStr = getQuotaDayString();
            let keyPool: ManagedApiKeyEntry[] = (user.managedApiKeys || []).map(entry => {
                if (entry.usage.date !== todayQuotaStr) {
                    return { ...entry, usage: { count: 0, date: todayQuotaStr } };
                }
                return entry;
            });
            
            let audioBase64: string | null = null;
            let success = false;
            let errorMsg = 'Hết hạn ngạch trên tất cả các key.';

            for (let i = 0; i < keyPool.length; i++) {
                const keyEntry = keyPool[i];
                if (keyEntry.usage.count < TTS_DAILY_API_LIMIT) {
                    try {
                        const result = await generateSpeech(keyEntry.key, chunkText, jobData.voice);
                        audioBase64 = result.base64Audio;
                        keyPool[i].usage.count++; // Increment usage on success
                        success = true;
                        break; // Exit loop on success
                    } catch (e) {
                         if (e instanceof GeminiApiError && e.isQuotaError) {
                            keyPool[i].usage.count = TTS_DAILY_API_LIMIT;
                         }
                         errorMsg = e instanceof Error ? e.message : String(e);
                         console.error(`Key ...${keyEntry.key.slice(-4)} failed for job ${jobId}, chunk ${chunkIndex}: ${errorMsg}`);
                    }
                }
            }

            if (success && audioBase64) {
                await kv.set(`job:${jobId}:result:${chunkIndex}`, audioBase64);
                await kv.hincrby(`job:${jobId}`, 'processedChunks', 1);
            } else {
                 await kv.hset(`job:${jobId}`, { status: 'failed', error: `Xử lý chunk ${chunkIndex} thất bại: ${errorMsg}` });
            }
            
            await updateUser(user.id, { managedApiKeys: keyPool });

            res.status(200).json({ success });

        } catch (error) {
            const message = error instanceof Error ? error.message : "Lỗi worker không xác định.";
            await kv.hset(`job:${jobId}`, { status: 'failed', error: message });
            res.status(500).json({ message });
        }
    }
});
