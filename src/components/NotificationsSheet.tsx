import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { theme } from '../constants/theme';
import { AppNotification } from '../types';
import { formatClock } from '../utils/time';
import { Button } from './Button';

interface Props {
  visible: boolean;
  items: AppNotification[];
  onClose: () => void;
}

/** In-app inbox: the same messages that are pushed to the phone. */
export function NotificationsSheet({ visible, items, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.modal} onPress={() => {}}>
          <View style={styles.accent} />
          <Text style={styles.title}>Notifications</Text>
          <ScrollView style={{ maxHeight: 420 }}>
            {items.length === 0 ? (
              <Text style={styles.empty}>Nothing yet</Text>
            ) : (
              items.map(n => (
                <View key={n.id} style={[styles.row, !n.read_at && styles.unread]}>
                  <Text style={styles.rowTitle}>{n.title}</Text>
                  {n.body ? <Text style={styles.rowBody}>{n.body}</Text> : null}
                  <Text style={styles.rowTime}>
                    {new Date(n.created_at).toDateString() === new Date().toDateString()
                      ? formatClock(new Date(n.created_at))
                      : new Date(n.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                  </Text>
                </View>
              ))
            )}
          </ScrollView>
          <Button label="Close" onPress={onClose} style={{ marginTop: 16 }} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modal: {
    width: '100%',
    maxWidth: 380,
    padding: 24,
    paddingTop: 28,
    backgroundColor: theme.colors.bg,
    borderWidth: 1,
    borderColor: theme.colors.borderBright,
    borderRadius: theme.radius,
  },
  accent: { position: 'absolute', top: 0, left: 24, width: 24, height: 2, backgroundColor: theme.colors.green },
  title: { fontFamily: theme.fonts.sansSemi, fontSize: 17, color: theme.colors.text, marginBottom: 12 },
  empty: { fontFamily: theme.fonts.sans, fontSize: 13, color: theme.colors.textDim, paddingVertical: 20, textAlign: 'center' },
  row: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  unread: { borderLeftWidth: 2, borderLeftColor: theme.colors.green, paddingLeft: 10 },
  rowTitle: { fontFamily: theme.fonts.sansSemi, fontSize: 13, color: theme.colors.text },
  rowBody: { fontFamily: theme.fonts.sans, fontSize: 12, color: theme.colors.textDim, marginTop: 3, lineHeight: 17 },
  rowTime: { fontFamily: theme.fonts.mono, fontSize: 10, color: theme.colors.textFaint, marginTop: 4 },
});
