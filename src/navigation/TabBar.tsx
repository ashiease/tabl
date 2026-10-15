import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '../constants/theme';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

const TAB_ICONS: Record<string, IconName> = {
  Home: 'home',
  Session: 'access-time',
  Wait: 'list',
  Scan: 'qr-code-scanner',
};

const SCAN_TAB = 'Scan';

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
        const isScan = route.name === SCAN_TAB;

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

        const iconName = TAB_ICONS[route.name] ?? 'circle';

        // ─── Icon color rules ───
        // Non-scan tabs: white when active, faint gray when inactive
        // Scan tab: white when active, dim green when inactive
        const iconColor = isFocused
          ? theme.colors.text
          : isScan
          ? 'rgba(34, 197, 94, 0.55)' // dim green
          : theme.colors.textFaint;

        // ─── Label color rules ───
        // Same as icons, but Scan's label stays faint gray when inactive
        // (only the icon wears the green accent)
        const labelColor = isFocused
          ? theme.colors.text
          : theme.colors.textFaint;

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            style={({ pressed }) => [styles.item, pressed && { opacity: 0.7 }]}
          >
            {isFocused && <View style={styles.activeBar} />}

            {isScan ? (
              <View
                style={[
                  styles.scanContainer,
                  isFocused
                    ? styles.scanContainerActive
                    : styles.scanContainerInactive,
                ]}
              >
                <MaterialIcons name={iconName} size={22} color={iconColor} />
                {badge !== undefined && (
                  <View style={[styles.badge, { backgroundColor: badgeBg }]}>
                    <Text style={[styles.badgeText, { color: badgeFg }]}>
                      {badge}
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.iconWrap}>
                <MaterialIcons name={iconName} size={22} color={iconColor} />
                {badge !== undefined && (
                  <View style={[styles.badge, { backgroundColor: badgeBg }]}>
                    <Text style={[styles.badgeText, { color: badgeFg }]}>
                      {badge}
                    </Text>
                  </View>
                )}
              </View>
            )}

            <Text style={[styles.label, { color: labelColor }]}>
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

  // Container for the Scan icon
  scanContainer: {
    width: 32,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  scanContainerInactive: {
    backgroundColor: 'rgba(34, 197, 94, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.25)',
  },
  scanContainerActive: {
    backgroundColor: 'rgba(34, 197, 94, 0.20)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.55)',
  },

  // Container for non-scan icons (kept for consistent vertical alignment)
  iconWrap: {
    width: 32,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
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
    right: -2,
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