import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../constants/theme';

export interface PickerItem {
  id: string;
  label: string;
  sublabel?: string;
  isActive?: boolean;
  isAdmin?: boolean;
}

interface Props {
  visible: boolean;
  title: string;
  message?: string;
  items: PickerItem[];
  onSelect: (id: string) => void;
  onCancel: () => void;
}

export function PickerSheet({
  visible,
  title,
  message,
  items,
  onSelect,
  onCancel,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable
          style={[
            styles.modal,
            {
              maxHeight:
                // leave room for status bar + safe bottom + 48px breathing room
                '100%',
              marginTop: insets.top + 24,
              marginBottom: insets.bottom + 24,
            },
          ]}
          onPress={() => {}}
        >
          <View style={styles.accent} />
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}

          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={true}
            indicatorStyle="white"
            bounces={true}
          >
            {items.map(item => (
              <Pressable
                key={item.id}
                style={({ pressed }) => [
                  styles.row,
                  item.isActive && styles.rowActive,
                  pressed && styles.rowPressed,
                ]}
                onPress={() => onSelect(item.id)}
              >
                <View style={styles.rowLeft}>
                  {item.isActive && <Text style={styles.caret}>▸</Text>}
                  <Text style={styles.rowLabel}>{item.label}</Text>
                </View>
                {item.sublabel ? (
                  <Text
                    style={[
                      styles.rowSub,
                      item.isAdmin && { color: theme.colors.red },
                    ]}
                  >
                    {item.sublabel}
                  </Text>
                ) : null}
              </Pressable>
            ))}
          </ScrollView>
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
    backgroundColor: theme.colors.bg,
    borderWidth: 1,
    borderColor: theme.colors.borderBright,
    borderRadius: theme.radius,
    paddingTop: 28,
    paddingHorizontal: 24,
    paddingBottom: 24,
    position: 'relative',
    flexShrink: 1,
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
    marginBottom: 8,
  },
  message: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    color: theme.colors.textDim,
    lineHeight: 18,
    marginBottom: 16,
  },
  list: {
    maxHeight: 340,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius,
    flexGrow: 0,
  },
  listContent: {
    paddingVertical: 0,
  },
  row: {
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  rowActive: { backgroundColor: theme.colors.surface2 },
  rowPressed: { backgroundColor: theme.colors.surface2 },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  caret: { color: theme.colors.green, fontSize: 11 },
  rowLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: 11,
    color: theme.colors.text,
    letterSpacing: 1,
  },
  rowSub: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    color: theme.colors.textDim,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
});