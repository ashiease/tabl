import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useStore } from '../../state/store';
import { useToast } from '../../components/Toast';
import { Button } from '../../components/Button';
import { SPACES, findSpace } from '../../constants/spaces';
import { theme } from '../../constants/theme';
import { formatClock } from '../../utils/time';
import { friendlyError } from '../../utils/errors';
import { Policy } from '../../types';
import { Card, Chip, Empty, Input, Row, SectionLabel, Stepper, styles as ui } from './ui';

// 27 rules · 31 announcements · 33 block bookings · 19 lost items · A3 reset
export function AdminManage({ onReset }: { onReset: () => void }) {
  const store = useStore();
  const { state } = store;
  const toast = useToast();

  const call = async (fn: string, args: Record<string, any>, done: string) => {
    try {
      const r = await store.adminCall(fn, args);
      toast.show(done, 'success');
      return r ?? true;
    } catch (e: any) {
      toast.show(friendlyError(e), 'error');
      return null;
    }
  };

  // ── Rules ──
  const [draft, setDraft] = useState<Policy | null>(state.policy);
  useEffect(() => setDraft(state.policy), [state.policy]);
  const set = (k: keyof Policy, v: any) => setDraft(d => (d ? { ...d, [k]: v } : d));
  const dirty = !!draft && !!state.policy && JSON.stringify(draft) !== JSON.stringify(state.policy);

  // ── Announcement ──
  const [annSpace, setAnnSpace] = useState<string | null>(null);
  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [annHours, setAnnHours] = useState(24);

  // ── Block booking ──
  const [blkTitle, setBlkTitle] = useState('');
  const [blkSpace, setBlkSpace] = useState('library');
  const [blkTables, setBlkTables] = useState('');
  const [blkDay, setBlkDay] = useState<0 | 1>(0);
  const [blkStart, setBlkStart] = useState('');
  const [blkHours, setBlkHours] = useState(2);


  const postAnnouncement = async () => {
    if (!annTitle.trim()) return toast.show('Add a title', 'error');
    const ok = await call('admin_post_announcement', {
      p_space_id: annSpace, p_title: annTitle, p_body: annBody, p_hours: annHours, p_push: true,
    }, 'Announcement posted');
    if (ok) { setAnnTitle(''); setAnnBody(''); }
  };

  const createBlock = async () => {
    if (!blkTitle.trim()) return toast.show('Add a title', 'error');
    const m = blkStart.trim().match(/^(\d{1,2})[:.](\d{2})\s*(am|pm)?$/i);
    if (!m) return toast.show('Start time like 14:00 or 2:00 pm', 'error');
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    if (m[3]) h = (h % 12) + (m[3].toLowerCase() === 'pm' ? 12 : 0);
    const start = new Date();
    start.setDate(start.getDate() + blkDay);
    start.setHours(h, min, 0, 0);
    const end = new Date(start.getTime() + blkHours * 3600 * 1000);

    let ids: string[] | null = null;
    if (blkTables.trim()) {
      const wanted = blkTables.split(/[,\s]+/).map(x => x.trim().toLowerCase()).filter(Boolean);
      const inSpace = state.tables.filter(t => t.space_id === blkSpace);
      const found = inSpace.filter(t => wanted.includes(t.label.toLowerCase()));
      if (found.length !== wanted.length) return toast.show('Some table labels were not found in this hall', 'error');
      ids = found.map(t => t.id);
    }
    const ok = await call('admin_create_block', {
      p_title: blkTitle, p_space_id: blkSpace, p_table_ids: ids,
      p_starts_at: start.toISOString(), p_ends_at: end.toISOString(),
    }, 'Booking created');
    if (ok) { setBlkTitle(''); setBlkTables(''); setBlkStart(''); }
  };


  const policy = state.policy;
  const now = Date.now();
  const blocks = [...state.blocks].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const lost = state.lostItems.filter(i => i.status !== 'returned');

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
      {/* ── Rules ── */}
      <SectionLabel label="Rules" />
      <Card>
        {!draft ? <Empty text="Loading…" /> : (
          <>
            <View style={ui.row}>
              <Text style={ui.key}>Exam mode</Text>
              <Switch
                value={draft.exam_mode}
                onValueChange={v => set('exam_mode', v)}
                trackColor={{ true: theme.colors.yellow, false: theme.colors.borderBright }}
              />
            </View>
            {draft.exam_mode ? (
              <>
                <Stepper label="Exam session" value={draft.exam_session_minutes} step={5} min={15} max={240} onChange={v => set('exam_session_minutes', v)} />
                <Stepper label="Exam break" value={draft.exam_break_minutes} step={5} min={0} max={60} onChange={v => set('exam_break_minutes', v)} />
              </>
            ) : (
              <>
                <Stepper label="Session" value={draft.session_minutes} step={5} min={15} max={240} onChange={v => set('session_minutes', v)} />
                <Stepper label="Break budget" value={draft.break_minutes} step={5} min={0} max={60} onChange={v => set('break_minutes', v)} />
              </>
            )}
            <Stepper label="Scan window" value={draft.hold_minutes} min={1} max={30} onChange={v => set('hold_minutes', v)} />
            <Stepper label="Missed bookings before pause" value={draft.misuse_limit} min={1} max={20} unit="" onChange={v => set('misuse_limit', v)} />
            <Stepper label="Pause length" value={draft.misuse_pause_hours} step={6} min={6} max={168} unit="h" onChange={v => set('misuse_pause_hours', v)} />
            <Text style={[ui.smallText, { marginTop: 10 }]}>
              New values apply to new sessions and breaks. Sessions already running keep their end time.
            </Text>
            {dirty && (
              <View style={styles.btnRow}>
                <Button label="Cancel" variant="secondary" style={{ flex: 1 }} onPress={() => setDraft(policy)} />
                <Button label="Save rules" variant="primary" style={{ flex: 1 }}
                        onPress={() => call('admin_set_policy', { p: draft }, 'Rules saved')} />
              </View>
            )}
          </>
        )}
      </Card>

      {/* ── Announcements ── */}
      <SectionLabel label="Announce" />
      <Card>
        <View style={styles.chips}>
          <Chip label="Everyone" active={annSpace === null} onPress={() => setAnnSpace(null)} />
          {SPACES.map(s => (
            <Chip key={s.id} label={s.name} active={annSpace === s.id} onPress={() => setAnnSpace(s.id)} />
          ))}
        </View>
        <Input placeholder="Title, e.g. Library closes at 10 pm" value={annTitle} onChangeText={setAnnTitle} maxLength={80} />
        <Input placeholder="Details (optional)" value={annBody} onChangeText={setAnnBody} multiline maxLength={500} />
        <Stepper label="Show for" value={annHours} step={6} min={1} max={336} unit="h" onChange={setAnnHours} />
        <Button label="Post & notify" variant="primary" style={{ marginTop: 12 }} onPress={postAnnouncement} />
        {state.announcements.length > 0 && (
          <View style={{ marginTop: 12 }}>
            {state.announcements.map(a => (
              <View key={a.id} style={ui.row}>
                <View style={{ flex: 1 }}>
                  <Text style={ui.titleText}>{a.title}</Text>
                  <Text style={ui.monoSmall}>
                    {a.space_id ? findSpace(a.space_id)?.name : 'Everyone'} · until {formatClock(new Date(a.expires_at))}
                  </Text>
                </View>
                <Text style={styles.link} onPress={() => call('admin_delete_announcement', { p_id: a.id }, 'Removed')}>Remove</Text>
              </View>
            ))}
          </View>
        )}
      </Card>

      {/* ── Block bookings ── */}
      <SectionLabel label="Book tables for an event" />
      <Card>
        <Input placeholder="Title, e.g. Mid-sem exam" value={blkTitle} onChangeText={setBlkTitle} maxLength={80} />
        <View style={styles.chips}>
          {SPACES.map(s => (
            <Chip key={s.id} label={s.name} active={blkSpace === s.id} onPress={() => setBlkSpace(s.id)} />
          ))}
        </View>
        <Input placeholder="Tables (blank = all), e.g. L-01, L-02" value={blkTables} onChangeText={setBlkTables} autoCapitalize="characters" />
        <View style={styles.chips}>
          <Chip label="Today" active={blkDay === 0} onPress={() => setBlkDay(0)} />
          <Chip label="Tomorrow" active={blkDay === 1} onPress={() => setBlkDay(1)} />
        </View>
        <Input placeholder="Start time, e.g. 14:00" value={blkStart} onChangeText={setBlkStart} />
        <Stepper label="Length" value={blkHours} min={1} max={24} unit="h" onChange={setBlkHours} />
        <Text style={[ui.smallText, { marginTop: 8 }]}>
          Students checked in on these tables are told now, and their session ends when the booking starts.
        </Text>
        <Button label="Create booking" variant="primary" style={{ marginTop: 12 }} onPress={createBlock} />
        {blocks.length > 0 && (
          <View style={{ marginTop: 12 }}>
            {blocks.map(b => {
              const live = new Date(b.starts_at).getTime() <= now;
              return (
                <View key={b.id} style={ui.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={ui.titleText}>{b.title}{live ? ' · now' : ''}</Text>
                    <Text style={ui.monoSmall}>
                      {findSpace(b.space_id)?.name} · {b.table_ids?.length
                        ? b.table_ids.map(id => state.tables.find(t => t.id === id)?.label ?? id).join(', ')
                        : 'all tables'} · {new Date(b.starts_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}{' '}
                      {formatClock(new Date(b.starts_at))}–{formatClock(new Date(b.ends_at))}
                    </Text>
                  </View>
                  <Text style={styles.link} onPress={() => call('admin_cancel_block', { p_id: b.id }, 'Booking cancelled')}>Cancel</Text>
                </View>
              );
            })}
          </View>
        )}
      </Card>


      {/* ── Lost items ── */}
      <SectionLabel label={`Items left · ${lost.length}`} />
      <Card>
        {lost.length === 0 && <Empty text="Nothing reported" />}
        {lost.map(i => (
          <View key={i.id} style={ui.row}>
            <View style={{ flex: 1 }}>
              <Text style={ui.titleText}>{i.description}</Text>
              <Text style={ui.monoSmall}>
                {state.tables.find(t => t.id === i.table_id)?.label} · {findSpace(i.space_id)?.name} · {i.status === 'at_desk' ? 'at the desk' : 'at the table'}
              </Text>
            </View>
            {i.status === 'at_table' && (
              <Text style={styles.link} onPress={() => call('admin_update_lost_item', { p_id: i.id, p_status: 'at_desk' }, 'Moved to desk')}>To desk</Text>
            )}
            <Text style={styles.link} onPress={() => call('admin_update_lost_item', { p_id: i.id, p_status: 'returned' }, 'Marked returned')}>Returned</Text>
          </View>
        ))}
        <Text style={[ui.smallText, { marginTop: 8 }]}>Add items from Live → tap a table, or from a student report.</Text>
      </Card>

      {/* ── Current rules summary + reset ── */}
      <SectionLabel label="Danger zone" />
      <Card>
        <Row k="Active rules" v={policy ? (policy.exam_mode ? 'Exam mode' : 'Normal') : '—'} last />
        <Button label="Reset all tables" variant="danger" style={{ marginTop: 12 }} onPress={onReset} />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  btnRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  link: { fontFamily: theme.fonts.sansSemi, fontSize: 12, color: theme.colors.blue, marginLeft: 12 },
});
