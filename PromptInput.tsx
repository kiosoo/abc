import React from 'react';
import { SendIcon } from './Icon';

interface PromptInputProps {
  prompt: string;
  setPrompt: (prompt: string) => void;
  isThinkingMode: boolean;
  setIsThinkingMode: (isThinkingMode: boolean) => void;
  onSubmit: () => void;
  isLoading: boolean;
}

const PromptInput: React.FC<PromptInputProps> = ({
  prompt,
  setPrompt,
  isThinkingMode,
  setIsThinkingMode,
  onSubmit,
  isLoading,
}) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Đặt câu hỏi hoặc ra lệnh..."
          className="w-full bg-gray-800 border border-gray-700 rounded-lg p-4 pr-16 resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-gray-200 placeholder-gray-500"
          rows={3}
          disabled={isLoading}
        />
        <button
          onClick={onSubmit}
          disabled={isLoading || !prompt.trim()}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500"
        >
          <SendIcon className="w-6 h-6" />
        </button>
      </div>
      <div className="flex items-center justify-end space-x-3 group">
        <label htmlFor="thinking-mode" className="text-sm font-medium text-gray-400 cursor-pointer group-hover:text-white transition-colors">
          Chế độ suy nghĩ sâu
        </label>
        <div 
          title="Dành cho các truy vấn phức tạp. Sử dụng mô hình mạnh hơn và có thể mất nhiều thời gian hơn để phản hồi."
          className="relative inline-flex items-center cursor-pointer"
        >
          <input
            type="checkbox"
            id="thinking-mode"
            className="sr-only peer"
            checked={isThinkingMode}
            onChange={(e) => setIsThinkingMode(e.target.checked)}
            disabled={isLoading}
          />
          <div className="w-11 h-6 bg-gray-700 rounded-full peer peer-focus:ring-4 peer-focus:ring-blue-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
        </div>
      </div>
    </div>
  );
};

export default PromptInput;