import React, { useState, useCallback } from 'react';
import PromptInput from '@/components/PromptInput';
import ResponseDisplay from '@/components/ResponseDisplay';
import { generateContent, generateSpeech } from '@/services/geminiService';
import { useAudioPlayer } from '@/hooks/useAudioPlayer';
import { Notification } from '@/types';

interface ChatTabProps {
    onSetNotification: (notification: Omit<Notification, 'id'>) => void;
    apiKey: string;
}

const ChatTab: React.FC<ChatTabProps> = ({ onSetNotification, apiKey }) => {
    const [prompt, setPrompt] = useState('');
    const [response, setResponse] = useState('');
    const [isThinkingMode, setIsThinkingMode] = useState(false);
    const [isLoadingText, setIsLoadingText] = useState(false);
    const [isLoadingAudio, setIsLoadingAudio] = useState(false);

    const { playAudio } = useAudioPlayer();

    const handleSubmit = useCallback(async () => {
        if (!prompt.trim()) return;

        setIsLoadingText(true);
        setResponse('');
        try {
            const result = await generateContent(prompt, isThinkingMode, apiKey);
            setResponse(result);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Đã xảy ra lỗi không xác định.';
            setResponse(`Lỗi: ${errorMessage}`);
            onSetNotification({ type: 'error', message: `Không thể nhận phản hồi: ${errorMessage}` });
        } finally {
            setIsLoadingText(false);
        }
    }, [prompt, isThinkingMode, onSetNotification, apiKey]);

    const handleSpeak = useCallback(async () => {
        if (!response.trim()) return;

        setIsLoadingAudio(true);
        try {
            const audioContent = await generateSpeech(response, 'Kore', apiKey);
            await playAudio(audioContent);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Đã xảy ra lỗi không xác định.';
            onSetNotification({ type: 'error', message: `Tạo âm thanh thất bại: ${errorMessage}` });
        } finally {
            setIsLoadingAudio(false);
        }
    }, [response, playAudio, onSetNotification, apiKey]);

    return (
        <div className="space-y-6">
            <PromptInput
                prompt={prompt}
                setPrompt={setPrompt}
                isThinkingMode={isThinkingMode}
                setIsThinkingMode={setIsThinkingMode}
                onSubmit={handleSubmit}
                isLoading={isLoadingText}
            />
            <ResponseDisplay
                response={response}
                isLoadingText={isLoadingText}
                isLoadingAudio={isLoadingAudio}
                onSpeak={handleSpeak}
            />
        </div>
    );
};

export default ChatTab;