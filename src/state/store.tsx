import React, {
  createContext, useContext, useCallback, useEffect, useRef, useState,
} from 'react';
import { AppState as RNAppState, AppStateStatus } from 'react-native';
import { supabase } from '../lib/supabase';
import {
  AppState, Profile, Table, Session, Reservation, WaitlistEntry,
  Policy, Borrow, BlockBooking, LostItem, Announcement, AppNotification, MyStatus, WaitPosition,
} from '../types';
import { newId } from '../logic/sessions';
import { registerForPush, unregisterPush } from '../lib/push';

export type ReportKind =
  | 'sitting_without_scanning'
  | 'asked_to_leave'
  | 'belongings_left'
  | 'damaged'
  | 'other';

interface StoreValue {
  state: AppState;
  ready: boolean;
  refreshAll: () => Promise<void>;

  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;

  reserve: (tableId: string, expiresAt: string) => Promise<void>;
  cancelReservation: (reservationId: string) => Promise<void>;
  scanToStart: (reservationId: string, endsAt: string) => Promise<void>;
  checkInDirect: (tableId: string, endsAt: string) => Promise<void>;
  endSession: (sessionId: string, reason: 'completed' | 'expired') => Promise<void>;
  startBreak: (sessionId: string) => Promise<void>;
  endBreak: (sessionId: string) => Promise<void>;
  joinWaitlist: (tableId: string, spaceId: string) => Promise<void>;
  leaveWaitlist: (entryId: string) => Promise<void>;
  setHostel: (spaceId: string) => Promise<void>;

  borrowTable: (tableId: string) => Promise<void>;
  endBorrow: () => Promise<void>;
  reportTable: (tableId: string, kind: ReportKind, note?: string) => Promise<void>;
  markNotificationsRead: () => Promise<void>;
  /** Call any admin_* function; refreshes afterwards. */
  adminCall: <T = any>(fn: string, args?: Record<string, any>) => Promise<T>;
}

