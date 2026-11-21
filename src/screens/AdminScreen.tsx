import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useStore } from '../state/store';
import { tablesInSpace, sessionForTable, borrowForTable, lostItemsAtTable } from '../state/selectors';
import { SPACES, findSpace } from '../constants/spaces';
import { theme } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { formatClock } from '../utils/time';
import { friendlyError } from '../utils/errors';
import { useToast } from '../components/Toast';
import { Button } from '../components/Button';
import { AccountMenu, MenuItem } from '../components/AccountMenu';
import { SectionLabel, Card, Row, Stat, Segments, styles as ui } from './admin/ui';
import { AdminInbox } from './admin/AdminInbox';
import { AdminStudents } from './admin/AdminStudents';
import { AdminManage } from './admin/AdminManage';
import { AdminLog } from './admin/AdminLog';

interface Props {
  onReset: () => void;
}

type Tab = 'live' | 'inbox' | 'students' | 'manage' | 'log';

interface Health {
  checked_at: string;
  expiry_job?: { schedule?: string; active?: boolean; last_run?: string | null; last_status?: string | null; failures_1h?: number; error?: string };
  push?: { queued?: number; devices?: number; last_status?: number | null; errors_1h?: number; error?: string };
  stuck_tables: { table_id: string; label: string; problem: string }[];
  open_reports: number;
  suspended_users: number;
  roster_size: number;
}

interface Insights {
  check_ins: number;
  no_shows: number;
  break_overruns: number;
  waitlist_offers: number;
  waitlist_claimed: number;
  borrow_converted: number;
  reports: number;
  by_hour: number[];
}

export function AdminScreen({ onReset }: Props) {
  const [tab, setTab] = useState<Tab>('live');
  const [openReports, setOpenReports] = useState(0);

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.segBar}>
        <Segments<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { id: 'live', label: 'Live' },
            { id: 'inbox', label: 'Inbox', badge: openReports },
            { id: 'students', label: 'Students' },
            { id: 'manage', label: 'Manage' },
            { id: 'log', label: 'Log' },
          ]}
        />
      </View>
      {tab === 'live' && <AdminLive onOpenReports={setOpenReports} goInbox={() => setTab('inbox')} />}
      {tab === 'inbox' && <AdminInbox onCount={setOpenReports} />}
      {tab === 'students' && <AdminStudents />}
      {tab === 'manage' && <AdminManage onReset={onReset} />}
      {tab === 'log' && <AdminLog />}
    </View>
  );
}

