import { GoogleGenAI, Modality } from '@google/genai';
import type { VercelRequest, VercelResponse } from './_lib/types.js';

export default async function ttsHandler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ message: `Phương thức ${req.method} không được phép` });
    }

    const { text, voice } = req.body;

    if (!text) {
        return res.status(400).json({ message: 'Yêu cầu nhập văn bản để tổng hợp giọng nói.' });
    }

    try {
        const apiKey = process.env.API_KEY;
        if (!apiKey) {
            console.error('API_KEY environment variable not set on server.');
            return res.status(500).json({ message: 'API key chưa được cấu hình trên máy chủ.' });
        }
        
        const ai = new GoogleGenAI({ apiKey });

        // Handle the 'auto' voice which is a UI-only value.
        // The API requires a specific voice name. 'Kore' is a good default.
        const effectiveVoice = (voice && String(voice).toLowerCase() !== 'auto') ? voice : 'Kore';

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: effectiveVoice },
                    },
                },
            },
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) {
            return res.status(500).json({ message: 'Không thể tạo âm thanh từ API.' });
        }

        res.status(200).json({ audioContent: base64Audio });
    } catch (error) {
        console.error('TTS API error:', error);
        const message = error instanceof Error ? error.message : 'Đã xảy ra lỗi không xác định.';
        res.status(500).json({ message: `Tổng hợp giọng nói thất bại: ${message}` });
    }
}