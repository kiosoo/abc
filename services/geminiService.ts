import { GoogleGenAI, Modality } from "@google/genai";

// This function now accepts an initialized GoogleGenAI instance.
export const generateContent = async (ai: GoogleGenAI, prompt: string, isThinkingMode: boolean): Promise<string> => {
  try {
    const modelName = isThinkingMode ? 'gemini-2.5-pro' : 'gemini-2.5-flash';

    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: isThinkingMode ? { thinkingConfig: { thinkingBudget: 8192 } } : {},
    });

    return response.text;
  } catch (error) {
    console.error("Error generating content:", error);
    if (error.toString().includes('API key not valid')) {
        throw new Error('API Key không hợp lệ. Vui lòng kiểm tra lại.');
    }
    if (error instanceof Error) {
      throw new Error(error.message);
    }
    throw new Error("An unknown error occurred while generating content.");
  }
};

// This function now accepts an initialized GoogleGenAI instance.
export const generateSpeech = async (ai: GoogleGenAI, text: string, voice: string = 'Kore'): Promise<string> => {
    try {
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

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!base64Audio) {
            throw new Error('Không thể tạo âm thanh từ API.');
        }

        return base64Audio;
    } catch (error) {
        console.error('TTS API error:', error);
        if (error.toString().includes('API key not valid')) {
            throw new Error('API Key không hợp lệ. Vui lòng kiểm tra lại.');
        }
        const message = error instanceof Error ? error.message : 'Đã xảy ra lỗi không xác định.';
        throw new Error(`Tổng hợp giọng nói thất bại: ${message}`);
    }
};