// ─── Live: occupancy, system health, last 7 days, live tables ───
function AdminLive({ onOpenReports, goInbox }: { onOpenReports: (n: number) => void; goInbox: () => void }) {
  const store = useStore();
  const { state } = store;
  const toast = useToast();
  const [health, setHealth] = useState<Health | null>(null);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [menu, setMenu] = useState<{ title: string; subtitle?: string; items: MenuItem[] } | null>(null);

  const load = useCallback(async () => {
    const [h, i] = await Promise.all([supabase.rpc('admin_health'), supabase.rpc('admin_insights', { p_days: 7 })]);
    if (h.data) {
      setHealth(h.data as Health);
      onOpenReports((h.data as Health).open_reports ?? 0);
    }
    if (i.data) setInsights(i.data as Insights);
  }, [onOpenReports]);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  const total = state.tables.length;
  const count = (st: string) => state.tables.filter(t => t.status === st).length;
  const available = count('available');
  const reserved = count('reserved');
  const occupied = count('occupied');
  const onBreak = count('on_break');
  const blocked = count('blocked');
  const inQueue = Object.values(state.waitCounts).reduce((a, b) => a + b, 0);
  const occupancy = total ? Math.round(((reserved + occupied + onBreak) / Math.max(1, total - blocked)) * 100) : 0;

  const usernameFor = (userId?: string | null) =>
    (userId && state.profiles.find(x => x.id === userId)?.username) || '—';

  const liveTables = state.tables
    .filter(t => t.status !== 'available')
    .map(table => {
      const session = sessionForTable(state, table.id);
      const reservation = state.reservations.find(r => r.table_id === table.id);
      const borrow = borrowForTable(state, table.id);
      return { table, session, reservation, borrow, owner: usernameFor(session?.user_id ?? reservation?.user_id) };
    })
    .sort((a, b) => {
      const order: Record<string, number> = { occupied: 0, on_break: 1, reserved: 2, blocked: 3 };
      return (order[a.table.status] ?? 9) - (order[b.table.status] ?? 9) || a.table.label.localeCompare(b.table.label);
    });

  const act = async (fn: string, args: Record<string, any>, done: string) => {
    setMenu(null);
    try {
      await store.adminCall(fn, args);
      toast.show(done, 'success');
      load();
    } catch (e: any) {
      toast.show(friendlyError(e), 'error');
    }
  };

  const openTable = (row: (typeof liveTables)[number]) => {
    const { table, session, reservation } = row;
    const items: MenuItem[] = [];
    if (session) {
      items.push({
        label: `Release table (end @${row.owner}'s session)`,
        onSelect: () => act('end_session', { p_session_id: session.id, p_reason: 'completed' }, `${table.label} released`),
      });
    }
    if (reservation) {
      items.push({
        label: `Cancel @${row.owner}'s reservation`,
        onSelect: () => act('cancel_reservation', { p_reservation_id: reservation.id }, `${table.label} released`),
      });
    }
    items.push({
      label: 'Mark an item left here',
      onSelect: () => act('admin_add_lost_item', { p_table_id: table.id, p_description: 'Item left at table' }, 'Item noted'),
    });
    items.push({ label: 'Close', onSelect: () => setMenu(null) });
    setMenu({
      title: `${table.label} · ${findSpace(table.space_id)?.name ?? ''}`,
      subtitle: session
        ? `@${row.owner} · ${session.status === 'on_break' ? `away, back by ${formatClock(new Date(session.break_ends_at!))}` : `until ${formatClock(new Date(session.ends_at))}`}`
        : reservation ? `Reserved by @${row.owner}` : table.status,
      items,
    });
  };

  const job = health?.expiry_job;
  const jobAgeSec = job?.last_run ? (Date.now() - new Date(job.last_run).getTime()) / 1000 : null;
  const jobOk = !!job?.active && jobAgeSec != null && jobAgeSec < 120 && job.last_status !== 'failed';
  const maxHour = Math.max(1, ...(insights?.by_hour ?? [0]));

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={theme.colors.textDim}
          onRefresh={async () => {
            setRefreshing(true);
            await Promise.all([store.refreshAll(), load()]);
            setRefreshing(false);
          }}
        />
      }
    >
      <SectionLabel label="Right now" />
      <View style={styles.statGrid}>
        <Stat label="Available" value={available} color={theme.colors.green} />
        <Stat label="Occupied" value={occupied} color={theme.colors.red} />
        <Stat label="Away" value={onBreak} color={theme.colors.yellow} />
        <Stat label="Reserved" value={reserved} color={theme.colors.blue} />
        <Stat label="In queue" value={inQueue} />
        <Stat label="Occupancy" value={`${occupancy}%`} hint={blocked ? `${blocked} booked for events` : undefined} />
      </View>

      <SectionLabel label="System health" />
      <Card>
        <Row
          k="Expiry job"
          v={job?.error ? 'unknown' : jobOk ? `OK · ${Math.round(jobAgeSec!)}s ago` : job?.last_run ? 'Delayed' : 'Not running'}
          valueColor={jobOk ? theme.colors.green : theme.colors.red}
        />
        <Row k="Push" v={`${health?.push?.devices ?? 0} phones · ${health?.push?.queued ?? 0} queued`}
             valueColor={(health?.push?.errors_1h ?? 0) > 0 ? theme.colors.yellow : undefined} />
        <Row k="Open reports" v={`${health?.open_reports ?? 0}`} valueColor={(health?.open_reports ?? 0) ? theme.colors.yellow : undefined} />
        <Row k="Suspended students" v={`${health?.suspended_users ?? 0}`} />
        <Row
          k="Stuck tables"
          v={`${health?.stuck_tables?.length ?? 0}`}
          valueColor={(health?.stuck_tables?.length ?? 0) ? theme.colors.red : theme.colors.green}
          last
        />
        {(health?.stuck_tables?.length ?? 0) > 0 && (
          <>
            {health!.stuck_tables.map(s => (
              <Text key={s.table_id} style={[ui.smallText, { marginTop: 6 }]}>• {s.label}: {s.problem}</Text>
            ))}
            <Button label="Fix stuck tables" variant="warning" style={{ marginTop: 12 }}
                    onPress={() => act('admin_fix_stuck_tables', {}, 'Tables repaired')} />
          </>
        )}
        {(health?.open_reports ?? 0) > 0 && (
          <Button label="Open inbox" variant="secondary" style={{ marginTop: 12 }} onPress={goInbox} />
        )}
      </Card>

      <SectionLabel label="Last 7 days" />
      <View style={styles.statGrid}>
        <Stat label="Check-ins" value={insights?.check_ins ?? 0} />
        <Stat label="No-shows" value={insights?.no_shows ?? 0} color={theme.colors.red} />
        <Stat label="Break overruns" value={insights?.break_overruns ?? 0} color={theme.colors.yellow} />
        <Stat
          label="Waitlist"
          value={`${insights?.waitlist_claimed ?? 0}/${insights?.waitlist_offers ?? 0}`}
          hint="offers claimed"
        />
      </View>
      <Card style={{ marginTop: 8 }}>
        <Text style={ui.key}>Check-ins by hour (IST)</Text>
        <View style={styles.chart}>
          {(insights?.by_hour ?? Array(24).fill(0)).map((n, h) => (
            <View key={h} style={styles.barCol}>
              <View
                style={[
                  styles.bar,
                  { height: Math.max(2, (n / maxHour) * 70), backgroundColor: n === maxHour && n > 0 ? theme.colors.green : theme.colors.borderBright },
                ]}
              />
            </View>
          ))}
        </View>
        <View style={styles.axis}>
          {['00', '06', '12', '18', '23'].map(h => <Text key={h} style={ui.monoSmall}>{h}</Text>)}
        </View>
      </Card>

      <SectionLabel label={`Live tables · ${liveTables.length}`} />
      <Card>
        {liveTables.length === 0 ? (
          <Text style={ui.empty}>All tables available</Text>
        ) : (
          liveTables.map((row, i) => {
            const st = row.table.status;
            const accent =
              st === 'occupied' ? theme.colors.red
              : st === 'on_break' ? theme.colors.yellow
              : st === 'blocked' ? theme.colors.textDim
              : theme.colors.blue;
            const items = lostItemsAtTable(state, row.table.id).length;
            return (
              <View key={row.table.id} style={[styles.liveRow, i === liveTables.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={styles.liveLeft}>
                  <View style={[styles.liveDot, { backgroundColor: accent }]} />
                  <Text style={styles.liveTable}>{row.table.label}</Text>
                  <Text style={styles.liveSpace}>{findSpace(row.table.space_id)?.name}</Text>
                  {items > 0 && <Text style={[styles.liveSpace, { color: theme.colors.blue }]}>● item</Text>}
                </View>
                <Text style={styles.liveOwner} onPress={() => st !== 'blocked' && openTable(row)}>
                  {st === 'blocked' ? 'event' : `@${row.owner}`}
                  {row.borrow ? ` +@${usernameFor(row.borrow.user_id)}` : ''}  ›
                </Text>
              </View>
            );
          })
        )}
      </Card>

      <SectionLabel label="Per space" />
      <Card>
        <View style={[ui.row, { opacity: 0.7 }]}>
          <Text style={[ui.key, { flex: 1 }]}>Space</Text>
          <Counts
            header
            cells={[
              { v: 'free', c: theme.colors.green },
              { v: 'res', c: theme.colors.blue },
              { v: 'occ', c: theme.colors.red },
              { v: 'away', c: theme.colors.yellow },
            ]}
          />
        </View>
        {SPACES.map((space, i) => {
          const t = tablesInSpace(state, space.id);
          const n = (st: string) => t.filter(x => x.status === st).length;
          return (
            <View key={space.id} style={[ui.row, i === SPACES.length - 1 && { borderBottomWidth: 0 }]}>
              <Text style={[ui.key, { flex: 1 }]} numberOfLines={1}>{space.name}</Text>
              <Counts
                cells={[
                  { v: n('available'), c: theme.colors.green },
                  { v: n('reserved'), c: theme.colors.blue },
                  { v: n('occupied'), c: theme.colors.red },
                  { v: n('on_break'), c: theme.colors.yellow },
                ]}
              />
            </View>
          );
        })}
      </Card>

      <AccountMenu
        visible={!!menu}
        title={menu?.title}
        subtitle={menu?.subtitle}
        items={menu?.items ?? []}
        onCancel={() => setMenu(null)}
      />
    </ScrollView>
  );
}

