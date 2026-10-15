import React, {
  createContext, useContext, useCallback, useEffect, useRef, useState,
} from 'react';
import { AppState as RNAppState, AppStateStatus } from 'react-native';
import { supabase } from '../lib/supabase';
import { AppState, Profile, Table, Session, Reservation, WaitlistEntry } from '../types';
import { newId } from '../logic/sessions';

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
  startBreak: (sessionId: string, breakEndsAt: string) => Promise<void>;
  endBreak: (sessionId: string) => Promise<void>;
  joinWaitlist: (tableId: string, spaceId: string) => Promise<void>;
  leaveWaitlist: (entryId: string) => Promise<void>;
  setHostel: (spaceId: string) => Promise<void>;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>({
    tables: [],
    sessions: [],
    reservations: [],
    waitlist: [],
    profiles: [],
    profile: null,
  });
  const [ready, setReady] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ─── Fetch helpers ───

  // Sorts tables by space_id, then by the numeric suffix of the id.
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
      .in('status', ['active', 'on_break', 'on_break_expired']);
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
    const { data } = await supabase
      .from('waitlist')
      .select('*')
      .eq('status', 'waiting');
    return (data ?? []) as WaitlistEntry[];
  }, []);

  /**
   * Fetch all profiles — but only if the caller is an admin.
   * RLS now blocks students from reading other users' profiles, so a
   * student would get zero rows. Rather than spam the network with a
   * call that always returns empty for students, we check first.
   */
  const fetchProfiles = useCallback(async (): Promise<Profile[]> => {
    // Get current profile to know if admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: me } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (me?.role !== 'admin') {
      return [];
    }

    const { data } = await supabase
      .from('profiles')
      .select('id, username, display_name, role, hostel_id');
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
      const [tables, sessions, reservations, waitlist, profile] =
        await Promise.all([
          fetchTables(),
          fetchSessions(),
          fetchReservations(),
          fetchWaitlist(),
          fetchProfile(),
        ]);

      // Fetch profiles after we know the current user (for admin check)
      const profiles = await fetchProfiles();

      setState({ tables, sessions, reservations, waitlist, profiles, profile });
    } catch (e) {
      console.warn('[refreshAll] failed:', e);
      const profile = await fetchProfile().catch(() => null);
      setState(prev => ({ ...prev, profile }));
    }
  }, [fetchTables, fetchSessions, fetchReservations, fetchWaitlist, fetchProfiles, fetchProfile]);

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
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('[signOut] supabase signOut error:', e);
    }
    setState({
      tables: [], sessions: [], reservations: [], waitlist: [], profiles: [], profile: null,
    });
    setReady(false);
    console.log('[signOut] done');
  }, []);

  // ─── Bootstrap ───

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          await refreshAll();
          setReady(true);
        }
      } catch (e) {
        console.warn('[bootstrap] failed:', e);
      }
    })();
  }, [refreshAll]);

  // ─── Realtime ───

  useEffect(() => {
    if (!ready) return;

    const ch = supabase
      .channel('tabl-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, async () => {
        const tables = await fetchTables();
        setState(s => ({ ...s, tables }));
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
        const waitlist = await fetchWaitlist();
        setState(s => ({ ...s, waitlist }));
      })
      .subscribe();

    channelRef.current = ch;

    return () => {
      supabase.removeChannel(ch);
      channelRef.current = null;
    };
  }, [ready, fetchTables, fetchSessions, fetchReservations, fetchWaitlist]);

  // ─── Foreground refresh ───

  useEffect(() => {
    const sub = RNAppState.addEventListener('change', (s: AppStateStatus) => {
      if (s === 'active' && ready) refreshAll();
    });
    return () => sub.remove();
  }, [ready, refreshAll]);

  // ─── Actions ───

  const reserve = useCallback(async (tableId: string, expiresAt: string) => {
    const { error } = await supabase.rpc('reserve_table', {
      p_table_id: tableId,
      p_reservation_id: newId('res'),
      p_expires_at: expiresAt,
    });
    if (error) throw error;
    await refreshAll();
  }, [refreshAll]);

  const cancelReservation = useCallback(async (reservationId: string) => {
    const { error } = await supabase.rpc('cancel_reservation', {
      p_reservation_id: reservationId,
    });
    if (error) throw error;
    await refreshAll();
  }, [refreshAll]);

  const scanToStart = useCallback(async (reservationId: string, endsAt: string) => {
    const { error } = await supabase.rpc('scan_to_start', {
      p_reservation_id: reservationId,
      p_session_id: newId('session'),
      p_ends_at: endsAt,
    });
    if (error) throw error;
    await refreshAll();
  }, [refreshAll]);

  const checkInDirect = useCallback(async (tableId: string, endsAt: string) => {
    const { error } = await supabase.rpc('check_in_direct', {
      p_table_id: tableId,
      p_session_id: newId('session'),
      p_ends_at: endsAt,
    });
    if (error) throw error;
    await refreshAll();
  }, [refreshAll]);

  const endSession = useCallback(async (sessionId: string, reason: 'completed' | 'expired') => {
    const { error } = await supabase.rpc('end_session', {
      p_session_id: sessionId,
      p_reason: reason,
    });
    if (error) throw error;
    await refreshAll();
  }, [refreshAll]);

  const startBreak = useCallback(async (sessionId: string, breakEndsAt: string) => {
    const { error } = await supabase.rpc('start_break', {
      p_session_id: sessionId,
      p_break_ends_at: breakEndsAt,
      p_break_duration: 15,
    });
    if (error) throw error;
    await refreshAll();
  }, [refreshAll]);

  const endBreak = useCallback(async (sessionId: string) => {
    const { error } = await supabase.rpc('end_break', { p_session_id: sessionId });
    if (error) throw error;
    await refreshAll();
  }, [refreshAll]);

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

  return (
    <StoreContext.Provider value={{
      state, ready, refreshAll,
      signIn, signOut,
      reserve, cancelReservation, scanToStart, checkInDirect,
      endSession, startBreak, endBreak,
      joinWaitlist, leaveWaitlist, setHostel,
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