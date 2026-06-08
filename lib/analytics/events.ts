export interface StoryTurnSubmittedPayload {
  speaker: 'dad' | 'kid';
  frameCount: number;
}

export interface StoryFrameGeneratedPayload {
  speaker: 'dad' | 'kid';
  frameCount: number;
}

export type StoryHintRequestedPayload = Record<string, never>;

export interface StoryPlayStartedPayload {
  frameCount: number;
}

export interface StoryFrameRevisitedPayload {
  frameIndex: number;
}

export interface StoryGenerationFailedPayload {
  speaker: 'dad' | 'kid';
  error: string;
}

export interface VoiceInputStartedPayload {
  speaker: 'dad' | 'kid';
}

export interface VoiceInputCompletedPayload {
  speaker: 'dad' | 'kid';
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
};
