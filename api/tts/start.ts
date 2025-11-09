

import { apiHandler } from '../_lib/apiHandler.js';
import { findUserById } from '../_lib/userManagement.js';
import { smartSplit } from '../_lib/textUtils.js';
import { createClient } from '@vercel/kv';
import { LONG_TEXT_CHUNK_SIZE } from '../../constants.js';

const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

export default apiHandler({
    POST: async (req, res, session) => {
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

        // Store job metadata and individual chunks in KV
        const pipeline = kv.pipeline();
        pipeline.hset(`job:${jobId}`, jobData);
        chunks.forEach((chunk, index) => {
            pipeline.set(`job:${jobId}:chunk:${index}`, chunk);
        });
        await pipeline.exec();

        // Asynchronously trigger worker functions for each chunk without awaiting response.
        // This is crucial to keep the start endpoint fast.
        const rootUrl = `https://${req.headers.host}`;
        // FIX: The `cookie` header can be an array of strings. Join it to a single string if it's an array.
        const cookieHeader = req.headers.cookie;
        const cookie = Array.isArray(cookieHeader) ? cookieHeader.join('; ') : cookieHeader || '';
        
        chunks.forEach((_, index) => {
            // We don't wait for these fetches to complete.
            // This is a "fire-and-forget" approach to kick off background jobs.
            fetch(`${rootUrl}/api/tts/process-chunk`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // Pass the original request's cookie to authenticate the worker.
                    'Cookie': cookie,
                },
                body: JSON.stringify({ jobId, chunkIndex: index }),
            }).catch(e => console.error(`Error triggering chunk processor for job ${jobId}, chunk ${index}:`, e));
        });

        res.status(202).json({ jobId, totalChunks: chunks.length });
    }
});