/** Four fixed-width columns so numbers line up under their headings. */
function Counts({ cells, header }: { cells: { v: number | string; c: string }[]; header?: boolean }) {
  return (
    <View style={styles.counts}>
      {cells.map((cell, i) => (
        <Text
          key={i}
          style={[styles.countCell, header ? styles.countHead : null, { color: cell.c }]}
        >
          {cell.v}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  segBar: { paddingHorizontal: 20, paddingTop: 12 },
  container: { padding: 20, paddingBottom: 48 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  valueSmall: { fontFamily: theme.fonts.monoBold, fontSize: 11 },
  counts: { flexDirection: 'row' },
  countCell: { width: 40, textAlign: 'center', fontFamily: theme.fonts.monoBold, fontSize: 12 },
  countHead: { fontFamily: theme.fonts.mono, fontSize: 10, letterSpacing: 0.5 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', height: 74, gap: 2, marginTop: 12 },
  barCol: { flex: 1, justifyContent: 'flex-end' },
  bar: { borderRadius: 2 },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  liveRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  liveLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  liveTable: { fontFamily: theme.fonts.display, fontSize: 14, color: theme.colors.text },
  liveSpace: { fontFamily: theme.fonts.mono, fontSize: 9, color: theme.colors.textDim, letterSpacing: 1, textTransform: 'uppercase' },
  liveOwner: { fontFamily: theme.fonts.monoBold, fontSize: 11, color: theme.colors.text, paddingVertical: 4 },
});
