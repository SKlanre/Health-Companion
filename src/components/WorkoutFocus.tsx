import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Dumbbell, 
  Sparkles, 
  Target, 
  RefreshCw, 
  Zap, 
  Heart, 
  User, 
  Activity,
  Home,
  Check,
  Eye,
  CalendarCheck,
  Layers
} from 'lucide-react';
import { UserProfile, DailyStats, FoodLogEntry, WorkoutEnvironment } from '../types';
import { recommendFocusArea, suggestWorkout } from '../services/geminiService';
import { auth, db, doc, setDoc } from '../firebase';

interface Props {
  userProfile: UserProfile | null;
  stats: DailyStats;
  foodLog: FoodLogEntry[];
  onShowResult: (title: string, content: string) => void;
  onUpdateProfile?: (updated: Partial<UserProfile>) => void;
}

const AREAS = [
  { id: 'Cardio', icon: <Heart className="w-5 h-5 text-rose-500" />, label: 'Cardio', color: 'rose' },
  { id: 'Legs', icon: <Activity className="w-5 h-5 text-emerald-500" />, label: 'Legs', color: 'emerald' },
  { id: 'Biceps', icon: <Dumbbell className="w-5 h-5 text-blue-500" />, label: 'Biceps', color: 'blue' },
  { id: 'Triceps', icon: <Dumbbell className="w-5 h-5 text-cyan-500" />, label: 'Triceps', color: 'cyan' },
  { id: 'Back', icon: <User className="w-5 h-5 text-amber-500" />, label: 'Back', color: 'amber' },
  { id: 'Chest', icon: <User className="w-5 h-5 text-indigo-500" />, label: 'Chest', color: 'indigo' },
  { id: 'Shoulders', icon: <User className="w-5 h-5 text-purple-500" />, label: 'Shoulders', color: 'purple' },
  { id: 'Core', icon: <Target className="w-5 h-5 text-orange-500" />, label: 'Core', color: 'orange' },
  { id: 'Full Body', icon: <Zap className="w-5 h-5 text-yellow-500" />, label: 'Full Body', color: 'yellow' },
];

const COLOR_MAP: { [key: string]: { bg: string, text: string, border: string } } = {
  rose: { bg: 'bg-rose-50 dark:bg-rose-950/30', text: 'text-rose-500', border: 'hover:border-rose-200 dark:hover:border-rose-900' },
  emerald: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-500', border: 'hover:border-emerald-200 dark:hover:border-emerald-900' },
  blue: { bg: 'bg-blue-50 dark:bg-blue-950/30', text: 'text-blue-500', border: 'hover:border-blue-200 dark:hover:border-blue-900' },
  cyan: { bg: 'bg-cyan-50 dark:bg-cyan-950/30', text: 'text-cyan-500', border: 'hover:border-cyan-200 dark:hover:border-cyan-900' },
  amber: { bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-500', border: 'hover:border-amber-200 dark:hover:border-amber-900' },
  indigo: { bg: 'bg-indigo-50 dark:bg-indigo-950/30', text: 'text-indigo-500', border: 'hover:border-indigo-200 dark:hover:border-indigo-900' },
  purple: { bg: 'bg-purple-50 dark:bg-purple-950/30', text: 'text-purple-500', border: 'hover:border-purple-200 dark:hover:border-purple-900' },
  orange: { bg: 'bg-orange-50 dark:bg-orange-950/30', text: 'text-orange-500', border: 'hover:border-orange-200 dark:hover:border-orange-900' },
  yellow: { bg: 'bg-yellow-50 dark:bg-yellow-950/30', text: 'text-yellow-500', border: 'hover:border-yellow-200 dark:hover:border-yellow-900' },
};

// Check if a timestamp is from the current calendar day
const isToday = (timestamp?: string): boolean => {
  if (!timestamp) return false;
  try {
    const date = new Date(timestamp);
    const now = new Date();
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate()
    );
  } catch {
    return false;
  }
};

