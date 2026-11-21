import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../constants/theme';
import { formatClock } from '../utils/time';
import { Button } from './Button';

interface Props {
  visible: boolean;
  name: string;
  username: string;
  tableLabel: string;
  spaceName: string;
  startedAt: string;
  endsAt: string;
  onBreak: boolean;
  onClose: () => void;
}

/**
 * 18 · "Proof" view: a big, live screen a student can show to anyone asking them
 * to move. The ticking clock shows it is live, not a screenshot.
 */
export function ProofSheet(p: Props) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    if (!p.visible) return;
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, [p.visible]);

  return (
    <Modal visible={p.visible} transparent animationType="fade" onRequestClose={p.onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.badge}>
            <View style={styles.dot} />
            <Text style={styles.badgeText}>{p.onBreak ? 'CHECKED IN · ON BREAK' : 'CHECKED IN'}</Text>
          </View>
          <Text style={styles.table}>{p.tableLabel}</Text>
          <Text style={styles.space}>{p.spaceName}</Text>

          <View style={styles.rows}>
            <Row k="Student" v={`${p.name} (@${p.username})`} />
            <Row k="Since" v={formatClock(new Date(p.startedAt))} />
            <Row k="Until" v={formatClock(new Date(p.endsAt))} />
          </View>

          <Text style={styles.clock}>{now.toLocaleTimeString()}</Text>
          <Text style={styles.note}>
            This table is booked through TABL. If there's a problem, please contact the warden.
          </Text>
          <Button label="Close" onPress={p.onClose} style={{ marginTop: 20, alignSelf: 'stretch' }} />
        </View>
      </View>
    </Modal>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.k}>{k}</Text>
      <Text style={styles.v}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    padding: 28,
    borderWidth: 2,
    borderColor: theme.colors.green,
    borderRadius: theme.radius + 4,
    backgroundColor: theme.colors.surface,
  },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.green },
  badgeText: { fontFamily: theme.fonts.monoBold, fontSize: 11, color: theme.colors.green, letterSpacing: 2 },
  table: { fontFamily: theme.fonts.sansBold, fontSize: 56, color: theme.colors.text },
  space: { fontFamily: theme.fonts.sansMedium, fontSize: 16, color: theme.colors.textDim, marginTop: 4 },
  rows: { alignSelf: 'stretch', marginTop: 24 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  k: { fontFamily: theme.fonts.mono, fontSize: 11, color: theme.colors.textDim, letterSpacing: 1.5, textTransform: 'uppercase' },
  v: { fontFamily: theme.fonts.sansSemi, fontSize: 14, color: theme.colors.text, flexShrink: 1, textAlign: 'right' },
  clock: { fontFamily: theme.fonts.monoBold, fontSize: 28, color: theme.colors.text, marginTop: 24 },
  note: {
    fontFamily: theme.fonts.sans,
    fontSize: 12,
    color: theme.colors.textDim,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 17,
  },
});
