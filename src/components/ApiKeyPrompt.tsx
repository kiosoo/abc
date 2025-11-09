

import React, { useState, useEffect } from 'react';
// FIX: Add file extension to import to resolve module loading error.
import { InfoIcon, LoadingSpinner } from '@/components/Icons.tsx';

interface ApiKeyPromptProps {
    onKeySelected: () => void;
}

// This component is designed for features like Veo video generation
// which require the user to select their own API key via a special dialog.
const ApiKeyPrompt: React.FC<ApiKeyPromptProps> = ({ onKeySelected }) => {
    const [isChecking, setIsChecking] = useState(true);

    useEffect(() => {
        const checkKey = async () => {
            // FIX: Check if window.aistudio and its methods exist before calling them.
            if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
                const hasKey = await window.aistudio.hasSelectedApiKey();
                if (hasKey) {
                    onKeySelected();
                }
            }
            setIsChecking(false);
        };
        checkKey();
    }, [onKeySelected]);

    const handleSelectKey = async () => {
        if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
            try {
                // FIX: Call window.aistudio.openSelectKey() to prompt user.
                await window.aistudio.openSelectKey();
                // As per guidelines, assume selection is successful to mitigate race conditions.
                onKeySelected();
            } catch (error) {
                console.error("Error opening API key selection dialog:", error);
            }
        } else {
            alert("API key selection utility is not available.");
        }
    };
    
    if (isChecking) {
        return <div className="flex items-center justify-center p-4"><LoadingSpinner /> <span className="ml-2">Checking API Key...</span></div>;
    }

    return (
        <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-6 text-center">
            <InfoIcon className="h-12 w-12 mx-auto text-blue-400 mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Project API Key Required</h3>
            <p className="text-blue-200 text-sm mb-4">
                This feature requires a personal API key associated with a Google Cloud project with billing enabled.
                <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline ml-1">Learn more about billing.</a>
            </p>
            <button
                onClick={handleSelectKey}
                className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
                Select API Key
            </button>
        </div>
    );
};

// FIX: Add global declaration for window.aistudio to satisfy TypeScript.
// FIX: Use a named interface 'AIStudio' to avoid subsequent declaration errors which can happen with anonymous inline types.
declare global {
    interface AIStudio {
        hasSelectedApiKey: () => Promise<boolean>;
        openSelectKey: () => Promise<void>;
    }
    interface Window {
        aistudio?: AIStudio;
    }
}

export default ApiKeyPrompt;