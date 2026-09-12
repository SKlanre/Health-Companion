import React, { useState } from 'react';
import {
  Shield,
  X,
  UserCheck,
  Eye,
  EyeOff,
  Sparkles,
  Download,
  KeyRound,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Lock,
  FileJson,
} from 'lucide-react';
import { UserProfile, PrivacySettings, DailyStats, FoodLogEntry } from '../types';
import { DEFAULT_PRIVACY_SETTINGS } from '../lib/notifications';
import { auth, sendPasswordResetEmail, db, doc, deleteDoc } from '../firebase';

interface PrivacySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile | null;
  stats?: DailyStats | null;
  foodLog?: FoodLogEntry[];
  onSavePrivacySettings: (settings: PrivacySettings) => Promise<void>;
  onSignOut?: () => void;
  showNotification?: (message: string, type: 'error' | 'success' | 'info') => void;
}

export const PrivacySettingsModal: React.FC<PrivacySettingsModalProps> = ({
  isOpen,
  onClose,
  profile,
  stats,
  foodLog = [],
  onSavePrivacySettings,
  onSignOut,
  showNotification,
}) => {
  const [settings, setSettings] = useState<PrivacySettings>(() => ({
    ...DEFAULT_PRIVACY_SETTINGS,
    ...(profile?.privacySettings || {}),
  }));

  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [passwordResetSent, setPasswordResetSent] = useState(false);

  if (!isOpen) return null;

  const handleToggle = async (key: keyof PrivacySettings) => {
    const updated = {
      ...settings,
      [key]: !settings[key],
    };
    setSettings(updated);
    setIsSaving(true);
    try {
      await onSavePrivacySettings(updated);
    } catch (err) {
      console.error('Failed to save privacy settings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportData = () => {
    setIsExporting(true);
    try {
      const exportObject = {
        exportDate: new Date().toISOString(),
        application: 'FitAI Nutrition & Fitness Companion',
        version: '2.4.0',
        user: {
          name: profile?.name,
          age: profile?.age,
          gender: profile?.gender,
          weight: profile?.weight,
          height: profile?.height,
          goal: profile?.goal,
          activityLevel: profile?.activityLevel,
          location: profile?.location,
          currency: profile?.currency,
          dailyBudget: profile?.dailyBudget,
          streak: profile?.streak,
          unitSystem: profile?.unitSystem,
        },
        privacySettings: settings,
        currentStats: stats,
        recentFoodLogs: foodLog,
      };

      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportObject, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `fitai_health_export_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      if (showNotification) {
        showNotification('Personal health data exported successfully!', 'success');
      }
    } catch (err) {
      console.error('Export failed:', err);
      if (showNotification) {
        showNotification('Failed to export data. Please try again.', 'error');
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handleSendPasswordReset = async () => {
    if (!auth.currentUser?.email) {
      if (showNotification) {
        showNotification('No registered email address found for this account.', 'error');
      }
      return;
    }

    try {
      await sendPasswordResetEmail(auth, auth.currentUser.email);
      setPasswordResetSent(true);
      if (showNotification) {
        showNotification(`Password reset email dispatched to ${auth.currentUser.email}`, 'success');
      }
      setTimeout(() => setPasswordResetSent(false), 5000);
    } catch (err) {
      console.error('Password reset failed:', err);
      if (showNotification) {
        showNotification('Failed to send password reset email. Please try again.', 'error');
      }
    }
  };

  const handleDeleteAccountData = async () => {
    setIsDeleting(true);
    try {
      if (auth.currentUser && !auth.currentUser.uid.startsWith('guest_local_')) {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        await deleteDoc(userRef);
      }
      localStorage.clear();
      if (showNotification) {
        showNotification('Account data erased successfully.', 'info');
      }
      if (onSignOut) {
        onSignOut();
      }
      onClose();
    } catch (err) {
      console.error('Account erase failed:', err);
      if (showNotification) {
        showNotification('Could not erase account data. Please check connection.', 'error');
      }
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
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
            <div className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-2xl">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">Privacy & Security</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Manage data, community visibility & credentials</p>
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
          {/* Community & Social Visibility */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                Community & Social Sharing
              </h3>
              {isSaving && <span className="text-[10px] text-emerald-500 font-bold animate-pulse">Saving...</span>}
            </div>

            <PrivacyToggleRow
              icon={settings.shareGoalsPublicly ? <Eye className="w-4 h-4 text-emerald-500" /> : <EyeOff className="w-4 h-4 text-slate-400" />}
              title="Share Goals & Milestones in Community"
              description="Display completed daily goals and streaks on leaderboard achievements and activity feeds"
              checked={settings.shareGoalsPublicly}
              onChange={() => handleToggle('shareGoalsPublicly')}
            />

            <PrivacyToggleRow
              icon={<UserCheck className="w-4 h-4 text-indigo-500" />}
              title="Anonymous Community Alias"
              description="Hide your real name and email address in community chats, using a private fitness badge instead"
              checked={settings.anonymousCommunity}
              onChange={() => handleToggle('anonymousCommunity')}
            />
          </div>

          {/* AI & Data Controls */}
          <div className="space-y-3">
            <h3 className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              AI Intelligence & Analytics
            </h3>

            <PrivacyToggleRow
              icon={<Sparkles className="w-4 h-4 text-amber-500" />}
              title="AI Dietary Personalization"
              description="Allow the Gemini AI Nutritionist to analyze previous food logs to tailor culturally authentic meals"
              checked={settings.aiPersonalization}
              onChange={() => handleToggle('aiPersonalization')}
            />

            <PrivacyToggleRow
              icon={<Lock className="w-4 h-4 text-sky-500" />}
              title="Anonymous Diagnostics"
              description="Share anonymous latency and error telemetry to maintain fast scanning and AI response times"
              checked={settings.analyticsEnabled}
              onChange={() => handleToggle('analyticsEnabled')}
            />
          </div>

          {/* Data Ownership & Export */}
          <div className="space-y-3">
            <h3 className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Data Ownership & Account
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                onClick={handleExportData}
                disabled={isExporting}
                className="p-3.5 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700 text-left transition-all active:scale-98 group flex flex-col justify-between"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-xl">
                    <Download className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-black text-slate-900 dark:text-white">Export Health Data</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                  Download a complete JSON archive of all your nutrition, workout, and goal logs.
                </p>
              </button>

              {auth.currentUser && !auth.currentUser.uid.startsWith('guest_local_') && (
                <button
                  onClick={handleSendPasswordReset}
                  className="p-3.5 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700 text-left transition-all active:scale-98 group flex flex-col justify-between"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-xl">
                      <KeyRound className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-black text-slate-900 dark:text-white">
                      {passwordResetSent ? 'Email Dispatched!' : 'Reset Password'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                    Send secure password reset instructions to your registered email address.
                  </p>
                </button>
              )}
            </div>
          </div>

          {/* Danger Zone */}
          <div className="pt-2">
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full py-3 px-4 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50 rounded-2xl border border-red-200/60 dark:border-red-900/40 text-red-600 dark:text-red-400 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Account & Erase All Personal Data</span>
              </button>
            ) : (
              <div className="p-4 bg-red-50 dark:bg-red-950/50 rounded-2xl border border-red-200 dark:border-red-800 space-y-3">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-black text-red-900 dark:text-red-200">Are you absolutely sure?</h4>
                    <p className="text-xs text-red-700 dark:text-red-300/90 leading-relaxed mt-0.5">
                      This will permanently delete your profile, stats, streak, and logs from our cloud database. This action cannot be undone.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteAccountData}
                    disabled={isDeleting}
                    className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black shadow-sm flex items-center justify-center gap-1.5"
                  >
                    {isDeleting ? 'Erasing...' : 'Yes, Erase Data'}
                  </button>
                </div>
              </div>
            )}
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

interface PrivacyToggleRowProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}

const PrivacyToggleRow: React.FC<PrivacyToggleRowProps> = ({ icon, title, description, checked, onChange }) => {
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
          checked ? 'bg-emerald-600' : 'bg-slate-200 dark:bg-slate-700'
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
