import React from 'react';
import LoadingSpinner from './LoadingSpinner';
import { SpeakerIcon } from './Icon';

interface ResponseDisplayProps {
  response: string;
  isLoadingText: boolean;
  isLoadingAudio: boolean;
  onSpeak: () => void;
}

const ResponseDisplay: React.FC<ResponseDisplayProps> = ({
  response,
  isLoadingText,
  isLoadingAudio,
  onSpeak,
}) => {
  const hasResponse = response.trim().length > 0;

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 min-h-[200px] flex flex-col relative prose prose-invert max-w-none prose-p:text-gray-300 prose-headings:text-gray-100">
      {isLoadingText && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800/50 rounded-xl">
          <LoadingSpinner />
        </div>
      )}
      {!isLoadingText && !hasResponse && (
        <div className="m-auto text-center text-gray-500">
          <h2 className="text-xl font-medium text-gray-400">Trợ lý AI của bạn</h2>
          <p>Phản hồi sẽ xuất hiện ở đây.</p>
        </div>
      )}
      {hasResponse && (
        <>
          <div className="flex-grow whitespace-pre-wrap">{response}</div>
          <div className="mt-4 pt-4 border-t border-gray-700/50 flex justify-end">
            <button
              onClick={onSpeak}
              disabled={isLoadingAudio || isLoadingText}
              className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-purple-500"
            >
              {isLoadingAudio ? (
                 <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <SpeakerIcon className="w-5 h-5" />
              )}
              <span>{isLoadingAudio ? 'Đang tổng hợp...' : 'Phát âm'}</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default ResponseDisplay;