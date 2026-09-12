import React, { useEffect } from 'react';
import { Trophy, Flame, Droplets, Sparkles, X } from 'lucide-react';
import { GoalAlertEvent } from '../types';

interface GoalCelebrationToastProps {
  alert: GoalAlertEvent | null;
  onDismiss: () => void;
}

export const GoalCelebrationToast: React.FC<GoalCelebrationToastProps> = ({ alert, onDismiss }) => {
  useEffect(() => {
    if (!alert) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, 6500);
    return () => clearTimeout(timer);
  }, [alert, onDismiss]);

  if (!alert) return null;

  const getIcon = () => {
    switch (alert.type) {
      case 'water':
        return <Droplets className="w-6 h-6 text-sky-400" />;
      case 'exercise':
        return <Trophy className="w-6 h-6 text-emerald-400" />;
      case 'streak':
        return <Flame className="w-6 h-6 text-orange-400" />;
      default:
        return <Sparkles className="w-6 h-6 text-amber-400" />;
    }
  };

  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4 pointer-events-none animate-bounce-short">
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 rounded-3xl shadow-2xl border border-amber-400/30 backdrop-blur-xl flex items-center gap-3.5 pointer-events-auto">
        <div className="p-3 bg-white/10 rounded-2xl shrink-0 backdrop-blur-sm border border-white/10">
          {getIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">
              Goal Unlocked
            </span>
          </div>
          <h4 className="text-sm font-black text-white mt-1 truncate">{alert.title}</h4>
          <p className="text-xs text-slate-300 font-medium leading-snug line-clamp-2 mt-0.5">
            {alert.message}
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="p-1.5 hover:bg-white/10 text-slate-400 hover:text-white rounded-full transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
