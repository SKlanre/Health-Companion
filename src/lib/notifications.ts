import { DailyStats, UserProfile, NotificationSettings, PrivacySettings, AppPreferences, GoalAlertEvent } from '../types';

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  goalCelebrations: true,
  waterReminders: true,
  mealReminders: true,
  streakAlerts: true,
  browserNotifications: false,
  soundEnabled: true,
  vibrationEnabled: true,
};

export const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  shareGoalsPublicly: true,
  anonymousCommunity: false,
  aiPersonalization: true,
  analyticsEnabled: true,
};

export const DEFAULT_APP_PREFERENCES: AppPreferences = {
  theme: 'system',
  timeFormat: '12h',
  startOfWeek: 'monday',
  compactCards: false,
  autoCelebrateGoals: true,
};

const STORAGE_KEY_ALERTS = 'fitai_goal_alerts_history';

/**
 * Check if the browser supports Desktop/Web Notifications
 */
export function isBrowserNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Get current browser notification permission
 */
export function getBrowserNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isBrowserNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

/**
 * Request notification permission from the user
 */
export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isBrowserNotificationSupported()) return 'unsupported';
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return Notification.permission;
  }
}

/**
 * Send a web notification if allowed
 */
export function sendBrowserNotification(title: string, options?: NotificationOptions): boolean {
  if (!isBrowserNotificationSupported()) return false;
  if (Notification.permission !== 'granted') return false;

  try {
    const notification = new Notification(title, {
      icon: '/icon.png',
      badge: '/icon.png',
      ...options,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    return true;
  } catch (err) {
    console.warn('Could not dispatch browser notification:', err);
    return false;
  }
}

/**
 * Synthesizes a pleasant goal achievement chime using standard Web Audio API
 */
export function playGoalCelebrationSound(): void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // Harmonic arpeggio: C5 (523Hz), E5 (659Hz), G5 (784Hz), C6 (1046Hz)
    const notes = [
      { freq: 523.25, time: 0.00, dur: 0.25 },
      { freq: 659.25, time: 0.12, dur: 0.25 },
      { freq: 783.99, time: 0.24, dur: 0.35 },
      { freq: 1046.50, time: 0.38, dur: 0.60 },
    ];

    notes.forEach(({ freq, time, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + time);

      gain.gain.setValueAtTime(0.001, now + time);
      gain.gain.exponentialRampToValueAtTime(0.25, now + time + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + time + dur);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + time);
      osc.stop(now + time + dur);
    });

    // Clean up AudioContext after playing
    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 1500);
  } catch (err) {
    console.warn('Web Audio celebration chime unavailable:', err);
  }
}

/**
 * Triggers subtle haptic feedback on supported mobile devices
 */
export function triggerHaptic(pattern: number[] = [40, 60, 40]): void {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {
    // Ignore unsupported vibration
  }
}

/**
 * Retrieve saved alerts from localStorage
 */
export function getSavedGoalAlerts(): GoalAlertEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ALERTS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Save an alert to the local history (max 30 entries)
 */
export function saveGoalAlert(alert: GoalAlertEvent): void {
  try {
    const existing = getSavedGoalAlerts();
    const updated = [alert, ...existing.filter(a => a.id !== alert.id)].slice(0, 30);
    localStorage.setItem(STORAGE_KEY_ALERTS, JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed to persist goal alert:', e);
  }
}

/**
 * Mark all alerts as read
 */
export function markAlertsAsRead(): void {
  try {
    const existing = getSavedGoalAlerts();
    const updated = existing.map(a => ({ ...a, read: true }));
    localStorage.setItem(STORAGE_KEY_ALERTS, JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed to mark alerts as read:', e);
  }
}

/**
 * Clear all saved alerts
 */
export function clearSavedAlerts(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_ALERTS);
  } catch (e) {
    console.warn('Failed to clear alerts:', e);
  }
}

