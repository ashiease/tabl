import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useStore } from '../state/store';
import {
  myActiveSession,
  myWaitlist,
  isAdmin,
  myHostelId,
  queueLength,
  queuePosition,
} from '../state/selectors';
import { findSpace, SPACES } from '../constants/spaces';
import { USERS, findUser } from '../constants/users';
import {
  ADMIN_PASSCODE,
  BREAK_MINUTES,
  SESSION_SECONDS,
} from '../constants/policy';
import { theme } from '../constants/theme';
import { newId, makeBreakEnd } from '../logic/sessions';
import { computeExpiryActions } from '../logic/expiry';
import { goToTab } from './navRef';

// Screens
import { HomeScreen } from '../screens/HomeScreen';
import { BrowseScreen } from '../screens/BrowseScreen';
import { MapScreen } from '../screens/MapScreen';
import { SessionScreen } from '../screens/SessionScreen';
import { WaitlistScreen } from '../screens/WaitlistScreen';
import { AdminScreen } from '../screens/AdminScreen';

// Components
import { AppHeader } from './headers';
import { ConfirmDialog, ConfirmConfig } from '../components/ConfirmDialog';
import { AccountMenu } from '../components/AccountMenu';
import { PickerSheet } from '../components/PickerSheet';
import { PasscodeDialog } from '../components/PasscodeDialog';
import { useToast } from '../components/Toast';
import { TabBar } from './TabBar';


const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

