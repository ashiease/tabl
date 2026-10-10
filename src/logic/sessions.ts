import { AppState, Session } from '../types';
import { SESSION_SECONDS, BREAK_MINUTES } from '../constants/policy';

export const newId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

export function makeCheckInActions(tableId: string, userId: string) {
  const endsAt = new Date(Date.now() + SESSION_SECONDS * 1000).toISOString();
  return {
    sessionId: newId('session'),
    tableId,
    userId,
    endsAt,
  };
}

export function makeBreakEnd() {
  return new Date(Date.now() + BREAK_MINUTES * 60 * 1000).toISOString();
}

export function sessionSecondsLeft(session: Session): number {
  return Math.max(
    0,
    Math.floor((new Date(session.ends_at).getTime() - Date.now()) / 1000)
  );
}