import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Table } from '../types';
import { theme } from '../constants/theme';
import { formatTime } from '../utils/time';

interface Props {
  table: Table;
  ownerId?: string | null;
  isMine?: boolean;
  breakRemainingSec?: number | null;
  graceRemainingSec?: number | null;
  reserveRemainingSec?: number | null;
  onPress: () => void;
}

export function TableCard({
  table,
  ownerId,
  isMine,
  breakRemainingSec,
  graceRemainingSec,
  reserveRemainingSec,
  onPress,
}: Props) {
  const accent =
    table.status === 'available' ? theme.colors.green
    : table.status === 'reserved' ? theme.colors.blue
    : table.status === 'occupied' ? theme.colors.red
    : theme.colors.yellow;

  const statusLabel =
    table.status === 'available' ? 'Available'
    : table.status === 'reserved' ? 'Reserved'
    : table.status === 'occupied' ? 'Occupied'
    : 'Away';

  const mineBorder =
    isMine && table.status === 'reserved'
      ? { borderColor: theme.colors.blue }
      : isMine
      ? { borderColor: theme.colors.green }
      : null;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, mineBorder, pressed && styles.pressed]}
    >
      <View style={[styles.topBar, { backgroundColor: accent }]} />
      <Text style={styles.label}>{table.label}</Text>
      <Text style={[styles.status, { color: accent }]}>{statusLabel}</Text>

      {ownerId && !isMine && <Text style={styles.owner}>{ownerId}</Text>}
      {isMine && (
        <Text
          style={[
            styles.owner,
            { color: table.status === 'reserved' ? theme.colors.blue : theme.colors.green },
          ]}
        >
          You
        </Text>
      )}

      {reserveRemainingSec != null && (
        <Text style={[styles.extra, { color: theme.colors.blue }]}>
          SCAN IN {formatTime(reserveRemainingSec)}
        </Text>
      )}
      {breakRemainingSec != null && (
        <Text style={styles.extra}>◷ {formatTime(breakRemainingSec)}</Text>
      )}
      {graceRemainingSec != null && (
        <Text style={[styles.extra, { color: theme.colors.red }]}>
          GRACE {formatTime(graceRemainingSec)}
        </Text>
      )}
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
    minHeight: 92,
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  label: {
    fontFamily: theme.fonts.dot,
    fontSize: 22,
    color: theme.colors.text,
    letterSpacing: 0.5,
  },
  status: {
    fontFamily: theme.fonts.monoBold,
    fontSize: 9,
    marginTop: 6,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  owner: {
    fontFamily: theme.fonts.mono,
    fontSize: 8,
    color: theme.colors.textFaint,
    marginTop: 2,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  extra: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    color: theme.colors.yellow,
    marginTop: 6,
    letterSpacing: 1,
  },
});