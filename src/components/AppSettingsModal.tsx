import React, { useState } from 'react';
import {
  Settings,
  X,
  Moon,
  Sun,
  Ruler,
  Clock,
  Calendar,
  Layers,
  Sparkles,
  Database,
  Trash2,
  Check,
  Smartphone,
} from 'lucide-react';
import { UserProfile, AppPreferences, UnitSystem } from '../types';
import { DEFAULT_APP_PREFERENCES } from '../lib/notifications';

interface AppSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile | null;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onSaveAppPreferences: (prefs: AppPreferences, newUnitSystem?: UnitSystem) => Promise<void>;
  showNotification?: (message: string, type: 'error' | 'success' | 'info') => void;
}

export const AppSettingsModal: React.FC<AppSettingsModalProps> = ({
  isOpen,
  onClose,
  profile,
  isDarkMode,
  onToggleDarkMode,
  onSaveAppPreferences,
  showNotification,
}) => {
  const [preferences, setPreferences] = useState<AppPreferences>(() => ({
    ...DEFAULT_APP_PREFERENCES,
    ...(profile?.appPreferences || {}),
  }));

  const [unitSystem, setUnitSystem] = useState<UnitSystem>(profile?.unitSystem || 'metric');
  const [isSaving, setIsSaving] = useState(false);
  const [clearedCache, setClearedCache] = useState(false);

  if (!isOpen) return null;

  const handleTogglePref = async (key: keyof AppPreferences) => {
    const updated = {
      ...preferences,
      [key]: !preferences[key],
    };
    setPreferences(updated);
    setIsSaving(true);
    try {
      await onSaveAppPreferences(updated, unitSystem);
    } catch (err) {
      console.error('Failed to save app preferences:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangeUnit = async (unit: UnitSystem) => {
    setUnitSystem(unit);
    setIsSaving(true);
    try {
      await onSaveAppPreferences(preferences, unit);
      if (showNotification) {
        showNotification(`Unit system changed to ${unit === 'metric' ? 'Metric (kg, cm, ml)' : 'Imperial (lbs, ft/in, oz)'}`, 'success');
      }
    } catch (err) {
      console.error('Failed to update unit system:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTimeFormatChange = async (format: '12h' | '24h') => {
    const updated = { ...preferences, timeFormat: format };
    setPreferences(updated);
    setIsSaving(true);
    try {
      await onSaveAppPreferences(updated, unitSystem);
    } catch (err) {
      console.error('Failed to save time format:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartOfWeekChange = async (day: 'sunday' | 'monday') => {
    const updated = { ...preferences, startOfWeek: day };
    setPreferences(updated);
    setIsSaving(true);
    try {
      await onSaveAppPreferences(updated, unitSystem);
    } catch (err) {
      console.error('Failed to save start of week:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearCache = () => {
    try {
      // Clear non-essential cached keys
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('cache') || key.includes('temp') || key.includes('preview'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      setClearedCache(true);
      setTimeout(() => setClearedCache(false), 3000);
      if (showNotification) {
        showNotification('App cache & temporary images cleared.', 'success');
      }
    } catch (e) {
      console.warn('Could not clear cache:', e);
    }
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
            <div className="p-2.5 bg-slate-500/10 text-slate-600 dark:text-slate-300 rounded-2xl">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">App Settings</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Display theme, measurement units & regional formatting</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Appearance & Dark Mode */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                Appearance & Theme
              </h3>
              {isSaving && <span className="text-[10px] text-indigo-500 font-bold animate-pulse">Saving...</span>}
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-xl">
                  {isDarkMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-800 dark:text-slate-200">
                    {isDarkMode ? 'Dark Mode Active' : 'Light Mode Active'}
                  </h4>
                  <p className="text-[11px] text-slate-400 dark:text-slate-400 mt-0.5">
                    Toggle high-contrast dark palette or crisp light theme
                  </p>
                </div>
              </div>

              <button
                onClick={onToggleDarkMode}
                className="px-4 py-2 bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 font-bold text-xs rounded-xl border border-slate-200 dark:border-slate-600 transition-all shadow-sm active:scale-95 flex items-center gap-1.5"
              >
                <span>Switch to {isDarkMode ? 'Light' : 'Dark'}</span>
              </button>
            </div>

            <AppToggleRow
              icon={<Sparkles className="w-4 h-4 text-amber-500" />}
              title="Auto-Celebrate Goal Milestones"
              description="Show in-app goal celebration banner and animation when you achieve daily goals"
              checked={preferences.autoCelebrateGoals}
              onChange={() => handleTogglePref('autoCelebrateGoals')}
            />
          </div>

          {/* Measurement Units */}
          <div className="space-y-3">
            <h3 className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Measurement Units
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleChangeUnit('metric')}
                className={`p-4 rounded-2xl border text-left transition-all relative ${
                  unitSystem === 'metric'
                    ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-black text-slate-900 dark:text-white">Metric</span>
                  {unitSystem === 'metric' && <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                  Kilograms (kg), Centimeters (cm), Milliliters (ml)
                </p>
              </button>

              <button
                onClick={() => handleChangeUnit('imperial')}
                className={`p-4 rounded-2xl border text-left transition-all relative ${
                  unitSystem === 'imperial'
                    ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-black text-slate-900 dark:text-white">Imperial</span>
                  {unitSystem === 'imperial' && <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                  Pounds (lbs), Feet/Inches (ft), Fluid Ounces (oz)
                </p>
              </button>
            </div>
          </div>

          {/* Regional & Formatting */}
          <div className="space-y-3">
            <h3 className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Time & Calendar
            </h3>

            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-200/60 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-800 dark:text-slate-200">Time Format</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Display log timestamps in 12h or 24h clock</p>
                </div>
              </div>

              <div className="flex bg-slate-200 dark:bg-slate-700 p-1 rounded-xl">
                <button
                  onClick={() => handleTimeFormatChange('12h')}
                  className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${
                    preferences.timeFormat === '12h'
                      ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  12h (AM/PM)
                </button>
                <button
                  onClick={() => handleTimeFormatChange('24h')}
                  className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${
                    preferences.timeFormat === '24h'
                      ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  24h
                </button>
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-200/60 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-800 dark:text-slate-200">First Day of Week</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Start of week for progress charts</p>
                </div>
              </div>

              <div className="flex bg-slate-200 dark:bg-slate-700 p-1 rounded-xl">
                <button
                  onClick={() => handleStartOfWeekChange('monday')}
                  className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${
                    preferences.startOfWeek === 'monday'
                      ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Monday
                </button>
                <button
                  onClick={() => handleStartOfWeekChange('sunday')}
                  className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${
                    preferences.startOfWeek === 'sunday'
                      ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Sunday
                </button>
              </div>
            </div>
          </div>

          {/* Cache & System Diagnostics */}
          <div className="space-y-3">
            <h3 className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Storage & Diagnostics
            </h3>

            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-200/60 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-800 dark:text-slate-200">Local Cache</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">Clear cached meal previews and offline buffers</p>
                </div>
              </div>

              <button
                onClick={handleClearCache}
                className="px-3 py-1.5 bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl border border-slate-200 dark:border-slate-600 transition-all active:scale-95 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5 text-slate-500" />
                <span>{clearedCache ? 'Cleared!' : 'Clear Cache'}</span>
              </button>
            </div>

            <div className="px-3 py-2 text-center text-[10px] text-slate-400 dark:text-slate-500 font-medium">
              FitAI Companion v2.4.0 • Google Gemini AI Cloud Connected
            </div>
          </div>
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

interface AppToggleRowProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}

const AppToggleRow: React.FC<AppToggleRowProps> = ({ icon, title, description, checked, onChange }) => {
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
