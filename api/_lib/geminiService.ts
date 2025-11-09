import { GoogleGenAI, Modality } from "@google/genai";

// Define and export the custom error class to provide more context to the caller.
export class GeminiApiError extends Error {
    public isQuotaError: boolean;
    constructor(message: string, isQuotaError: boolean = false) {
        super(message);
        this.name = 'GeminiApiError';
        this.isQuotaError = isQuotaError;
    }
}

export const generateSpeech = async (
    apiKey: string, 
    text: string, 
    voice: string = 'Kore'
): Promise<{ base64Audio: string }> => {
    try {
        const ai = new GoogleGenAI({ apiKey });
        
        // Handle the 'auto' voice which is a UI-only value.
        // The API requires a specific voice name. 'Kore' is a good default.
        const effectiveVoice = (voice && voice.toLowerCase() !== 'auto') ? voice : 'Kore';

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

        const audioPart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        const base64Audio = audioPart?.inlineData?.data;

        if (!base64Audio) {
            // This is a valid scenario but results in no audio, throw a generic error.
            throw new GeminiApiError('Không thể tạo âm thanh từ API (phản hồi không chứa dữ liệu âm thanh).');
        }

        return { base64Audio };
    } catch (error) {
        console.error(`TTS API error with key ...${apiKey.slice(-4)}:`, error);
        const errorString = error.toString();
        
        if (errorString.includes('API key not valid')) {
            // This is a fatal, non-quota error for this key.
            throw new GeminiApiError(`API Key không hợp lệ: ...${apiKey.slice(-4)}`);
        }
        
        if (errorString.includes('RESOURCE_EXHAUSTED') || errorString.includes('429')) {
            // This is a specific quota error.
            throw new GeminiApiError(`Hạn ngạch API đã bị vượt quá cho key ...${apiKey.slice(-4)}.`, true);
        }
        
        const message = error instanceof Error ? error.message : 'Đã xảy ra lỗi không xác định.';
        // Any other error is treated as a general, non-quota failure.
        throw new GeminiApiError(`Tổng hợp giọng nói thất bại: ${message}`);
    }
};