import React from 'react';
import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { theme } from '../constants/theme';

type Variant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'danger'
  | 'success'
  | 'warning';

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  style?: ViewStyle;
  rightHint?: string;
}

export function Button({
  label,
  onPress,
  variant = 'secondary',
  style,
  rightHint,
}: Props) {
  const bg =
    variant === 'primary' || variant === 'success'
      ? theme.colors.green
      : variant === 'danger'
      ? theme.colors.red
      : 'transparent';

  const fg =
    variant === 'primary' || variant === 'success'
      ? '#061a0d'
      : variant === 'danger'
      ? theme.colors.text
      : variant === 'warning'
      ? theme.colors.yellow
      : theme.colors.text;

  const border =
    variant === 'primary' || variant === 'success'
      ? theme.colors.green
      : variant === 'danger'
      ? theme.colors.red
      : variant === 'warning'
      ? theme.colors.border
      : variant === 'ghost'
      ? theme.colors.border
      : theme.colors.borderBright;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, borderColor: border },
        pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
        style,
      ]}
    >
      <Text style={[styles.text, { color: fg }]}>{label}</Text>
      {rightHint ? <Text style={styles.hint}>{rightHint}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: theme.radius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontFamily: theme.fonts.monoBold,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  hint: {
    position: 'absolute',
    right: 14,
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    color: theme.colors.textDim,
    letterSpacing: 1,
  },
});