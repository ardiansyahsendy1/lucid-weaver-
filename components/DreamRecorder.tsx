import React, { useState, useEffect, useRef, useCallback } from 'react';
// FIX: Removed unused and non-exported `LiveSession` type.
import { GoogleGenAI, Modality } from '@google/genai';
import type { Blob, LiveServerMessage } from '@google/genai';

// Helper functions for audio processing, must be implemented manually as per guidelines.
function encode(bytes: Uint8Array): string {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function createBlob(data: Float32Array): Blob {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
        int16[i] = data[i] * 32768;
    }
    return {
        data: encode(new Uint8Array(int16.buffer)),
        mimeType: 'audio/pcm;rate=16000',
    };
}


interface DreamRecorderProps {
    onRecordingStart: () => void;
    onRecordingStop: (transcription: string) => void;
}

const DreamRecorder: React.FC<DreamRecorderProps> = ({ onRecordingStart, onRecordingStop }) => {
    const [isRecording, setIsRecording] = useState(false);
    // FIX: Renamed state to clarify its UI-only purpose and avoid confusion with data refs.
    const [liveUiText, setLiveUiText] = useState('');
    const fullTranscription = useRef('');
    // FIX: Added a ref to reliably track the current transcription segment without causing stale closures.
    const liveTranscriptionPart = useRef('');
    // FIX: `LiveSession` is not an exported type. Use `any` or allow inference.
    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);

    const stopRecording = useCallback(() => {
        if (!isRecording) return;
        
        sessionPromiseRef.current?.then(session => session.close());
        mediaStreamRef.current?.getTracks().forEach(track => track.stop());
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close();
        }
        scriptProcessorRef.current?.disconnect();

        setIsRecording(false);
        // FIX: Combine the committed transcription with the final live part to avoid data loss.
        onRecordingStop(fullTranscription.current + liveTranscriptionPart.current);
    }, [isRecording, onRecordingStop]);


    const startRecording = useCallback(async () => {
        onRecordingStart();
        setIsRecording(true);
        fullTranscription.current = '';
        // FIX: Reset new ref and state for a new recording session.
        liveTranscriptionPart.current = '';
        setLiveUiText('');

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;

            // FIX: Cast `window` to `any` to handle vendor-prefixed `webkitAudioContext` without TypeScript errors.
            const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            audioContextRef.current = inputAudioContext;

            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
            
            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: () => {
                        const source = inputAudioContext.createMediaStreamSource(stream);
                        const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
                        scriptProcessorRef.current = scriptProcessor;

                        scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const pcmBlob = createBlob(inputData);
                            sessionPromiseRef.current?.then((session) => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };
                        source.connect(scriptProcessor);
                        scriptProcessor.connect(inputAudioContext.destination);
                    },
                    // FIX: Reworked onmessage logic to use refs, preventing stale state and data loss.
                    onmessage: (message: LiveServerMessage) => {
                        if (message.serverContent?.inputTranscription) {
                            const text = message.serverContent.inputTranscription.text;
                            liveTranscriptionPart.current += text;
                            setLiveUiText(liveTranscriptionPart.current);
                        }
                        if (message.serverContent?.turnComplete) {
                           fullTranscription.current += liveTranscriptionPart.current + " ";
                           liveTranscriptionPart.current = '';
                           setLiveUiText('');
                        }
                    },
                    onerror: (e: ErrorEvent) => console.error('Live API Error:', e),
                    onclose: () => console.log('Live API connection closed.'),
                },
                config: {
                    inputAudioTranscription: {},
                    responseModalities: [Modality.AUDIO], // required but not used for output
                },
            });

        } catch (error) {
            console.error('Failed to start recording:', error);
            setIsRecording(false);
            alert('Could not access microphone. Please check your browser permissions.');
        }
    }, [onRecordingStart]);
    
    // Auto-start recording when component mounts
    useEffect(() => {
        startRecording();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (isRecording) {
               stopRecording();
            }
        };
    }, [isRecording, stopRecording]);


    return (
        <div className="flex flex-col items-center justify-center text-center p-8 bg-gray-800/50 rounded-2xl shadow-2xl backdrop-blur-sm">
            <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500 mb-4">
                {isRecording ? "Recording Your Dream..." : "Ready to Record"}
            </h2>
            <p className="text-gray-300 mb-6 min-h-[48px] max-w-xl">
               {isRecording ? "Speak freely about your dream. We are capturing every word." : "Press the button to begin."}
            </p>

            <div className="relative my-6">
                <div className="absolute -inset-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full blur opacity-75 animate-pulse"></div>
                <button
                    onClick={stopRecording}
                    className="relative bg-gray-900 text-white font-bold w-32 h-32 rounded-full shadow-lg flex items-center justify-center"
                >
                    Stop
                </button>
            </div>
            
            <div className="w-full max-w-2xl min-h-[100px] bg-gray-900/70 p-4 rounded-lg mt-6">
                {/* FIX: Use the new state variable for displaying the live transcription part. */}
                <p className="text-gray-200 text-left">{fullTranscription.current} <span className="text-purple-300">{liveUiText}</span></p>
            </div>
        </div>
    );
};

export default DreamRecorder;