import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useStore } from '../state/store';
import { tablesInSpace } from '../state/selectors';
import { SPACES } from '../constants/spaces';
import { theme } from '../constants/theme';
import { Button } from '../components/Button';

interface Props {
  onReset: () => void;
}

export function AdminScreen({ onReset }: Props) {
  const { state } = useStore();

  const total = state.tables.length;
  const available = state.tables.filter(t => t.status === 'available').length;
  const reserved = state.tables.filter(t => t.status === 'reserved').length;
  const occupied = state.tables.filter(t => t.status === 'occupied').length;
  const onBreak = state.tables.filter(t => t.status === 'on_break').length;
  const expired = state.sessions.filter(s => s.status === 'expired').length;
  const completed = state.sessions.filter(s => s.status === 'completed').length;
  const activeWait = state.waitlist.filter(w => w.status !== 'expired').length;
  const occupancy = total
    ? Math.round(((reserved + occupied + onBreak) / total) * 100)
    : 0;

  const usernameFor = (userId: string) => {
    const p = state.profiles.find(x => x.id === userId);
    return p?.username ?? '—';
  };

  // Every table that isn't available — occupied, on break, or reserved.
  const liveTables = state.tables
    .filter(t => t.status !== 'available')
    .map(table => {
      const session = state.sessions.find(
        s =>
          s.table_id === table.id &&
          (s.status === 'active' ||
            s.status === 'on_break' ||
            s.status === 'on_break_expired')
      );
      const reservation = state.reservations.find(r => r.table_id === table.id);
      const ownerId = session?.user_id ?? reservation?.user_id ?? null;
      const owner = ownerId ? usernameFor(ownerId) : '—';
      return {
        label: table.label,
        space: SPACES.find(s => s.id === table.space_id)?.name ?? table.space_id,
        status: table.status,
        owner,
      };
    })
    .sort((a, b) => {
      const order: Record<string, number> = { occupied: 0, on_break: 1, reserved: 2 };
      const oa = order[a.status] ?? 9;
      const ob = order[b.status] ?? 9;
      if (oa !== ob) return oa - ob;
      return a.label.localeCompare(b.label);
    });

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <SectionLabel label="Global" />
      <View style={styles.statGrid}>
        <Stat label="Available" value={available} color={theme.colors.green} />
        <Stat label="Reserved" value={reserved} color={theme.colors.blue} />
        <Stat label="Occupied" value={occupied} color={theme.colors.red} />
        <Stat label="Away" value={onBreak} color={theme.colors.yellow} />
        <Stat label="In Queue" value={activeWait} />
      </View>

      <SectionLabel label="Metrics" />
      <View style={styles.infoCard}>
        <Row k="Occupancy" v={`${occupancy}%`} />
        <Row k="Total Tables" v={`${total}`} />
        <Row k="Completed" v={`${completed}`} />
        <Row k="Expired" v={`${expired}`} valueColor={theme.colors.red} />
      </View>

      <SectionLabel label={`Live Tables · ${liveTables.length}`} />
      {liveTables.length === 0 ? (
        <View style={styles.infoCard}>
          <Text style={styles.emptyLive}>All tables available</Text>
        </View>
      ) : (
        <View style={styles.infoCard}>
          {liveTables.map((row, i) => {
            const accent =
              row.status === 'occupied' ? theme.colors.red
              : row.status === 'on_break' ? theme.colors.yellow
              : theme.colors.blue;
            return (
              <View
                key={`${row.label}-${i}`}
                style={[
                  styles.liveRow,
                  i === liveTables.length - 1 && { borderBottomWidth: 0 },
                ]}
              >
                <View style={styles.liveLeft}>
                  <View style={[styles.liveDot, { backgroundColor: accent }]} />
                  <Text style={styles.liveTable}>{row.label}</Text>
                  <Text style={styles.liveSpace}>{row.space}</Text>
                </View>
                <View style={styles.liveRight}>
                  <Text style={styles.liveOwner}>@{row.owner}</Text>
                  <Text style={[styles.liveStatus, { color: accent }]}>
                    {row.status === 'on_break' ? 'away' : row.status}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <SectionLabel label="Per Space" />
      <View style={styles.infoCard}>
        <View style={[styles.row, { opacity: 0.6 }]}>
          <Text style={styles.key}>Legend</Text>
          <Text style={styles.valueSmall}>
            <Text style={{ color: theme.colors.green }}>free</Text>
            <Text style={{ color: theme.colors.textFaint }}> · </Text>
            <Text style={{ color: theme.colors.blue }}>res</Text>
            <Text style={{ color: theme.colors.textFaint }}> · </Text>
            <Text style={{ color: theme.colors.red }}>occ</Text>
            <Text style={{ color: theme.colors.textFaint }}> · </Text>
            <Text style={{ color: theme.colors.yellow }}>away</Text>
          </Text>
        </View>
        {SPACES.map(space => {
          const t = tablesInSpace(state, space.id);
          const a = t.filter(x => x.status === 'available').length;
          const r = t.filter(x => x.status === 'reserved').length;
          const o = t.filter(x => x.status === 'occupied').length;
          const b = t.filter(x => x.status === 'on_break').length;
          return (
            <View key={space.id} style={styles.row}>
              <Text style={styles.key}>{space.name}</Text>
              <Text style={styles.valueSmall}>
                <Text style={{ color: theme.colors.green }}>{a}</Text>
                <Text style={{ color: theme.colors.textFaint }}> · </Text>
                <Text style={{ color: theme.colors.blue }}>{r}</Text>
                <Text style={{ color: theme.colors.textFaint }}> · </Text>
                <Text style={{ color: theme.colors.red }}>{o}</Text>
                <Text style={{ color: theme.colors.textFaint }}> · </Text>
                <Text style={{ color: theme.colors.yellow }}>{b}</Text>
              </Text>
            </View>
          );
        })}
      </View>

      <SectionLabel label="Policy" />
      <View style={styles.infoCard}>
        <Row k="Session length" v="60 min" valueColor={theme.colors.green} />
        <Row k="Break length" v="15 min" valueColor={theme.colors.yellow} />
        <Row k="Grace period" v="5 min" valueColor={theme.colors.red} />
        <Row k="Reservation window" v="5 min" valueColor={theme.colors.blue} />
      </View>

      <Button
        label="Reset All Tables"
        variant="ghost"
        onPress={onReset}
        style={{ marginTop: 24 }}
      />
    </ScrollView>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <View style={styles.sectionRow}>
      <View style={styles.dot} />
      <Text style={styles.sectionText}>{label}</Text>
      <View style={styles.line} />
    </View>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

function Row({ k, v, valueColor }: { k: string; v: string; valueColor?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.key}>{k}</Text>
      <Text style={[styles.value, valueColor ? { color: valueColor } : null]}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    marginBottom: 12,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.green,
  },
  sectionText: {
    fontFamily: theme.fonts.monoBold,
    fontSize: 10,
    color: theme.colors.textDim,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },
  line: { flex: 1, height: 1, backgroundColor: theme.colors.border },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statCell: {
    width: '48%',
    padding: 16,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius,
  },
  statLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    color: theme.colors.textDim,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  statValue: {
    fontFamily: theme.fonts.display,
    fontSize: 32,
    color: theme.colors.text,
    marginTop: 8,
  },
  infoCard: {
    padding: 16,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  key: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    color: theme.colors.textDim,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  value: {
    fontFamily: theme.fonts.monoBold,
    fontSize: 13,
    color: theme.colors.text,
  },
  valueSmall: { fontFamily: theme.fonts.monoBold, fontSize: 11 },
  emptyLive: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    color: theme.colors.textDim,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    textAlign: 'center',
    paddingVertical: 8,
  },
  liveRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  liveLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  liveTable: {
    fontFamily: theme.fonts.display,
    fontSize: 14,
    color: theme.colors.text,
    letterSpacing: 0.5,
  },
  liveSpace: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    color: theme.colors.textDim,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  liveRight: { alignItems: 'flex-end' },
  liveOwner: {
    fontFamily: theme.fonts.monoBold,
    fontSize: 10,
    color: theme.colors.text,
    letterSpacing: 1,
  },
  liveStatus: {
    fontFamily: theme.fonts.mono,
    fontSize: 8,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: 2,
  },
});