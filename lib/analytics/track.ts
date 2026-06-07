import { EventName } from './events';

export function track(eventName: EventName, payload?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;

  if (process.env.NODE_ENV === 'development') {
    console.log(
      `%c[Novus] %c${eventName}`,
      'color: #d9622b; font-weight: bold',
      'color: inherit',
      payload ?? ''
    );
  }

  // Placeholder for Novus SDK integration:
  // if (window.Novus) {
  //   window.Novus.track(eventName, payload);
  // }
}
