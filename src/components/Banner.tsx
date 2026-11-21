import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../constants/theme';

type Tone = 'info' | 'warning' | 'danger';

interface Props {
  title: string;
  body?: string;
  tone?: Tone;
  onPress?: () => void;
}

/** A slim notice card: announcements, account status, items left behind. */
export function Banner({ title, body, tone = 'info', onPress }: Props) {
  const accent =
    tone === 'danger' ? theme.colors.red
    : tone === 'warning' ? theme.colors.yellow
    : theme.colors.blue;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.wrap, { borderLeftColor: accent }, pressed && { opacity: 0.85 }]}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        {body ? <Text style={styles.body}>{body}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    padding: 14,
    marginBottom: 10,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderLeftWidth: 3,
    borderRadius: theme.radius,
  },
  title: {
    fontFamily: theme.fonts.sansSemi,
    fontSize: 13,
    color: theme.colors.text,
  },
  body: {
    fontFamily: theme.fonts.sans,
    fontSize: 12,
    color: theme.colors.textDim,
    marginTop: 4,
    lineHeight: 17,
  },
});
