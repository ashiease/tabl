import React, { useCallback, useEffect, useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useStore } from '../state/store';
import {
  myActiveSession,
  myWaitlist,
  isAdmin,
  myHostelId,
  myReservation,
  queueLength,
  queuePosition,
} from '../state/selectors';
import { findSpace, SPACES } from '../constants/spaces';
import { USERS, findUser } from '../constants/users';
import {
  ADMIN_PASSCODE,
  BREAK_MINUTES,
  RESERVATION_SECONDS,
  SESSION_SECONDS,
} from '../constants/policy';
import { theme } from '../constants/theme';
import { newId, makeBreakEnd } from '../logic/sessions';
import { computeExpiryActions } from '../logic/expiry';
import { goToTab, goToHome } from './navRef';
import { formatTime, secondsUntil } from '../utils/time';

// Screens
import { HomeScreen } from '../screens/HomeScreen';
import { BrowseScreen } from '../screens/BrowseScreen';
import { MapScreen } from '../screens/MapScreen';
import { SessionScreen } from '../screens/SessionScreen';
import { WaitlistScreen } from '../screens/WaitlistScreen';
import { AdminScreen } from '../screens/AdminScreen';
import { ScanScreen } from '../screens/ScanScreen';

// Components
import { AppHeader } from './headers';
import { TabBar } from './TabBar';
import { ConfirmDialog, ConfirmConfig } from '../components/ConfirmDialog';
import { AccountMenu } from '../components/AccountMenu';
import { PickerSheet } from '../components/PickerSheet';
import { PasscodeDialog } from '../components/PasscodeDialog';
import { useToast } from '../components/Toast';
import { User } from '../types';

const Tab = createBottomTabNavigator();
const HomeStack = createNativeStackNavigator();

