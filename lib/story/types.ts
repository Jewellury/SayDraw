export interface Scene {
  id: number;
  speaker: 'dad' | 'kid';
  text: string;
  svg: string;
  summary?: string;
}

export interface StoryState {
  scenes: Scene[];
  current: number;
  speaker: 'dad' | 'kid';
}

export interface GenerateRequest {
  storySoFar: string;
  newLine: string;
  speaker: 'dad' | 'kid';
  textPrompt?: string;
  drawingPrompt?: string;
}

export interface GenerateResponse {
  narration: string;
  svg: string;
  followUpQuestion?: string;
  storySummary?: string;
}

export interface GenerateError {
  error: string;
}
