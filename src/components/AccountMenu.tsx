import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../constants/theme';

export interface MenuItem {
  label: string;
  hint?: string;
  onSelect: () => void;
}

interface Props {
  visible: boolean;
  title?: string;
  subtitle?: string;
  items: MenuItem[];
  onCancel: () => void;
}

export function AccountMenu({ visible, title, subtitle, items, onCancel }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.modal} onPress={() => {}}>
          <View style={styles.accent} />
          {title && <Text style={styles.title}>{title}</Text>}
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          <View style={styles.list}>
            {items.map((item, i) => (
              <Pressable
                key={i}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                onPress={item.onSelect}
              >
                <Text style={styles.rowLabel}>{item.label}</Text>
                {item.hint ? <Text style={styles.rowHint}>{item.hint}</Text> : null}
              </Pressable>
            ))}
          </View>
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
    maxWidth: 340,
    padding: 24,
    paddingTop: 28,
    backgroundColor: theme.colors.bg,
    borderWidth: 1,
    borderColor: theme.colors.borderBright,
    borderRadius: theme.radius,
    position: 'relative',
  },
  accent: {
    position: 'absolute',
    top: 0,
    left: 24,
    width: 24,
    height: 2,
    backgroundColor: theme.colors.green,
  },
  title: {
    fontFamily: theme.fonts.dot,
    fontSize: 18,
    color: theme.colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    color: theme.colors.textDim,
    marginTop: 6,
    marginBottom: 16,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  list: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius,
    overflow: 'hidden',
    marginTop: 8,
  },
  row: {
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  rowPressed: { backgroundColor: theme.colors.surface2 },
  rowLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    color: theme.colors.text,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  rowHint: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    color: theme.colors.textDim,
    letterSpacing: 1,
  },
});