
export type AppState = 'idle' | 'recording' | 'processing' | 'results' | 'error';

export interface DreamAnalysisResult {
  transcription: string;
  imageUrl: string;
  interpretation: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}
