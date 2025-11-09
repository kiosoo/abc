import { GoogleGenAI, Modality } from "@google/genai";

export const generateContent = async (apiKey: string, prompt: string, isThinkingMode: boolean): Promise<string> => {
    try {
      const ai = new GoogleGenAI({ apiKey });
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
    voice: string = 'Kore'
): Promise<{ base64Audio: string }> => {
    try {
        // Create a new client for each request to ensure the correct API key is used.
        const ai = new GoogleGenAI({ apiKey });
        
        const speechConfig: { [key: string]: any } = {
            voiceConfig: {
                prebuiltVoiceConfig: { voiceName: voice },
            },
        };

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

        return { base64Audio };
    } catch (error) {
        console.error('TTS API error:', error);
        const errorString = error.toString();
        if (errorString.includes('API key not valid')) {
            throw new Error(`API Key không hợp lệ. Key: ...${apiKey.slice(-4)}`);
        }
        if (errorString.includes('RESOURCE_EXHAUSTED') || errorString.includes('429')) {
            throw new Error(`Hạn ngạch API đã bị vượt quá cho key ...${apiKey.slice(-4)}.`);
        }
        const message = error instanceof Error ? error.message : 'Đã xảy ra lỗi không xác định.';
        throw new Error(`Tổng hợp giọng nói thất bại: ${message}`);
    }
};
