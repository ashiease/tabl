import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useStore } from '../state/store';
import { sessionForTable, tablesInSpace } from '../state/selectors';
import { findSpace } from '../constants/spaces';
import { theme } from '../constants/theme';
import { TableCard } from '../components/TableCard';
import { secondsUntil } from '../utils/time';

interface Props {
  spaceId: string;
  onTablePress: (tableId: string) => void;
}

export function MapScreen({ spaceId, onTablePress }: Props) {
  const { state } = useStore();
  const [, force] = useState(0);
  const space = findSpace(spaceId);

  useEffect(() => {
    const t = setInterval(() => force(x => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  if (!space) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Space not found</Text>
      </View>
    );
  }

  const tables = tablesInSpace(state, spaceId);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.grid}>
        {tables.map(table => {
          const session = sessionForTable(state, table.id);
          const isMine = session?.user_id === state.currentUserId;

          let breakRemainingSec: number | null = null;
          let graceRemainingSec: number | null = null;

          if (session?.status === 'on_break' && session.break_ends_at) {
            breakRemainingSec = secondsUntil(session.break_ends_at);
          } else if (session?.status === 'on_break_expired' && session.grace_ends_at) {
            graceRemainingSec = secondsUntil(session.grace_ends_at);
          }

          return (
            <View key={table.id} style={styles.gridItem}>
              <TableCard
                table={table}
                ownerId={session && !isMine ? session.user_id : null}
                isMine={!!isMine}
                breakRemainingSec={breakRemainingSec}
                graceRemainingSec={graceRemainingSec}
                onPress={() => onTablePress(table.id)}
              />
            </View>
          );
        })}
      </View>

      <View style={styles.legend}>
        <Legend color={theme.colors.green} label="Available" />
        <Legend color={theme.colors.red} label="Occupied" />
        <Legend color={theme.colors.yellow} label="Away" />
      </View>
    </ScrollView>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  gridItem: { width: '48%' },
  legend: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    flexWrap: 'wrap',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    color: theme.colors.textDim,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    color: theme.colors.textDim,
    letterSpacing: 1.5,
  },
});