export function RootNavigator() {
  const { state, dispatch } = useStore();
  const toast = useToast();

  // Global UI state
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [hostelPickerOpen, setHostelPickerOpen] = useState(false);
  const [userSwitcherOpen, setUserSwitcherOpen] = useState(false);
  const [passcodeOpen, setPasscodeOpen] = useState(false);

  // Confirm dialog (single reusable instance)
  const [confirmCfg, setConfirmCfg] = useState<ConfirmConfig | null>(null);
  const [confirmResolve, setConfirmResolve] = useState<
    ((v: boolean) => void) | null
  >(null);

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

  // Derived values
  const user = findUser(state.currentUserId)!;
  const hasSession = !!myActiveSession(state);
  const waitCount = myWaitlist(state).length;

  // Expiry tick
  useEffect(() => {
    const t = setInterval(() => {
      const actions = computeExpiryActions(state);
      actions.forEach(a => {
        dispatch(a);
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

  // ─── Actions ───

  const notifyNextInWaitlist = useCallback(
    (tableId: string, snapshot = state) => {
      const next = snapshot.waitlist
        .filter(
          w =>
            w.table_id === tableId &&
            !w.notified &&
            w.status === 'waiting'
        )
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

  const checkIn = useCallback(
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

      // Jump to the Session tab
      goToTab('Session');
    },
    [state, dispatch, toast]
  );

  const startBreak = useCallback(() => {
    const s = myActiveSession(state);
    if (!s) return;
    dispatch({
      type: 'START_BREAK',
      payload: { sessionId: s.id, breakEndsAt: makeBreakEnd() },
    });
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
    dispatch({
      type: 'FINALIZE',
      payload: { sessionId: s.id, reason: 'completed' },
    });
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

  const handleTablePress = useCallback(
    async (tableId: string) => {
      const table = state.tables.find(t => t.id === tableId);
      if (!table) return;

      const mine = myActiveSession(state);

      if (mine && mine.table_id === tableId) {
        goToTab('Session');
        return;
      }
      if (mine) {
        toast.show('You already have an active session', 'error');
        goToTab('Session');
        return;
      }

      if (table.status === 'available') {
        const space = findSpace(table.space_id);
        const ok = await confirm({
          title: 'Check In',
          message: `Check in to Table ${table.label} in ${space?.name}?`,
          confirmText: 'Check In',
          cancelText: 'Cancel',
        });
        if (ok) checkIn(tableId);
        return;
      }

      if (table.status === 'on_break') {
        toast.show('Owner is on break — table may free up soon', 'warning');
        return;
      }

      // Occupied → waitlist
      const existing = state.waitlist.find(
        w =>
          w.table_id === tableId &&
          w.user_id === state.currentUserId &&
          w.status === 'waiting'
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
    [state, confirm, checkIn, joinWaitlist, toast]
  );

  const handleSetHostel = useCallback(() => setHostelPickerOpen(true), []);
  const handleUserPress = useCallback(() => setAccountMenuOpen(true), []);

  const handlePickHostel = useCallback(
    (spaceId: string) => {
      dispatch({
        type: 'SET_HOSTEL',
        payload: { userId: state.currentUserId, spaceId },
      });
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
      message: 'Wipe all sessions, tables, and waitlists?',
      confirmText: 'Reset',
      cancelText: 'Cancel',
      destructive: true,
    });
    if (!ok) return;
    dispatch({ type: 'RESET', payload: seedFreshState() });
    toast.show('Reset complete', 'info');
  }, [confirm, dispatch, toast]);

  // Session header values
  const sessionVariant: 'default' | 'away' | 'grace' = (() => {
    const s = myActiveSession(state);
    if (s?.status === 'on_break') return 'away';
    if (s?.status === 'on_break_expired') return 'grace';
    return 'default';
  })();

  const sessionTitle =
    sessionVariant === 'away'
      ? 'Away'
      : sessionVariant === 'grace'
      ? 'Grace'
      : 'My Session';

  const sessionSubtitle = (() => {
    const s = myActiveSession(state);
    if (!s) return 'Track your study time';
    const table = state.tables.find(t => t.id === s.table_id);
    const space = findSpace(s.space_id);
    return `${space?.name} · ${table?.label}`;
  })();

  // ─── Tabs ───
const Tabs = () => (
    <Tab.Navigator
  tabBar={props => <TabBar {...props} />}
  screenOptions={({ route }) => ({
    headerShown: false,
    tabBarBadge:
      route.name === 'Session' && hasSession
        ? '●'
        : route.name === 'Wait' && waitCount > 0
        ? waitCount
        : undefined,
    tabBarBadgeStyle: {
      backgroundColor:
        route.name === 'Session' ? theme.colors.green : theme.colors.red,
      color: route.name === 'Session' ? '#061a0d' : '#fff',
      fontFamily: theme.fonts.monoBold,
      fontSize: 9,
    },
  })}
  initialRouteName={hasSession ? 'Session' : 'Home'}
>
      <Tab.Screen
        name="Home"
        children={({ navigation }) => (
          <>
            <AppHeader
              title="Home"
              subtitle="Library & your hostel"
              user={user}
              onUserPress={handleUserPress}
            />
            <HomeScreen
              onOpenSpace={id =>
                navigation.getParent()?.navigate('Map', { spaceId: id })
              }
              onOpenBrowse={() => navigation.getParent()?.navigate('Browse')}
              onSetHostel={handleSetHostel}
            />
          </>
        )}
      />
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
      <Tab.Screen
        name="Admin"
        children={() => (
          <>
            <AppHeader
              title="Admin"
              subtitle="Occupancy & utilization"
              user={user}
              onUserPress={handleUserPress}
            />
            <AdminScreen onUnlock={handleUnlockAdmin} onReset={handleReset} />
          </>
        )}
      />
    </Tab.Navigator>
  );

  // ─── Stack wrappers ───
  const BrowseWrapper = ({ navigation }: any) => (
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
  );

  const MapWrapper = ({ route }: any) => {
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
  };

  return (
    <>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Tabs" component={Tabs} />
        <Stack.Screen name="Browse" component={BrowseWrapper} />
        <Stack.Screen
          name="Map"
          component={MapWrapper}
          options={{ animation: 'slide_from_right' }}
        />
      </Stack.Navigator>

      {/* Global overlays */}
      <AccountMenu
        visible={accountMenuOpen}
        title="Account"
        subtitle={`${state.currentUserId} · ${user.name}`}
        items={[
          {
            label: 'Change hostel',
            hint: myHostelId(state)
              ? findSpace(myHostelId(state)!)?.name
              : 'Not set',
            onSelect: () => {
              setAccountMenuOpen(false);
              setTimeout(() => setHostelPickerOpen(true), 200);
            },
          },
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

// Seed helper — matches store's initial state
function seedFreshState() {
  const tables = SPACES.flatMap(space => {
    const prefix =
      space.type === 'library' ? 'L' : space.id.slice(0, 2).toUpperCase();
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
    waitlist: [],
    hostelsByUser: {},
    currentUserId: 'STU-001',
  };
}