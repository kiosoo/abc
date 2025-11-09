import { apiHandler } from '../_lib/apiHandler.js';
import { findUserById } from '../_lib/userManagement.js';
import { generateSpeech } from '../_lib/geminiService.js';
import { decode, createWavBuffer, stitchPcmChunks } from '../_lib/audioUtils.js';
import { LONG_TEXT_CHUNK_SIZE, TIER_LIMITS } from '../../constants.js';

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

        // --- Daily character limit check ---
        const dailyLimit = TIER_LIMITS[user.tier];
        if (dailyLimit !== Infinity) {
            const todayStr = new Date().toISOString().split('T')[0];
            const usageData = user.usage || { ttsCharacters: 0, usageDate: todayStr };
            
            // If the usage date is not today, the usage is effectively 0 for today.
            const currentUsage = usageData.usageDate === todayStr ? usageData.ttsCharacters : 0;
            const requestedLength = text.length;
            
            if (currentUsage + requestedLength > dailyLimit) {
                const message = `Bạn đã sử dụng hết số ký tự trong ngày. Yêu cầu ${requestedLength.toLocaleString()} ký tự sẽ vượt quá giới hạn. (Đã dùng: ${currentUsage.toLocaleString()}/${dailyLimit.toLocaleString()})`;
                res.status(403).json({ message });
                return;
            }
        }
        // --- End of check ---

        if (!user.managedApiKeys || user.managedApiKeys.length === 0) {
            res.status(403).json({ message: 'Tài khoản của bạn chưa được cấu hình để sử dụng tính năng này. Vui lòng liên hệ quản trị viên.' });
            return;
        }

        try {
            const chunks: string[] = [];
            for (let i = 0; i < text.length; i += LONG_TEXT_CHUNK_SIZE) {
                chunks.push(text.substring(i, i + LONG_TEXT_CHUNK_SIZE));
            }
            
            const managedKeys = user.managedApiKeys;
            const numKeys = managedKeys.length;

            // Create a promise for each chunk, rotating through the available API keys.
            const speechPromises = chunks.map((chunk, index) => {
                const apiKey = managedKeys[index % numKeys];
                return generateSpeech(apiKey, chunk, voice).then(result => decode(result.base64Audio));
            });

            // Await all promises to resolve in parallel.
            const pcmChunks = await Promise.all(speechPromises);

            const combinedPcm = stitchPcmChunks(pcmChunks);
            const finalWavBuffer = createWavBuffer(combinedPcm);

            res.setHeader('Content-Type', 'audio/wav');
            res.setHeader('Content-Length', finalWavBuffer.length);
            res.send(finalWavBuffer);

        } catch (error) {
            const message = error instanceof Error ? error.message : 'Đã xảy ra lỗi không xác định khi tạo âm thanh.';
            console.error("Managed TTS Error:", message);
            res.status(500).json({ message });
        }
    }
});