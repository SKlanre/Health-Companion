import React, { useState, useEffect } from 'react';
import {
  Bell,
  X,
  CheckCircle2,
  AlertCircle,
  Volume2,
  VolumeX,
  Vibrate,
  Smartphone,
  Flame,
  Droplets,
  Utensils,
  Trophy,
  Trash2,
  Send,
  Sparkles,
} from 'lucide-react';
import { UserProfile, NotificationSettings, GoalAlertEvent } from '../types';
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  getBrowserNotificationPermission,
  requestNotificationPermission,
  dispatchGoalCelebration,
  getSavedGoalAlerts,
  clearSavedAlerts,
} from '../lib/notifications';

interface NotificationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile | null;
  onSaveNotificationSettings: (settings: NotificationSettings) => Promise<void>;
  onTriggerGoalAlert?: (alert: GoalAlertEvent) => void;
}

export const NotificationSettingsModal: React.FC<NotificationSettingsModalProps> = ({
  isOpen,
  onClose,
  profile,
  onSaveNotificationSettings,
  onTriggerGoalAlert,
}) => {
  const [settings, setSettings] = useState<NotificationSettings>(() => ({
    ...DEFAULT_NOTIFICATION_SETTINGS,
    ...(profile?.notificationSettings || {}),
  }));

  const [permStatus, setPermStatus] = useState<NotificationPermission | 'unsupported'>('default');
  const [history, setHistory] = useState<GoalAlertEvent[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'settings' | 'history'>('settings');
  const [testSent, setTestSent] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPermStatus(getBrowserNotificationPermission());
      setHistory(getSavedGoalAlerts());
      if (profile?.notificationSettings) {
        setSettings({
          ...DEFAULT_NOTIFICATION_SETTINGS,
          ...profile.notificationSettings,
        });
      }
    }
  }, [isOpen, profile]);

  if (!isOpen) return null;

  const handleToggle = async (key: keyof NotificationSettings) => {
    const updated = {
      ...settings,
      [key]: !settings[key],
    };

    // If enabling browser notifications and permission is not granted yet, ask
    if (key === 'browserNotifications' && updated.browserNotifications && permStatus !== 'granted') {
      const result = await requestNotificationPermission();
      setPermStatus(result);
      if (result !== 'granted') {
        updated.browserNotifications = false;
      }
    }

    setSettings(updated);
    setIsSaving(true);
    try {
      await onSaveNotificationSettings(updated);
    } catch (e) {
      console.error('Failed to save notification settings:', e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRequestPermission = async () => {
    const res = await requestNotificationPermission();
    setPermStatus(res);
    if (res === 'granted') {
      const updated = { ...settings, browserNotifications: true };
      setSettings(updated);
      await onSaveNotificationSettings(updated);
    }
  };

  const handleSendTestNotification = () => {
    const testAlert: GoalAlertEvent = {
      id: `test_goal_${Date.now()}`,
      type: 'calories',
      title: '🎉 Goal Achieved! (Test)',
      message: 'Awesome work! Your daily calorie target has been fulfilled.',
      timestamp: new Date().toISOString(),
      value: 2150,
      goal: 2100,
      read: false,
    };

    dispatchGoalCelebration(testAlert, settings);
    setHistory(getSavedGoalAlerts());
    setTestSent(true);
    setTimeout(() => setTestSent(false), 3000);

    if (onTriggerGoalAlert) {
      onTriggerGoalAlert(testAlert);
    }
  };

  const handleClearHistory = () => {
    clearSavedAlerts();
    setHistory([]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div 
        className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[32px] overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col max-h-[90vh] animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 text-amber-500 rounded-2xl">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">Goal & Notifications</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Alerts, goal celebrations & reminders</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex px-6 pt-3 border-b border-slate-100 dark:border-slate-800 gap-4">
          <button
            onClick={() => setActiveTab('settings')}
            className={`pb-3 text-xs font-black uppercase tracking-wider transition-all relative ${
              activeTab === 'settings'
                ? 'text-indigo-600 dark:text-indigo-400'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            Settings & Toggles
            {activeTab === 'settings' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-3 text-xs font-black uppercase tracking-wider transition-all relative flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'text-indigo-600 dark:text-indigo-400'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            Alert History
            {history.length > 0 && (
              <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[9px] font-black rounded-full">
                {history.length}
              </span>
            )}
            {activeTab === 'history' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
            )}
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {activeTab === 'settings' ? (
            <>
              {/* Browser Permission Banner */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200/70 dark:border-slate-700/60 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl shrink-0 mt-0.5">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                        Browser Web Notifications
                      </h4>
                      {permStatus === 'granted' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3" /> Enabled
                        </span>
                      ) : permStatus === 'denied' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 px-2 py-0.5 rounded-full">
                          <AlertCircle className="w-3 h-3" /> Blocked
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded-full">
                          Not Allowed Yet
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      {permStatus === 'granted'
                        ? 'Your device is ready to receive instant goal achievements and reminder alerts!'
                        : permStatus === 'denied'
                        ? 'Notifications were blocked in your browser settings. To enable, click the lock icon in your URL bar and allow notifications.'
                        : 'Allow browser notifications so you never miss a goal completion or hydration check.'}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  {permStatus !== 'granted' && permStatus !== 'denied' && (
                    <button
                      onClick={handleRequestPermission}
                      className="flex-1 py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black tracking-wide shadow-md shadow-indigo-600/20 active:scale-98 transition-all flex items-center justify-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Enable Browser Alerts</span>
                    </button>
                  )}
                  <button
                    onClick={handleSendTestNotification}
                    className="py-2.5 px-3 bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-black tracking-wide border border-slate-200 dark:border-slate-600 active:scale-98 transition-all flex items-center justify-center gap-1.5 shrink-0"
                  >
                    <Send className="w-3.5 h-3.5 text-amber-500" />
                    <span>{testSent ? 'Sent!' : 'Send Test Alert'}</span>
                  </button>
                </div>
              </div>

              {/* Goal Celebrations Group */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    Goal Notifications
                  </h3>
                  {isSaving && <span className="text-[10px] text-indigo-500 font-bold animate-pulse">Saving...</span>}
                </div>

                <ToggleRow
                  icon={<Trophy className="w-4 h-4 text-amber-500" />}
                  title="Goal Milestones & Celebrations"
                  description="Notify immediately when Daily Calorie, Water, Exercise, or Steps targets are fulfilled"
                  checked={settings.goalCelebrations}
                  onChange={() => handleToggle('goalCelebrations')}
                />

                <ToggleRow
                  icon={<Flame className="w-4 h-4 text-orange-500" />}
                  title="Streak Saver Alerts"
                  description="Evening reminder to log your daily activity and protect your consistency streak"
                  checked={settings.streakAlerts}
                  onChange={() => handleToggle('streakAlerts')}
                />

                <ToggleRow
                  icon={<Droplets className="w-4 h-4 text-sky-500" />}
                  title="Hydration Reminders"
                  description="Gentle periodic prompts to keep you hydrated and on track for your water goal"
                  checked={settings.waterReminders}
                  onChange={() => handleToggle('waterReminders')}
                />

                <ToggleRow
                  icon={<Utensils className="w-4 h-4 text-emerald-500" />}
                  title="Meal Logging Prompts"
                  description="Reminders to record breakfast, lunch, and dinner so your stats stay accurate"
                  checked={settings.mealReminders}
                  onChange={() => handleToggle('mealReminders')}
                />
              </div>

              {/* Audio & Delivery Preferences */}
              <div className="space-y-3">
                <h3 className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  Feedback & Sound
                </h3>

                <ToggleRow
                  icon={settings.soundEnabled ? <Volume2 className="w-4 h-4 text-indigo-500" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
                  title="Celebration Audio Chimes"
                  description="Play an uplifting harmonic arpeggio when you achieve a fitness goal"
                  checked={settings.soundEnabled}
                  onChange={() => handleToggle('soundEnabled')}
                />

                <ToggleRow
                  icon={<Vibrate className="w-4 h-4 text-purple-500" />}
                  title="Haptic Vibration"
                  description="Vibrate device gently upon goal completion (mobile & supported devices)"
                  checked={settings.vibrationEnabled}
                  onChange={() => handleToggle('vibrationEnabled')}
                />
              </div>
            </>
          ) : (
            /* History Tab */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  {history.length === 0 ? 'No alerts yet' : `${history.length} recent goal alert${history.length > 1 ? 's' : ''}`}
                </span>
                {history.length > 0 && (
                  <button
                    onClick={handleClearHistory}
                    className="text-[11px] font-bold text-red-500 hover:text-red-600 flex items-center gap-1 hover:underline"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear All</span>
                  </button>
                )}
              </div>

              {history.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
                  <Trophy className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No goal achievements logged yet</p>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto">
                    When you hit your calorie, water, exercise, or streak goals, celebratory alerts will appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {history.map((alert) => (
                    <div
                      key={alert.id}
                      className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/60 flex items-start gap-3.5"
                    >
                      <div className="p-2 bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-xl shrink-0 mt-0.5">
                        {alert.type === 'water' ? (
                          <Droplets className="w-4 h-4 text-sky-500" />
                        ) : alert.type === 'exercise' ? (
                          <Trophy className="w-4 h-4 text-emerald-500" />
                        ) : alert.type === 'streak' ? (
                          <Flame className="w-4 h-4 text-orange-500" />
                        ) : (
                          <Sparkles className="w-4 h-4 text-amber-500" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-black text-slate-900 dark:text-white">{alert.title}</h4>
                          <span className="text-[10px] text-slate-400">
                            {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 font-medium mt-0.5 leading-relaxed">
                          {alert.message}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm active:scale-95"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

interface ToggleRowProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}

const ToggleRow: React.FC<ToggleRowProps> = ({ icon, title, description, checked, onChange }) => {
  return (
    <div
      onClick={onChange}
      className="p-3.5 bg-white dark:bg-slate-800/70 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 cursor-pointer transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 bg-slate-100 dark:bg-slate-700/60 rounded-xl shrink-0 mt-0.5">
          {icon}
        </div>
        <div>
          <h4 className="text-xs font-black text-slate-800 dark:text-slate-200">{title}</h4>
          <p className="text-[11px] text-slate-400 dark:text-slate-400 leading-snug mt-0.5">{description}</p>
        </div>
      </div>

      {/* Switch element */}
      <div
        className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${
          checked ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'
        }`}
      >
        <span
          className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform shadow-sm ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </div>
    </div>
  );
};
