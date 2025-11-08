import { GoogleGenAI, Modality, GenerateContentResponse } from "@google/genai";
import { TimedWord } from '@/types';

// --- Centralized AI Client Management ---
let aiInstance: GoogleGenAI | null = null;
let currentApiKey: string | null = null;

/**
 * Gets a cached instance of the GoogleGenAI client.
 * Creates a new instance only if the API key changes.
 * @param apiKey The user's API key.
 * @returns An initialized GoogleGenAI instance.
 */
const getAiClient = (apiKey: string): GoogleGenAI => {
    if (!aiInstance || apiKey !== currentApiKey) {
        if (!apiKey) {
            throw new Error('API Key is required to initialize the AI Client.');
        }
        aiInstance = new GoogleGenAI({ apiKey });
        currentApiKey = apiKey;
    }
    return aiInstance;
};
// --- End of AI Client Management ---

/**
 * Finds timed words from the API response. The SDK may attach this data
 * in a non-standard way, so this function defensively checks for it.
 * @param response The response from the generateContent call.
 * @returns An array of TimedWord objects or null if not found.
 */
const findTimedWords = (response: GenerateContentResponse): TimedWord[] | null => {
    const candidate = response.candidates?.[0];
    if (!candidate?.content?.parts) return null;
    
    for (const part of candidate.content.parts) {
        // The SDK might attach it directly to the part object
        if ((part as any).timedWords) {
            return (part as any).timedWords;
        }
    }
    return null;
}


export const generateContent = async (apiKey: string, prompt: string, isThinkingMode: boolean): Promise<string> => {
    try {
      const ai = getAiClient(apiKey);
      const modelName = isThinkingMode ? 'gemini-2.5-pro' : 'gemini-2.5-flash';

      const response = await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: isThinkingMode ? { thinkingConfig: { thinkingBudget: 8192 } } : {},
      });

      return response.text;
    } catch (error) {
        console.error("Error generating content:", error);
        const errorString = error.toString();
        if (errorString.includes('API key not valid')) {
            throw new Error('API Key không hợp lệ. Vui lòng kiểm tra lại.');
        }
        if (errorString.includes('RESOURCE_EXHAUSTED') || errorString.includes('429')) {
            throw new Error('Hạn ngạch API đã bị vượt quá. Vui lòng thử lại sau một lát.');
        }
        if (error instanceof Error) {
        throw new Error(error.message);
        }
        throw new Error("An unknown error occurred while generating content.");
    }
};

export const generateSpeech = async (
    apiKey: string, 
    text: string, 
    voice: string = 'Kore',
    requestTimestamps: boolean = false
): Promise<{ base64Audio: string; timedWords: TimedWord[] | null }> => {
    try {
        const ai = getAiClient(apiKey);
        
        // Use 'any' for speechConfig to accommodate the potentially undocumented 'enableTimepoints' property.
        const speechConfig: any = {
            voiceConfig: {
                prebuiltVoiceConfig: { voiceName: voice },
            },
        };

        if (requestTimestamps) {
            speechConfig.enableTimepoints = true;
        }

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: speechConfig,
            },
        });

        const audioPart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
        const base64Audio = audioPart?.inlineData?.data;

        if (!base64Audio) {
            throw new Error('Không thể tạo âm thanh từ API.');
        }

        const timedWords = requestTimestamps ? findTimedWords(response) : null;

        return { base64Audio, timedWords };
    } catch (error) {
        console.error('TTS API error:', error);
        const errorString = error.toString();
        if (errorString.includes('API key not valid')) {
            throw new Error('API Key không hợp lệ. Vui lòng kiểm tra lại.');
        }
        if (errorString.includes('RESOURCE_EXHAUSTED') || errorString.includes('429')) {
            throw new Error('Hạn ngạch API đã bị vượt quá. Vui lòng thử lại sau một lát.');
        }
        const message = error instanceof Error ? error.message : 'Đã xảy ra lỗi không xác định.';
        throw new Error(`Tổng hợp giọng nói thất bại: ${message}`);
    }
};