export type SpaceType = 'library' | 'hostel';
export type TableStatus = 'available' | 'reserved' | 'occupied' | 'on_break';
export type SessionStatus =
  | 'active'
  | 'on_break'
  | 'on_break_expired'
  | 'completed'
  | 'expired';
export type UserRole = 'student' | 'admin';

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  role: UserRole;
  hostel_id: string | null;
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
  grace_ends_at: string | null;
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

export interface AppState {
  tables: Table[];
  sessions: Session[];
  reservations: Reservation[];
  waitlist: WaitlistEntry[];
  profiles: Profile[];         // ← new: all users, for owner name lookup
  profile: Profile | null;     // current logged-in user
}