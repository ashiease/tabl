import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useStore } from '../state/store';
import { isAdmin, tablesInSpace } from '../state/selectors';
import { SPACES } from '../constants/spaces';
import { theme } from '../constants/theme';
import { Button } from '../components/Button';

interface Props {
  onUnlock: () => void;
  onReset: () => void;
}

export function AdminScreen({ onUnlock, onReset }: Props) {
  const { state } = useStore();

  if (!isAdmin(state)) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyIcon}>◎</Text>
        <Text style={styles.emptyText}>Admin access required</Text>
        <Text style={styles.emptySub}>Sign in as an admin</Text>
        <View style={{ width: '100%', marginTop: 24, paddingHorizontal: 40 }}>
          <Button label="Unlock Admin" variant="primary" onPress={onUnlock} />
        </View>
      </View>
    );
  }

  const total = state.tables.length;
  const available = state.tables.filter(t => t.status === 'available').length;
  const occupied = state.tables.filter(t => t.status === 'occupied').length;
  const onBreak = state.tables.filter(t => t.status === 'on_break').length;
  const expired = state.sessions.filter(s => s.status === 'expired').length;
  const completed = state.sessions.filter(s => s.status === 'completed').length;
  const activeWait = state.waitlist.filter(w => w.status !== 'expired').length;
  const occupancy = total ? Math.round(((occupied + onBreak) / total) * 100) : 0;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <SectionLabel label="Global" />
      <View style={styles.statGrid}>
        <Stat label="Available" value={available} color={theme.colors.green} />
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

      <SectionLabel label="Per Space" />
      <View style={styles.infoCard}>
        {SPACES.map(space => {
          const t = tablesInSpace(state, space.id);
          const a = t.filter(x => x.status === 'available').length;
          const o = t.filter(x => x.status === 'occupied').length;
          const b = t.filter(x => x.status === 'on_break').length;
          return (
            <View key={space.id} style={styles.row}>
              <Text style={styles.key}>{space.name}</Text>
              <Text style={styles.valueSmall}>
                <Text style={{ color: theme.colors.green }}>{a}</Text>
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
      </View>

      <Button
        label="Reset Demo Data"
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
    fontFamily: theme.fonts.dot,
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
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIcon: { fontSize: 32, color: theme.colors.textDim, marginBottom: 20 },
  emptyText: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    color: theme.colors.textDim,
    letterSpacing: 1.5,
  },
  emptySub: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    color: theme.colors.textDim,
    letterSpacing: 1.5,
    marginTop: 6,
  },
});