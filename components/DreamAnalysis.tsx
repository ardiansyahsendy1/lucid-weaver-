
import React from 'react';
import type { DreamAnalysisResult } from '../types';
import Chat from './Chat';

interface DreamAnalysisProps {
    result: DreamAnalysisResult;
    onReset: () => void;
}

const DreamAnalysis: React.FC<DreamAnalysisProps> = ({ result, onReset }) => {
    return (
        <div className="w-full h-full p-2 sm:p-4">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 h-full">
                {/* Left Column: Image and Actions */}
                <div className="lg:col-span-2 flex flex-col space-y-6">
                    <div className="bg-gray-800 p-4 rounded-lg shadow-xl flex-shrink-0">
                        <img
                            src={result.imageUrl}
                            alt="Dream representation"
                            className="w-full h-auto object-cover rounded-md"
                        />
                         <h3 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500 mt-4">
                            Your Dreamscape
                        </h3>
                    </div>
                    <div className="bg-gray-800 p-4 rounded-lg shadow-xl flex-grow">
                         <h3 className="text-lg font-semibold text-gray-200 mb-2">Transcription</h3>
                        <div className="h-48 overflow-y-auto bg-gray-900/50 p-3 rounded-md text-gray-300 text-sm leading-relaxed">
                            <p>{result.transcription}</p>
                        </div>
                    </div>
                     <button
                        onClick={onReset}
                        className="w-full bg-purple-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-purple-700 transition-colors duration-300 mt-auto"
                    >
                        Analyze Another Dream
                    </button>
                </div>

                {/* Right Column: Interpretation and Chat */}
                <div className="lg:col-span-3 flex flex-col space-y-6">
                    <div className="bg-gray-800 p-6 rounded-lg shadow-xl">
                        <h3 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500 mb-3">
                            Psychological Interpretation
                        </h3>
                        <div className="prose prose-invert prose-sm max-w-none text-gray-300" dangerouslySetInnerHTML={{ __html: result.interpretation.replace(/\n/g, '<br />') }} />
                    </div>
                    <div className="bg-gray-800 rounded-lg shadow-xl flex-grow flex flex-col">
                        <Chat dreamContext={result.transcription} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DreamAnalysis;
