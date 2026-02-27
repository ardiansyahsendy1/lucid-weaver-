import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import type { Blob, LiveServerMessage } from '@google/genai';

// Encode an ArrayBuffer to base64 for the Gemini Live API PCM blob format.
function encodePCM(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

interface DreamRecorderProps {
    onRecordingStart: () => void;
    onRecordingStop: (transcription: string) => void;
}

const DreamRecorder: React.FC<DreamRecorderProps> = ({ onRecordingStart, onRecordingStop }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [liveUiText, setLiveUiText] = useState('');
    // Inline error message instead of alert()
    const [micError, setMicError] = useState<string | null>(null);

    const fullTranscription = useRef('');
    const liveTranscriptionPart = useRef('');
    const sessionPromiseRef = useRef<Promise<any> | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const workletNodeRef = useRef<AudioWorkletNode | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    // Track whether stop was user-initiated so onclose doesn't double-fire
    const stoppingRef = useRef(false);

    const stopRecording = useCallback(() => {
        if (!isRecording) return;
        stoppingRef.current = true;

        sessionPromiseRef.current?.then(session => session.close());
        mediaStreamRef.current?.getTracks().forEach(track => track.stop());
        workletNodeRef.current?.disconnect();
        workletNodeRef.current?.port.close();

        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close();
        }

        setIsRecording(false);
        // Combine committed transcription with any in-flight partial
        onRecordingStop(fullTranscription.current + liveTranscriptionPart.current);
    }, [isRecording, onRecordingStop]);


    const startRecording = useCallback(async () => {
        setMicError(null);
        onRecordingStart();
        setIsRecording(true);
        stoppingRef.current = false;
        fullTranscription.current = '';
        liveTranscriptionPart.current = '';
        setLiveUiText('');

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;

            const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            audioContextRef.current = inputAudioContext;

            // Load the AudioWorklet processor from /public (served as a static asset by Vite)
            await inputAudioContext.audioWorklet.addModule('/pcm-processor.js');

            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: () => {
                        const source = inputAudioContext.createMediaStreamSource(stream);
                        const workletNode = new AudioWorkletNode(inputAudioContext, 'pcm-processor');
                        workletNodeRef.current = workletNode;

                        // Receive PCM Int16 buffers from the worklet and forward to Gemini
                        workletNode.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
                            const pcmBlob: Blob = {
                                data: encodePCM(event.data),
                                mimeType: 'audio/pcm;rate=16000',
                            };
                            sessionPromiseRef.current?.then(session => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };

                        source.connect(workletNode);
                        // Connect to destination so the AudioContext stays active;
                        // actual speaker output is muted by not connecting from worklet → destination.
                    },
                    onmessage: (message: LiveServerMessage) => {
                        if (message.serverContent?.inputTranscription) {
                            const text = message.serverContent.inputTranscription.text;
                            liveTranscriptionPart.current += text;
                            setLiveUiText(liveTranscriptionPart.current);
                        }
                        if (message.serverContent?.turnComplete) {
                            fullTranscription.current += liveTranscriptionPart.current + ' ';
                            liveTranscriptionPart.current = '';
                            setLiveUiText('');
                        }
                    },
                    onerror: (e: ErrorEvent) => {
                        console.error('Live API Error:', e);
                        // Surface API errors inside the component instead of crashing silently
                        if (!stoppingRef.current) {
                            setMicError('Live API error. Please stop and try again.');
                        }
                    },
                    onclose: () => {
                        console.log('Live API connection closed.');
                        // If closed unexpectedly (not by the user), surface it as an error
                        if (!stoppingRef.current) {
                            setMicError('Connection closed unexpectedly. Please try again.');
                            setIsRecording(false);
                        }
                    },
                },
                config: {
                    inputAudioTranscription: {},
                    responseModalities: [Modality.AUDIO],
                },
            });

        } catch (error) {
            console.error('Failed to start recording:', error);
            setIsRecording(false);
            // Show the error inline — no blocking alert()
            setMicError('Could not access microphone. Please check your browser permissions.');
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
                {isRecording ? 'Recording Your Dream...' : 'Ready to Record'}
            </h2>
            <p className="text-gray-300 mb-6 min-h-[48px] max-w-xl">
                {isRecording ? 'Speak freely about your dream. We are capturing every word.' : 'Press the button to begin.'}
            </p>

            {/* Inline error message replaces the blocking alert() */}
            {micError && (
                <div className="w-full max-w-xl mb-4 px-4 py-3 rounded-lg bg-red-900/60 border border-red-500 text-red-300 text-sm">
                    {micError}
                </div>
            )}

            <div className="relative my-6">
                <div className="absolute -inset-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-full blur opacity-75 animate-pulse"></div>
                <button
                    onClick={stopRecording}
                    disabled={!isRecording}
                    className="relative bg-gray-900 text-white font-bold w-32 h-32 rounded-full shadow-lg flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Stop
                </button>
            </div>

            <div className="w-full max-w-2xl min-h-[100px] bg-gray-900/70 p-4 rounded-lg mt-6">
                <p className="text-gray-200 text-left">
                    {fullTranscription.current}
                    <span className="text-purple-300">{liveUiText}</span>
                </p>
            </div>
        </div>
    );
};

export default DreamRecorder;
