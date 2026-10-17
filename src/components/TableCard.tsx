import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Table } from '../types';
import { theme } from '../constants/theme';
import { formatTime } from '../utils/time';

interface Props {
  table: Table;
  isMine?: boolean;
  breakRemainingSec?: number | null;
  reserveRemainingSec?: number | null;
  onPress: () => void;
}

export function TableCard({
  table,
  isMine,
  breakRemainingSec,
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

  const borderColor =
    isMine && table.status === 'reserved' ? theme.colors.blue
    : isMine ? theme.colors.green
    : theme.colors.border;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { borderColor },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.topBar, { backgroundColor: accent }]} />

      <Text style={styles.label}>{table.label}</Text>
      <Text style={[styles.status, { color: accent }]}>{statusLabel}</Text>

      {isMine && (
        <Text
          style={[
            styles.you,
            {
              color:
                table.status === 'reserved'
                  ? theme.colors.blue
                  : theme.colors.green,
            },
          ]}
        >
          You
        </Text>
      )}

      {reserveRemainingSec != null && (
        <Text style={[styles.extra, { color: theme.colors.blue }]}>
          Scan in {formatTime(reserveRemainingSec)}
        </Text>
      )}
      {breakRemainingSec != null && (
        <Text style={styles.extra}>◷ {formatTime(breakRemainingSec)}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
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
    fontFamily: theme.fonts.display,
    fontSize: 22,
    color: theme.colors.text,
    letterSpacing: 0,
  },
  status: {
    fontFamily: theme.fonts.sansSemi,
    fontSize: 11,
    marginTop: 6,
    letterSpacing: 0.2,
  },
  you: {
    fontFamily: theme.fonts.sansSemi,
    fontSize: 11,
    marginTop: 2,
    letterSpacing: 0,
  },
  extra: {
    fontFamily: theme.fonts.sansSemi,
    fontSize: 11,
    color: theme.colors.yellow,
    marginTop: 6,
    letterSpacing: 0,
  },
});