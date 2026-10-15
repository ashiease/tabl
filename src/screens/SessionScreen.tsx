import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useStore } from '../state/store';
import { myActiveSession } from '../state/selectors';
import { DotRing } from '../components/DotRing';
import { Button } from '../components/Button';
import { theme } from '../constants/theme';
import { sessionSecondsLeft } from '../logic/sessions';
import { formatTime, formatClock, secondsUntil } from '../utils/time';
import { SESSION_SECONDS, LOW_TIME_THRESHOLD } from '../constants/policy';

interface Props {
  onStartBreak: () => void;
  onEndBreak: () => void;
  onEndSession: () => void;
  breakBudgetRemaining: number | null;
}

export function SessionScreen({
  onStartBreak,
  onEndBreak,
  onEndSession,
  breakBudgetRemaining,
}: Props) {
  const { state } = useStore();
  const session = myActiveSession(state);
  const [, force] = useState(0);

  useEffect(() => {
    const t = setInterval(() => force(x => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  if (!session) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyIcon}>◱</Text>
        <Text style={styles.emptyText}>No active session</Text>
        <Text style={styles.emptySub}>Pick a space and tap a table</Text>
      </View>
    );
  }

  const startedAt = new Date(session.started_at).getTime();
  const endsAt = new Date(session.ends_at).getTime();

  let remainingFraction = 0;
  let mode: 'session' | 'break' = 'session';
  let low = false;
  let centerBig = '';
  let centerSmall = 'Remaining';

  if (session.status === 'on_break' && session.break_ends_at && session.paused_at) {
    mode = 'break';
    const breakEnds = new Date(session.break_ends_at).getTime();
    const breakStarted = new Date(session.paused_at).getTime();
    const totalMs = Math.max(1, breakEnds - breakStarted);
    const remainingMs = Math.max(0, breakEnds - Date.now());
    remainingFraction = Math.min(1, remainingMs / totalMs);
    centerBig = formatTime(secondsUntil(session.break_ends_at));
    centerSmall = 'Break Remaining';
  } else {
    const left = sessionSecondsLeft(session);
    remainingFraction = Math.min(1, left / SESSION_SECONDS);
    low = left <= LOW_TIME_THRESHOLD;
    centerBig = formatTime(left);
  }

  const hasBreakBudget =
    breakBudgetRemaining !== null && breakBudgetRemaining > 0;

  const breakMinutesLabel =
    breakBudgetRemaining !== null
      ? Math.ceil(breakBudgetRemaining / 60)
      : 15;

  const breakHint =
    breakBudgetRemaining !== null
      ? `${formatTime(breakBudgetRemaining)} LEFT`
      : '+ 15M PAUSE';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.timeRange}>
        <View style={styles.timeCol}>
          <Text style={styles.timeLabel}>Started</Text>
          <Text style={styles.timeValue}>{formatClock(new Date(startedAt))}</Text>
        </View>
        <Text style={styles.arrow}>→</Text>
        <View style={styles.timeCol}>
          <Text style={styles.timeLabel}>Ends</Text>
          <Text style={styles.timeValue}>{formatClock(new Date(endsAt))}</Text>
        </View>
      </View>

      <View style={styles.ringWrap}>
        <DotRing remainingFraction={remainingFraction} mode={mode} low={low}>
          <Text style={styles.big}>{centerBig}</Text>
          <Text style={styles.small}>{centerSmall.toUpperCase()}</Text>
        </DotRing>
      </View>

      <View style={styles.actions}>
        {mode === 'session' && hasBreakBudget && (
          <Button
            label={`${breakMinutesLabel} MIN BREAK`}
            rightHint={breakHint}
            variant="warning"
            onPress={onStartBreak}
          />
        )}
        {mode === 'session' && !hasBreakBudget && (
          <Button
            label="BREAK USED"
            variant="ghost"
            onPress={() => {}}
          />
        )}
        {mode === 'break' && (
          <Button
            label="I'M BACK"
            variant="success"
            onPress={onEndBreak}
          />
        )}
        <Button
          label="END SESSION"
          variant="ghost"
          onPress={onEndSession}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, alignItems: 'center' },
  timeRange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 28,
  },
  timeCol: { alignItems: 'center', gap: 6 },
  timeLabel: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    color: theme.colors.textDim,
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  timeValue: {
    fontFamily: theme.fonts.display,
    fontSize: 20,
    color: theme.colors.text,
    letterSpacing: 0.5,
  },
  arrow: {
    color: theme.colors.textFaint,
    paddingTop: 18,
    fontFamily: theme.fonts.mono,
  },
  ringWrap: { alignItems: 'center', justifyContent: 'center' },
  big: {
    fontFamily: theme.fonts.display,
    fontSize: 46,
    color: theme.colors.text,
    fontVariant: ['tabular-nums'],
    letterSpacing: 2,
  },
  small: {
    fontFamily: theme.fonts.mono,
    fontSize: 9,
    color: theme.colors.textDim,
    letterSpacing: 3,
    marginTop: 12,
  },
  actions: { width: '100%', marginTop: 32, gap: 12 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIcon: { fontSize: 32, color: theme.colors.textDim, marginBottom: 20 },
  emptyText: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    color: theme.colors.textDim,
    letterSpacing: 1.5,
  },
  emptySub: {
    fontFamily: theme.fonts.mono,
    fontSize: 10,
    color: theme.colors.textDim,
    letterSpacing: 1.5,
    marginTop: 6,
  },
});