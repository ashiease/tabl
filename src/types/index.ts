export type SpaceType = 'library' | 'hostel';
export type TableStatus = 'available' | 'occupied' | 'on_break';
export type SessionStatus =
  | 'active'
  | 'on_break'
  | 'on_break_expired'
  | 'completed'
  | 'expired';
export type UserRole = 'student' | 'admin';

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
  qr_code: string;
  status: TableStatus;
  current_session_id: string | null;
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
  grace_ends_at: string | null;
}

export interface WaitlistEntry {
  id: string;
  table_id: string;
  space_id: string;
  user_id: string;
  created_at: string;
  notified: boolean;
  notified_at?: string;
  status: 'waiting' | 'expired';
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
}

export interface AppState {
  tables: Table[];
  sessions: Session[];
  waitlist: WaitlistEntry[];
  hostelsByUser: Record<string, string>;
  currentUserId: string;
}