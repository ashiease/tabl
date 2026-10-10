import { AppState } from '../types';
import { GRACE_SECONDS } from '../constants/policy';

/**
 * Runs every second. Returns a list of dispatch actions to apply.
 * Pure — no side effects — so it's testable.
 */
export function computeExpiryActions(state: AppState) {
  const actions: any[] = [];
  const now = Date.now();

  // Break → grace → expire
  state.sessions.forEach(session => {
    if (session.status === 'on_break') {
      const breakEnd = new Date(session.break_ends_at!).getTime();
      if (now > breakEnd) {
        actions.push({
          type: 'BREAK_EXPIRED',
          payload: {
            sessionId: session.id,
            graceEndsAt: new Date(breakEnd + GRACE_SECONDS * 1000).toISOString(),
          },
        });
      }
    } else if (session.status === 'on_break_expired') {
      const graceEnd = new Date(session.grace_ends_at!).getTime();
      if (now > graceEnd) {
        actions.push({
          type: 'FINALIZE',
          payload: { sessionId: session.id, reason: 'expired' },
        });
      }
    } else if (session.status === 'active') {
      const end = new Date(session.ends_at).getTime();
      if (now >= end) {
        actions.push({
          type: 'FINALIZE',
          payload: { sessionId: session.id, reason: 'expired' },
        });
      }
    }
  });

  return actions;
}