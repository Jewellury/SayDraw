import { EventName, EventPayloadMap } from './events';

declare global {
  interface Window {
    pendo?: {
      track(event: string, properties?: Record<string, unknown>): void;
    };
  }
}

export function track<K extends EventName>(eventName: K, payload: EventPayloadMap[K]): void {
  if (typeof window === 'undefined') return;

  if (process.env.NODE_ENV === 'development') {
    console.log(
      `%c[Novus] %c${eventName}`,
      'color: #d9622b; font-weight: bold',
      'color: inherit',
      payload ?? ''
    );
  }

  try {
    if (window.pendo) {
      window.pendo.track(eventName, payload as Record<string, unknown>);
    }
  } catch (e) {
    console.error('[pendo.track] failed:', e);
  }
}
