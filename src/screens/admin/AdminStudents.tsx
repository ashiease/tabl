import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useStore } from '../../state/store';
import { useToast } from '../../components/Toast';
import { AccountMenu, MenuItem } from '../../components/AccountMenu';
import { findSpace } from '../../constants/spaces';
import { theme } from '../../constants/theme';
import { formatClock } from '../../utils/time';
import { friendlyError } from '../../utils/errors';
import { Card, Empty, Input, SectionLabel, styles as ui, timeAgo } from './ui';

// 24 · Students: search, suspend / reinstate, lift a misuse pause, see their history
interface Student {
  user_id: string;
  username: string;
  display_name: string;
  hostel_id: string | null;
  roster_hostel: string | null;
  suspended_until: string | null;
  suspended_reason: string | null;
  reserve_paused_until: string | null;
  no_shows_7d: number;
  break_overruns_7d: number;
  sessions_7d: number;
  reports_against_30d: number;
  current_table: string | null;
}

interface LogRow { id: number; at: string; event: string; table_label: string | null }

const until = (iso: string) => {
  const d = new Date(iso);
  if (d.getFullYear() > 9000) return 'until reinstated';
  return `until ${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} ${formatClock(d)}`;
};

export function AdminStudents() {
  const store = useStore();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Student[]>([]);
  const [menu, setMenu] = useState<Student | null>(null);
  const [history, setHistory] = useState<{ who: Student; rows: LogRow[] } | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('admin_list_users', { p_search: q.trim() || null });
    if (error) return toast.show(friendlyError(error), 'error');
    setRows((data ?? []) as Student[]);
  }, [q, toast]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

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

  const showHistory = async (s: Student) => {
    setMenu(null);
    const { data, error } = await supabase.rpc('admin_activity', { p_limit: 30, p_user: s.user_id, p_event: null });
    if (error) return toast.show(friendlyError(error), 'error');
    setHistory({ who: s, rows: (data ?? []) as LogRow[] });
  };

  const menuItems = (s: Student): MenuItem[] => [
    ...(s.suspended_until
      ? [{ label: 'Reinstate account', onSelect: () => act('admin_unsuspend_user', { p_user: s.user_id }, `@${s.username} reinstated`) }]
      : [
          { label: 'Suspend for 24 hours', onSelect: () => act('admin_suspend_user', { p_user: s.user_id, p_hours: 24, p_reason: 'Misuse of study tables' }, `@${s.username} suspended`) },
          { label: 'Suspend for 7 days', onSelect: () => act('admin_suspend_user', { p_user: s.user_id, p_hours: 24 * 7, p_reason: 'Repeated misuse of study tables' }, `@${s.username} suspended`) },
          { label: 'Suspend until reinstated', onSelect: () => act('admin_suspend_user', { p_user: s.user_id, p_hours: null, p_reason: 'Contact the warden' }, `@${s.username} suspended`) },
        ]),
    ...(s.reserve_paused_until
      ? [{ label: 'Lift reserving pause', onSelect: () => act('admin_clear_pause', { p_user: s.user_id }, 'Pause lifted') }]
      : []),
    { label: 'Recent activity', onSelect: () => showHistory(s) },
    { label: 'Close', onSelect: () => setMenu(null) },
  ];

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
      <Input placeholder="Search roll number or name" value={q} onChangeText={setQ} autoCapitalize="none" />

      <SectionLabel label={`${rows.length} students`} />
      <Card>
        {rows.length === 0 && <Empty text="No students found" />}
        {rows.map((s, i) => {
          const flags: { text: string; color: string }[] = [];
          if (s.suspended_until) flags.push({ text: 'suspended', color: theme.colors.red });
          if (s.reserve_paused_until) flags.push({ text: 'paused', color: theme.colors.yellow });
          if (s.no_shows_7d) flags.push({ text: `${s.no_shows_7d} no-show`, color: theme.colors.yellow });
          if (s.break_overruns_7d) flags.push({ text: `${s.break_overruns_7d} overrun`, color: theme.colors.yellow });
          if (s.reports_against_30d) flags.push({ text: `${s.reports_against_30d} reported`, color: theme.colors.red });
          return (
            <Pressable key={s.user_id} onPress={() => setMenu(s)}
                       style={[styles.row, i === rows.length - 1 && { borderBottomWidth: 0 }]}>
              <View style={{ flex: 1 }}>
                <Text style={ui.titleText}>@{s.username}</Text>
                <Text style={ui.monoSmall}>
                  {(findSpace(s.roster_hostel ?? s.hostel_id ?? '')?.name ?? 'No hostel')}
                  {s.roster_hostel ? ' (roster)' : ''} · {s.sessions_7d} sessions this week
                  {s.current_table ? ` · at ${s.current_table}` : ''}
                </Text>
                {s.suspended_until ? (
                  <Text style={[ui.smallText, { color: theme.colors.red }]}>Suspended {until(s.suspended_until)}</Text>
                ) : null}
                {flags.length > 0 && (
                  <View style={styles.flags}>
                    {flags.map(f => <Text key={f.text} style={[styles.flag, { color: f.color, borderColor: f.color }]}>{f.text}</Text>)}
                  </View>
                )}
              </View>
              <Text style={styles.chev}>›</Text>
            </Pressable>
          );
        })}
      </Card>

      {history && (
        <>
          <SectionLabel label={`@${history.who.username} · recent`} right={<Text style={styles.close} onPress={() => setHistory(null)}>close</Text>} />
          <Card>
            {history.rows.length === 0 && <Empty text="No activity" />}
            {history.rows.map((r, i) => (
              <View key={r.id} style={[ui.row, i === history.rows.length - 1 && { borderBottomWidth: 0 }]}>
                <Text style={ui.key}>{r.event.replace(/_/g, ' ')}{r.table_label ? ` · ${r.table_label}` : ''}</Text>
                <Text style={ui.monoSmall}>{timeAgo(r.at)}</Text>
              </View>
            ))}
          </Card>
        </>
      )}

      <AccountMenu
        visible={!!menu}
        title={menu ? `@${menu.username}` : ''}
        subtitle={menu?.display_name}
        items={menu ? menuItems(menu) : []}
        onCancel={() => setMenu(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border, gap: 8,
  },
  chev: { color: theme.colors.textFaint, fontSize: 18 },
  flags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  flag: {
    fontFamily: theme.fonts.sansSemi, fontSize: 10, borderWidth: 1, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2,
  },
  close: { fontFamily: theme.fonts.sansSemi, fontSize: 11, color: theme.colors.textDim, marginLeft: 8 },
});
