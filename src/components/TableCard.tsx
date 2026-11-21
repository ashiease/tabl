import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Table } from '../types';
import { theme } from '../constants/theme';
import { formatClock, formatTime } from '../utils/time';

interface Props {
  table: Table;
  isMine?: boolean;
  breakRemainingSec?: number | null;
  reserveRemainingSec?: number | null;
  /** 14 · when the current occupant's session ends */
  freeAt?: string | null;
  /** 14 · when an away owner must be back */
  backBy?: string | null;
  /** 16 · someone is using the table while its owner is away */
  borrowed?: boolean;
  /** 33 · block booking running on this table */
  blockTitle?: string | null;
  blockUntil?: string | null;
  /** 19 · items reported left at the table */
  itemsLeft?: number;
  waiting?: number;
  onPress: () => void;
}

export function TableCard({
  table,
  isMine,
  breakRemainingSec,
  reserveRemainingSec,
  freeAt,
  backBy,
  borrowed,
  blockTitle,
  blockUntil,
  itemsLeft = 0,
  waiting = 0,
  onPress,
}: Props) {
  const accent =
    table.status === 'available' ? theme.colors.green
    : table.status === 'reserved' ? theme.colors.blue
    : table.status === 'occupied' ? theme.colors.red
    : table.status === 'blocked' ? theme.colors.textDim
    : theme.colors.yellow;

  const statusLabel =
    table.status === 'available' ? 'Available'
    : table.status === 'reserved' ? 'Reserved'
    : table.status === 'occupied' ? 'Occupied'
    : table.status === 'blocked' ? (blockTitle ?? 'Blocked')
    : borrowed ? 'Away · in use'
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
        table.status === 'blocked' && { opacity: 0.6 },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.topBar, { backgroundColor: accent }]} />

      <View style={styles.headRow}>
        <Text style={styles.label}>{table.label}</Text>
        {itemsLeft > 0 && <Text style={styles.item}>● item left</Text>}
      </View>
      <Text style={[styles.status, { color: accent }]} numberOfLines={1}>{statusLabel}</Text>

      {isMine && (
        <Text
          style={[
            styles.you,
            { color: table.status === 'reserved' ? theme.colors.blue : theme.colors.green },
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
        <Text style={styles.extra}>
          ◷ {formatTime(breakRemainingSec)}{backBy ? ` · back by ${formatClock(new Date(backBy))}` : ''}
        </Text>
      )}
      {table.status === 'occupied' && freeAt && (
        <Text style={[styles.extra, { color: theme.colors.textDim }]}>Free by {formatClock(new Date(freeAt))}</Text>
      )}
      {table.status === 'blocked' && blockUntil && (
        <Text style={[styles.extra, { color: theme.colors.textDim }]}>Until {formatClock(new Date(blockUntil))}</Text>
      )}
      {waiting > 0 && table.status !== 'available' && (
        <Text style={[styles.extra, { color: theme.colors.textDim }]}>{waiting} waiting</Text>
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
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: {
    fontFamily: theme.fonts.display,
    fontSize: 22,
    color: theme.colors.text,
    letterSpacing: 0,
  },
  item: { fontFamily: theme.fonts.sansSemi, fontSize: 10, color: theme.colors.blue },
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
