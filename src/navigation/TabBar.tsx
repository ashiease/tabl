import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../constants/theme';

const ICONS: Record<string, string> = {
  Home: '◱',
  Session: '◷',
  Wait: '≡',
  Scan: '#',
};

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.wrap,
        { paddingBottom: Math.max(insets.bottom, 12) },
      ]}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const badge = options.tabBarBadge;
        const badgeBg =
          (options.tabBarBadgeStyle as any)?.backgroundColor ??
          theme.colors.red;
        const badgeFg =
          (options.tabBarBadgeStyle as any)?.color ?? '#fff';

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            style={({ pressed }) => [styles.item, pressed && { opacity: 0.7 }]}
          >
            {isFocused && <View style={styles.activeBar} />}
            <View style={styles.iconWrap}>
              <Text
                style={[
                  styles.icon,
                  { color: isFocused ? theme.colors.text : theme.colors.textFaint },
                ]}
              >
                {ICONS[route.name] ?? '·'}
              </Text>
              {badge !== undefined && (
                <View style={[styles.badge, { backgroundColor: badgeBg }]}>
                  <Text style={[styles.badgeText, { color: badgeFg }]}>
                    {badge}
                  </Text>
                </View>
              )}
            </View>
            <Text
              style={[
                styles.label,
                { color: isFocused ? theme.colors.text : theme.colors.textFaint },
              ]}
            >
              {route.name.toUpperCase()}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    backgroundColor: theme.colors.bg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingTop: 8,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    position: 'relative',
  },
  activeBar: {
    position: 'absolute',
    top: -9,
    width: 35,
    height: 2,
    backgroundColor: theme.colors.green,
  },
  iconWrap: {
    position: 'relative',
    marginBottom: 4,
  },
  icon: {
    fontFamily: theme.fonts.mono,
    fontSize: 16,
  },
  label: {
    fontFamily: theme.fonts.monoBold,
    fontSize: 9,
    letterSpacing: 1.5,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -12,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    fontFamily: theme.fonts.monoBold,
    fontSize: 9,
  },
});