/**
 * Check if the user just achieved any daily goals between previous and current stats
 */
export function evaluateGoalMilestones(
  prevStats: DailyStats | null,
  newStats: DailyStats,
  userProfile: UserProfile | null
): GoalAlertEvent[] {
  if (!prevStats) return [];

  const notifSettings: NotificationSettings = {
    ...DEFAULT_NOTIFICATION_SETTINGS,
    ...(userProfile?.notificationSettings || {}),
  };

  if (!notifSettings.goalCelebrations) {
    return [];
  }

  const triggeredAlerts: GoalAlertEvent[] = [];
  const now = new Date().toISOString();

  // 1. Calories Goal Reached
  if (
    newStats.caloriesGoal > 0 &&
    newStats.calories >= newStats.caloriesGoal &&
    prevStats.calories < prevStats.caloriesGoal
  ) {
    triggeredAlerts.push({
      id: `calorie_goal_${Date.now()}`,
      type: 'calories',
      title: 'Daily Calorie Goal Reached! 🎉',
      message: `Outstanding! You hit your calorie target with ${newStats.calories.toLocaleString()} / ${newStats.caloriesGoal.toLocaleString()} kcal today.`,
      timestamp: now,
      value: newStats.calories,
      goal: newStats.caloriesGoal,
      read: false,
    });
  }

  // 2. Water Goal Reached
  if (
    newStats.waterGoal > 0 &&
    newStats.water >= newStats.waterGoal &&
    prevStats.water < prevStats.waterGoal
  ) {
    triggeredAlerts.push({
      id: `water_goal_${Date.now()}`,
      type: 'water',
      title: 'Hydration Goal Achieved! 💧',
      message: `Great job staying hydrated! You completed your daily target with ${newStats.water.toLocaleString()} ml.`,
      timestamp: now,
      value: newStats.water,
      goal: newStats.waterGoal,
      read: false,
    });
  }

  // 3. Exercise Goal Reached
  if (
    newStats.exerciseGoal > 0 &&
    newStats.exercise >= newStats.exerciseGoal &&
    prevStats.exercise < prevStats.exerciseGoal
  ) {
    triggeredAlerts.push({
      id: `exercise_goal_${Date.now()}`,
      type: 'exercise',
      title: 'Workout Target Crushed! 💪',
      message: `You completed your daily fitness goal of ${newStats.exercise} minutes of exercise!`,
      timestamp: now,
      value: newStats.exercise,
      goal: newStats.exerciseGoal,
      read: false,
    });
  }

  // 4. Steps Goal Reached
  if (
    newStats.stepsGoal > 0 &&
    newStats.steps >= newStats.stepsGoal &&
    prevStats.steps < prevStats.stepsGoal
  ) {
    triggeredAlerts.push({
      id: `steps_goal_${Date.now()}`,
      type: 'steps',
      title: 'Daily Steps Goal Met! 👟',
      message: `Incredible work! You conquered ${newStats.steps.toLocaleString()} steps today.`,
      timestamp: now,
      value: newStats.steps,
      goal: newStats.stepsGoal,
      read: false,
    });
  }

  return triggeredAlerts;
}

/**
 * Dispatches goal alert celebrations across Web Push, Sound, Vibration, and persistence
 */
export function dispatchGoalCelebration(
  alert: GoalAlertEvent,
  notifSettings: NotificationSettings
): void {
  // Save to local alert history
  saveGoalAlert(alert);

  // Play celebration sound if enabled
  if (notifSettings.soundEnabled) {
    playGoalCelebrationSound();
  }

  // Trigger haptic vibration if enabled
  if (notifSettings.vibrationEnabled) {
    triggerHaptic([60, 100, 60, 120]);
  }

  // Trigger browser web notification if allowed & enabled
  if (notifSettings.browserNotifications && Notification.permission === 'granted') {
    sendBrowserNotification(alert.title, {
      body: alert.message,
      tag: alert.type,
    });
  }
}
