
import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import type { ChatMessage } from './types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });
const chatModel = ai.chats;

export async function generateDreamImage(dreamText: string): Promise<string> {
    try {
        const imagePromptGeneratorResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `You are an AI artist's assistant. Your task is to take a dream description and create a concise, highly descriptive prompt for a surrealist image generation model like Imagen. Focus on the core emotional tone, key symbols, and bizarre juxtapositions. Do not explain the prompt, just provide the text. Here is the dream: "${dreamText}"`
        });
        
        const imagePrompt = imagePromptGeneratorResponse.text;
        
        const imageResponse = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: imagePrompt,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/jpeg',
                aspectRatio: '3:4',
            },
        });

        if (imageResponse.generatedImages && imageResponse.generatedImages.length > 0) {
            const base64ImageBytes: string = imageResponse.generatedImages[0].image.imageBytes;
            return `data:image/jpeg;base64,${base64ImageBytes}`;
        }
        throw new Error("Image generation failed to produce an image.");

    } catch (error) {
        console.error("Error generating dream image:", error);
        throw new Error("Failed to generate dream image.");
    }
}


export async function generateDreamInterpretation(dreamText: string): Promise<string> {
    try {
        const interpretationResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `You are a world-class psychoanalyst specializing in Jungian dream interpretation. Your analysis should be structured, insightful, and accessible. Based on the following dream, provide a markdown-formatted analysis with these sections:

### Core Emotional Theme
(A brief summary of the dominant feeling or mood of the dream.)

### Key Symbols & Archetypes
(List key symbols and the Jungian archetypes they might represent, e.g., 'The Shadow', 'The Anima/Animus', 'The Wise Old Man').

### Potential Interpretation
(A detailed analysis connecting the symbols and themes to potential aspects of the dreamer's waking life or subconscious mind.)

Dream Transcription:
"${dreamText}"`
        });
        return interpretationResponse.text;
    } catch (error) {
        console.error("Error generating dream interpretation:", error);
        throw new Error("Failed to generate dream interpretation.");
    }
}

export function createChat(dreamContext: string): Chat {
    return chatModel.create({
        model: 'gemini-2.5-flash',
        config: {
            systemInstruction: `You are a helpful AI assistant continuing a conversation about a dream analysis. The user has already received an initial interpretation. Your role is to answer follow-up questions about specific symbols, feelings, or parts of the dream. Use the original dream transcription and interpretation as your primary context. Be insightful and draw connections to Jungian psychology where relevant. Here is the original dream: "${dreamContext}"`,
        },
    });
}
