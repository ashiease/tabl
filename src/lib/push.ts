// Push notifications (12)
// - Server pushes (table ready, table released, reports, announcements…) are queued in
//   the `notifications` table and sent by the database every 10 s to this phone's token.
// - Time reminders (session / break / reservation about to run out) are scheduled locally
//   on the phone, so they fire on time even without a connection.
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Android needs a notification channel. Expo Go can't create one (SDK 53+), so this is
// optional: without it, reminders still work using the system default channel.
let channelReady = false;
async function ensureChannel() {
  if (Platform.OS !== 'android' || channelReady) return;
  try {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'TABL',
      importance: Notifications.AndroidImportance.HIGH,
    });
    channelReady = true;
  } catch {
    channelReady = false;
  }
}

/** Ask for permission and register this phone. Returns the Expo push token, or null. */
export async function registerForPush(): Promise<string | null> {
  if (Platform.OS === 'web' || !Device.isDevice) return null;

  await ensureChannel();

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== 'granted') return null;

  // EAS project id from app.json → expo.extra.eas.projectId
  const projectId = '27af94a0-1e03-4cf4-b84c-1285f2cae5ab';
  let token: string;
  try {
    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch {
    // Expo Go on Android has no remote push; a development build does.
    console.log('[push] remote push not available in this build (Expo Go?) · local reminders still work');
    return null;
  }

  const { error } = await supabase.rpc('set_push_token', { p_token: token, p_platform: Platform.OS });
  if (error) console.warn('[push] set_push_token failed:', error.message);
  return token;
}

export async function unregisterPush(token: string | null) {
  if (!token) return;
  await supabase.rpc('clear_push_token', { p_token: token });
}

export interface Reminder {
  at: Date;
  title: string;
  body: string;
}

/** Replace all scheduled reminders with these (past ones are skipped). */
export async function setReminders(reminders: Reminder[]) {
  if (Platform.OS === 'web') return;
  try {
    await ensureChannel();
    await Notifications.cancelAllScheduledNotificationsAsync();
    const now = Date.now();
    for (const r of reminders) {
      if (r.at.getTime() <= now + 1000) continue;
      await Notifications.scheduleNotificationAsync({
        content: { title: r.title, body: r.body, sound: 'default' },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: r.at,
          ...(channelReady ? { channelId: 'default' } : {}),
        },
      });
    }
  } catch (e) {
    console.warn('[push] reminders failed:', e);
  }
}
