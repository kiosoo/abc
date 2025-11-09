
import { apiHandler } from '../_lib/apiHandler.js';
import { createClient } from '@vercel/kv';

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

        if (!jobData) {
            res.status(404).json({ message: 'Không tìm thấy tác vụ' });
            return;
        }

        // Security check: ensure the user requesting status owns the job.
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
});
