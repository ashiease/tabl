export type SpaceType = 'library' | 'hostel';
export type TableStatus = 'available' | 'reserved' | 'occupied' | 'on_break' | 'blocked';
export type SessionStatus =
  | 'active'
  | 'on_break'
  | 'completed'
  | 'expired';
export type UserRole = 'student' | 'admin';

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  role: UserRole;
  hostel_id: string | null;
  suspended_until?: string | null;
  suspended_reason?: string | null;
}

export interface Space {
  id: string;
  name: string;
  type: SpaceType;
  tables: number;
}

export interface Table {
  id: string;
  space_id: string;
  label: string;
  status: TableStatus;
  current_session_id: string | null;
  updated_at: string;
}

export interface Session {
  id: string;
  table_id: string;
  space_id: string;
  user_id: string;
  status: SessionStatus;
  started_at: string;
  ends_at: string;
  ended_at: string | null;
  break_ends_at: string | null;
  break_duration: number | null;
  paused_at: string | null;
  break_started_at: string | null;
  break_seconds_used: number;
}

export interface Reservation {
  id: string;
  table_id: string;
  space_id: string;
  user_id: string;
  created_at: string;
  expires_at: string;
}

export interface WaitlistEntry {
  id: string;
  table_id: string;
  space_id: string;
  user_id: string;
  created_at: string;
  notified: boolean;
  notified_at?: string | null;
  status: 'waiting' | 'expired';
}

/** Rules set by the admin (server is the source of truth). */
export interface Policy {
  session_minutes: number;
  break_minutes: number;
  hold_minutes: number;
  exam_mode: boolean;
  exam_session_minutes: number;
  exam_break_minutes: number;
  misuse_limit: number;
  misuse_window_days: number;
  misuse_pause_hours: number;
}

/** Someone using an away table until its owner returns. */
export interface Borrow {
  id: number;
  table_id: string;
  space_id: string;
  user_id: string;
  owner_session_id: string;
  started_at: string;
  status: 'active' | 'ended' | 'converted';
}

export interface BlockBooking {
  id: number;
  title: string;
  space_id: string;
  table_ids: string[] | null;
  starts_at: string;
  ends_at: string;
  cancelled_at: string | null;
}

export interface LostItem {
  id: number;
  table_id: string;
  space_id: string;
  description: string;
  status: 'at_table' | 'at_desk' | 'returned';
  created_at: string;
}

export interface Announcement {
  id: number;
  created_at: string;
  space_id: string | null;
  title: string;
  body: string;
  expires_at: string;
}

export interface AppNotification {
  id: number;
  title: string;
  body: string;
  data: Record<string, any>;
  created_at: string;
  read_at: string | null;
}

export interface MyStatus {
  suspended_until: string | null;
  suspended_reason: string | null;
  reserve_paused_until: string | null;
  roster_active: boolean;
  roster_hostel: string | null;
  unread: number;
}

export interface WaitPosition {
  entry_id: string;
  table_id: string;
  queue_position: number;
  waiting: number;
}

export interface AppState {
  tables: Table[];
  sessions: Session[];
  reservations: Reservation[];
  waitlist: WaitlistEntry[];
  profiles: Profile[];
  profile: Profile | null;
  policy: Policy | null;
  borrows: Borrow[];
  blocks: BlockBooking[];
  lostItems: LostItem[];
  announcements: Announcement[];
  notifications: AppNotification[];
  myStatus: MyStatus | null;
  waitPositions: WaitPosition[];
  waitCounts: Record<string, number>;
}
