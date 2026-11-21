import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { theme } from '../../constants/theme';

export function SectionLabel({ label, right }: { label: string; right?: React.ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <View style={styles.dot} />
      <Text style={styles.sectionText}>{label}</Text>
      <View style={styles.line} />
      {right}
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Row({ k, v, valueColor, last }: { k: string; v: string; valueColor?: string; last?: boolean }) {
  return (
    <View style={[styles.row, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.key}>{k}</Text>
      <Text style={[styles.value, valueColor ? { color: valueColor } : null]}>{v}</Text>
    </View>
  );
}

export function Stat({ label, value, color, hint }: { label: string; value: number | string; color?: string; hint?: string }) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
      {hint ? <Text style={styles.statHint}>{hint}</Text> : null}
    </View>
  );
}

export function Chip({
  label, active, onPress, color,
}: { label: string; active?: boolean; onPress?: () => void; color?: string }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={[
        styles.chip,
        active && { backgroundColor: theme.colors.surface2, borderColor: color ?? theme.colors.green },
      ]}
    >
      <Text style={[styles.chipText, { color: active ? color ?? theme.colors.green : color ?? theme.colors.textDim }]}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Segmented tabs for the admin dashboard. */
export function Segments<T extends string>({
  value, options, onChange,
}: { value: T; options: { id: T; label: string; badge?: number }[]; onChange: (v: T) => void }) {
  return (
    <View style={styles.segWrap}>
      {options.map(o => {
        const on = o.id === value;
        return (
          <Pressable key={o.id} onPress={() => onChange(o.id)} style={[styles.seg, on && styles.segOn]}>
            <Text style={[styles.segText, on && styles.segTextOn]} numberOfLines={1}>{o.label}</Text>
            {o.badge ? (
              <View style={styles.badge}><Text style={styles.badgeText}>{o.badge}</Text></View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function Input(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={theme.colors.textFaint}
      {...props}
      style={[styles.input, props.multiline && { minHeight: 90, textAlignVertical: 'top' }, props.style]}
    />
  );
}

/** − value + control for a number setting. */
export function Stepper({
  label, value, step = 1, min, max, unit = 'min', onChange,
}: { label: string; value: number; step?: number; min: number; max: number; unit?: string; onChange: (v: number) => void }) {
  return (
    <View style={styles.row}>
      <Text style={styles.key}>{label}</Text>
      <View style={styles.stepper}>
        <Pressable style={styles.stepBtn} onPress={() => onChange(Math.max(min, value - step))}>
          <Text style={styles.stepTxt}>−</Text>
        </Pressable>
        <Text style={styles.stepVal}>{value} {unit}</Text>
        <Pressable style={styles.stepBtn} onPress={() => onChange(Math.min(max, value + step))}>
          <Text style={styles.stepTxt}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function Empty({ text }: { text: string }) {
  return <Text style={styles.empty}>{text}</Text>;
}

export function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

export const styles = StyleSheet.create({
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 24, marginBottom: 12 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: theme.colors.green },
  sectionText: {
    fontFamily: theme.fonts.monoBold, fontSize: 10, color: theme.colors.textDim, letterSpacing: 2.5, textTransform: 'uppercase',
  },
  line: { flex: 1, height: 1, backgroundColor: theme.colors.border },
  card: {
    padding: 16, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius,
  },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: theme.colors.border, gap: 12,
  },
  key: { fontFamily: theme.fonts.mono, fontSize: 10, color: theme.colors.textDim, letterSpacing: 1.5, textTransform: 'uppercase', flexShrink: 1 },
  value: { fontFamily: theme.fonts.monoBold, fontSize: 13, color: theme.colors.text },
  statCell: {
    width: '48%', padding: 16, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: theme.radius,
  },
  statLabel: { fontFamily: theme.fonts.mono, fontSize: 9, color: theme.colors.textDim, letterSpacing: 2, textTransform: 'uppercase' },
  statValue: { fontFamily: theme.fonts.display, fontSize: 30, color: theme.colors.text, marginTop: 8 },
  statHint: { fontFamily: theme.fonts.sans, fontSize: 11, color: theme.colors.textDim, marginTop: 2 },
  chip: {
    paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 20,
  },
  chipText: { fontFamily: theme.fonts.sansSemi, fontSize: 11 },
  segWrap: {
    flexDirection: 'row', backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: theme.radius, padding: 3, gap: 3,
  },
  seg: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: theme.radius - 3, flexDirection: 'row', justifyContent: 'center', gap: 4 },
  segOn: { backgroundColor: theme.colors.surface2, borderWidth: 1, borderColor: theme.colors.borderBright },
  segText: { fontFamily: theme.fonts.sansSemi, fontSize: 11, color: theme.colors.textDim },
  segTextOn: { color: theme.colors.text },
  badge: { minWidth: 16, height: 16, borderRadius: 8, backgroundColor: theme.colors.red, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { fontFamily: theme.fonts.sansSemi, fontSize: 9, color: '#fff' },
  input: {
    borderWidth: 1, borderColor: theme.colors.borderBright, borderRadius: theme.radius, paddingHorizontal: 12, paddingVertical: 10,
    color: theme.colors.text, fontFamily: theme.fonts.sans, fontSize: 13, backgroundColor: theme.colors.bg, marginBottom: 8,
  },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn: {
    width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: theme.colors.borderBright,
    alignItems: 'center', justifyContent: 'center',
  },
  stepTxt: { color: theme.colors.text, fontSize: 16, fontFamily: theme.fonts.sansSemi },
  stepVal: { fontFamily: theme.fonts.monoBold, fontSize: 13, color: theme.colors.text, minWidth: 64, textAlign: 'center' },
  empty: {
    fontFamily: theme.fonts.mono, fontSize: 10, color: theme.colors.textDim, letterSpacing: 1.5, textTransform: 'uppercase',
    textAlign: 'center', paddingVertical: 10,
  },
  smallText: { fontFamily: theme.fonts.sans, fontSize: 12, color: theme.colors.textDim, lineHeight: 17 },
  titleText: { fontFamily: theme.fonts.sansSemi, fontSize: 14, color: theme.colors.text },
  monoSmall: { fontFamily: theme.fonts.mono, fontSize: 10, color: theme.colors.textFaint },
});
