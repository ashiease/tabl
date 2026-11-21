import { AppState, Session, WaitlistEntry, Profile, Policy } from '../types';
import { BREAK_MINUTES, RESERVATION_SECONDS, SESSION_SECONDS } from '../constants/policy';

export const currentProfile = (s: AppState): Profile | null => s.profile;

export const isAdmin = (s: AppState) => s.profile?.role === 'admin';

export const myHostelId = (s: AppState) => s.profile?.hostel_id ?? null;

const OPEN = (x: Session) => x.status === 'active' || x.status === 'on_break';

export const myActiveSession = (s: AppState): Session | undefined => {
  if (!s.profile) return undefined;
  return s.sessions.find(x => x.user_id === s.profile!.id && OPEN(x));
};

export const sessionForTable = (s: AppState, tableId: string) =>
  s.sessions.find(x => x.table_id === tableId && OPEN(x));

export const myReservation = (s: AppState) => {
  if (!s.profile) return undefined;
  return s.reservations.find(r => r.user_id === s.profile!.id);
};

export const reservationForTable = (s: AppState, tableId: string) =>
  s.reservations.find(r => r.table_id === tableId);

export const tablesInSpace = (s: AppState, spaceId: string) =>
  s.tables.filter(t => t.space_id === spaceId);

export const spaceCounts = (s: AppState, spaceId: string) => {
  const tables = tablesInSpace(s, spaceId);
  return {
    total: tables.length,
    available: tables.filter(t => t.status === 'available').length,
  };
};

// Positions come from the server (students can only read their own entries).
export const queuePosition = (s: AppState, entryId: string) =>
  s.waitPositions.find(p => p.entry_id === entryId)?.queue_position ?? 0;

export const queueLength = (s: AppState, tableId: string) => s.waitCounts[tableId] ?? 0;

export const myWaitlist = (s: AppState): WaitlistEntry[] => {
  if (!s.profile) return [];
  return s.waitlist.filter(w => w.user_id === s.profile!.id && w.status !== 'expired');
};

// ── Rules (live from the admin's settings, with safe fallbacks) ──
export const sessionSeconds = (p: Policy | null) =>
  p ? 60 * (p.exam_mode ? p.exam_session_minutes : p.session_minutes) : SESSION_SECONDS;
export const breakSeconds = (p: Policy | null) =>
  p ? 60 * (p.exam_mode ? p.exam_break_minutes : p.break_minutes) : BREAK_MINUTES * 60;
export const holdSeconds = (p: Policy | null) => (p ? 60 * p.hold_minutes : RESERVATION_SECONDS);

// ── Using an away table ──
export const myBorrow = (s: AppState) =>
  s.profile ? s.borrows.find(b => b.user_id === s.profile!.id && b.status === 'active') : undefined;

export const borrowForTable = (s: AppState, tableId: string) =>
  s.borrows.find(b => b.table_id === tableId && b.status === 'active');

// ── Block bookings ──
const blockApplies = (s: AppState, tableId: string) => (b: AppState['blocks'][number]) => {
  if (b.cancelled_at) return false;
  if (b.table_ids && b.table_ids.length) return b.table_ids.includes(tableId);
  return b.space_id === s.tables.find(t => t.id === tableId)?.space_id;
};

export const activeBlockForTable = (s: AppState, tableId: string) => {
  const now = Date.now();
  return s.blocks.find(
    b => blockApplies(s, tableId)(b) && new Date(b.starts_at).getTime() <= now && new Date(b.ends_at).getTime() > now
  );
};

export const nextBlockForTable = (s: AppState, tableId: string) => {
  const now = Date.now();
  return s.blocks
    .filter(b => blockApplies(s, tableId)(b) && new Date(b.starts_at).getTime() > now)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
};

// ── Items left behind ──
export const lostItemsAtTable = (s: AppState, tableId: string) =>
  s.lostItems.filter(i => i.table_id === tableId && i.status === 'at_table');

// ── Announcements for a space (or everyone) ──
export const announcementsFor = (s: AppState, spaceId?: string | null) => {
  const now = Date.now();
  return s.announcements.filter(
    a => new Date(a.expires_at).getTime() > now && (!a.space_id || a.space_id === spaceId)
  );
};

export const unreadCount = (s: AppState) => s.notifications.filter(n => !n.read_at).length;