const EMPTY: AppState = {
  tables: [], sessions: [], reservations: [], waitlist: [], profiles: [], profile: null,
  policy: null, borrows: [], blocks: [], lostItems: [], announcements: [], notifications: [],
  myStatus: null, waitPositions: [], waitCounts: {},
};

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(EMPTY);
  const [ready, setReady] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pushTokenRef = useRef<string | null>(null);

  // ─── Fetch helpers ───

  const fetchTables = useCallback(async () => {
    const { data } = await supabase.from('tables').select('*');
    const rows = (data ?? []) as Table[];
    return rows.sort((a, b) => {
      if (a.space_id !== b.space_id) return a.space_id.localeCompare(b.space_id);
      const an = parseInt(a.id.split('-').pop() || '0', 10);
      const bn = parseInt(b.id.split('-').pop() || '0', 10);
      return an - bn;
    });
  }, []);

  const fetchSessions = useCallback(async () => {
    const { data } = await supabase
      .from('sessions')
      .select('*')
      .in('status', ['active', 'on_break']);
    return (data ?? []) as Session[];
  }, []);

  const fetchReservations = useCallback(async () => {
    const { data } = await supabase
      .from('reservations')
      .select('*')
      .gt('expires_at', new Date().toISOString());
    return (data ?? []) as Reservation[];
  }, []);

  const fetchWaitlist = useCallback(async () => {
    const [{ data }, pos, counts] = await Promise.all([
      supabase.from('waitlist').select('*').eq('status', 'waiting'),
      supabase.rpc('my_waitlist_positions'),
      supabase.rpc('waitlist_counts'),
    ]);
    const waitCounts: Record<string, number> = {};
    for (const r of (counts.data ?? []) as { table_id: string; waiting: number }[]) waitCounts[r.table_id] = r.waiting;
    return {
      waitlist: (data ?? []) as WaitlistEntry[],
      waitPositions: (pos.data ?? []) as WaitPosition[],
      waitCounts,
    };
  }, []);

  const fetchExtras = useCallback(async () => {
    const nowIso = new Date().toISOString();
    const [policy, borrows, blocks, lost, ann, notes, status] = await Promise.all([
      supabase.from('app_policy').select('*').eq('id', 1).maybeSingle(),
      supabase.from('table_borrows').select('*').eq('status', 'active'),
      supabase.from('block_bookings').select('*').is('cancelled_at', null).gt('ends_at', nowIso),
      supabase.from('lost_items').select('*').neq('status', 'returned'),
      supabase.from('announcements').select('*').gt('expires_at', nowIso).order('created_at', { ascending: false }),
      supabase.from('notifications').select('id, title, body, data, created_at, read_at')
        .order('created_at', { ascending: false }).limit(40),
      supabase.rpc('my_status'),
    ]);
    return {
      policy: (policy.data ?? null) as Policy | null,
      borrows: (borrows.data ?? []) as Borrow[],
      blocks: (blocks.data ?? []) as BlockBooking[],
      lostItems: (lost.data ?? []) as LostItem[],
      announcements: (ann.data ?? []) as Announcement[],
      notifications: (notes.data ?? []) as AppNotification[],
      myStatus: (status.data ?? null) as MyStatus | null,
    };
  }, []);

  const fetchProfiles = useCallback(async (): Promise<Profile[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: me } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (me?.role !== 'admin') return [];

    const { data } = await supabase
      .from('profiles')
      .select('id, username, display_name, role, hostel_id, suspended_until, suspended_reason');
    return (data ?? []) as Profile[];
  }, []);

  const fetchProfile = useCallback(async (): Promise<Profile | null> => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr) {
        console.warn('[fetchProfile] getUser error:', userErr.message);
      }
      if (user) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        if (error) {
          console.warn('[fetchProfile] profiles query error:', error.message);
        }
        if (data) return data as Profile;
      }
      await new Promise(r => setTimeout(r, 200));
    }
    console.warn('[fetchProfile] gave up after retries');
    return null;
  }, []);

  const refreshAll = useCallback(async () => {
    try {
      const [tables, sessions, reservations, wait, extras, profile] =
        await Promise.all([
          fetchTables(),
          fetchSessions(),
          fetchReservations(),
          fetchWaitlist(),
          fetchExtras(),
          fetchProfile(),
        ]);

      const profiles = await fetchProfiles();

      setState({ tables, sessions, reservations, ...wait, ...extras, profiles, profile });
    } catch (e) {
      console.warn('[refreshAll] failed:', e);
      const profile = await fetchProfile().catch(() => null);
      setState(prev => ({ ...prev, profile }));
    }
  }, [fetchTables, fetchSessions, fetchReservations, fetchWaitlist, fetchExtras, fetchProfiles, fetchProfile]);

  // ─── Auth ───

  const signIn = useCallback(async (username: string, password: string) => {
    const email = `${username.trim().toLowerCase()}@tabl.local`;
    console.log('[signIn] attempting:', email);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    console.log('[signIn] result:', {
      user: data?.user?.id,
      hasSession: !!data?.session,
      error: error?.message,
    });

    if (error) throw error;
    if (!data.session) throw new Error('Login failed: no session returned');

    try {
      await refreshAll();
    } catch (e) {
      console.warn('[signIn] refreshAll failed, continuing anyway:', e);
    }

    console.log('[signIn] complete');
    setReady(true);
  }, [refreshAll]);

  const signOut = useCallback(async () => {
    console.log('[signOut] signing out');
    // stop push notifications to this phone for this account
    await unregisterPush(pushTokenRef.current).catch(() => {});
    pushTokenRef.current = null;
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('[signOut] supabase signOut error:', e);
    }
    setState(EMPTY);
    setReady(false);
    console.log('[signOut] done');
  }, []);

  // ─── Bootstrap + auth state listener ───
  //
  // On cold start, we read the persisted session from AsyncStorage. If
  // it exists, we hydrate state and mark the app as ready.
  //
  // We also subscribe to onAuthStateChange so:
  //   - a `SIGNED_OUT` event (from any source) clears state and shows Login
  //   - a `TOKEN_REFRESHED` event re-triggers refreshAll so the user's
  //     profile and data stay fresh across the day
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        console.log('[bootstrap] checking stored session…');
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.warn('[bootstrap] getSession error:', error.message);
        }

        console.log(
          '[bootstrap] session:',
          session ? `user=${session.user.id}` : 'none'
        );

        if (session && mounted) {
          await refreshAll();
          if (mounted) {
            setReady(true);
            console.log('[bootstrap] ready with profile');
          }
        } else if (mounted) {
          setReady(false);
        }
      } catch (e) {
        console.warn('[bootstrap] failed:', e);
        if (mounted) setReady(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(
        '[auth event]',
        event,
        session ? `user=${session.user.id}` : 'no session'
      );

      if (event === 'SIGNED_OUT') {
        setState(EMPTY);
        setReady(false);
      } else if (event === 'SIGNED_IN' && session) {
        // signIn() already handles its own refreshAll, but this catches
        // other sign-in paths (e.g. auto-refresh from stored token).
        refreshAll().catch(() => {});
      } else if (event === 'TOKEN_REFRESHED' && session) {
        refreshAll().catch(() => {});
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [refreshAll]);

  // ─── Push notifications: register this phone once signed in ───

  useEffect(() => {
    if (!ready) return;
    registerForPush()
      .then(token => {
        pushTokenRef.current = token;
      })
      .catch(e => console.warn('[push] register failed:', e));
  }, [ready]);

  // ─── Realtime ───

  useEffect(() => {
    if (!ready) return;

    const refreshExtras = async () => {
      const extras = await fetchExtras();
      setState(s => ({ ...s, ...extras }));
    };

    const ch = supabase
      .channel('tabl-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, async () => {
        const [tables, wait] = await Promise.all([fetchTables(), fetchWaitlist()]);
        setState(s => ({ ...s, tables, ...wait }));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, async () => {
        const sessions = await fetchSessions();
        setState(s => ({ ...s, sessions }));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, async () => {
        const reservations = await fetchReservations();
        setState(s => ({ ...s, reservations }));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'waitlist' }, async () => {
        const wait = await fetchWaitlist();
        setState(s => ({ ...s, ...wait }));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'table_borrows' }, refreshExtras)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'block_bookings' }, refreshExtras)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lost_items' }, refreshExtras)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, refreshExtras)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, refreshExtras)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_policy' }, refreshExtras)
      .subscribe();

    channelRef.current = ch;

    return () => {
      supabase.removeChannel(ch);
      channelRef.current = null;
    };
  }, [ready, fetchTables, fetchSessions, fetchReservations, fetchWaitlist, fetchExtras]);

  // ─── Foreground refresh ───

  useEffect(() => {
    const sub = RNAppState.addEventListener('change', (s: AppStateStatus) => {
      if (s === 'active' && ready) refreshAll();
    });
    return () => sub.remove();
  }, [ready, refreshAll]);

  // ─── Actions ───
  // Times sent to the server are ignored there (it applies the admin's rules);
  // they are kept so older database versions still work.

  const call = useCallback(async (fn: string, args?: Record<string, any>) => {
    const { data, error } = await supabase.rpc(fn, args);
    if (error) throw error;
    await refreshAll();
    return data;
  }, [refreshAll]);

  const reserve = useCallback(async (tableId: string, expiresAt: string) => {
    await call('reserve_table', {
      p_table_id: tableId,
      p_reservation_id: newId('res'),
      p_expires_at: expiresAt,
    });
  }, [call]);

  const cancelReservation = useCallback(async (reservationId: string) => {
    await call('cancel_reservation', { p_reservation_id: reservationId });
  }, [call]);

  const scanToStart = useCallback(async (reservationId: string, endsAt: string) => {
    await call('scan_to_start', {
      p_reservation_id: reservationId,
      p_session_id: newId('session'),
      p_ends_at: endsAt,
    });
  }, [call]);

  const checkInDirect = useCallback(async (tableId: string, endsAt: string) => {
    await call('check_in_direct', {
      p_table_id: tableId,
      p_session_id: newId('session'),
      p_ends_at: endsAt,
    });
  }, [call]);

  const endSession = useCallback(async (sessionId: string, reason: 'completed' | 'expired') => {
    await call('end_session', { p_session_id: sessionId, p_reason: reason });
  }, [call]);

  const startBreak = useCallback(async (sessionId: string) => {
    await call('start_break', { p_session_id: sessionId, p_break_duration_minutes: 15 });
  }, [call]);

  const endBreak = useCallback(async (sessionId: string) => {
    await call('end_break', { p_session_id: sessionId });
  }, [call]);

  const joinWaitlist = useCallback(async (tableId: string, spaceId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('waitlist').insert({
      id: newId('wait'),
      table_id: tableId,
      space_id: spaceId,
      user_id: user.id,
    });
    if (error) throw error;
    await refreshAll();
  }, [refreshAll]);

  const leaveWaitlist = useCallback(async (entryId: string) => {
    const { error } = await supabase.from('waitlist').delete().eq('id', entryId);
    if (error) throw error;
    await refreshAll();
  }, [refreshAll]);

  const setHostel = useCallback(async (spaceId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from('profiles')
      .update({ hostel_id: spaceId })
      .eq('id', user.id);
    if (error) throw error;
    await refreshAll();
  }, [refreshAll]);

  const borrowTable = useCallback(async (tableId: string) => {
    await call('borrow_table', { p_table_id: tableId });
  }, [call]);

  const endBorrow = useCallback(async () => {
    await call('end_borrow');
  }, [call]);

  const reportTable = useCallback(async (tableId: string, kind: ReportKind, note?: string) => {
    await call('report_table', { p_table_id: tableId, p_kind: kind, p_note: note ?? null });
  }, [call]);

  const markNotificationsRead = useCallback(async () => {
    const { error } = await supabase.rpc('mark_notifications_read');
    if (error) throw error;
    setState(s => ({
      ...s,
      notifications: s.notifications.map(n => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })),
      myStatus: s.myStatus ? { ...s.myStatus, unread: 0 } : s.myStatus,
    }));
  }, []);

  const adminCall = useCallback(async (fn: string, args?: Record<string, any>) => {
    return call(fn, args);
  }, [call]) as StoreValue['adminCall'];

  return (
    <StoreContext.Provider value={{
      state, ready, refreshAll,
      signIn, signOut,
      reserve, cancelReservation, scanToStart, checkInDirect,
      endSession, startBreak, endBreak,
      joinWaitlist, leaveWaitlist, setHostel,
      borrowTable, endBorrow, reportTable, markNotificationsRead, adminCall,
    }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
