import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useStore } from '../state/store';
import { myWaitlist, queuePosition } from '../state/selectors';
import { findSpace } from '../constants/spaces';
import { theme } from '../constants/theme';
import { Button } from '../components/Button';

interface Props {
  onLeave: (entryId: string) => void;
}

export function WaitlistScreen({ onLeave }: Props) {
  const { state } = useStore();
  const mine = myWaitlist(state);

  if (mine.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyIcon}>≡</Text>
        <Text style={styles.emptyText}>Not in any queue</Text>
        <Text style={styles.emptySub}>Tap an occupied table</Text>
      </View>
    );
  }

  const sorted = [...mine].sort((a, b) => a.created_at.localeCompare(b.created_at));

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.sectionRow}>
        <View style={styles.dot} />
        <Text style={styles.sectionText}>Your Entries</Text>
        <View style={styles.line} />
      </View>

      {sorted.map(entry => {
        const table = state.tables.find(t => t.id === entry.table_id);
        const space = findSpace(entry.space_id);
        const pos = queuePosition(state, entry.id);
        if (!table || !space) return null;

        return (
          <View key={entry.id} style={styles.entryWrap}>
            <View style={[styles.entry, entry.notified && styles.entryNotified]}>
              <View style={styles.entryLeft}>
                <Text style={styles.entryLabel}>
                  {table.label} · {space.name}
                </Text>
                <Text style={styles.entryStatus}>
                  {entry.notified ? 'Ready · head over' : 'Waiting'}
                </Text>
              </View>
              <View
                style={[
                  styles.position,
                  entry.notified && styles.positionNotified,
                ]}
              >
                <Text
                  style={[
                    styles.positionText,
                    entry.notified && { color: '#061a0d' },
                  ]}
                >
                  {entry.notified ? '✓' : '#' + pos}
                </Text>
              </View>
            </View>
            <Button label="Leave" variant="secondary" onPress={() => onLeave(entry.id)} />
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  entryWrap: { marginBottom: 16 },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderBright,
    borderLeftWidth: 2,
    borderLeftColor: theme.colors.green,
    borderRadius: theme.radius,
    marginBottom: 8,
  },
  entryNotified: {
    borderColor: theme.colors.green,
    backgroundColor: theme.colors.surface2,
  },
  entryLeft: { flex: 1 },
  entryLabel: {
    fontFamily: theme.fonts.dot,
    fontSize: 16,
    color: theme.colors.text,
  },
  entryStatus: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    color: theme.colors.textDim,
    marginTop: 4,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  position: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: theme.colors.borderBright,
    borderRadius: 2,
  },
  positionNotified: {
    backgroundColor: theme.colors.green,
    borderColor: theme.colors.green,
  },
  positionText: {
    fontFamily: theme.fonts.monoBold,
    fontSize: 10,
    color: theme.colors.text,
    letterSpacing: 1,
  },
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