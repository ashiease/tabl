import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../constants/theme';
import { User } from '../types';

interface Props {
  title: string;
  subtitle: string;
  titleVariant?: 'default' | 'away' | 'grace';
  user: User;
  onUserPress: () => void;
  showTopAccent?: boolean;
}

export function AppHeader({
  title,
  subtitle,
  titleVariant = 'default',
  user,
  onUserPress,
  showTopAccent = true,
}: Props) {
  const insets = useSafeAreaInsets();

  const titleColor =
    titleVariant === 'away' ? theme.colors.yellow
    : titleVariant === 'grace' ? theme.colors.red
    : theme.colors.text;

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 12 }]}>
      {showTopAccent && <View style={styles.topAccent} />}
      <View style={styles.row}>
        <View style={styles.left}>
          <Text style={[styles.title, { color: titleColor }]} numberOfLines={1}>
            {title.toUpperCase()}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle.toUpperCase()}
          </Text>
        </View>
        <Pressable
          onPress={onUserPress}
          style={({ pressed }) => [styles.pill, pressed && styles.pillPressed]}
        >
          <View
            style={[
              styles.roleDot,
              user.role === 'admin' && { backgroundColor: theme.colors.red },
            ]}
          />
          <Text style={styles.pillText}>{user.id}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: theme.colors.bg,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    position: 'relative',
  },
  topAccent: {
    position: 'absolute',
    top: 0,
    left: 20,
    width: 32,
    height: 1,
    backgroundColor: theme.colors.green,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  left: { flex: 1 },
  title: {
    fontFamily: theme.fonts.dot,
    fontSize: 24,
    letterSpacing: 1.5,
    lineHeight: 28,
  },
  subtitle: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    color: theme.colors.textDim,
    marginTop: 6,
    letterSpacing: 2,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderBright,
    borderRadius: 20,
  },
  pillPressed: { backgroundColor: theme.colors.surface2 },
  roleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.green,
  },
  pillText: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    color: theme.colors.textDim,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});