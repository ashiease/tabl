import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { Space } from '../types';
import { theme } from '../constants/theme';

interface Props {
  space: Space | null;
  tag: string;
  counts: { total: number; available: number } | null;
  onPress: () => void;
}

export function HeroCard({ space, tag, counts, onPress }: Props) {
  if (!space || !counts) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.card, styles.unset, pressed && styles.pressed]}
      >
        <View>
          <Text style={styles.tag}>{tag}</Text>
          <Text style={styles.label}>SET{'\n'}HOSTEL</Text>
        </View>
        <Text style={[styles.meta, { color: theme.colors.textFaint }]}>
          TAP TO PICK
        </Text>
      </Pressable>
    );
  }

  const full = counts.available === 0;
  const accentColor = full ? theme.colors.red : theme.colors.green;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={[styles.topBar, { backgroundColor: accentColor }]} />
      <View>
        <Text style={styles.tag}>{tag}</Text>
        <Text style={styles.label}>{space.name}</Text>
      </View>
      <Text style={styles.meta}>
        <Text style={{ color: accentColor, fontFamily: theme.fonts.monoBold }}>
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
    flex: 1,
    minHeight: 118,
    padding: 14,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius,
    justifyContent: 'space-between',
    overflow: 'hidden',
    position: 'relative',
  },
  unset: { borderColor: theme.colors.border },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  tag: {
    fontFamily: theme.fonts.mono,
    fontSize: 8,
    color: theme.colors.textFaint,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  label: {
    fontFamily: theme.fonts.dot,
    fontSize: 22,
    color: theme.colors.text,
    lineHeight: 26,
    textTransform: 'uppercase',
  },
  meta: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    color: theme.colors.textDim,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: 14,
  },
});