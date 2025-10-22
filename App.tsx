
import React, { useState, useCallback } from 'react';
import type { AppState, DreamAnalysisResult } from './types';
import { generateDreamImage, generateDreamInterpretation } from './services/geminiService';
import DreamRecorder from './components/DreamRecorder';
import DreamAnalysis from './components/DreamAnalysis';

const processingMessages = [
    "Weaving the threads of your subconscious...",
    "Consulting the oracle of slumber...",
    "Translating dream language into pixels...",
    "Exploring the corridors of your mind...",
    "Painting your dream with starlight..."
];

const App: React.FC = () => {
    const [appState, setAppState] = useState<AppState>('idle');
    const [analysisResult, setAnalysisResult] = useState<DreamAnalysisResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [currentProcessingMessage, setCurrentProcessingMessage] = useState(processingMessages[0]);

    const handleReset = useCallback(() => {
        setAppState('idle');
        setAnalysisResult(null);
        setError(null);
    }, []);

    const handleRecordingStart = useCallback(() => {
        setAppState('recording');
        setError(null);
    }, []);

    const handleRecordingStop = useCallback(async (transcription: string) => {
        if (!transcription || transcription.trim().length < 10) {
            setError("Dream recording is too short. Please try again.");
            setAppState('idle');
            return;
        }

        setAppState('processing');
        
        const intervalId = setInterval(() => {
            setCurrentProcessingMessage(processingMessages[Math.floor(Math.random() * processingMessages.length)]);
        }, 2000);

        try {
            const [imageUrl, interpretation] = await Promise.all([
                generateDreamImage(transcription),
                generateDreamInterpretation(transcription),
            ]);

            setAnalysisResult({ transcription, imageUrl, interpretation });
            setAppState('results');
        } catch (err) {
            console.error(err);
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred during analysis.";
            setError(errorMessage);
            setAppState('error');
        } finally {
            clearInterval(intervalId);
        }
    }, []);

    const renderContent = () => {
        switch (appState) {
            case 'recording':
                return <DreamRecorder onRecordingStart={handleRecordingStart} onRecordingStop={handleRecordingStop} />;
            case 'processing':
                return (
                    <div className="text-center flex flex-col items-center justify-center h-full">
                        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-400 mb-4"></div>
                        <p className="text-xl text-purple-300 font-semibold">{currentProcessingMessage}</p>
                    </div>
                );
            case 'results':
                return analysisResult && <DreamAnalysis result={analysisResult} onReset={handleReset} />;
            case 'error':
                 return (
                    <div className="text-center p-8 bg-gray-800 rounded-lg shadow-xl">
                        <h2 className="text-2xl font-bold text-red-400 mb-4">Analysis Failed</h2>
                        <p className="text-gray-300 mb-6">{error}</p>
                        <button
                            onClick={handleReset}
                            className="bg-purple-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-purple-700 transition-colors duration-300"
                        >
                            Try Again
                        </button>
                    </div>
                );
            case 'idle':
            default:
                return (
                    <div className="text-center">
                        <h1 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500 mb-4">
                            Lucid Weaver
                        </h1>
                        <p className="text-lg text-gray-300 mb-8 max-w-md mx-auto">
                            Capture your dreams upon waking. Let AI illuminate the hidden landscapes of your mind.
                        </p>
                        <button
                            onClick={handleRecordingStart}
                            className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold py-4 px-8 rounded-full shadow-lg hover:scale-105 transform transition-transform duration-300 ease-in-out"
                        >
                            Record a Dream
                        </button>
                    </div>
                );
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4 font-sans">
            <div className="w-full max-w-4xl mx-auto min-h-[80vh] flex flex-col justify-center">
                {renderContent()}
            </div>
        </div>
    );
};

export default App;
