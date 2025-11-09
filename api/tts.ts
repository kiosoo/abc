import { apiHandler } from './_lib/apiHandler.js';
import { findUserById, updateUser } from './_lib/userManagement.js';
import { smartSplit } from './_lib/textUtils.js';
import { createClient } from '@vercel/kv';
import { LONG_TEXT_CHUNK_SIZE, TTS_DAILY_API_LIMIT } from '../src/constants.js';
import { ManagedApiKeyEntry } from './_lib/types.js';
import { generateSpeech, GeminiApiError } from './_lib/geminiService.js';
import { decode, createWavBuffer, stitchPcmChunks } from './_lib/audioUtils.js';

const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

const getQuotaDayString = () => {
    const now = new Date();
    now.setUTCHours(now.getUTCHours() - 8);
    return now.toISOString().split('T')[0];
};

async function handleStart(req, res, session) {
    if (!session.id) {
        res.status(401).json({ message: 'Chưa được xác thực' });
        return;
    }
    const user = await findUserById(session.id);
    if (!user) {
        res.status(404).json({ message: 'Không tìm thấy người dùng' });
        return;
    }
    const { text, voice } = req.body;
    if (!text) {
        res.status(400).json({ message: 'Yêu cầu nhập văn bản' });
        return;
    }
    const jobId = `tts_${user.id}_${Date.now()}`;
    const chunks = smartSplit(text, LONG_TEXT_CHUNK_SIZE);
    const jobData = {
        status: 'pending', // Client will drive the processing
        userId: user.id,
        totalChunks: chunks.length,
        voice: voice,
        createdAt: new Date().toISOString(),
    };
    const pipeline = kv.pipeline();
    pipeline.hset(`job:${jobId}`, jobData);
    chunks.forEach((chunk, index) => {
        pipeline.set(`job:${jobId}:chunk:${index}`, chunk);
    });
    await pipeline.exec();

    // The client will now be responsible for calling processSingleChunk for each chunk.
    res.status(201).json({ jobId, totalChunks: chunks.length });
}


async function handleProcessSingleChunk(req, res, session) {
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
            res.status(403).json({ message: 'Không tìm thấy người dùng hoặc key được quản lý.' });
            return;
        }
        const jobData = await kv.hgetall(`job:${jobId}`);
        if (!jobData) {
            res.status(404).json({ message: 'Không tìm thấy tác vụ' });
            return;
        }
        const chunkText = await kv.get(`job:${jobId}:chunk:${chunkIndex}`);
        if (!chunkText) {
            res.status(404).json({ message: `Không tìm thấy văn bản chunk` });
            return;
        }
        const todayQuotaStr = getQuotaDayString();
        let keyPool = (user.managedApiKeys || []).map(entry => {
            if (entry.usage.date !== todayQuotaStr) {
                return { ...entry, usage: { count: 0, date: todayQuotaStr } };
            }
            return entry;
        });
        
        if (keyPool.length === 0) {
            res.status(500).json({ message: 'Không có API key nào được cấu hình cho người dùng này.' });
            return;
        }

        let audioBase64 = null;
        let success = false;
        let errorMsg = 'Hết hạn ngạch trên tất cả các key hoặc đã xảy ra lỗi.';
        
        // Smarter key selection for parallel processing:
        // Start checking from an index based on the chunk number to distribute load.
        const startIndex = chunkIndex % keyPool.length;
        
        for (let i = 0; i < keyPool.length; i++) {
            const keyIndex = (startIndex + i) % keyPool.length;
            const keyEntry = keyPool[keyIndex];

            if (keyEntry.usage.count < TTS_DAILY_API_LIMIT) {
                try {
                    const result = await generateSpeech(keyEntry.key, chunkText as string, jobData.voice as string);
                    audioBase64 = result.base64Audio;
                    keyPool[keyIndex].usage.count++; // Increment usage
                    success = true;
                    break; // Found a working key, exit the loop
                } catch (e) {
                    if (e instanceof GeminiApiError && e.isQuotaError) {
                        keyPool[keyIndex].usage.count = TTS_DAILY_API_LIMIT; // Mark as exhausted for today
                    }
                    errorMsg = e instanceof Error ? e.message : String(e);
                    console.error(`Key ...${keyEntry.key.slice(-4)} failed for job ${jobId}, chunk ${chunkIndex}: ${errorMsg}`);
                    // Don't break; continue to try the next key
                }
            }
        }

        // Update the user's key usage state in the database.
        // NOTE: In a highly concurrent scenario, this read-modify-write operation
        // could have a race condition. For this app's scale, the risk is acceptable.
        await updateUser(user.id, { managedApiKeys: keyPool });
        
        if (success && audioBase64) {
             // Return the audio directly to the client
            res.status(200).json({ base64Audio: audioBase64, chunkIndex: chunkIndex });
        } else {
            res.status(500).json({ message: `Xử lý chunk ${chunkIndex} thất bại: ${errorMsg}`, chunkIndex: chunkIndex });
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : "Lỗi worker không xác định.";
        res.status(500).json({ message, chunkIndex: chunkIndex });
    }
}

async function handleCleanup(req, res, session) {
    if (!session.id) {
        res.status(401).json({ message: 'Chưa được xác thực' });
        return;
    }
    const { jobId } = req.body;
    if (!jobId || typeof jobId !== 'string') {
        res.status(400).json({ message: 'Yêu cầu jobId' });
        return;
    }
    const jobData = await kv.hgetall(`job:${jobId}`);
    if (!jobData || jobData.userId !== session.id) {
        res.status(403).json({ message: 'Không có quyền truy cập hoặc tác vụ không tồn tại' });
        return;
    }

    try {
        const totalChunks = Number(jobData.totalChunks);
        const keysToDelete = [
            `job:${jobId}`,
            ...Array.from({ length: totalChunks }, (_, i) => `job:${jobId}:chunk:${i}`)
        ];
        await kv.del(...keysToDelete);
        res.status(200).json({ message: 'Đã dọn dẹp tác vụ thành công' });
    } catch(error) {
        console.error(`Lỗi khi dọn dẹp job ${jobId}:`, error);
        const message = error instanceof Error ? error.message : "Lỗi không xác định khi dọn dẹp.";
        res.status(500).json({ message });
    }
}


export default apiHandler({
    POST: async (req, res, session) => {
        const { action } = req.query;
        switch (action) {
            case 'start':
                return handleStart(req, res, session);
            case 'processSingleChunk':
                return handleProcessSingleChunk(req, res, session);
            case 'cleanup':
                return handleCleanup(req, res, session);
            default:
                res.status(400).json({ message: 'Hành động không hợp lệ cho POST' });
                return;
        }
    },
});