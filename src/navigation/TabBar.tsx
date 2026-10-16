import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '../constants/theme';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

/**
 * Material icon per tab.
 * `icon` is the default (inactive), `iconActive` is used when the tab is focused.
 * If iconActive is omitted, the inactive icon is reused and only the color changes.
 */
const TAB_ICONS: Record<
  string,
  { icon: IconName; iconActive?: IconName }
> = {
  Home:    { icon: 'home' },
  Session: { icon: 'access-time' },
  Wait:    { icon: 'list' },
  Scan:    { icon: 'qr-code-scanner' },
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

        const iconEntry = TAB_ICONS[route.name] ?? { icon: 'circle' as IconName };
        const iconName =
          isFocused && iconEntry.iconActive
            ? iconEntry.iconActive
            : iconEntry.icon;

        const iconColor = isFocused
          ? theme.colors.text
          : theme.colors.textFaint;

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            style={({ pressed }) => [styles.item, pressed && { opacity: 0.7 }]}
          >
            {isFocused && <View style={styles.activeBar} />}
            <View style={styles.iconWrap}>
              <MaterialIcons name={iconName} size={18} color={iconColor} />
              {badge !== undefined && (
                <View style={[styles.badge, { backgroundColor: badgeBg }]}>
                  <Text style={[styles.badgeText, { color: badgeFg }]}>
                    {badge}
                  </Text>
                </View>
              )}
            </View>
            <Text style={[styles.label, { color: iconColor }]}>
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
    paddingTop: 10,
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
    top: -11,
    width: 24,
    height: 2,
    backgroundColor: theme.colors.green,
  },
  iconWrap: {
    position: 'relative',
    marginBottom: 4,
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