
import { apiHandler } from '../_lib/apiHandler.js';
import { createClient } from '@vercel/kv';
import { decode, createWavBuffer, stitchPcmChunks } from '../_lib/audioUtils.js';

const kv = createClient({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
});

export default apiHandler({
    GET: async (req, res, session) => {
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
        
        if (jobData.status !== 'processing' && jobData.status !== 'completed' && Number(jobData.processedChunks) !== Number(jobData.totalChunks)) {
            res.status(409).json({ message: `Tác vụ chưa hoàn tất hoặc đã thất bại. Trạng thái: ${jobData.status}` });
            return;
        }
        
        const totalChunks = Number(jobData.totalChunks);
        const pcmChunks: Uint8Array[] = [];

        try {
            const chunkKeys = Array.from({ length: totalChunks }, (_, i) => `job:${jobId}:result:${i}`);
            const base64Results = await kv.mget<string[]>(...chunkKeys);

            for (const base64Audio of base64Results) {
                if (!base64Audio) {
                    throw new Error("Dữ liệu chunk âm thanh bị thiếu trong cơ sở dữ liệu.");
                }
                pcmChunks.push(decode(base64Audio));
            }

            const combinedPcm = stitchPcmChunks(pcmChunks);
            const finalWavBuffer = createWavBuffer(combinedPcm);

            // Clean up job data from KV after successful retrieval
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
});
