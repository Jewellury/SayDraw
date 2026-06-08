export interface StoryTurnSubmittedPayload {
  speaker: 'dad' | 'kid';
  frameCount: number;
  inputMethod: 'text' | 'voice';
  language: 'zh' | 'en';
  inputLength: number;
}

export interface StoryFrameGeneratedPayload {
  speaker: 'dad' | 'kid';
  frameCount: number;
  hasNarration: boolean;
  hasSvg: boolean;
  hasStorySummary: boolean;
  language: 'zh' | 'en';
}

export interface StoryHintRequestedPayload {
  language: 'zh' | 'en';
  frameCount: number;
  speaker: 'dad' | 'kid';
  hintLength: number;
}

export interface StoryPlayStartedPayload {
  frameCount: number;
  language: 'zh' | 'en';
}

export interface StoryFrameRevisitedPayload {
  frameIndex: number;
  totalFrames: number;
  frameSpeaker: 'dad' | 'kid';
}

export interface StoryGenerationFailedPayload {
  speaker: 'dad' | 'kid';
  error_msg: string;
  frameCount: number;
  language: 'zh' | 'en';
}

export interface VoiceInputStartedPayload {
  speaker: 'dad' | 'kid';
  language: 'zh' | 'en';
}

export interface VoiceInputCompletedPayload {
  speaker: 'dad' | 'kid';
  language: 'zh' | 'en';
  transcriptLength: number;
}

export interface StoryResetPayload {
  framesDiscarded: number;
  language: 'zh' | 'en';
  lastSpeaker: 'dad' | 'kid';
}

export interface StoryPlaybackCompletedPayload {
  frameCount: number;
  language: 'zh' | 'en';
}

export interface SettingsCustomPromptSavedPayload {
  promptLength: number;
  isReset: boolean;
  language: 'zh' | 'en';
}

export interface VoiceInputFailedPayload {
  speaker: 'dad' | 'kid';
  language: 'zh' | 'en';
}

export interface LanguageSwitchedPayload {
  fromLanguage: 'zh' | 'en';
  toLanguage: 'zh' | 'en';
  frameCount: number;
}

export interface StoryHintFailedPayload {
  error_msg: string;
  language: 'zh' | 'en';
  frameCount: number;
}

export const EVENTS = {
  STORY_TURN_SUBMITTED: 'story_turn_submitted',
  STORY_FRAME_GENERATED: 'story_frame_generated',
  STORY_HINT_REQUESTED: 'story_hint_requested',
  STORY_PLAY_STARTED: 'story_play_started',
  STORY_FRAME_REVISITED: 'story_frame_revisited',
  STORY_GENERATION_FAILED: 'story_generation_failed',
  VOICE_INPUT_STARTED: 'voice_input_started',
  VOICE_INPUT_COMPLETED: 'voice_input_completed',
  STORY_RESET: 'story_reset',
  STORY_PLAYBACK_COMPLETED: 'story_playback_completed',
  SETTINGS_CUSTOM_PROMPT_SAVED: 'settings_custom_prompt_saved',
  VOICE_INPUT_FAILED: 'voice_input_failed',
  LANGUAGE_SWITCHED: 'language_switched',
  STORY_HINT_FAILED: 'story_hint_failed',
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

export type EventPayloadMap = {
  [EVENTS.STORY_TURN_SUBMITTED]: StoryTurnSubmittedPayload;
  [EVENTS.STORY_FRAME_GENERATED]: StoryFrameGeneratedPayload;
  [EVENTS.STORY_HINT_REQUESTED]: StoryHintRequestedPayload;
  [EVENTS.STORY_PLAY_STARTED]: StoryPlayStartedPayload;
  [EVENTS.STORY_FRAME_REVISITED]: StoryFrameRevisitedPayload;
  [EVENTS.STORY_GENERATION_FAILED]: StoryGenerationFailedPayload;
  [EVENTS.VOICE_INPUT_STARTED]: VoiceInputStartedPayload;
  [EVENTS.VOICE_INPUT_COMPLETED]: VoiceInputCompletedPayload;
  [EVENTS.STORY_RESET]: StoryResetPayload;
  [EVENTS.STORY_PLAYBACK_COMPLETED]: StoryPlaybackCompletedPayload;
  [EVENTS.SETTINGS_CUSTOM_PROMPT_SAVED]: SettingsCustomPromptSavedPayload;
  [EVENTS.VOICE_INPUT_FAILED]: VoiceInputFailedPayload;
  [EVENTS.LANGUAGE_SWITCHED]: LanguageSwitchedPayload;
  [EVENTS.STORY_HINT_FAILED]: StoryHintFailedPayload;
};