const getTodayDateKey = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const WorkoutFocus: React.FC<Props> = ({ userProfile, stats, foodLog, onShowResult, onUpdateProfile }) => {
  const todayKey = useMemo(() => getTodayDateKey(), []);
  const storageKey = useMemo(() => {
    const uid = auth.currentUser?.uid || 'guest';
    return `fitai_fixed_workouts_${uid}_${todayKey}`;
  }, [todayKey]);

  // Environment state (Home vs Gym)
  const [environment, setEnvironment] = useState<WorkoutEnvironment>(() => {
    return userProfile?.workoutEnvironment || 'home';
  });

  // Sync environment when userProfile loads or updates
  useEffect(() => {
    if (userProfile?.workoutEnvironment && userProfile.workoutEnvironment !== environment) {
      setEnvironment(userProfile.workoutEnvironment);
    }
  }, [userProfile?.workoutEnvironment]);

  // Read initial cached workouts from localStorage
  const [cachedWorkouts, setCachedWorkouts] = useState<{ [area: string]: string }>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // ignore
    }
    return {};
  });

  const [recommendation, setRecommendation] = useState<{ area: string; reason: string } | null>(() => {
    if (userProfile?.preloadedFocusAreaRecommendation) {
      if (typeof userProfile.preloadedFocusAreaRecommendation === 'object') {
        const rec = userProfile.preloadedFocusAreaRecommendation;
        if (!rec.timestamp || isToday(rec.timestamp)) {
          return { area: rec.area, reason: rec.reason };
        }
      } else if (typeof userProfile.preloadedFocusAreaRecommendation === 'string') {
        try {
          const parsed = JSON.parse(userProfile.preloadedFocusAreaRecommendation);
          if (parsed.area && parsed.reason) return parsed;
        } catch {
          return { area: userProfile.preloadedFocusAreaRecommendation, reason: "Today's targeted training focus." };
        }
      }
    }
    return null;
  });

  const [isRecommending, setIsRecommending] = useState(false);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Sync workouts from userProfile when available and valid for today
  useEffect(() => {
    if (!userProfile) return;

    setCachedWorkouts(prev => {
      const updated = { ...prev };
      let changed = false;

      // 1. If userProfile has preloadedWorkouts for today
      if (userProfile.preloadedWorkouts && isToday(userProfile.lastWorkoutPreloadTimestamp)) {
        Object.entries(userProfile.preloadedWorkouts).forEach(([key, workout]) => {
          if (workout && (!updated[key] || updated[key] !== workout)) {
            updated[key] = workout;
            changed = true;
          }
        });
      }

      // 2. If userProfile has preloadedWorkout for Full Body today (from daily preload)
      if (userProfile.preloadedWorkout && 
          (isToday(userProfile.lastMealPreloadTimestamp) || isToday(userProfile.lastWorkoutPreloadTimestamp))) {
        const envKey = `Full Body_${userProfile.workoutEnvironment || 'home'}`;
        if (!updated[envKey]) {
          updated[envKey] = userProfile.preloadedWorkout;
          changed = true;
        }
        if (!updated['Full Body']) {
          updated['Full Body'] = userProfile.preloadedWorkout;
          changed = true;
        }
      }

      if (changed) {
        try {
          localStorage.setItem(storageKey, JSON.stringify(updated));
        } catch {
          // ignore
        }
        return updated;
      }
      return prev;
    });

    // Sync recommendation if present on profile
    if (userProfile.preloadedFocusAreaRecommendation && !recommendation) {
      if (typeof userProfile.preloadedFocusAreaRecommendation === 'object') {
        const rec = userProfile.preloadedFocusAreaRecommendation;
        if (!rec.timestamp || isToday(rec.timestamp)) {
          setRecommendation({ area: rec.area, reason: rec.reason });
        }
      } else if (typeof userProfile.preloadedFocusAreaRecommendation === 'string') {
        try {
          const parsed = JSON.parse(userProfile.preloadedFocusAreaRecommendation);
          if (parsed.area) setRecommendation(parsed);
        } catch {
          setRecommendation({ area: userProfile.preloadedFocusAreaRecommendation, reason: "Today's targeted training focus." });
        }
      }
    }
  }, [userProfile, storageKey, recommendation]);

  // Initial load for focus recommendation if not yet generated today
  useEffect(() => {
    if (userProfile && !recommendation && !isRecommending) {
      handleGetRecommendation(false);
    }
  }, [userProfile, recommendation, isRecommending]);

  // Fetch or regenerate the focus recommendation
  const handleGetRecommendation = async (forceRefresh = false) => {
    if (recommendation && !forceRefresh) return;

    setIsRecommending(true);
    try {
      const result = await recommendFocusArea(userProfile, stats, foodLog);
      if (result && result.area) {
        setRecommendation(result);

        // Persist to Firestore so it stays fixed for today across all visits
        if (auth.currentUser) {
          const userDocRef = doc(db, 'users', auth.currentUser.uid);
          await setDoc(userDocRef, {
            preloadedFocusAreaRecommendation: {
              area: result.area,
              reason: result.reason,
              timestamp: new Date().toISOString()
            }
          }, { merge: true });
        }
      }
    } catch (error) {
      console.error("Failed to get focus area recommendation", error);
    } finally {
      setIsRecommending(false);
    }
  };

  // Helper to switch environment and persist
  const handleSwitchEnvironment = async (newEnv: WorkoutEnvironment) => {
    if (newEnv === environment) return;
    setEnvironment(newEnv);
    onUpdateProfile?.({ workoutEnvironment: newEnv });

    if (auth.currentUser) {
      try {
        const userDocRef = doc(db, 'users', auth.currentUser.uid);
        await setDoc(userDocRef, { workoutEnvironment: newEnv }, { merge: true });
      } catch (err) {
        console.error("Failed to update workout environment in Firestore", err);
      }
    }
  };

  // Helper to retrieve fixed workout for a specific area and environment if already generated today
  const getAreaWorkout = useCallback((area: string, env: WorkoutEnvironment = environment): string | null => {
    const envKey = `${area}_${env}`;
    // 1. Check environment-specific key in local cache
    if (cachedWorkouts[envKey]) {
      return cachedWorkouts[envKey];
    }
    
    // 2. Check environment-specific key in profile
    if (userProfile?.preloadedWorkouts?.[envKey] && isToday(userProfile.lastWorkoutPreloadTimestamp)) {
      return userProfile.preloadedWorkouts[envKey];
    }

    // 3. Fallback to raw area if it was stored without env suffix and matches current environment
    if (cachedWorkouts[area] && (userProfile?.workoutEnvironment === env || !userProfile?.workoutEnvironment)) {
      return cachedWorkouts[area];
    }

    // 4. Check legacy preloadedWorkout for Full Body
    if (area === 'Full Body') {
      if (userProfile?.preloadedWorkout && 
          (userProfile.workoutEnvironment === env || !userProfile.workoutEnvironment) &&
          (isToday(userProfile.lastMealPreloadTimestamp) || isToday(userProfile.lastWorkoutPreloadTimestamp))) {
        return userProfile.preloadedWorkout;
      }
      if (userProfile?.preloadedWorkouts?.['Full Body'] && 
          (userProfile.workoutEnvironment === env || !userProfile.workoutEnvironment) &&
          isToday(userProfile.lastWorkoutPreloadTimestamp)) {
        return userProfile.preloadedWorkouts['Full Body'];
      }
    }

    return null;
  }, [cachedWorkouts, userProfile, environment]);

  // Main interaction handler: opens existing fixed recommendation instantly or generates once
  const handleSelectArea = async (area: string, forceRegenerate = false, explicitEnv?: WorkoutEnvironment) => {
    const targetEnv = explicitEnv || environment;
    if (explicitEnv && explicitEnv !== environment) {
      handleSwitchEnvironment(explicitEnv);
    }
    const existing = getAreaWorkout(area, targetEnv);
    const envLabel = targetEnv === 'gym' ? 'Gym' : 'Home';

    // FIXED RECOMMENDATION: Opens immediately without loading if already generated today!
    if (existing && !forceRegenerate) {
      onShowResult(`${area} (${envLabel}) Workout`, existing);
      return;
    }

    // Generate for the first time today (or on explicit refresh)
    setIsGenerating(true);
    setSelectedArea(`${area}_${targetEnv}`);
    try {
      const remainingMinutes = Math.max(stats.exerciseGoal - stats.exercise, 15);
      const workout = await suggestWorkout(remainingMinutes, userProfile, area, targetEnv);
      
      if (workout) {
        const envKey = `${area}_${targetEnv}`;
        const updated = { 
          ...cachedWorkouts, 
          [envKey]: workout,
          ...(area === 'Full Body' && targetEnv === (userProfile?.workoutEnvironment || 'home') ? { 'Full Body': workout } : {})
        };
        setCachedWorkouts(updated);

        // Cache in localStorage for 0ms retrieval
        try {
          localStorage.setItem(storageKey, JSON.stringify(updated));
        } catch {
          // ignore
        }

        // Persist to Firestore
        if (auth.currentUser) {
          const userDocRef = doc(db, 'users', auth.currentUser.uid);
          const payload: any = {
            preloadedWorkouts: {
              ...(userProfile?.preloadedWorkouts || {}),
              [envKey]: workout
            },
            workoutEnvironment: targetEnv,
            lastWorkoutPreloadTimestamp: new Date().toISOString()
          };
          if (area === 'Full Body' && targetEnv === (userProfile?.workoutEnvironment || 'home')) {
            payload.preloadedWorkout = workout;
          }
          await setDoc(userDocRef, payload, { merge: true });
        }

        // Open result
        onShowResult(`${area} (${envLabel}) Workout`, workout);
      }
    } catch (error) {
      console.error("Failed to generate workout", error);
    } finally {
      setIsGenerating(false);
      setSelectedArea(null);
    }
  };

  const isRecommendedAreaReady = recommendation ? Boolean(getAreaWorkout(recommendation.area, environment)) : false;

  // Formatted goal display string based on user info
  const goalLabel = useMemo(() => {
    if (!userProfile?.goal) return 'Active Fitness';
    switch (userProfile.goal) {
      case 'lose_weight': return 'Weight Loss';
      case 'gain_muscle': return 'Muscle Hypertrophy';
      case 'maintain': return 'Maintenance & Tone';
      default: return String(userProfile.goal).replace('_', ' ');
    }
  }, [userProfile?.goal]);

  return (
    <div className="space-y-6">
      {/* Header & Section Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Dumbbell className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Workout Recommendations
          </h2>
          <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mt-0.5">
            Personalized to your {goalLabel.toLowerCase()} goal and tailored for today.
          </p>
        </div>

        {/* Quick Location Switcher Pills in Header */}
        <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => handleSwitchEnvironment('home')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
              environment === 'home'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Home className="w-3.5 h-3.5" />
            Home
          </button>
          <button
            type="button"
            onClick={() => handleSwitchEnvironment('gym')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
              environment === 'gym'
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Dumbbell className="w-3.5 h-3.5" />
            Gym
          </button>
        </div>
      </div>

      {/* AI Recommendation Card (Daily Focus) */}
      <div 
        className={`bg-indigo-50 dark:bg-indigo-950/20 rounded-[32px] p-6 border border-indigo-100 dark:border-indigo-900/30 relative overflow-hidden transition-all ${isRecommending ? 'animate-pulse' : ''}`}
      >
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Sparkles className="w-24 h-24 text-indigo-600" />
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="bg-indigo-600 text-[10px] font-black text-white uppercase tracking-tighter px-2 py-0.5 rounded-lg">
                Daily AI Focus
              </div>
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-white/70 dark:bg-slate-800/60 px-2 py-0.5 rounded-md">
                {environment === 'gym' ? '🏋️ Gym' : '🏠 Home'}
              </span>
              {isRecommendedAreaReady && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100/70 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md">
                  <CalendarCheck className="w-3 h-3" />
                  Fixed for Today
                </span>
              )}
            </div>
            
            <button 
              type="button"
              onClick={() => handleGetRecommendation(true)}
              disabled={isRecommending}
              title="Refresh today's AI recommendation"
              className="text-indigo-400 hover:text-indigo-600 transition-colors disabled:opacity-50 p-1 rounded-lg hover:bg-indigo-100/50 dark:hover:bg-indigo-900/30"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRecommending ? 'animate-spin' : ''}`} />
            </button>
          </div>
          
          {recommendation ? (
            <div className="animate-in slide-in-from-bottom-2 duration-500">
              <h3 className="text-2xl font-black text-indigo-900 dark:text-indigo-100 mb-2">
                Focus on your <span className="text-indigo-600 dark:text-indigo-400 uppercase">{recommendation.area}</span> today.
              </h3>
              <p className="text-indigo-700/70 dark:text-indigo-300 text-sm font-medium leading-relaxed italic mb-4">
                "{recommendation.reason}"
              </p>
              
              <div className="flex items-center gap-3">
                <button 
                  type="button"
                  onClick={() => handleSelectArea(recommendation.area)}
                  disabled={isGenerating}
                  className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black text-sm shadow-lg shadow-indigo-200 dark:shadow-indigo-900/40 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 hover:bg-indigo-700"
                >
                  {isGenerating && selectedArea === `${recommendation.area}_${environment}` ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : isRecommendedAreaReady ? (
                    <Eye className="w-4 h-4" />
                  ) : (
                    <Zap className="w-4 h-4" />
                  )}
                  {isRecommendedAreaReady ? `View ${recommendation.area} (${environment === 'gym' ? 'Gym' : 'Home'}) Workout` : `Generate ${recommendation.area} (${environment === 'gym' ? 'Gym' : 'Home'}) Workout`}
                </button>

                {isRecommendedAreaReady && (
                  <button
                    type="button"
                    onClick={() => handleSelectArea(recommendation.area, true)}
                    disabled={isGenerating}
                    title="Generate a new variation for today"
                    className="p-3 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100/60 dark:hover:bg-indigo-900/40 rounded-2xl transition-all active:scale-95 disabled:opacity-50 border border-indigo-200/50 dark:border-indigo-800/40"
                  >
                    <RefreshCw className={`w-4 h-4 ${isGenerating && selectedArea === `${recommendation.area}_${environment}` ? 'animate-spin' : ''}`} />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="py-4 space-y-2">
              <div className="h-4 bg-indigo-200 dark:bg-indigo-900 rounded w-3/4 animate-pulse"></div>
              <div className="h-4 bg-indigo-200 dark:bg-indigo-900 rounded w-1/2 animate-pulse"></div>
            </div>
          )}
        </div>
      </div>

      {/* Manual Area Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between ml-1">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-slate-400" />
            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Target Muscle Focus ({environment === 'gym' ? 'Gym' : 'Home'})
            </p>
          </div>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
            Tap to open today's {environment} routine
          </span>
        </div>
        
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
          {AREAS.map((area) => {
            const isReady = Boolean(getAreaWorkout(area.id, environment));
            const isCurrentGenerating = isGenerating && selectedArea === `${area.id}_${environment}`;

            return (
              <button
                key={area.id}
                type="button"
                onClick={() => handleSelectArea(area.id)}
                disabled={isGenerating}
                className={`p-3.5 bg-white dark:bg-slate-900 border rounded-2xl flex flex-col items-center gap-2 transition-all active:scale-90 relative group ${
                  isReady 
                    ? 'border-indigo-200 dark:border-indigo-800/70 shadow-sm bg-indigo-50/20 dark:bg-indigo-950/10' 
                    : 'border-slate-100 dark:border-slate-800'
                } ${COLOR_MAP[area.color].border} ${isGenerating && !isCurrentGenerating ? 'opacity-60' : ''}`}
              >
                {/* Fixed Ready Indicator Dot */}
                {isReady && (
                  <span 
                    title={`Fixed ${environment} workout ready for today`} 
                    className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900"
                  />
                )}

                <div className={`w-11 h-11 rounded-xl ${COLOR_MAP[area.color].bg} flex items-center justify-center transition-transform group-hover:scale-110 relative`}>
                  {isCurrentGenerating ? (
                    <RefreshCw className="w-5 h-5 text-indigo-500 animate-spin" />
                  ) : (
                    area.icon
                  )}
                </div>

                <div className="flex flex-col items-center">
                  <span className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-tight text-center">
                    {area.label}
                  </span>
                  {isReady && (
                    <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                      Ready
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default WorkoutFocus;
