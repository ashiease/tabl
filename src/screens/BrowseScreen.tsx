import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useStore } from '../state/store';
import { myHostelId, spaceCounts } from '../state/selectors';
import { SPACES } from '../constants/spaces';
import { theme } from '../constants/theme';
import { SpaceCard } from '../components/SpaceCard';

interface Props {
  onOpenSpace: (id: string) => void;
}

export function BrowseScreen({ onOpenSpace }: Props) {
  const { state } = useStore();
  const hostelId = myHostelId(state);
  const library = SPACES.filter(s => s.type === 'library');
  const hostels = SPACES.filter(s => s.type === 'hostel');

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <SectionLabel label="Library" />
      <View style={styles.grid}>
        {library.map(s => (
          <View key={s.id} style={styles.gridItem}>
            <SpaceCard
              space={s}
              counts={spaceCounts(state, s.id)}
              isHome={s.id === hostelId}
              onPress={() => onOpenSpace(s.id)}
            />
          </View>
        ))}
      </View>

      <SectionLabel label="Hostels" />
      <View style={styles.grid}>
        {hostels.map(s => (
          <View key={s.id} style={styles.gridItem}>
            <SpaceCard
              space={s}
              counts={spaceCounts(state, s.id)}
              isHome={s.id === hostelId}
              onPress={() => onOpenSpace(s.id)}
            />
          </View>
        ))}
      </View>
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

const styles = StyleSheet.create({
  container: { padding: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  gridItem: { width: '48%' },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
    marginBottom: 10,
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
  line: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.border,
  },
});