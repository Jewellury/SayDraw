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
  /** UI language — drives localized mock fallback copy. Defaults to 'zh'. */
  lang?: 'zh' | 'en';
}

export interface GenerateResponse {
  narration: string;
  svg: string;
  followUpQuestion?: string;
  storySummary?: string;
  /** Echoes the renderer path the route actually took, so the client can
   *  attribute analytics without guessing. */
  strategy?: 'direct' | 'semantic';
}

export interface GenerateError {
  error: string;
}

export interface HintRequest {
  storySoFar: string;
  lang: 'zh' | 'en';
}

export interface HintResponse {
  hint: string;
}
