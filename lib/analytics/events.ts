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
