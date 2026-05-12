import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const MORNING_ID = 'tans.morning-reminder';
const EVENING_ID = 'tans.evening-checkin';

// Default schedule. A future settings screen can read/write these.
export const NOTIFICATION_TIMES = {
  morning: { hour: 9, minute: 0 },
  evening: { hour: 19, minute: 0 },
};

let handlerSet = false;

function ensureHandler() {
  if (handlerSet) return;
  handlerSet = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 120, 80, 120],
  });
}

export async function setupNotifications(): Promise<boolean> {
  ensureHandler();
  await ensureAndroidChannel();

  const existing = await Notifications.getPermissionsAsync();
  let granted = existing.granted;
  if (!granted && existing.canAskAgain) {
    const requested = await Notifications.requestPermissionsAsync();
    granted = requested.granted;
  }
  if (!granted) return false;

  // Cancel-and-replace so changing the schedule is idempotent.
  await Notifications.cancelScheduledNotificationAsync(MORNING_ID).catch(
    () => {},
  );
  await Notifications.cancelScheduledNotificationAsync(EVENING_ID).catch(
    () => {},
  );

  await Notifications.scheduleNotificationAsync({
    identifier: MORNING_ID,
    content: {
      title: 'Time to make a piece',
      body: 'A small action is enough — show up for today.',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: NOTIFICATION_TIMES.morning.hour,
      minute: NOTIFICATION_TIMES.morning.minute,
    },
  });

  await Notifications.scheduleNotificationAsync({
    identifier: EVENING_ID,
    content: {
      title: 'Evening check-in',
      body: 'How did today go? Your tangram is waiting.',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: NOTIFICATION_TIMES.evening.hour,
      minute: NOTIFICATION_TIMES.evening.minute,
    },
  });

  return true;
}

export async function cancelAllScheduled(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
