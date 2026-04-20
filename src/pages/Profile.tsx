
import React, { useState } from 'react';
import { User, Settings, Bell, Shield, Heart, HelpCircle, LogOut, ChevronRight, Scale, Ruler, Activity, Target, MapPin, Zap, Moon, Sun, RefreshCw, AlertCircle } from 'lucide-react';
import { UserProfile, DailyHistoryEntry } from '../types';
import { auth, db, doc, setDoc, handleFirestoreError, OperationType } from '../firebase';

interface ProfileProps {
  profile: UserProfile | null;
  history?: DailyHistoryEntry[];
  onReset: () => void;
  onRestoreStats: () => Promise<boolean>;
  darkMode: boolean;
  onToggleDarkMode: () => void;
}

const Profile: React.FC<ProfileProps> = ({ profile, history, onReset, onRestoreStats, darkMode, onToggleDarkMode }) => {
  const [isRestoring, setIsRestoring] = useState(false);
  const [showRestoreSuccess, setShowRestoreSuccess] = useState(false);

  if (!profile) return null;

  const handleSignOut = () => {
    auth.signOut();
  };

  const handleRestoreFullData = async () => {
    if (!auth.currentUser) return;
    
    setIsRestoring(true);
    try {
      // 1. Restore Weight if discrepancy found
      const hasWeightDiscrepancy = history && history.length > 0 && history.some(h => h.weight !== profile.weight);
      if (hasWeightDiscrepancy) {
        const lastWeight = history.find(h => h.weight !== profile.weight)?.weight || history[0].weight;
        const userDocRef = doc(db, 'users', auth.currentUser.uid);
        await setDoc(userDocRef, { 
          weight: lastWeight,
          stats: { weight: lastWeight }
        }, { merge: true });
      }

      // 2. Restore Goals and Today's Calories
      await onRestoreStats();
      
      setShowRestoreSuccess(true);
      setTimeout(() => setShowRestoreSuccess(false), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${auth.currentUser.uid}`);
    } finally {
      setIsRestoring(false);
    }
  };

  const handleResetData = async () => {
    if (!auth.currentUser) return;
    
    try {
      const userDocRef = doc(db, 'users', auth.currentUser.uid);
      await setDoc(userDocRef, { onboarded: false }, { merge: true });
      onReset();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${auth.currentUser.uid}`);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <h1 className="text-2xl font-black text-gray-900 dark:text-white">Profile</h1>

      <div className="bg-white dark:bg-slate-900 p-6 rounded-[32px] shadow-sm border border-gray-50 dark:border-slate-800 flex items-center gap-4">
        <div className="w-16 h-16 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center text-white text-2xl font-black border-4 border-white dark:border-slate-800 shadow-lg">
          {profile.name.charAt(0)}
        </div>
        <div>
          <h2 className="text-xl font-black text-gray-900 dark:text-white">{profile.name}</h2>
          <div className="flex items-center gap-1 text-gray-400">
            <MapPin className="w-3 h-3" />
            <span className="text-xs font-bold">{profile.location}</span>
          </div>
          <p className="text-sm text-indigo-500 font-bold uppercase tracking-widest mt-1">{profile.goal.replace('_', ' ')}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <ProfileStat icon={<Zap className="text-amber-500 fill-amber-500" />} label="Streak" value={`${profile.streak} Days`} />
        <ProfileStat 
          icon={<Scale className="text-rose-500" />} 
          label="Weight" 
          value={profile.unitSystem === 'metric' 
            ? `${Math.round(profile.weight * 0.453592)} kg` 
            : `${profile.weight} lbs`} 
        />
        <ProfileStat 
          icon={<Ruler className="text-blue-500" />} 
          label="Height" 
          value={profile.unitSystem === 'metric' 
            ? `${profile.height} cm` 
            : `${Math.floor(profile.height / 30.48)}'${Math.round((profile.height % 30.48) / 2.54)}"`} 
        />
        <ProfileStat icon={<Activity className="text-indigo-500" />} label="Activity" value={profile.activityLevel.replace('_', ' ')} />
      </div>

      <div className="space-y-2">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-gray-50 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl">
              {darkMode ? <Moon className="w-5 h-5 text-indigo-400" /> : <Sun className="w-5 h-5 text-amber-500" />}
            </div>
            <span className="text-sm font-bold text-gray-700 dark:text-slate-200">Dark Mode</span>
          </div>
          <button 
            onClick={onToggleDarkMode}
            className={`w-12 h-6 rounded-full relative transition-colors duration-300 ${darkMode ? 'bg-indigo-600' : 'bg-slate-200'}`}
          >
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 ${darkMode ? 'left-7' : 'left-1'}`}></div>
          </button>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-gray-50 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl">
              <Settings className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
            </div>
            <span className="text-sm font-bold text-gray-700 dark:text-slate-200">Unit System</span>
          </div>
          <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-xl">
            {(['imperial', 'metric'] as const).map((sys) => (
              <button
                key={sys}
                onClick={async () => {
                  if (!auth.currentUser) return;
                  try {
                    const userDocRef = doc(db, 'users', auth.currentUser.uid);
                    await setDoc(userDocRef, { unitSystem: sys }, { merge: true });
                  } catch (error) {
                    handleFirestoreError(error, OperationType.UPDATE, `users/${auth.currentUser.uid}`);
                  }
                }}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                  profile.unitSystem === sys 
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                  : 'text-gray-400 hover:text-gray-600 dark:hover:text-slate-300'
                }`}
              >
                {sys}
              </button>
            ))}
          </div>
        </div>
        <MenuButton icon={<User className="text-blue-500" />} label="Personal Information" />
        <MenuButton 
          icon={<Heart className="text-red-500" />} 
          label="Retake Health Questionnaire" 
          onClick={handleResetData}
        />
        
        <div className="p-4 bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl border border-indigo-100 dark:border-indigo-800/50 space-y-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-black text-indigo-900 dark:text-indigo-200">Sync & Recovery</h4>
              <p className="text-xs text-indigo-600 dark:text-indigo-400/80 font-medium leading-relaxed">
                If your goals or today's logs seem missing, click below to recalculate your totals and restore goals from your history.
              </p>
            </div>
          </div>
          <button 
            onClick={handleRestoreFullData}
            disabled={isRestoring}
            className="w-full py-3 bg-white dark:bg-slate-800 rounded-xl text-indigo-600 dark:text-indigo-400 text-xs font-black uppercase tracking-widest shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2"
          >
            {isRestoring ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {showRestoreSuccess ? 'Sync Complete!' : 'Restore Past Goals & Logs'}
          </button>
        </div>

        <MenuButton icon={<Bell className="text-amber-500" />} label="Notifications" />
        <MenuButton icon={<Shield className="text-emerald-500" />} label="Privacy & Security" />
        <MenuButton icon={<Settings className="text-gray-500" />} label="App Settings" />
      </div>

      <button 
        onClick={handleSignOut}
        className="w-full p-5 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-50 dark:border-slate-800 flex items-center justify-center gap-2 text-red-500 font-black hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
      >
        <LogOut className="w-5 h-5" /> Sign Out
      </button>
    </div>
  );
};

const ProfileStat = ({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) => (
  <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-gray-50 dark:border-slate-800 shadow-sm">
    <div className="flex items-center gap-2 mb-1">
      {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { className: 'w-4 h-4' }) : icon}
      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</span>
    </div>
    <div className="text-lg font-black text-gray-900 dark:text-white capitalize">{value}</div>
  </div>
);

const MenuButton = ({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick?: () => void }) => (
  <button 
    onClick={onClick}
    className="w-full p-5 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-50 dark:border-slate-800 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
  >
    <div className="flex items-center gap-4">
      <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl group-hover:bg-white dark:group-hover:bg-slate-700 transition-colors">
        {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { className: 'w-5 h-5' }) : icon}
      </div>
      <span className="text-sm font-bold text-gray-700 dark:text-slate-200">{label}</span>
    </div>
    <ChevronRight className="w-4 h-4 text-gray-300" />
  </button>
);

export default Profile;
