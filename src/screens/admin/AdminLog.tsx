import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/Toast';
import { findSpace } from '../../constants/spaces';
import { theme } from '../../constants/theme';
import { formatClock } from '../../utils/time';
import { friendlyError } from '../../utils/errors';
import { Card, Chip, Empty, SectionLabel, styles as ui } from './ui';

// 29 · Activity and audit log (kept 90 days)
interface LogRow {
  id: number;
  at: string;
  event: string;
  username: string | null;
  actor: string | null;
  table_label: string | null;
  space_id: string | null;
  details: Record<string, any>;
}

const FILTERS: { id: string | null; label: string }[] = [
  { id: null, label: 'All' },
  { id: 'checked_in', label: 'Check-ins' },
  { id: 'no_show', label: 'No-shows' },
  { id: 'break_overrun', label: 'Overruns' },
  { id: 'waitlist_offered', label: 'Waitlist' },
  { id: 'admin_force_release', label: 'Releases' },
];

const COLOR: Record<string, string> = {
  no_show: theme.colors.red,
  break_overrun: theme.colors.yellow,
  admin_force_release: theme.colors.red,
  admin_suspend: theme.colors.red,
  checked_in: theme.colors.green,
  waitlist_offered: theme.colors.blue,
  borrow_converted: theme.colors.blue,
};

export function AdminLog() {
  const toast = useToast();
  const [filter, setFilter] = useState<string | null>(null);
  const [rows, setRows] = useState<LogRow[]>([]);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('admin_activity', { p_limit: 150, p_user: null, p_event: filter });
    if (error) return toast.show(friendlyError(error), 'error');
    setRows((data ?? []) as LogRow[]);
  }, [filter, toast]);

  useEffect(() => {
    load();
  }, [load]);

  let lastDay = '';
  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
      <View style={styles.filters}>
        {FILTERS.map(f => (
          <Chip key={f.label} label={f.label} active={filter === f.id} onPress={() => setFilter(f.id)} />
        ))}
      </View>
      <Text style={[ui.smallText, { marginTop: 12 }]}>
        Every booking, break, release and admin action. Entries are deleted after 90 days.
      </Text>

      <Card style={{ marginTop: 12 }}>
        {rows.length === 0 && <Empty text="No activity" />}
        {rows.map(r => {
          const day = new Date(r.at).toDateString();
          const header = day !== lastDay;
          lastDay = day;
          const who = r.username ? `@${r.username}` : '';
          const by = r.actor && r.actor !== r.username ? ` · by @${r.actor}` : '';
          return (
            <View key={r.id}>
              {header && (
                <SectionLabel label={day === new Date().toDateString() ? 'Today' : new Date(r.at).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })} />
              )}
              <View style={styles.row}>
                <Text style={styles.time}>{formatClock(new Date(r.at))}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.event, { color: COLOR[r.event] ?? theme.colors.text }]}>
                    {r.event.replace(/_/g, ' ')}
                  </Text>
                  <Text style={ui.monoSmall}>
                    {[who, r.table_label && `${r.table_label}${r.space_id ? ` · ${findSpace(r.space_id)?.name ?? r.space_id}` : ''}`]
                      .filter(Boolean).join(' · ')}{by}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { flexDirection: 'row', gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  time: { fontFamily: theme.fonts.mono, fontSize: 10, color: theme.colors.textDim, width: 62, paddingTop: 2 },
  event: { fontFamily: theme.fonts.sansSemi, fontSize: 12, textTransform: 'capitalize' },
});
