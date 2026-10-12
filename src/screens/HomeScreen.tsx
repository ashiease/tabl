import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useStore } from '../state/store';
import { myHostelId, spaceCounts } from '../state/selectors';
import { findSpace } from '../constants/spaces';
import { theme } from '../constants/theme';
import { HeroCard } from '../components/HeroCard';

interface Props {
  onOpenSpace: (id: string) => void;
  onSetHostel: () => void;
}

export function HomeScreen({ onOpenSpace, onSetHostel }: Props) {
  const { state } = useStore();
  const hostelId = myHostelId(state);
  const hostel = hostelId ? findSpace(hostelId) : null;
  const library = findSpace('library')!;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.sectionRow}>
        <View style={styles.dot} />
        <Text style={styles.sectionText}>Quick Access</Text>
        <View style={styles.line} />
      </View>

      <View style={styles.grid}>
        <HeroCard
          space={hostel}
          tag="Home Hostel"
          counts={hostel ? spaceCounts(state, hostel.id) : null}
          onPress={() => (hostel ? onOpenSpace(hostel.id) : onSetHostel())}
        />
        <HeroCard
          space={library}
          tag="Library"
          counts={spaceCounts(state, library.id)}
          onPress={() => onOpenSpace(library.id)}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
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
  line: { flex: 1, height: 1, backgroundColor: theme.colors.border },
  grid: { flexDirection: 'row', gap: 8 },
});