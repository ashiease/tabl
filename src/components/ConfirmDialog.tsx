import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../constants/theme';
import { Button } from './Button';

export interface ConfirmConfig {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  accent?: 'green' | 'red' | 'yellow';
  destructive?: boolean;
}

interface Props extends ConfirmConfig {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  accent = 'green',
  destructive = false,
  onConfirm,
  onCancel,
}: Props) {
  const accentColor =
    destructive ? theme.colors.red
    : accent === 'red' ? theme.colors.red
    : accent === 'yellow' ? theme.colors.yellow
    : theme.colors.green;

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
          <View style={[styles.accent, { backgroundColor: accentColor }]} />
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <Button
              label={cancelText}
              onPress={onCancel}
              variant="secondary"
              style={{ flex: 1 }}
            />
            <Button
              label={confirmText}
              onPress={onConfirm}
              variant={destructive ? 'danger' : 'primary'}
              style={{ flex: 1 }}
            />
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
  },
  title: {
    fontFamily: theme.fonts.dot,
    fontSize: 18,
    color: theme.colors.text,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  message: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    color: theme.colors.textDim,
    lineHeight: 18,
    marginBottom: 20,
    letterSpacing: 0.3,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
});