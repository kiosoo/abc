import { apiHandler } from './_lib/apiHandler.js';
import { findUserById, updateUser } from './_lib/userManagement.js';
import { smartSplit } from './_lib/textUtils.js';
import { createClient } from '@vercel/kv';
import { LONG_TEXT_CHUNK_SIZE, TTS_DAILY_API_LIMIT } from '../constants.js';
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
        status: 'processing',
        userId: user.id,
        totalChunks: chunks.length,
        processedChunks: 0,
        voice: voice,
        createdAt: new Date().toISOString(),
    };
    const pipeline = kv.pipeline();
    pipeline.hset(`job:${jobId}`, jobData);
    chunks.forEach((chunk, index) => {
        pipeline.set(`job:${jobId}:chunk:${index}`, chunk);
    });
    await pipeline.exec();
    const rootUrl = `https://${req.headers.host}`;
    const cookieHeader = req.headers.cookie;
    const cookie = Array.isArray(cookieHeader) ? cookieHeader.join('; ') : cookieHeader || '';
    chunks.forEach((_, index) => {
        fetch(`${rootUrl}/api/tts?action=process`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': cookie,
            },
            body: JSON.stringify({ jobId, chunkIndex: index }),
        }).catch(e => console.error(`Error triggering chunk processor for job ${jobId}, chunk ${index}:`, e));
    });
    res.status(202).json({ jobId, totalChunks: chunks.length });
}

async function handleProcessChunk(req, res, session) {
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
        const jobData = await kv.hgetall(`job:${jobId}`);
        if (!jobData) {
            res.status(404).json({ message: 'Không tìm thấy tác vụ' });
            return;
        }
        const chunkText = await kv.get(`job:${jobId}:chunk:${chunkIndex}`);
        if (!chunkText) {
            await kv.hset(`job:${jobId}`, { status: 'failed', error: `Không tìm thấy văn bản cho chunk ${chunkIndex}` });
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
        let audioBase64 = null;
        let success = false;
        let errorMsg = 'Hết hạn ngạch trên tất cả các key.';
        for (let i = 0; i < keyPool.length; i++) {
            const keyEntry = keyPool[i];
            if (keyEntry.usage.count < TTS_DAILY_API_LIMIT) {
                try {
                    const result = await generateSpeech(keyEntry.key, chunkText as string, jobData.voice as string);
                    audioBase64 = result.base64Audio;
                    keyPool[i].usage.count++;
                    success = true;
                    break;
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

async function handleStatus(req, res, session) {
    if (!session.id) {
        res.status(401).json({ message: 'Chưa được xác thực' });
        return;
    }
    const { jobId } = req.query;
    if (!jobId || typeof jobId !== 'string') {
        res.status(400).json({ message: 'Yêu cầu jobId' });
        return;
    }
    const jobData = await kv.hgetall(`job:${jobId}`);
    if (!jobData) {
        res.status(404).json({ message: 'Không tìm thấy tác vụ' });
        return;
    }
    if (jobData.userId !== session.id) {
        res.status(403).json({ message: 'Không có quyền truy cập' });
        return;
    }
    res.status(200).json({
        status: jobData.status,
        totalChunks: jobData.totalChunks,
        processedChunks: jobData.processedChunks,
        error: jobData.error || null,
    });
}

async function handleResult(req, res, session) {
     if (!session.id) {
        res.status(401).json({ message: 'Chưa được xác thực' });
        return;
    }
    const { jobId } = req.query;
    if (!jobId || typeof jobId !== 'string') {
        res.status(400).json({ message: 'Yêu cầu jobId' });
        return;
    }
    const jobData = await kv.hgetall(`job:${jobId}`);
    if (!jobData || jobData.userId !== session.id) {
        res.status(403).json({ message: 'Không có quyền truy cập hoặc tác vụ không tồn tại' });
        return;
    }

    const totalChunks = Number(jobData.totalChunks);
    const processedChunks = Number(jobData.processedChunks);

    if (jobData.status === 'failed' || processedChunks < totalChunks) {
        res.status(409).json({ message: `Tác vụ chưa hoàn tất hoặc đã thất bại. Trạng thái: ${jobData.status}` });
        return;
    }
    
    try {
        const chunkKeys = Array.from({ length: totalChunks }, (_, i) => `job:${jobId}:result:${i}`);
        const base64Results = await kv.mget<string[]>(...chunkKeys);

        const pcmChunks: Uint8Array[] = [];
        for (const base64Audio of base64Results) {
            if (!base64Audio) {
                throw new Error("Dữ liệu chunk âm thanh bị thiếu trong cơ sở dữ liệu.");
            }
            pcmChunks.push(decode(base64Audio));
        }

        const combinedPcm = stitchPcmChunks(pcmChunks);
        const finalWavBuffer = createWavBuffer(combinedPcm);
        const keysToDelete = [
            `job:${jobId}`,
            ...Array.from({ length: totalChunks }, (_, i) => `job:${jobId}:chunk:${i}`),
            ...chunkKeys
        ];
        await kv.del(...keysToDelete);
        res.setHeader('Content-Type', 'audio/wav');
        res.setHeader('Content-Length', finalWavBuffer.length);
        res.send(finalWavBuffer);
    } catch (error) {
        console.error(`Lỗi khi ghép kết quả cho job ${jobId}:`, error);
        const message = error instanceof Error ? error.message : "Lỗi không xác định khi xử lý kết quả.";
        res.status(500).json({ message });
    }
}


export default apiHandler({
    POST: async (req, res, session) => {
        const { action } = req.query;
        switch (action) {
            case 'start':
                return handleStart(req, res, session);
            case 'process':
                return handleProcessChunk(req, res, session);
            default:
                res.status(400).json({ message: 'Hành động không hợp lệ cho POST' });
                return;
        }
    },
    GET: async (req, res, session) => {
        const { action } = req.query;
        switch (action) {
            case 'status':
                return handleStatus(req, res, session);
            case 'result':
                return handleResult(req, res, session);
            default:
                res.status(400).json({ message: 'Hành động không hợp lệ cho GET' });
                return;
        }
    }
});