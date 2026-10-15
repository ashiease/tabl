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
import {
  BREAK_MINUTES,
  RESERVATION_SECONDS,
  SESSION_SECONDS,
} from '../constants/policy';
import { theme } from '../constants/theme';
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
import { useToast } from '../components/Toast';
import { Profile } from '../types';
import { supabase } from '../lib/supabase';

const Tab = createBottomTabNavigator();
const HomeStack = createNativeStackNavigator();

export function RootNavigator() {
  const store = useStore();
  const { state } = store;
  const toast = useToast();

  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [hostelPickerOpen, setHostelPickerOpen] = useState(false);

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

  const profile = state.profile!;
  const hasSession = !!myActiveSession(state);
  const myRes = myReservation(state);
  const waitCount = myWaitlist(state).length;
  const admin = isAdmin(state);

  // ─── Expiry tick ───
  useEffect(() => {
    const t = setInterval(async () => {
      const now = Date.now();
      const myId = state.profile?.id;
      if (!myId) return;

      const expiredActive = state.sessions.filter(
        s =>
          s.user_id === myId &&
          s.status === 'active' &&
          new Date(s.ends_at).getTime() <= now
      );
      for (const s of expiredActive) {
        try {
          await store.endSession(s.id, 'expired');
          toast.show('60 minutes up · Session ended', 'warning');
        } catch (e) {
          console.warn('[tick] endSession (active) failed:', e);
        }
      }

      const expiredBreak = state.sessions.filter(
        s =>
          s.user_id === myId &&
          s.status === 'on_break' &&
          s.break_ends_at &&
          new Date(s.break_ends_at).getTime() <= now
      );
      for (const s of expiredBreak) {
        try {
          await store.endSession(s.id, 'expired');
          toast.show('Break over · Session ended', 'warning');
        } catch (e) {
          console.warn('[tick] endSession (break) failed:', e);
        }
      }

      const expiredRes = state.reservations.filter(
        r => r.user_id === myId && new Date(r.expires_at).getTime() <= now
      );
      for (const r of expiredRes) {
        try {
          await store.cancelReservation(r.id);
        } catch (e) {
          console.warn('[tick] cancelReservation failed:', e);
        }
      }
    }, 1000);

    return () => clearInterval(t);
  }, [state.sessions, state.reservations, state.profile?.id, store, toast]);

  // ─── Break budget ───
  const breakBudgetRemaining = (() => {
    const s = myActiveSession(state);
    if (!s) return null;
    const used = s.break_seconds_used ?? 0;
    const total = BREAK_MINUTES * 60;
    return Math.max(0, total - used);
  })();

  // ─── Action wrappers ───

  const startSession = useCallback(
    async (tableId: string) => {
      const table = state.tables.find(t => t.id === tableId);
      if (!table) return;
      const endsAt = new Date(Date.now() + SESSION_SECONDS * 1000).toISOString();
      try {
        await store.checkInDirect(tableId, endsAt);
        toast.show(`Checked in · ${table.label}`, 'success');
        goToTab('Session');
      } catch (e: any) {
        toast.show(e?.message ?? 'Check-in failed', 'error');
      }
    },
    [state.tables, store, toast]
  );

  const scanToStart = useCallback(
    async (reservationId: string) => {
      const res = state.reservations.find(r => r.id === reservationId);
      if (!res) return;
      const table = state.tables.find(t => t.id === res.table_id);
      const endsAt = new Date(Date.now() + SESSION_SECONDS * 1000).toISOString();
      try {
        await store.scanToStart(reservationId, endsAt);
        toast.show(`Checked in · ${table?.label}`, 'success');
        goToTab('Session');
      } catch (e: any) {
        toast.show(e?.message ?? 'Check-in failed', 'error');
      }
    },
    [state.reservations, state.tables, store, toast]
  );

  const reserve = useCallback(
    async (tableId: string) => {
      const table = state.tables.find(t => t.id === tableId);
      if (!table) return;
      const expiresAt = new Date(Date.now() + RESERVATION_SECONDS * 1000).toISOString();
      try {
        await store.reserve(tableId, expiresAt);
        toast.show(`Reserved · ${table.label} — scan to start`, 'info');
        goToTab('Scan');
      } catch (e: any) {
        toast.show(e?.message ?? 'Reserve failed', 'error');
      }
    },
    [state.tables, store, toast]
  );

  const cancelReservation = useCallback(
    async (reservationId: string) => {
      try {
        await store.cancelReservation(reservationId);
        toast.show('Reservation cancelled', 'info');
      } catch (e: any) {
        toast.show(e?.message ?? 'Cancel failed', 'error');
      }
    },
    [store, toast]
  );

  const startBreak = useCallback(async () => {
    const s = myActiveSession(state);
    if (!s) return;
    try {
      await store.startBreak(s.id);
      toast.show(`Break started`, 'warning');
    } catch (e: any) {
      const msg = e?.message ?? 'Break failed';
      if (msg.includes('no_break_time_left')) {
        toast.show('No break time remaining', 'error');
      } else {
        toast.show(msg, 'error');
      }
    }
  }, [state, store, toast]);

  const endBreak = useCallback(async () => {
    const s = myActiveSession(state);
    if (!s) return;
    try {
      await store.endBreak(s.id);
      toast.show('Session resumed', 'success');
    } catch (e: any) {
      toast.show(e?.message ?? 'Resume failed', 'error');
    }
  }, [state, store, toast]);

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
    try {
      await store.endSession(s.id, 'completed');
      toast.show('Session ended · Table released', 'info');
    } catch (e: any) {
      toast.show(e?.message ?? 'End failed', 'error');
    }
  }, [state, confirm, store, toast]);

  const joinWaitlist = useCallback(
    async (tableId: string) => {
      const table = state.tables.find(t => t.id === tableId);
      if (!table) return;
      try {
        await store.joinWaitlist(tableId, table.space_id);
        toast.show(`Added to queue · ${table.label}`, 'success');
      } catch (e: any) {
        toast.show(e?.message ?? 'Queue failed', 'error');
      }
    },
    [state.tables, store, toast]
  );

  const leaveWaitlist = useCallback(
    async (entryId: string) => {
      try {
        await store.leaveWaitlist(entryId);
        toast.show('Left waitlist', 'info');
      } catch (e: any) {
        toast.show(e?.message ?? 'Leave failed', 'error');
      }
    },
    [store, toast]
  );

  // ─── Table tap ───
  const handleTablePress = useCallback(
    async (tableId: string) => {
      const table = state.tables.find(t => t.id === tableId);
      if (!table) return;

      const mine = myActiveSession(state);
      const myR = myReservation(state);

      if (mine && mine.table_id === tableId) { goToTab('Session'); return; }
      if (mine) {
        toast.show('You already have an active session', 'error');
        goToTab('Session');
        return;
      }

      if (myR && myR.table_id === tableId) {
        const remaining = secondsUntil(myR.expires_at);
        const choice = await confirm({
          title: 'Check In Required',
          message: `You reserved Table ${table.label}. Scan the QR on the table to start your session.\n\nTime remaining: ${formatTime(remaining)}`,
          confirmText: 'Scan QR',
          cancelText: 'Cancel Reservation',
        });
        if (choice) goToTab('Scan');
        else await cancelReservation(myR.id);
        return;
      }

      if (myR && myR.table_id !== tableId) {
        const otherTable = state.tables.find(t => t.id === myR.table_id);
        const ok = await confirm({
          title: 'Cancel Reservation?',
          message: `You have Table ${otherTable?.label} reserved. Cancel it and continue with ${table.label}?`,
          confirmText: 'Cancel & Continue',
          cancelText: 'Keep',
        });
        if (!ok) return;
        await cancelReservation(myR.id);
      }

      if (table.status === 'available') {
        const space = findSpace(table.space_id);
        const ok = await confirm({
          title: 'Reserve Table',
          message: `Reserve Table ${table.label} in ${space?.name}? You'll have ${RESERVATION_SECONDS / 60} minutes to scan the QR and start your session.`,
          confirmText: 'Reserve',
          cancelText: 'Cancel',
        });
        if (ok) await reserve(tableId);
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
        w => w.table_id === tableId && w.user_id === profile.id && w.status === 'waiting'
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
      if (ok) await joinWaitlist(tableId);
    },
    [state, profile.id, confirm, reserve, cancelReservation, joinWaitlist, toast]
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
      const myR = myReservation(state);
      const otherRes = state.reservations.find(
        r => r.table_id === table.id && r.user_id !== profile.id
      );

      if (mine) {
        if (mine.table_id === table.id) { goToTab('Session'); return true; }
        toast.show('You already have an active session', 'error');
        goToTab('Session');
        return true;
      }

      if (otherRes) {
        toast.show('Reserved by another student — may free up soon', 'warning');
        return false;
      }

      if (myR && myR.table_id === table.id) {
        scanToStart(myR.id);
        return true;
      }

      if (myR && myR.table_id !== table.id) {
        const otherTable = state.tables.find(t => t.id === myR.table_id);
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
    [state, profile.id, toast, scanToStart, startSession, handleTablePress]
  );

  // ─── UI handlers ───
  const handleSetHostel = useCallback(() => setHostelPickerOpen(true), []);
  const handleUserPress = useCallback(() => setAccountMenuOpen(true), []);

  const handlePickHostel = useCallback(
    async (spaceId: string) => {
      setHostelPickerOpen(false);
      try {
        await store.setHostel(spaceId);
        toast.show(`Home set · ${findSpace(spaceId)?.name}`, 'success');
      } catch (e: any) {
        toast.show(e?.message ?? 'Update failed', 'error');
      }
    },
    [store, toast]
  );

  const handleSignOut = useCallback(async () => {
    setAccountMenuOpen(false);
    await store.signOut();
  }, [store]);

  const handleReset = useCallback(async () => {
    const ok = await confirm({
      title: 'Reset All Tables',
      message: 'Set every table back to available? This also clears all sessions, reservations, and waitlists.',
      confirmText: 'Reset',
      cancelText: 'Cancel',
      destructive: true,
    });
    if (!ok) return;
    try {
      const { error } = await supabase.rpc('reset_all_tables');
      if (error) throw error;
      await store.refreshAll();
      toast.show('All tables reset', 'info');
    } catch (e: any) {
      toast.show(e?.message ?? 'Reset failed', 'error');
    }
  }, [confirm, store, toast]);

  // Header values
  const sessionVariant: 'default' | 'away' = (() => {
    const s = myActiveSession(state);
    if (s?.status === 'on_break') return 'away';
    return 'default';
  })();

  const sessionTitle =
    sessionVariant === 'away' ? 'Away' : 'My Session';

  const sessionSubtitle = (() => {
    const s = myActiveSession(state);
    if (!s) return 'Track your study time';
    const table = state.tables.find(t => t.id === s.table_id);
    const space = findSpace(s.space_id);
    return `${space?.name} · ${table?.label}`;
  })();

  // ─── Home nested stack ───
  const HomeStackNavigator = () => (
    <HomeStack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
      <HomeStack.Screen name="HomeMain">
        {({ navigation }) => (
          <>
            <AppHeader
              title={admin ? 'Admin' : 'Home'}
              subtitle={admin ? 'Occupancy & utilization' : 'Library & your hostel'}
              profile={profile}
              onUserPress={handleUserPress}
            />
            {admin ? (
              <AdminScreen onReset={handleReset} />
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
              profile={profile}
              onUserPress={handleUserPress}
            />
            <BrowseScreen
              onOpenSpace={id => navigation.navigate('Map', { spaceId: id })}
            />
          </>
        )}
      </HomeStack.Screen>

      <HomeStack.Screen name="Map">
        {({ route }: any) => {
          const spaceId = route.params?.spaceId as string;
          const space = findSpace(spaceId);
          return (
            <>
              <AppHeader
                title={space?.name ?? 'Map'}
                subtitle={space?.type === 'library' ? 'Library' : 'Hostel'}
                profile={profile}
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
                profile={profile}
                onUserPress={handleUserPress}
              />
              <SessionScreen
                onStartBreak={startBreak}
                onEndBreak={endBreak}
                onEndSession={endSession}
                breakBudgetRemaining={breakBudgetRemaining}
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
                profile={profile}
                onUserPress={handleUserPress}
              />
              <WaitlistScreen onLeave={leaveWaitlist} />
            </>
          )}
        />

        <Tab.Screen name="Scan">
          {() => (
            <ScanTabContent
              profile={profile}
              onUserPress={handleUserPress}
              onScan={handleScan}
              onExit={() => goToHome()}
            />
          )}
        </Tab.Screen>
      </Tab.Navigator>

      <AccountMenu
        visible={accountMenuOpen}
        title="Account"
        subtitle={`@${profile.username} · ${profile.display_name}`}
        items={[
          {
            label: 'Change hostel',
            hint: myHostelId(state) ? findSpace(myHostelId(state)!)?.name : 'Not set',
            onSelect: () => {
              setAccountMenuOpen(false);
              setTimeout(() => setHostelPickerOpen(true), 200);
            },
          },
          {
            label: 'Sign out',
            onSelect: handleSignOut,
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

function ScanTabContent({
  profile,
  onUserPress,
  onScan,
  onExit,
}: {
  profile: Profile;
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
        profile={profile}
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