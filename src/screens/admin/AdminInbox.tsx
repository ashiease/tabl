import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useStore } from '../../state/store';
import { useToast } from '../../components/Toast';
import { Button } from '../../components/Button';
import { findSpace } from '../../constants/spaces';
import { theme } from '../../constants/theme';
import { friendlyError } from '../../utils/errors';
import { Card, Chip, Empty, Input, SectionLabel, styles as ui, timeAgo } from './ui';

// 28 · Disputes inbox: reports sent by students
interface Report {
  id: number;
  created_at: string;
  kind: string;
  note: string | null;
  status: 'open' | 'resolved' | 'dismissed';
  admin_note: string | null;
  table_id: string;
  table_label: string;
  space_id: string;
  reporter: string | null;
  occupant: string | null;
  occupant_id: string | null;
}

const KIND: Record<string, string> = {
  sitting_without_scanning: 'Sitting without scanning',
  asked_to_leave: 'Asked to leave a booked table',
  belongings_left: 'Belongings left',
  damaged: 'Damaged table / chair',
  other: 'Other',
};

export function AdminInbox({ onCount }: { onCount: (n: number) => void }) {
  const store = useStore();
  const toast = useToast();
  const [filter, setFilter] = useState<'open' | 'resolved' | 'dismissed'>('open');
  const [items, setItems] = useState<Report[]>([]);
  const [notes, setNotes] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('admin_list_reports', { p_status: filter });
    if (error) return toast.show(friendlyError(error), 'error');
    setItems((data ?? []) as Report[]);
    if (filter === 'open') onCount((data ?? []).length);
  }, [filter, onCount, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (fn: string, args: Record<string, any>, done: string) => {
    try {
      await store.adminCall(fn, args);
      toast.show(done, 'success');
      load();
    } catch (e: any) {
      toast.show(friendlyError(e), 'error');
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
      <View style={styles.filters}>
        <Chip label="Open" active={filter === 'open'} onPress={() => setFilter('open')} />
        <Chip label="Resolved" active={filter === 'resolved'} onPress={() => setFilter('resolved')} />
        <Chip label="Dismissed" active={filter === 'dismissed'} onPress={() => setFilter('dismissed')} />
      </View>

      <SectionLabel label={`${items.length} ${filter}`} />
      {items.length === 0 && <Card><Empty text={filter === 'open' ? 'No open reports' : 'Nothing here'} /></Card>}

      {items.map(r => (
        <Card key={r.id} style={{ marginBottom: 10 }}>
          <View style={styles.head}>
            <Text style={ui.titleText}>{r.table_label} · {findSpace(r.space_id)?.name}</Text>
            <Text style={ui.monoSmall}>{timeAgo(r.created_at)}</Text>
          </View>
          <Text style={[styles.kind, r.kind === 'asked_to_leave' && { color: theme.colors.yellow }]}>
            {KIND[r.kind] ?? r.kind}
          </Text>
          {r.note ? <Text style={[ui.smallText, { marginTop: 4 }]}>“{r.note}”</Text> : null}
          <Text style={[ui.monoSmall, { marginTop: 8 }]}>
            From @{r.reporter ?? '—'}{r.occupant ? ` · table held by @${r.occupant}` : ' · table was not checked in'}
          </Text>

          {r.status === 'open' ? (
            <>
              <Input
                placeholder="Note for the student (optional)"
                value={notes[r.id] ?? ''}
                onChangeText={t => setNotes(n => ({ ...n, [r.id]: t }))}
                style={{ marginTop: 12 }}
              />
              <View style={styles.actions}>
                <Button label="Resolve" variant="primary" style={{ flex: 1 }}
                        onPress={() => act('admin_resolve_report', { p_id: r.id, p_status: 'resolved', p_note: notes[r.id] ?? null }, 'Resolved · student notified')} />
                <Button label="Dismiss" variant="secondary" style={{ flex: 1 }}
                        onPress={() => act('admin_resolve_report', { p_id: r.id, p_status: 'dismissed', p_note: notes[r.id] ?? null }, 'Dismissed')} />
              </View>
              {r.occupant_id ? (
                <Button label={`Suspend @${r.occupant} for 24 h`} variant="ghost" style={{ marginTop: 8 }}
                        onPress={() => act('admin_suspend_user', { p_user: r.occupant_id, p_hours: 24, p_reason: `Report: ${KIND[r.kind] ?? r.kind}` }, `@${r.occupant} suspended`)} />
              ) : null}
            </>
          ) : (
            r.admin_note ? <Text style={[ui.smallText, { marginTop: 8, color: theme.colors.green }]}>Admin: {r.admin_note}</Text> : null
          )}
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', gap: 8 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kind: { fontFamily: theme.fonts.sansSemi, fontSize: 13, color: theme.colors.red, marginTop: 6 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
});
