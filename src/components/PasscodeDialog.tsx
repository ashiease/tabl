import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { theme } from '../constants/theme';
import { Button } from './Button';

interface Props {
  visible: boolean;
  onSubmit: (code: string) => void;
  onCancel: () => void;
}

export function PasscodeDialog({ visible, onSubmit, onCancel }: Props) {
  const [value, setValue] = useState('');

  useEffect(() => {
    if (!visible) setValue('');
  }, [visible]);

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
          <Text style={styles.title}>Admin Access</Text>
          <Text style={styles.message}>Enter admin passcode. (Demo: 2001)</Text>
          <TextInput
            value={value}
            onChangeText={setValue}
            placeholder="Passcode"
            placeholderTextColor={theme.colors.textFaint}
            secureTextEntry
            keyboardType="number-pad"
            style={styles.input}
            autoFocus
          />
          <View style={styles.actions}>
            <Button
              label="Cancel"
              variant="secondary"
              onPress={onCancel}
              style={{ flex: 1 }}
            />
            <Button
              label="Unlock"
              variant="primary"
              onPress={() => onSubmit(value)}
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
    backgroundColor: theme.colors.green,
  },
  title: {
    fontFamily: theme.fonts.dot,
    fontSize: 18,
    color: theme.colors.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  message: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    color: theme.colors.textDim,
    lineHeight: 18,
    marginBottom: 16,
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderBright,
    borderRadius: theme.radius,
    paddingVertical: 12,
    paddingHorizontal: 14,
    color: theme.colors.text,
    fontFamily: theme.fonts.mono,
    fontSize: 14,
    letterSpacing: 2,
    marginBottom: 16,
  },
  actions: { flexDirection: 'row', gap: 8 },
});