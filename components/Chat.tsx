
import React, { useState, useEffect, useRef } from 'react';
import { createChat } from '../services/geminiService';
import type { ChatMessage } from '../types';
import type { Chat as ChatInstance } from '@google/genai';


interface ChatProps {
    dreamContext: string;
}

const Chat: React.FC<ChatProps> = ({ dreamContext }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    // Separate flag: true only while waiting for the very first chunk (before model message appears)
    const [isWaitingForFirstChunk, setIsWaitingForFirstChunk] = useState(false);
    const chatInstanceRef = useRef<ChatInstance | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        chatInstanceRef.current = createChat(dreamContext);
    }, [dreamContext]);
    
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);


    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage: ChatMessage = { role: 'user', content: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);
        setIsWaitingForFirstChunk(true);

        try {
            if (chatInstanceRef.current) {
                const stream = await chatInstanceRef.current.sendMessageStream({ message: input });

                let modelResponse = '';
                // Append the placeholder model message once streaming starts
                setMessages(prev => [...prev, { role: 'model', content: '' }]);
                setIsWaitingForFirstChunk(false);

                for await (const chunk of stream) {
                    const chunkText = chunk.text;
                    modelResponse += chunkText;
                    // Immutable update: map over messages and replace only the last one
                    setMessages(prev =>
                        prev.map((msg, i) =>
                            i === prev.length - 1 ? { ...msg, content: modelResponse } : msg
                        )
                    );
                }
            }
        } catch (error) {
            console.error('Chat error:', error);
            setIsWaitingForFirstChunk(false);
            setMessages(prev => [...prev, { role: 'model', content: 'Sorry, I encountered an error. Please try again.' }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full p-4">
            <h3 className="text-lg font-semibold text-gray-200 mb-2 px-2">Ask a Follow-Up Question</h3>
            <div className="flex-grow overflow-y-auto mb-4 pr-2">
                 {messages.map((msg, index) => (
                    <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} mb-3`}>
                        <div className={`max-w-xs md:max-w-md lg:max-w-lg px-4 py-2 rounded-2xl ${msg.role === 'user' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-200'}`}>
                           <p className="text-sm">{msg.content}</p>
                        </div>
                    </div>
                ))}
                 {/* Spinner shown only while waiting for the first token to arrive */}
                 {isWaitingForFirstChunk && (
                     <div className="flex justify-start mb-3">
                         <div className="max-w-xs px-4 py-2 rounded-2xl bg-gray-700 text-gray-200">
                             <div className="flex items-center space-x-2">
                                 <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
                                 <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse [animation-delay:0.2s]"></div>
                                 <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse [animation-delay:0.4s]"></div>
                             </div>
                         </div>
                     </div>
                 )}
                <div ref={messagesEndRef} />
            </div>
            <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="E.g., What does the ocean symbolize?"
                    className="flex-grow bg-gray-900 border border-gray-600 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 focus:outline-none text-gray-200"
                    disabled={isLoading}
                />
                <button type="submit" disabled={isLoading || !input.trim()} className="bg-purple-600 text-white px-4 py-2 rounded-lg disabled:bg-gray-600 disabled:cursor-not-allowed hover:bg-purple-700 transition-colors">
                    Send
                </button>
            </form>
        </div>
    );
};

export default Chat;
