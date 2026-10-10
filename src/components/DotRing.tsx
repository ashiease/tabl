import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { DOT_COUNT } from '../constants/policy';
import { theme } from '../constants/theme';

const SIZE = 280;
const CENTER = SIZE / 2;
const RADIUS = 118;

type Mode = 'session' | 'break' | 'grace';

interface Props {
  remainingFraction: number; // 1 = full, 0 = empty
  mode?: Mode;
  low?: boolean;
  urgent?: boolean;
  children?: React.ReactNode;
}

export function DotRing({
  remainingFraction,
  mode = 'session',
  low = false,
  urgent = false,
  children,
}: Props) {
  const litCount = Math.round(DOT_COUNT * Math.max(0, Math.min(1, remainingFraction)));
  const leadingIdx = litCount - 1;

  const litColor =
    mode === 'break' ? theme.colors.yellow
    : mode === 'grace' ? theme.colors.red
    : low ? theme.colors.yellow
    : theme.colors.green;

  return (
    <View style={styles.wrap}>
      <Svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        style={StyleSheet.absoluteFill}
      >
        {Array.from({ length: DOT_COUNT }, (_, i) => {
          const angle = (i / DOT_COUNT) * Math.PI * 2 - Math.PI / 2;
          const x = CENTER + RADIUS * Math.cos(angle);
          const y = CENTER + RADIUS * Math.sin(angle);

          const isLit = i < litCount;
          const isLeading = i === leadingIdx;

          const fill = isLit ? litColor : '#1a1a1a';
          const r = isLit ? 3.2 : 2.4;

          return (
            <Circle
              key={i}
              cx={x}
              cy={y}
              r={r}
              fill={fill}
              opacity={isLeading && isLit ? 0.9 : 1}
            />
          );
        })}
      </Svg>
      <View style={styles.center}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});