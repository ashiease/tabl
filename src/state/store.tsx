import React, {
    createContext, useContext, useEffect, useReducer, useState, useCallback,
  } from 'react';
  import AsyncStorage from '@react-native-async-storage/async-storage';
  import { AppState } from '../types';
  import { STORAGE_KEY } from '../constants/policy';
  import { SPACES } from '../constants/spaces';
  
  type Action =
    | { type: 'HYDRATE'; payload: AppState }
    | { type: 'SET_USER'; payload: string }
    | { type: 'SET_HOSTEL'; payload: { userId: string; spaceId: string } }
    | { type: 'CHECK_IN'; payload: { tableId: string; userId: string; sessionId: string; endsAt: string } }
    | { type: 'START_BREAK'; payload: { sessionId: string; breakEndsAt: string } }
    | { type: 'END_BREAK'; payload: { sessionId: string } }
    | { type: 'FINALIZE'; payload: { sessionId: string; reason: 'completed' | 'expired' } }
    | { type: 'BREAK_EXPIRED'; payload: { sessionId: string; graceEndsAt: string } }
    | { type: 'JOIN_WAITLIST'; payload: { entryId: string; tableId: string; spaceId: string; userId: string; createdAt: string } }
    | { type: 'LEAVE_WAITLIST'; payload: { entryId: string } }
    | { type: 'NOTIFY_NEXT'; payload: { tableId: string; entryId: string; at: string } }
    | { type: 'RESET'; payload: AppState };
  
  function seed(): AppState {
    const tables = SPACES.flatMap(space => {
      const prefix = space.type === 'library' ? 'L' : space.id.slice(0, 2).toUpperCase();
      return Array.from({ length: space.tables }, (_, i) => {
        const label = `${prefix}-${String(i + 1).padStart(2, '0')}`;
        return {
          id: `table-${space.id}-${i + 1}`,
          space_id: space.id,
          label,
          qr_code: `TABL-${space.id.toUpperCase()}-${label}`,
          status: 'available' as const,
          current_session_id: null,
        };
      });
    });
    return { tables, sessions: [], waitlist: [], hostelsByUser: {}, currentUserId: 'STU-001' };
  }
  
  function reducer(state: AppState, action: Action): AppState {
    switch (action.type) {
      case 'HYDRATE':
        return action.payload;
  
      case 'SET_USER':
        return { ...state, currentUserId: action.payload };
  
      case 'SET_HOSTEL':
        return {
          ...state,
          hostelsByUser: {
            ...state.hostelsByUser,
            [action.payload.userId]: action.payload.spaceId,
          },
        };
  
      case 'CHECK_IN': {
        const { tableId, userId, sessionId, endsAt } = action.payload;
        const table = state.tables.find(t => t.id === tableId);
        if (!table) return state;
  
        const session = {
          id: sessionId,
          table_id: tableId,
          space_id: table.space_id,
          user_id: userId,
          status: 'active' as const,
          started_at: new Date().toISOString(),
          ends_at: endsAt,
          ended_at: null,
          break_ends_at: null,
          break_duration: null,
          grace_ends_at: null,
        };
  
        return {
          ...state,
          sessions: [...state.sessions, session],
          tables: state.tables.map(t =>
            t.id === tableId
              ? { ...t, status: 'occupied', current_session_id: sessionId }
              : t
          ),
        };
      }
  
      case 'START_BREAK': {
        const { sessionId, breakEndsAt } = action.payload;
        const session = state.sessions.find(s => s.id === sessionId);
        if (!session) return state;
  
        return {
          ...state,
          sessions: state.sessions.map(s =>
            s.id === sessionId
              ? { ...s, status: 'on_break', break_ends_at: breakEndsAt, break_duration: 15, grace_ends_at: null }
              : s
          ),
          tables: state.tables.map(t =>
            t.id === session.table_id ? { ...t, status: 'on_break' } : t
          ),
        };
      }
  
      case 'END_BREAK': {
        const { sessionId } = action.payload;
        const session = state.sessions.find(s => s.id === sessionId);
        if (!session) return state;
  
        return {
          ...state,
          sessions: state.sessions.map(s =>
            s.id === sessionId
              ? { ...s, status: 'active', break_ends_at: null, break_duration: null, grace_ends_at: null }
              : s
          ),
          tables: state.tables.map(t =>
            t.id === session.table_id ? { ...t, status: 'occupied' } : t
          ),
        };
      }
  
      case 'BREAK_EXPIRED': {
        const { sessionId, graceEndsAt } = action.payload;
        return {
          ...state,
          sessions: state.sessions.map(s =>
            s.id === sessionId
              ? { ...s, status: 'on_break_expired', grace_ends_at: graceEndsAt }
              : s
          ),
        };
      }
  
      case 'FINALIZE': {
        const { sessionId, reason } = action.payload;
        const session = state.sessions.find(s => s.id === sessionId);
        if (!session) return state;
  
        return {
          ...state,
          sessions: state.sessions.map(s =>
            s.id === sessionId
              ? { ...s, status: reason, ended_at: new Date().toISOString() }
              : s
          ),
          tables: state.tables.map(t =>
            t.id === session.table_id
              ? { ...t, status: 'available', current_session_id: null }
              : t
          ),
        };
      }
  
      case 'JOIN_WAITLIST':
        return {
          ...state,
          waitlist: [
            ...state.waitlist,
            {
              id: action.payload.entryId,
              table_id: action.payload.tableId,
              space_id: action.payload.spaceId,
              user_id: action.payload.userId,
              created_at: action.payload.createdAt,
              notified: false,
              status: 'waiting',
            },
          ],
        };
  
      case 'LEAVE_WAITLIST':
        return {
          ...state,
          waitlist: state.waitlist.filter(w => w.id !== action.payload.entryId),
        };
  
      case 'NOTIFY_NEXT':
        return {
          ...state,
          waitlist: state.waitlist.map(w =>
            w.id === action.payload.entryId
              ? { ...w, notified: true, notified_at: action.payload.at }
              : w
          ),
        };
  
      case 'RESET':
        return action.payload;
  
      default:
        return state;
    }
  }
  
  interface StoreValue {
    state: AppState;
    dispatch: React.Dispatch<Action>;
    hydrated: boolean;
  }
  
  const StoreContext = createContext<StoreValue | null>(null);
  
  export function StoreProvider({ children }: { children: React.ReactNode }) {
    const [state, dispatch] = useReducer(reducer, seed());
    const [hydrated, setHydrated] = useState(false);
  
    // Load from AsyncStorage on mount
    useEffect(() => {
      (async () => {
        try {
          const raw = await AsyncStorage.getItem(STORAGE_KEY);
          if (raw) dispatch({ type: 'HYDRATE', payload: JSON.parse(raw) });
        } catch {}
        setHydrated(true);
      })();
    }, []);
  
    // Persist on every change (after hydration)
    useEffect(() => {
      if (!hydrated) return;
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
    }, [state, hydrated]);
  
    return (
      <StoreContext.Provider value={{ state, dispatch, hydrated }}>
        {children}
      </StoreContext.Provider>
    );
  }
  
  export function useStore() {
    const ctx = useContext(StoreContext);
    if (!ctx) throw new Error('useStore must be used inside StoreProvider');
    return ctx;
  }