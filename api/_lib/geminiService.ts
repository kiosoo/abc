import { GoogleGenAI, Modality } from "@google/genai";

export const generateSpeech = async (
    apiKey: string, 
    text: string, 
    voice: string = 'Kore'
): Promise<{ base64Audio: string }> => {
    try {
        const ai = new GoogleGenAI({ apiKey });
        
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: voice },
                    },
                },
            },
        });

        const audioPart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        const base64Audio = audioPart?.inlineData?.data;

        if (!base64Audio) {
            throw new Error('Không thể tạo âm thanh từ API.');
        }

        return { base64Audio };
    } catch (error) {
        console.error(`TTS API error with key ...${apiKey.slice(-4)}:`, error);
        const errorString = error.toString();
        if (errorString.includes('API key not valid')) {
            throw new Error(`API Key không hợp lệ: ...${apiKey.slice(-4)}`);
        }
        if (errorString.includes('RESOURCE_EXHAUSTED') || errorString.includes('429')) {
            throw new Error(`Hạn ngạch API đã bị vượt quá cho key ...${apiKey.slice(-4)}.`);
        }
        const message = error instanceof Error ? error.message : 'Đã xảy ra lỗi không xác định.';
        throw new Error(`Tổng hợp giọng nói thất bại: ${message}`);
    }
};
