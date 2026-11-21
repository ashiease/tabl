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
  myBorrow,
  borrowForTable,
  activeBlockForTable,
  nextBlockForTable,
  sessionForTable,
  breakSeconds,
  holdSeconds,
  sessionSeconds,
  lostItemsAtTable,
  unreadCount,
} from '../state/selectors';
import { findSpace, SPACES } from '../constants/spaces';
import { RESERVATION_SECONDS, SESSION_SECONDS } from '../constants/policy';
import { friendlyError } from '../utils/errors';
import { setReminders, Reminder } from '../lib/push';
import { theme } from '../constants/theme';
import { goToTab, goToHome } from './navRef';
import { formatClock, formatTime, secondsUntil } from '../utils/time';

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
import { ProofSheet } from '../components/ProofSheet';
import { NotificationsSheet } from '../components/NotificationsSheet';
import { ReportKind } from '../state/store';
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
  const [proofOpen, setProofOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [tableMenuFor, setTableMenuFor] = useState<string | null>(null);
  const [reportFor, setReportFor] = useState<string | null>(null);

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
  const hasSession = !!myActiveSession(state) || !!myBorrow(state);
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
          toast.show('Time up · Session ended · Collect your belongings', 'warning');
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
          toast.show('Break over · Session ended · Collect your belongings', 'warning');
        } catch (e) {
          console.warn('[tick] endSession (break) failed:', e);
        }
      }

      const expiredRes = state.reservations.filter(
        r => r.user_id === myId && new Date(r.expires_at).getTime() <= now
      );
      // The server releases expired reservations (and records missed ones);
      // here we only refresh so the screen catches up.
      if (expiredRes.length > 0) {
        store.refreshAll().catch(() => {});
      }
    }, 1000);

    return () => clearInterval(t);
  }, [state.sessions, state.reservations, state.profile?.id, store, toast]);

  // ─── Break budget ───
  const breakBudgetRemaining = (() => {
    const s = myActiveSession(state);
    if (!s) return null;
    const used = s.break_seconds_used ?? 0;
    const total = breakSeconds(state.policy);
    return Math.max(0, total - used);
  })();

  // ─── Local reminders (fire even with the app closed) ───
  const reminderKey = (() => {
    const s = myActiveSession(state);
    const r = myReservation(state);
    const b = myBorrow(state);
    return [s?.id, s?.status, s?.ends_at, s?.break_ends_at, r?.id, r?.expires_at, b?.id].join('|');
  })();
  useEffect(() => {
    const s = myActiveSession(state);
    const r = myReservation(state);
    const list: Reminder[] = [];
    const at = (iso: string, minusSec: number) => new Date(new Date(iso).getTime() - minusSec * 1000);
    if (s?.status === 'active') {
      list.push({ at: at(s.ends_at, 15 * 60), title: '15 minutes left', body: 'Your study session ends soon.' });
      list.push({ at: at(s.ends_at, 60), title: '1 minute left', body: 'Your session is about to end. Collect your belongings.' });
    }
    if (s?.status === 'on_break' && s.break_ends_at) {
      list.push({ at: at(s.break_ends_at, 3 * 60), title: 'Break ends in 3 minutes', body: "Head back and tap \"I'm back\" or the table is released." });
      list.push({ at: at(s.break_ends_at, 60), title: 'Break ends in 1 minute', body: 'Your table will be released if you are not back.' });
    }
    if (r) {
      list.push({ at: at(r.expires_at, 60), title: '1 minute to scan', body: 'Scan the table QR or your reservation is released.' });
    }
    setReminders(list);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reminderKey]);

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
        toast.show(friendlyError(e, 'Check-in failed'), 'error');
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
        toast.show(friendlyError(e, 'Check-in failed'), 'error');
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
        toast.show(friendlyError(e, 'Reserve failed'), 'error');
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
        toast.show(friendlyError(e, 'Cancel failed'), 'error');
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
      toast.show(friendlyError(e, 'Break failed'), 'error');
    }
  }, [state, store, toast]);

  const endBreak = useCallback(async () => {
    const s = myActiveSession(state);
    if (!s) return;
    try {
      await store.endBreak(s.id);
      toast.show('Session resumed', 'success');
    } catch (e: any) {
      toast.show(friendlyError(e, 'Resume failed'), 'error');
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
      toast.show('Session ended · Collect your belongings', 'info');
    } catch (e: any) {
      toast.show(friendlyError(e, 'End failed'), 'error');
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
        toast.show(friendlyError(e, 'Queue failed'), 'error');
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
        toast.show(friendlyError(e, 'Leave failed'), 'error');
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
      const myB = myBorrow(state);

      if (mine && mine.table_id === tableId) { goToTab('Session'); return; }
      if (myB && myB.table_id === tableId) { goToTab('Session'); return; }
      if (myB) {
        toast.show('You are using another table right now', 'error');
        goToTab('Session');
        return;
      }

      if (table.status === 'blocked') {
        const blk = activeBlockForTable(state, tableId);
        toast.show(
          blk ? `${blk.title} · booked until ${formatClock(new Date(blk.ends_at))}` : 'This table is booked',
          'warning'
        );
        return;
      }
      if (table.status === 'on_break' || table.status === 'occupied') {
        // occupied / away: queue (occupied only), report a problem, or how to use it while the owner is away
        setTableMenuFor(tableId);
        return;
      }

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
        const items = lostItemsAtTable(state, tableId);
        const nextBlk = nextBlockForTable(state, tableId);
        const extra =
          (items.length ? `\n\nNote: ${items.map(i => i.description).join(', ')} was left at this table.` : '') +
          (nextBlk && new Date(nextBlk.starts_at).getTime() - Date.now() < sessionSeconds(state.policy) * 1000
            ? `\n\nBooked for ${nextBlk.title} from ${formatClock(new Date(nextBlk.starts_at))}, so your session ends then.`
            : '');
        const ok = await confirm({
          title: 'Reserve Table',
          message: `Reserve Table ${table.label} in ${space?.name}? You'll have ${Math.round(holdSeconds(state.policy) / 60)} minutes to scan the QR and start your session.${extra}`,
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

    },
    [state, profile.id, confirm, reserve, cancelReservation, toast]
  );

  // Join the queue for an occupied table (from the table menu)
  const askJoinWaitlist = useCallback(
    async (tableId: string) => {
      const table = state.tables.find(t => t.id === tableId);
      if (!table) return;
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
      const sess = sessionForTable(state, tableId);
      const freeLine = sess?.status === 'active' ? ` Free by ${formatClock(new Date(sess.ends_at))}.` : '';
      const queueLine =
        len > 0
          ? ` ${len} ${len === 1 ? 'person is' : 'people are'} already waiting.`
          : ' No one else is waiting yet.';
      const ok = await confirm({
        title: 'Join Waitlist',
        message: `Table ${table.label} in ${space?.name} is occupied.${freeLine}${queueLine} When it frees up it's held for you for ${Math.round(holdSeconds(state.policy) / 60)} minutes. Join the queue?`,
        confirmText: 'Join',
        cancelText: 'Cancel',
      });
      if (ok) await joinWaitlist(tableId);
    },
    [state, profile.id, confirm, joinWaitlist]
  );

  // 16 · use an away table until its owner returns (only by scanning it)
  const askBorrow = useCallback(
    async (tableId: string) => {
      const table = state.tables.find(t => t.id === tableId);
      const owner = sessionForTable(state, tableId);
      if (!table || !owner || owner.status !== 'on_break') return;
      if (borrowForTable(state, tableId)) {
        toast.show('Someone is already using this table', 'warning');
        return;
      }
      const backBy = owner.break_ends_at ? formatClock(new Date(owner.break_ends_at)) : 'soon';
      const ok = await confirm({
        title: 'Use Until Owner Returns',
        message: `${table.label}'s owner is on a break and must be back by ${backBy}. You can use it until then. If they don't return, it becomes yours for a full session. If they return, please free it.`,
        confirmText: 'Use Table',
        cancelText: 'Cancel',
        accent: 'yellow',
      });
      if (!ok) return;
      try {
        await store.borrowTable(tableId);
        toast.show(`Using ${table.label} · until ${backBy}`, 'success');
        goToTab('Session');
      } catch (e: any) {
        toast.show(friendlyError(e, 'Could not use table'), 'error');
      }
    },
    [state, confirm, store, toast]
  );

  const endBorrow = useCallback(async () => {
    const ok = await confirm({
      title: 'Free This Table',
      message: 'Stop using this table? Please take your belongings with you.',
      confirmText: 'Free Table',
      cancelText: 'Cancel',
    });
    if (!ok) return;
    try {
      await store.endBorrow();
      toast.show('Table freed · Collect your belongings', 'info');
    } catch (e: any) {
      toast.show(friendlyError(e, 'Failed'), 'error');
    }
  }, [confirm, store, toast]);

  // 18 · report a problem at a table
  const submitReport = useCallback(
    async (tableId: string, kind: ReportKind) => {
      setReportFor(null);
      try {
        await store.reportTable(tableId, kind);
        toast.show('Report sent to the admin', 'success');
      } catch (e: any) {
        toast.show(friendlyError(e, 'Report failed'), 'error');
      }
    },
    [store, toast]
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
      const myB = myBorrow(state);
      const otherRes = state.reservations.find(
        r => r.table_id === table.id && r.user_id !== profile.id
      );

      if (mine) {
        if (mine.table_id === table.id) { goToTab('Session'); return true; }
        toast.show('You already have an active session', 'error');
        goToTab('Session');
        return true;
      }

      if (myB) {
        if (myB.table_id === table.id) { goToTab('Session'); return true; }
        toast.show('You are using another table right now', 'error');
        goToTab('Session');
        return true;
      }

      if (table.status === 'blocked') {
        handleTablePress(table.id);
        return false;
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
        askBorrow(table.id);
        return true;
      }

      return false;
    },
    [state, profile.id, toast, scanToStart, startSession, handleTablePress, askBorrow]
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
        toast.show(friendlyError(e, 'Update failed'), 'error');
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
      toast.show(friendlyError(e, 'Reset failed'), 'error');
    }
  }, [confirm, store, toast]);

  // Header values
  const sessionVariant: 'default' | 'away' = (() => {
    const s = myActiveSession(state);
    if (s?.status === 'on_break') return 'away';
    return 'default';
  })();

  const sessionTitle =
    sessionVariant === 'away' ? 'Away' : 'Session';

  const sessionSubtitle = (() => {
    const s = myActiveSession(state);
    const b = myBorrow(state);
    if (!s && b) {
      const t = state.tables.find(x => x.id === b.table_id);
      return `${findSpace(b.space_id)?.name} · ${t?.label} · until owner returns`;
    }
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
            fontFamily: theme.fonts.sansSemi,
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
                onEndBorrow={endBorrow}
                onShowProof={() => setProofOpen(true)}
                onReport={id => setReportFor(id)}
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
            label: `Notifications${unreadCount(state) ? ` (${unreadCount(state)} new)` : ''}`,
            onSelect: () => {
              setAccountMenuOpen(false);
              setTimeout(() => setNotesOpen(true), 200);
            },
          },
          {
            label: state.myStatus?.roster_active ? 'My hostel' : 'Change hostel',
            hint: myHostelId(state) ? findSpace(myHostelId(state)!)?.name : 'Not set',
            onSelect: () => {
              setAccountMenuOpen(false);
              if (state.myStatus?.roster_active) {
                toast.show("Your hostel comes from the warden's resident list", 'info');
                return;
              }
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

      {/* Table menu for occupied / away tables */}
      {(() => {
        const t = tableMenuFor ? state.tables.find(x => x.id === tableMenuFor) : undefined;
        const sess = t ? sessionForTable(state, t.id) : undefined;
        const sub =
          t?.status === 'on_break' && sess?.break_ends_at
            ? `Owner away · back by ${formatClock(new Date(sess.break_ends_at))}`
            : sess
            ? `Occupied · free by ${formatClock(new Date(sess.ends_at))}`
            : '';
        const items = [
          ...(t?.status === 'occupied'
            ? [{
                label: `Join waitlist${queueLength(state, t.id) ? ` · ${queueLength(state, t.id)} waiting` : ''}`,
                onSelect: () => { const id = t.id; setTableMenuFor(null); setTimeout(() => askJoinWaitlist(id), 200); },
              }]
            : []),
          ...(t?.status === 'on_break'
            ? [{
                label: 'Use until owner returns',
                hint: 'Scan its QR',
                onSelect: () => { setTableMenuFor(null); toast.show("Scan the table's QR to use it", 'info'); goToTab('Scan'); },
              }]
            : []),
          {
            label: 'Report a problem',
            onSelect: () => { const id = t?.id ?? null; setTableMenuFor(null); setTimeout(() => setReportFor(id), 200); },
          },
          { label: 'Close', onSelect: () => setTableMenuFor(null) },
        ];
        return (
          <AccountMenu
            visible={!!t}
            title={t ? `Table ${t.label}` : ''}
            subtitle={sub}
            items={items}
            onCancel={() => setTableMenuFor(null)}
          />
        );
      })()}

      <PickerSheet
        visible={!!reportFor}
        title="Report a problem"
        message={`Table ${state.tables.find(t => t.id === reportFor)?.label ?? ''} · the admin sees this with the time and who held the table.`}
        items={[
          { id: 'sitting_without_scanning', label: 'Someone is sitting without scanning' },
          { id: 'asked_to_leave', label: 'I was asked to leave my booked table' },
          { id: 'belongings_left', label: 'Belongings left here' },
          { id: 'damaged', label: 'Table or chair is damaged' },
          { id: 'other', label: 'Something else' },
        ]}
        onSelect={kind => reportFor && submitReport(reportFor, kind as ReportKind)}
        onCancel={() => setReportFor(null)}
      />

      {(() => {
        const s = myActiveSession(state);
        const t = s ? state.tables.find(x => x.id === s.table_id) : undefined;
        return s && t ? (
          <ProofSheet
            visible={proofOpen}
            name={profile.display_name}
            username={profile.username}
            tableLabel={t.label}
            spaceName={findSpace(t.space_id)?.name ?? ''}
            startedAt={s.started_at}
            endsAt={s.ends_at}
            onBreak={s.status === 'on_break'}
            onClose={() => setProofOpen(false)}
          />
        ) : null;
      })()}

      <NotificationsSheet
        visible={notesOpen}
        items={state.notifications}
        onClose={() => {
          setNotesOpen(false);
          store.markNotificationsRead().catch(() => {});
        }}
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