export function RootNavigator() {
  const { state, dispatch } = useStore();
  const toast = useToast();

  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [hostelPickerOpen, setHostelPickerOpen] = useState(false);
  const [userSwitcherOpen, setUserSwitcherOpen] = useState(false);
  const [passcodeOpen, setPasscodeOpen] = useState(false);

  const [confirmCfg, setConfirmCfg] = useState<ConfirmConfig | null>(null);
  const [confirmResolve, setConfirmResolve] = useState<((v: boolean) => void) | null>(null);

  const confirm = useCallback((cfg: ConfirmConfig) => {
    return new Promise<boolean>(resolve => {
      setConfirmCfg(cfg);
      setConfirmResolve(() => resolve);
    });
  }, []);

  const handleConfirm = useCallback(() => {
    confirmResolve?.(true);
    setConfirmCfg(null);
    setConfirmResolve(null);
  }, [confirmResolve]);

  const handleCancel = useCallback(() => {
    confirmResolve?.(false);
    setConfirmCfg(null);
    setConfirmResolve(null);
  }, [confirmResolve]);

  const user = findUser(state.currentUserId)!;
  const hasSession = !!myActiveSession(state);
  const myRes = myReservation(state);
  const waitCount = myWaitlist(state).length;
  const admin = isAdmin(state);

  // Expiry tick
  useEffect(() => {
    const t = setInterval(() => {
      const actions = computeExpiryActions(state);
      actions.forEach(a => {
        dispatch(a);
        if (a.type === 'RESERVATION_EXPIRED') {
          const r = state.reservations.find(x => x.id === a.payload.reservationId);
          if (r?.user_id === state.currentUserId) {
            const table = state.tables.find(t => t.id === r.table_id);
            toast.show(`Reservation expired · ${table?.label} released`, 'warning');
          }
        }
        if (a.type === 'FINALIZE' && a.payload.reason === 'expired') {
          const s = state.sessions.find(x => x.id === a.payload.sessionId);
          if (s?.user_id === state.currentUserId) {
            toast.show('60 minutes up · Session ended', 'warning');
          }
        }
      });
    }, 1000);
    return () => clearInterval(t);
  }, [state, dispatch, toast]);

  // ─── Shared actions ───

  const notifyNextInWaitlist = useCallback(
    (tableId: string, snapshot = state) => {
      const next = snapshot.waitlist
        .filter(w => w.table_id === tableId && !w.notified && w.status === 'waiting')
        .sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
      if (next) {
        dispatch({
          type: 'NOTIFY_NEXT',
          payload: { tableId, entryId: next.id, at: new Date().toISOString() },
        });
        if (next.user_id === state.currentUserId) {
          toast.show('Table now available', 'success');
        }
      }
    },
    [state, dispatch, toast]
  );

  const startSession = useCallback(
    (tableId: string) => {
      const table = state.tables.find(t => t.id === tableId);
      if (!table) return;
      const sessionId = newId('session');
      const endsAt = new Date(Date.now() + SESSION_SECONDS * 1000).toISOString();
      dispatch({
        type: 'CHECK_IN',
        payload: { tableId, userId: state.currentUserId, sessionId, endsAt },
      });
      toast.show(`Checked in · ${table.label}`, 'success');
      goToTab('Session');
    },
    [state, dispatch, toast]
  );

  const scanToStart = useCallback(
    (reservationId: string) => {
      const res = state.reservations.find(r => r.id === reservationId);
      if (!res) return;
      const table = state.tables.find(t => t.id === res.table_id);
      const sessionId = newId('session');
      const endsAt = new Date(Date.now() + SESSION_SECONDS * 1000).toISOString();
      dispatch({
        type: 'SCAN_TO_START',
        payload: { reservationId, sessionId, endsAt },
      });
      toast.show(`Checked in · ${table?.label}`, 'success');
      goToTab('Session');
    },
    [state, dispatch, toast]
  );

  const reserve = useCallback(
    (tableId: string) => {
      const table = state.tables.find(t => t.id === tableId);
      if (!table) return;
      const now = Date.now();
      dispatch({
        type: 'RESERVE',
        payload: {
          reservationId: newId('res'),
          tableId,
          spaceId: table.space_id,
          userId: state.currentUserId,
          createdAt: new Date(now).toISOString(),
          expiresAt: new Date(now + RESERVATION_SECONDS * 1000).toISOString(),
        },
      });
      toast.show(`Reserved · ${table.label} — scan to start`, 'info');
      goToTab('Scan');
    },
    [state, dispatch, toast]
  );

  const cancelReservation = useCallback(
    (reservationId: string) => {
      dispatch({ type: 'CANCEL_RESERVATION', payload: { reservationId } });
      toast.show('Reservation cancelled', 'info');
    },
    [dispatch, toast]
  );

  const startBreak = useCallback(() => {
    const s = myActiveSession(state);
    if (!s) return;
    dispatch({ type: 'START_BREAK', payload: { sessionId: s.id, breakEndsAt: makeBreakEnd() } });
    toast.show(`Break started · ${BREAK_MINUTES} min`, 'warning');
  }, [state, dispatch, toast]);

  const endBreak = useCallback(() => {
    const s = myActiveSession(state);
    if (!s) return;
    dispatch({ type: 'END_BREAK', payload: { sessionId: s.id } });
    toast.show('Session resumed', 'success');
  }, [state, dispatch, toast]);

  const endSession = useCallback(async () => {
    const s = myActiveSession(state);
    if (!s) return;
    const ok = await confirm({
      title: 'End Session',
      message: 'Release this table for others?',
      confirmText: 'End Session',
      cancelText: 'Cancel',
      destructive: true,
    });
    if (!ok) return;
    dispatch({ type: 'FINALIZE', payload: { sessionId: s.id, reason: 'completed' } });
    notifyNextInWaitlist(s.table_id);
    toast.show('Session ended · Table released', 'info');
  }, [state, dispatch, confirm, notifyNextInWaitlist, toast]);

  const joinWaitlist = useCallback(
    (tableId: string) => {
      const table = state.tables.find(t => t.id === tableId);
      if (!table) return;
      dispatch({
        type: 'JOIN_WAITLIST',
        payload: {
          entryId: newId('wait'),
          tableId,
          spaceId: table.space_id,
          userId: state.currentUserId,
          createdAt: new Date().toISOString(),
        },
      });
      toast.show(`Added to queue · ${table.label}`, 'success');
    },
    [state, dispatch, toast]
  );

  const leaveWaitlist = useCallback(
    (entryId: string) => {
      dispatch({ type: 'LEAVE_WAITLIST', payload: { entryId } });
      toast.show('Left waitlist', 'info');
    },
    [dispatch, toast]
  );

  // ─── Table tap (Map) ───
  const handleTablePress = useCallback(
    async (tableId: string) => {
      const table = state.tables.find(t => t.id === tableId);
      if (!table) return;

      const mine = myActiveSession(state);
      const myRes = myReservation(state);

      if (mine && mine.table_id === tableId) {
        goToTab('Session');
        return;
      }
      if (mine) {
        toast.show('You already have an active session', 'error');
        goToTab('Session');
        return;
      }

      if (myRes && myRes.table_id === tableId) {
        const remaining = secondsUntil(myRes.expires_at);
        const choice = await confirm({
          title: 'Check In Required',
          message: `You reserved Table ${table.label}. Scan the QR on the table to start your session.\n\nTime remaining: ${formatTime(remaining)}`,
          confirmText: 'Scan QR',
          cancelText: 'Cancel Reservation',
        });
        if (choice) {
          goToTab('Scan');
        } else {
          cancelReservation(myRes.id);
        }
        return;
      }

      if (myRes && myRes.table_id !== tableId) {
        const otherTable = state.tables.find(t => t.id === myRes.table_id);
        const ok = await confirm({
          title: 'Cancel Reservation?',
          message: `You have Table ${otherTable?.label} reserved. Cancel it and continue with ${table.label}?`,
          confirmText: 'Cancel & Continue',
          cancelText: 'Keep',
        });
        if (!ok) return;
        dispatch({ type: 'CANCEL_RESERVATION', payload: { reservationId: myRes.id } });
      }

      if (table.status === 'available') {
        const space = findSpace(table.space_id);
        const ok = await confirm({
          title: 'Reserve Table',
          message: `Reserve Table ${table.label} in ${space?.name}? You'll have ${RESERVATION_SECONDS / 60} minutes to scan the QR and start your session.`,
          confirmText: 'Reserve',
          cancelText: 'Cancel',
        });
        if (ok) reserve(tableId);
        return;
      }

      if (table.status === 'reserved') {
        toast.show('Reserved by another student — may free up soon', 'warning');
        return;
      }

      if (table.status === 'on_break') {
        toast.show('Owner is on break — table may free up soon', 'warning');
        return;
      }

      const existing = state.waitlist.find(
        w => w.table_id === tableId && w.user_id === state.currentUserId && w.status === 'waiting'
      );

      if (existing) {
        const pos = queuePosition(state, existing.id);
        const ok = await confirm({
          title: 'Already Waiting',
          message: `You're already in this queue for ${table.label} (position #${pos}).`,
          confirmText: 'View Waitlist',
          cancelText: 'Cancel',
        });
        if (ok) goToTab('Wait');
        return;
      }

      const len = queueLength(state, tableId);
      const space = findSpace(table.space_id);
      const queueLine =
        len > 0
          ? ` ${len} ${len === 1 ? 'person is' : 'people are'} already waiting.`
          : ' No one else is waiting yet.';
      const ok = await confirm({
        title: 'Join Waitlist',
        message: `Table ${table.label} in ${space?.name} is occupied.${queueLine} Join the queue?`,
        confirmText: 'Join',
        cancelText: 'Cancel',
      });
      if (ok) joinWaitlist(tableId);
    },
    [state, confirm, reserve, cancelReservation, joinWaitlist, toast]
  );

  // ─── Scan handler ───
  const handleScan = useCallback(
    (data: string): boolean => {
      const table = state.tables.find(t => t.id === data);
      if (!table) {
        toast.show('Not a study table', 'error');
        return false;
      }

      const mine = myActiveSession(state);
      const myRes = myReservation(state);
      const otherRes = state.reservations.find(
        r => r.table_id === table.id && r.user_id !== state.currentUserId
      );

      if (mine) {
        if (mine.table_id === table.id) {
          goToTab('Session');
          return true;
        }
        toast.show('You already have an active session', 'error');
        goToTab('Session');
        return true;
      }

      if (otherRes) {
        toast.show('Reserved by another student — may free up soon', 'warning');
        return false;
      }

      if (myRes && myRes.table_id === table.id) {
        scanToStart(myRes.id);
        return true;
      }

      if (myRes && myRes.table_id !== table.id) {
        const otherTable = state.tables.find(t => t.id === myRes.table_id);
        toast.show(`You have ${otherTable?.label} reserved. Cancel it first.`, 'error');
        return false;
      }

      if (table.status === 'available') {
        startSession(table.id);
        return true;
      }

      if (table.status === 'occupied') {
        handleTablePress(table.id);
        return true;
      }

      if (table.status === 'on_break') {
        toast.show('Owner is on break — table may free up soon', 'warning');
        return true;
      }

      return false;
    },
    [state, toast, scanToStart, startSession, handleTablePress]
  );

  // ─── UI handlers ───
  const handleSetHostel = useCallback(() => setHostelPickerOpen(true), []);
  const handleUserPress = useCallback(() => setAccountMenuOpen(true), []);

  const handlePickHostel = useCallback(
    (spaceId: string) => {
      dispatch({ type: 'SET_HOSTEL', payload: { userId: state.currentUserId, spaceId } });
      setHostelPickerOpen(false);
      toast.show(`Home set · ${findSpace(spaceId)?.name}`, 'success');
    },
    [dispatch, state.currentUserId, toast]
  );

  const handleSwitchUser = useCallback(
    (userId: string) => {
      dispatch({ type: 'SET_USER', payload: userId });
      setUserSwitcherOpen(false);
      toast.show(`Switched to ${userId}`, 'info');
    },
    [dispatch, toast]
  );

  const handleUnlockAdmin = useCallback(() => setPasscodeOpen(true), []);

  const handlePasscodeSubmit = useCallback(
    (code: string) => {
      setPasscodeOpen(false);
      if (code === ADMIN_PASSCODE) {
        dispatch({ type: 'SET_USER', payload: 'ADM-001' });
        toast.show('Admin unlocked', 'success');
      } else {
        toast.show('Incorrect passcode', 'error');
      }
    },
    [dispatch, toast]
  );

  const handleReset = useCallback(async () => {
    const ok = await confirm({
      title: 'Reset Demo Data',
      message: 'Wipe all sessions, reservations, tables, and waitlists?',
      confirmText: 'Reset',
      cancelText: 'Cancel',
      destructive: true,
    });
    if (!ok) return;
    dispatch({ type: 'RESET', payload: seedFreshState() });
    toast.show('Reset complete', 'info');
  }, [confirm, dispatch, toast]);

  // Header values
  const sessionVariant: 'default' | 'away' | 'grace' = (() => {
    const s = myActiveSession(state);
    if (s?.status === 'on_break') return 'away';
    if (s?.status === 'on_break_expired') return 'grace';
    return 'default';
  })();

  const sessionTitle =
    sessionVariant === 'away' ? 'Away'
    : sessionVariant === 'grace' ? 'Grace'
    : 'My Session';

  const sessionSubtitle = (() => {
    const s = myActiveSession(state);
    if (!s) return 'Track your study time';
    const table = state.tables.find(t => t.id === s.table_id);
    const space = findSpace(s.space_id);
    return `${space?.name} · ${table?.label}`;
  })();

  // ─── Home nested stack (Home / Browse / Map) ───
  const HomeStackNavigator = () => (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="HomeMain">
        {({ navigation }) => (
          <>
            <AppHeader
              title={admin ? 'Admin' : 'Home'}
              subtitle={admin ? 'Occupancy & utilization' : 'Library & your hostel'}
              user={user}
              onUserPress={handleUserPress}
            />
            {admin ? (
              <AdminScreen onUnlock={handleUnlockAdmin} onReset={handleReset} />
            ) : (
              <HomeScreen
                onOpenSpace={id => navigation.navigate('Map', { spaceId: id })}
                onSetHostel={handleSetHostel}
              />
            )}
          </>
        )}
      </HomeStack.Screen>

      <HomeStack.Screen name="Browse">
        {({ navigation }) => (
          <>
            <AppHeader
              title="All Spaces"
              subtitle="Library & 13 hostels"
              user={user}
              onUserPress={handleUserPress}
            />
            <BrowseScreen
              onOpenSpace={id => navigation.navigate('Map', { spaceId: id })}
            />
          </>
        )}
      </HomeStack.Screen>

      <HomeStack.Screen
        name="Map"
        options={{ animation: 'fade' }} // fade, slide_from_right, slide_from_bottom, flip, none, default
      >
        {({ route }: any) => {
          const spaceId = route.params?.spaceId as string;
          const space = findSpace(spaceId);
          return (
            <>
              <AppHeader
                title={space?.name ?? 'Map'}
                subtitle={space?.type === 'library' ? 'Library' : 'Hostel'}
                user={user}
                onUserPress={handleUserPress}
              />
              <MapScreen spaceId={spaceId} onTablePress={handleTablePress} />
            </>
          );
        }}
      </HomeStack.Screen>
    </HomeStack.Navigator>
  );

  // ─── Tabs ───
  return (
    <>
      <Tab.Navigator
        tabBar={props => <TabBar {...props} />}
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarBadge:
            route.name === 'Session' && hasSession ? '●'
            : route.name === 'Wait' && waitCount > 0 ? waitCount
            : undefined,
          tabBarBadgeStyle: {
            backgroundColor: route.name === 'Session' ? theme.colors.green : theme.colors.red,
            color: route.name === 'Session' ? '#061a0d' : '#fff',
            fontFamily: theme.fonts.monoBold,
            fontSize: 9,
          },
        })}
        initialRouteName={hasSession ? 'Session' : myRes ? 'Scan' : 'Home'}
      >
        <Tab.Screen name="Home" component={HomeStackNavigator} />

        <Tab.Screen
          name="Session"
          children={() => (
            <>
              <AppHeader
                title={sessionTitle}
                subtitle={sessionSubtitle}
                titleVariant={sessionVariant}
                user={user}
                onUserPress={handleUserPress}
              />
              <SessionScreen
                onStartBreak={startBreak}
                onEndBreak={endBreak}
                onEndSession={endSession}
              />
            </>
          )}
        />

        <Tab.Screen
          name="Wait"
          children={() => (
            <>
              <AppHeader
                title="Waitlist"
                subtitle="Your queued tables"
                user={user}
                onUserPress={handleUserPress}
              />
              <WaitlistScreen onLeave={leaveWaitlist} />
            </>
          )}
        />

        <Tab.Screen name="Scan">
          {() => (
            <ScanTabContent
              user={user}
              onUserPress={handleUserPress}
              onScan={handleScan}
              onExit={() => goToHome()}
            />
          )}
        </Tab.Screen>
      </Tab.Navigator>

      {/* Global overlays */}
      <AccountMenu
        visible={accountMenuOpen}
        title="Account"
        subtitle={`${state.currentUserId} · ${user.name}`}
        items={[
          {
            label: 'Change hostel',
            hint: myHostelId(state) ? findSpace(myHostelId(state)!)?.name : 'Not set',
            onSelect: () => {
              setAccountMenuOpen(false);
              setTimeout(() => setHostelPickerOpen(true), 200);
            },
          },
          ...(!admin
            ? [
                {
                  label: 'Unlock Admin',
                  hint: 'passcode',
                  onSelect: () => {
                    setAccountMenuOpen(false);
                    setTimeout(() => setPasscodeOpen(true), 200);
                  },
                },
              ]
            : []),
          {
            label: 'Switch user',
            hint: 'demo',
            onSelect: () => {
              setAccountMenuOpen(false);
              setTimeout(() => setUserSwitcherOpen(true), 200);
            },
          },
          {
            label: 'Close',
            onSelect: () => setAccountMenuOpen(false),
          },
        ]}
        onCancel={() => setAccountMenuOpen(false)}
      />

      <PickerSheet
        visible={hostelPickerOpen}
        title="Where do you stay?"
        message="Pick your resident hostel. You can change this anytime."
        items={SPACES.filter(s => s.type === 'hostel').map(s => ({
          id: s.id,
          label: s.name,
          isActive: myHostelId(state) === s.id,
        }))}
        onSelect={handlePickHostel}
        onCancel={() => setHostelPickerOpen(false)}
      />

      <PickerSheet
        visible={userSwitcherOpen}
        title="Switch User"
        message="Demo only — pick a user to act as."
        items={USERS.map(u => ({
          id: u.id,
          label: `${u.id} · ${u.name}`,
          sublabel: u.role,
          isActive: u.id === state.currentUserId,
          isAdmin: u.role === 'admin',
        }))}
        onSelect={handleSwitchUser}
        onCancel={() => setUserSwitcherOpen(false)}
      />

      <PasscodeDialog
        visible={passcodeOpen}
        onSubmit={handlePasscodeSubmit}
        onCancel={() => setPasscodeOpen(false)}
      />

      <ConfirmDialog
        visible={!!confirmCfg}
        title={confirmCfg?.title ?? ''}
        message={confirmCfg?.message ?? ''}
        confirmText={confirmCfg?.confirmText}
        cancelText={confirmCfg?.cancelText}
        accent={confirmCfg?.accent}
        destructive={confirmCfg?.destructive}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </>
  );
}

/**
 * Scan tab content — separated so it can tick every second and keep
 * the reservation countdown live.
 */
function ScanTabContent({
  user,
  onUserPress,
  onScan,
  onExit,
}: {
  user: User;
  onUserPress: () => void;
  onScan: (data: string) => boolean;
  onExit: () => void;
}) {
  const { state } = useStore();
  const [, force] = useState(0);

  useEffect(() => {
    const t = setInterval(() => force(x => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const res = myReservation(state);
  const resTable = res ? state.tables.find(t => t.id === res.table_id) : null;
  const label = res
    ? `RESERVED: ${resTable?.label} · ${formatTime(secondsUntil(res.expires_at))}`
    : null;

  return (
    <>
      <AppHeader
        title="Scan"
        subtitle="Point at a table QR"
        user={user}
        onUserPress={onUserPress}
      />
      <ScanScreen
        onScan={onScan}
        onExit={onExit}
        reservationLabel={label}
      />
    </>
  );
}

function seedFreshState() {
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
  return {
    tables,
    sessions: [],
    reservations: [],
    waitlist: [],
    hostelsByUser: {},
    currentUserId: 'STU-001',
  };
}