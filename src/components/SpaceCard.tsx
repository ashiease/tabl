import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Space } from '../types';
import { theme } from '../constants/theme';

interface Props {
  space: Space;
  counts: { total: number; available: number };
  isHome?: boolean;
  onPress: () => void;
}

export function SpaceCard({ space, counts, isHome, onPress }: Props) {
  const full = counts.available === 0;
  const accent = full ? theme.colors.red : theme.colors.green;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={[styles.topBar, { backgroundColor: accent }]} />
      <View style={styles.labelRow}>
        <Text style={styles.label}>{space.name}</Text>
        {isHome && <Text style={styles.homeTag}>·HOME</Text>}
      </View>
      <Text style={styles.meta}>
        <Text style={{ color: accent, fontFamily: theme.fonts.monoBold }}>
          {counts.available}
        </Text>
        <Text style={{ color: theme.colors.textDim }}>
          {' '}/ {counts.total} free
        </Text>
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius,
    overflow: 'hidden',
    position: 'relative',
    minHeight: 76,
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
  },
  labelRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  label: {
    fontFamily: theme.fonts.dot,
    fontSize: 16,
    color: theme.colors.text,
    letterSpacing: 0.5,
  },
  homeTag: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    color: theme.colors.green,
    letterSpacing: 2,
  },
  meta: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    color: theme.colors.textDim,
    marginTop: 8,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});