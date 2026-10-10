import { AppState, Session, Table, WaitlistEntry } from '../types';

export const currentUser = (s: AppState) =>
  s.currentUserId;

export const isAdmin = (s: AppState) =>
  s.currentUserId.startsWith('ADM');

export const myHostelId = (s: AppState) =>
  s.hostelsByUser[s.currentUserId] ?? null;

export const myActiveSession = (s: AppState): Session | undefined =>
  s.sessions.find(
    x =>
      x.user_id === s.currentUserId &&
      (x.status === 'active' ||
        x.status === 'on_break' ||
        x.status === 'on_break_expired')
  );

export const sessionForTable = (s: AppState, tableId: string) =>
  s.sessions.find(
    x =>
      x.table_id === tableId &&
      (x.status === 'active' ||
        x.status === 'on_break' ||
        x.status === 'on_break_expired')
  );

export const tablesInSpace = (s: AppState, spaceId: string) =>
  s.tables.filter(t => t.space_id === spaceId);

export const spaceCounts = (s: AppState, spaceId: string) => {
  const tables = tablesInSpace(s, spaceId);
  return {
    total: tables.length,
    available: tables.filter(t => t.status === 'available').length,
  };
};

export const queuePosition = (s: AppState, entryId: string) => {
  const entry = s.waitlist.find(w => w.id === entryId);
  if (!entry) return 0;
  const queue = s.waitlist
    .filter(w => w.table_id === entry.table_id && w.status === 'waiting')
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  return queue.findIndex(w => w.id === entryId) + 1;
};

export const queueLength = (s: AppState, tableId: string) =>
  s.waitlist.filter(w => w.table_id === tableId && w.status === 'waiting').length;

export const myWaitlist = (s: AppState): WaitlistEntry[] =>
  s.waitlist.filter(
    w => w.user_id === s.currentUserId && w.status !== 'expired'
  );