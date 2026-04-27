import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronRight, 
  ChevronLeft, 
  User, 
  Scale, 
  Ruler, 
  Activity, 
  Target,
  CheckCircle2,
  ArrowRight,
  Heart,
  Utensils,
  Apple,
  Wallet,
  X,
  ShieldCheck,
  Plus,
  Minus,
  RefreshCw
} from 'lucide-react';
import { UserProfile, DailyStats, ActivityLevel, FitnessGoal, Gender, MealPrepStyle, FruitConsumption } from '../types';

interface OnboardingProps {
  onComplete: (profile: UserProfile, stats: DailyStats) => void;
  initialProfile?: UserProfile | null;
}

const Onboarding: React.FC<OnboardingProps> = ({ onComplete, initialProfile }) => {
  const [step, setStep] = useState(1);
  const [isFinishing, setIsFinishing] = useState(false);
  const [profile, setProfile] = useState<UserProfile>(initialProfile ? {
    ...initialProfile,
    onboarded: false // Force onboarded false so we stay in onboarding
  } : {
    name: '',
    age: 25,
    ageRange: '21-30',
    gender: 'male',
    weight: 165,
    height: 175,
    activityLevel: 'moderate',
    goal: 'maintain',
    location: '',
    workoutEnvironment: 'home',
    mealPrepStyle: 'self',
    fruitConsumption: 'sometimes',
    dailyBudget: 50,
    targetWeight: 165,
    streak: 0,
    unitSystem: 'imperial',
    lastStatsResetDate: new Date().toISOString().split('T')[0],
    onboarded: false,
    hasAcceptedTerms: false
  });

  const totalSteps = 12;

  const nextStep = () => setStep(prev => Math.min(prev + 1, totalSteps));
  const prevStep = () => setStep(prev => Math.max(prev - 1, 1));

  const calculateStats = (): DailyStats => {
    // Mifflin-St Jeor Equation
    // Weight in lbs to kg: lbs * 0.453592
    // Height in cm
    const weightKg = profile.weight * 0.453592;
    const s = profile.gender === 'male' ? 5 : profile.gender === 'female' ? -161 : -78;
    const bmr = 10 * weightKg + 6.25 * profile.height - 5 * profile.age + s;

    const activityFactors: Record<ActivityLevel, number> = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      active: 1.725,
      very_active: 1.9
    };

    const tdee = bmr * activityFactors[profile.activityLevel];

    let calorieGoal = tdee;
    let weightGoal = profile.targetWeight || profile.weight;

    if (profile.goal === 'lose_weight') {
      calorieGoal -= 500;
    } else if (profile.goal === 'gain_muscle') {
      calorieGoal += 500;
    }

    return {
      calories: 0,
      caloriesGoal: Math.round(calorieGoal),
      water: 0,
      waterGoal: profile.activityLevel === 'active' || profile.activityLevel === 'very_active' ? 12 : 8,
      steps: 0,
      stepsGoal: profile.activityLevel === 'sedentary' ? 5000 : 10000,
      exercise: 0,
      exerciseGoal: 30,
      weight: profile.weight,
      weightGoal: weightGoal
    };
  };

  const handleFinish = () => {
    setIsFinishing(true);
    const stats = calculateStats();
    onComplete({ ...profile, onboarded: true, hasAcceptedTerms: true }, stats);
  };

  const handleSkipAll = () => {
    setIsFinishing(true);
    // Use default values but make sure they are reasonable
    const defaultProfile: UserProfile = {
      ...profile,
      name: profile.name || 'User',
      location: profile.location || 'Global',
      onboarded: true,
      hasAcceptedTerms: true
    };
    
    // Calculate stats with these defaults
    const weightKg = defaultProfile.weight * 0.453592;
    const bmr = 10 * weightKg + 6.25 * defaultProfile.height - 5 * defaultProfile.age + 5;
    const tdee = bmr * 1.55; // moderate

    const defaultStats: DailyStats = {
      calories: 0,
      caloriesGoal: Math.round(tdee),
      water: 0,
      waterGoal: 8,
      steps: 0,
      stepsGoal: 10000,
      exercise: 0,
      exerciseGoal: 30,
      weight: defaultProfile.weight,
      weightGoal: defaultProfile.weight
    };

    onComplete(defaultProfile, defaultStats);
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="text-center space-y-2">
              <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-950/30 rounded-3xl flex items-center justify-center mx-auto mb-4">
                <User className="w-10 h-10 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h2 className="text-3xl font-black text-gray-900 dark:text-white">What's your name?</h2>
              <p className="text-gray-500 dark:text-slate-400">Let's get to know you better.</p>
            </div>
            <input
              type="text"
              placeholder="Your Name"
              className="w-full p-5 bg-white dark:bg-slate-900 border-2 border-gray-100 dark:border-slate-800 rounded-2xl text-xl font-bold text-slate-800 dark:text-white focus:border-indigo-500 focus:outline-none transition-all shadow-sm"
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              autoFocus
            />
          </motion.div>
        );
      case 2:
        return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="text-center space-y-2">
              <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-950/30 rounded-3xl flex items-center justify-center mx-auto mb-4">
                <Activity className="w-10 h-10 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h2 className="text-3xl font-black text-gray-900 dark:text-white">Where are you located?</h2>
              <p className="text-gray-500 dark:text-slate-400">This helps us recommend local foods and activities.</p>
            </div>
            <input
              type="text"
              placeholder="e.g. Lagos, Nigeria"
              className="w-full p-5 bg-white dark:bg-slate-900 border-2 border-gray-100 dark:border-slate-800 rounded-2xl text-xl font-bold text-slate-800 dark:text-white focus:border-indigo-500 focus:outline-none transition-all shadow-sm"
              value={profile.location}
              onChange={(e) => setProfile({ ...profile, location: e.target.value })}
              autoFocus
            />
          </motion.div>
        );
      case 3:
        return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-black text-gray-900 dark:text-white">Tell us about yourself</h2>
              <p className="text-gray-500 dark:text-slate-400">This helps us calculate your base metabolism.</p>
            </div>
            
            <div className="space-y-4">
              <label className="block text-sm font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Gender</label>
              <div className="grid grid-cols-3 gap-3">
                {(['male', 'female', 'other'] as Gender[]).map((g) => (
                  <button
                    key={g}
                    onClick={() => setProfile({ ...profile, gender: g })}
                    className={`p-4 rounded-2xl font-bold capitalize transition-all ${
                      profile.gender === g 
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 dark:shadow-indigo-900/20' 
                      : 'bg-white dark:bg-slate-900 border-2 border-gray-50 dark:border-slate-800 text-gray-500 dark:text-slate-400'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <label className="block text-sm font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Age Range</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { range: '10-15', age: 13 },
                  { range: '16-20', age: 18 },
                  { range: '21-30', age: 25 },
                  { range: '31-40', age: 35 },
                  { range: '41-50', age: 45 },
                  { range: '51-60', age: 55 },
                  { range: '60+', age: 65 }
                ].map((item) => (
                  <button
                    key={item.range}
                    onClick={() => setProfile({ ...profile, ageRange: item.range, age: item.age })}
                    className={`p-4 rounded-2xl font-bold transition-all ${
                      profile.ageRange === item.range 
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 dark:shadow-indigo-900/20' 
                      : 'bg-white dark:bg-slate-900 border-2 border-gray-50 dark:border-slate-800 text-gray-500 dark:text-slate-400 hover:border-indigo-100'
                    }`}
                  >
                    {item.range}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        );
      case 4:
        return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-black text-gray-900 dark:text-white">Body Metrics</h2>
              <p className="text-gray-500 dark:text-slate-400">Your current weight and height.</p>
            </div>

            <div className="flex bg-gray-100 dark:bg-slate-900 p-1 rounded-2xl">
              {(['imperial', 'metric'] as const).map((sys) => (
                <button
                  key={sys}
                  onClick={() => setProfile({ ...profile, unitSystem: sys })}
                  className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                    profile.unitSystem === sys 
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                    : 'text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300'
                  }`}
                >
                  {sys}
                </button>
              ))}
            </div>

            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border-2 border-gray-50 dark:border-slate-800 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Scale className="w-5 h-5 text-rose-500" />
                    <span className="font-black text-gray-900 dark:text-white">Weight</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => {
                        const amount = profile.unitSystem === 'imperial' ? 1 : Math.round(1 / 0.453592);
                        setProfile({ ...profile, weight: Math.max(80, profile.weight - amount) });
                      }}
                      className="p-1 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-500 hover:bg-rose-100 transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="text-xl font-black text-rose-500 min-w-[80px] text-center">
                      {profile.unitSystem === 'imperial' 
                        ? `${profile.weight} lbs` 
                        : `${Math.round(profile.weight * 0.453592)} kg`}
                    </span>
                    <button 
                      onClick={() => {
                        const amount = profile.unitSystem === 'imperial' ? 1 : Math.round(1 / 0.453592);
                        setProfile({ ...profile, weight: Math.min(450, profile.weight + amount) });
                      }}
                      className="p-1 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-500 hover:bg-rose-100 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <input
                  type="range"
                  min={profile.unitSystem === 'imperial' ? "80" : "36"}
                  max={profile.unitSystem === 'imperial' ? "400" : "181"}
                  className="w-full h-2 bg-gray-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-500"
                  value={profile.unitSystem === 'imperial' ? profile.weight : Math.round(profile.weight * 0.453592)}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    const weightLbs = profile.unitSystem === 'imperial' ? val : Math.round(val / 0.453592);
                    setProfile({ ...profile, weight: weightLbs });
                  }}
                />
              </div>

              <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border-2 border-gray-50 dark:border-slate-800 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Ruler className="w-5 h-5 text-blue-500" />
                    <span className="font-black text-gray-900 dark:text-white">Height</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setProfile({ ...profile, height: Math.max(120, profile.height - 1) })}
                      className="p-1 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-500 hover:bg-blue-100 transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="text-xl font-black text-blue-500 min-w-[80px] text-center">
                      {profile.unitSystem === 'imperial' 
                        ? `${Math.floor(profile.height / 30.48)}'${Math.round((profile.height % 30.48) / 2.54)}"` 
                        : `${profile.height} cm`}
                    </span>
                    <button 
                      onClick={() => setProfile({ ...profile, height: Math.min(230, profile.height + 1) })}
                      className="p-1 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-500 hover:bg-blue-100 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <input
                  type="range"
                  min="120"
                  max="230"
                  className="w-full h-2 bg-gray-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  value={profile.height}
                  onChange={(e) => setProfile({ ...profile, height: parseInt(e.target.value) })}
                />
              </div>
            </div>
          </motion.div>
        );
      case 5:
        return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-black text-gray-900 dark:text-white">Activity Level</h2>
              <p className="text-gray-500 dark:text-slate-400">How active are you on a daily basis?</p>
            </div>

            <div className="space-y-3">
              {(['sedentary', 'light', 'moderate', 'active', 'very_active'] as ActivityLevel[]).map((level) => (
                <button
                  key={level}
                  onClick={() => setProfile({ ...profile, activityLevel: level })}
                  className={`w-full p-5 rounded-2xl text-left flex items-center justify-between transition-all ${
                    profile.activityLevel === level 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 dark:shadow-indigo-900/20 scale-[1.02]' 
                    : 'bg-white dark:bg-slate-900 border-2 border-gray-50 dark:border-slate-800 text-gray-700 dark:text-slate-300 hover:border-indigo-100 dark:hover:border-indigo-900'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-xl ${profile.activityLevel === level ? 'bg-white/20' : 'bg-indigo-50 dark:bg-indigo-950/30'}`}>
                      <Activity className={`w-5 h-5 ${profile.activityLevel === level ? 'text-white' : 'text-indigo-600 dark:text-indigo-400'}`} />
                    </div>
                    <span className="font-bold capitalize">{level.replace('_', ' ')}</span>
                  </div>
                  {profile.activityLevel === level && <CheckCircle2 className="w-5 h-5" />}
                </button>
              ))}
            </div>
          </motion.div>
        );
      case 6:
        return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-black text-gray-900 dark:text-white">Workout Setting</h2>
              <p className="text-gray-500 dark:text-slate-400">Where do you usually exercise?</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setProfile({ ...profile, workoutEnvironment: 'home' })}
                className={`p-8 rounded-[32px] flex flex-col items-center gap-4 transition-all ${
                  profile.workoutEnvironment === 'home' 
                  ? 'bg-indigo-600 text-white shadow-xl scale-[1.02]' 
                  : 'bg-white dark:bg-slate-900 border-2 border-gray-50 dark:border-slate-800 text-gray-700 dark:text-slate-300 hover:border-indigo-100 dark:hover:border-indigo-900'
                }`}
              >
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${profile.workoutEnvironment === 'home' ? 'bg-white/10' : 'bg-indigo-50 dark:bg-indigo-950/30'}`}>
                  <Activity className={`w-8 h-8 ${profile.workoutEnvironment === 'home' ? 'text-white' : 'text-indigo-600 dark:text-indigo-400'}`} />
                </div>
                <span className="font-black text-lg">Home</span>
              </button>

              <button
                onClick={() => setProfile({ ...profile, workoutEnvironment: 'gym' })}
                className={`p-8 rounded-[32px] flex flex-col items-center gap-4 transition-all ${
                  profile.workoutEnvironment === 'gym' 
                  ? 'bg-indigo-600 text-white shadow-xl scale-[1.02]' 
                  : 'bg-white dark:bg-slate-900 border-2 border-gray-50 dark:border-slate-800 text-gray-700 dark:text-slate-300 hover:border-indigo-100 dark:hover:border-indigo-900'
                }`}
              >
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${profile.workoutEnvironment === 'gym' ? 'bg-white/10' : 'bg-indigo-50 dark:bg-indigo-950/30'}`}>
                  <Activity className={`w-8 h-8 ${profile.workoutEnvironment === 'gym' ? 'text-white' : 'text-indigo-600 dark:text-indigo-400'}`} />
                </div>
                <span className="font-black text-lg">Gym</span>
              </button>
            </div>
          </motion.div>
        );
      case 7:
        return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-black text-gray-900 dark:text-white">Meal Preparation</h2>
              <p className="text-gray-500 dark:text-slate-400">How do you usually get your meals?</p>
            </div>

            <div className="space-y-3">
              {[
                { id: 'self', label: 'I make them myself', icon: <Utensils /> },
                { id: 'others', label: 'Someone makes them for me', icon: <User /> },
                { id: 'eat_out', label: 'I eat out most of the time', icon: <ArrowRight /> }
              ].map((style) => (
                <button
                  key={style.id}
                  onClick={() => setProfile({ ...profile, mealPrepStyle: style.id as MealPrepStyle })}
                  className={`w-full p-5 rounded-2xl text-left flex items-center justify-between transition-all ${
                    profile.mealPrepStyle === style.id 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 dark:shadow-indigo-900/20 scale-[1.02]' 
                    : 'bg-white dark:bg-slate-900 border-2 border-gray-50 dark:border-slate-800 text-gray-700 dark:text-slate-300 hover:border-indigo-100 dark:hover:border-indigo-900'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-xl ${profile.mealPrepStyle === style.id ? 'bg-white/20' : 'bg-indigo-50 dark:bg-indigo-950/30'}`}>
                      {React.isValidElement(style.icon) ? React.cloneElement(style.icon as React.ReactElement<any>, { className: `w-5 h-5 ${profile.mealPrepStyle === style.id ? 'text-white' : 'text-indigo-600 dark:text-indigo-400'}` }) : style.icon}
                    </div>
                    <span className="font-bold">{style.label}</span>
                  </div>
                  {profile.mealPrepStyle === style.id && <CheckCircle2 className="w-5 h-5" />}
                </button>
              ))}
            </div>
          </motion.div>
        );
      case 8:
        return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-black text-gray-900 dark:text-white">Fruit Consumption</h2>
              <p className="text-gray-500 dark:text-slate-400">How often do you include fruits in your diet?</p>
            </div>

            <div className="space-y-3">
              {[
                { id: 'rarely', label: 'Rarely / Never', icon: <X /> },
                { id: 'sometimes', label: 'Sometimes (2-3 times a week)', icon: <Apple /> },
                { id: 'daily', label: 'Daily', icon: <Apple /> }
              ].map((freq) => (
                <button
                  key={freq.id}
                  onClick={() => setProfile({ ...profile, fruitConsumption: freq.id as FruitConsumption })}
                  className={`w-full p-5 rounded-2xl text-left flex items-center justify-between transition-all ${
                    profile.fruitConsumption === freq.id 
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100 dark:shadow-emerald-900/20 scale-[1.02]' 
                    : 'bg-white dark:bg-slate-900 border-2 border-gray-50 dark:border-slate-800 text-gray-700 dark:text-slate-300 hover:border-emerald-100 dark:hover:border-emerald-900'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-xl ${profile.fruitConsumption === freq.id ? 'bg-white/20' : 'bg-emerald-50 dark:bg-emerald-950/30'}`}>
                      {React.isValidElement(freq.icon) ? React.cloneElement(freq.icon as React.ReactElement<any>, { className: `w-5 h-5 ${profile.fruitConsumption === freq.id ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'}` }) : freq.icon}
                    </div>
                    <span className="font-bold">{freq.label}</span>
                  </div>
                  {profile.fruitConsumption === freq.id && <CheckCircle2 className="w-5 h-5" />}
                </button>
              ))}
            </div>
          </motion.div>
        );
      case 9:
        return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <div className="text-center space-y-2">
              <div className="w-20 h-20 bg-amber-50 dark:bg-amber-950/30 rounded-3xl flex items-center justify-center mx-auto mb-4">
                <Wallet className="w-10 h-10 text-amber-600 dark:text-amber-400" />
              </div>
              <h2 className="text-3xl font-black text-gray-900 dark:text-white">Daily Meal Budget</h2>
              <p className="text-gray-500 dark:text-slate-400">How much do you typically spend on meals per day?</p>
            </div>
            
            <div className="space-y-6">
              <div className="text-center">
                <span className="text-5xl font-black text-amber-600 dark:text-amber-400">${profile.dailyBudget}</span>
                <p className="text-gray-400 dark:text-slate-500 font-bold uppercase tracking-widest text-xs mt-2">Estimated daily spend</p>
              </div>
              <input
                type="range"
                min="5"
                max="200"
                step="5"
                className="w-full h-2 bg-gray-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-600"
                value={profile.dailyBudget}
                onChange={(e) => setProfile({ ...profile, dailyBudget: parseInt(e.target.value) })}
              />
              <div className="flex justify-between text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">
                <span>$5</span>
                <span>$100</span>
                <span>$200+</span>
              </div>
            </div>
          </motion.div>
        );
      case 10:
        return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-black text-gray-900 dark:text-white">Your Goal</h2>
              <p className="text-gray-500 dark:text-slate-400">What do you want to achieve?</p>
            </div>

            <div className="space-y-4">
              {(['lose_weight', 'maintain', 'gain_muscle'] as FitnessGoal[]).map((goal) => (
                <button
                  key={goal}
                  onClick={() => {
                    const newTarget = goal === 'maintain' ? profile.weight : profile.targetWeight || profile.weight;
                    setProfile({ ...profile, goal: goal, targetWeight: newTarget });
                  }}
                  className={`w-full p-6 rounded-[32px] text-left flex items-center gap-6 transition-all ${
                    profile.goal === goal 
                    ? 'bg-slate-900 dark:bg-indigo-600 text-white shadow-xl scale-[1.02]' 
                    : 'bg-white dark:bg-slate-900 border-2 border-gray-50 dark:border-slate-800 text-gray-700 dark:text-slate-300 hover:border-slate-200 dark:hover:border-indigo-900'
                  }`}
                >
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${profile.goal === goal ? 'bg-white/10' : 'bg-slate-50 dark:bg-slate-800'}`}>
                    <Target className={`w-8 h-8 ${profile.goal === goal ? 'text-white' : 'text-slate-400 dark:text-slate-500'}`} />
                  </div>
                  <div>
                    <h4 className="font-black text-lg capitalize">{goal.replace('_', ' ')}</h4>
                    <p className={`text-sm ${profile.goal === goal ? 'text-white/60' : 'text-gray-400 dark:text-slate-500'}`}>
                      {goal === 'lose_weight' ? 'Burn fat and get leaner' : goal === 'maintain' ? 'Keep your current physique' : 'Build strength and mass'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        );
      case 11:
        const heightM = profile.height / 100;
        const idealKg = 22 * (heightM * heightM);
        const minKg = 18.5 * (heightM * heightM);
        const maxKg = 25 * (heightM * heightM);
        
        const displayIdeal = profile.unitSystem === 'imperial' ? Math.round(idealKg / 0.453592) : Math.round(idealKg);
        const displayMin = profile.unitSystem === 'imperial' ? Math.round(minKg / 0.453592) : Math.round(minKg);
        const displayMax = profile.unitSystem === 'imperial' ? Math.round(maxKg / 0.453592) : Math.round(maxKg);
        const unit = profile.unitSystem === 'imperial' ? 'lbs' : 'kg';

        const currentTarget = profile.targetWeight || profile.weight;
        const targetWeightKg = profile.unitSystem === 'imperial' ? currentTarget * 0.453592 : currentTarget;
        const targetBMI = targetWeightKg / (heightM * heightM);
        const isUnhealthy = targetBMI < 18.5 || targetBMI > 30;

        return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <div className="text-center space-y-2">
              <div className="w-20 h-20 bg-rose-50 dark:bg-rose-950/30 rounded-3xl flex items-center justify-center mx-auto mb-4">
                <Scale className="w-10 h-10 text-rose-600 dark:text-rose-400" />
              </div>
              <h2 className="text-3xl font-black text-gray-900 dark:text-white">Target Weight</h2>
              <p className="text-gray-500 dark:text-slate-400">
                {profile.goal === 'maintain' 
                  ? "You're set to maintain your current weight." 
                  : `What is your target weight in ${unit}?`}
              </p>
            </div>

            {profile.goal !== 'maintain' ? (
              <div className="space-y-6">
                <div className="bg-white dark:bg-slate-900 p-8 rounded-[32px] border-2 border-gray-50 dark:border-slate-800 shadow-sm text-center">
                  <div className="text-5xl font-black text-slate-900 dark:text-white mb-2">
                    {currentTarget} <span className="text-xl text-gray-400">{unit}</span>
                  </div>
                  <div className={`text-sm font-bold ${isUnhealthy ? 'text-rose-500' : 'text-emerald-500'}`}>
                    Target BMI: {targetBMI.toFixed(1)} ({isUnhealthy ? 'Unhealthy' : 'Healthy Range'})
                  </div>
                  
                  <input
                    type="range"
                    min={displayMin - 20}
                    max={displayMax + 40}
                    className="w-full h-2 bg-gray-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-500 mt-8"
                    value={currentTarget}
                    onChange={(e) => setProfile({ ...profile, targetWeight: parseInt(e.target.value) })}
                  />
                </div>

                <div className="bg-indigo-50 dark:bg-indigo-950/30 p-6 rounded-3xl border border-indigo-100 dark:border-indigo-900/30">
                  <div className="flex items-center gap-3 mb-2">
                    <Heart className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    <span className="font-black text-indigo-900 dark:text-indigo-200">Medical Recommendation</span>
                  </div>
                  <p className="text-sm text-indigo-700 dark:text-indigo-300 leading-relaxed">
                    Based on your height, an ideal healthy weight for you is approximately <strong className="text-indigo-900 dark:text-white">{displayIdeal} {unit}</strong> (BMI 22). 
                    A healthy range is between {displayMin} and {displayMax} {unit}.
                  </p>
                  <button 
                    onClick={() => setProfile({ ...profile, targetWeight: displayIdeal })}
                    className="mt-4 w-full py-3 bg-white dark:bg-slate-800 rounded-xl text-indigo-600 dark:text-indigo-400 text-xs font-black uppercase tracking-widest shadow-sm hover:shadow-md transition-all"
                  >
                    Set to Ideal Weight
                  </button>
                </div>
                
                {isUnhealthy && (
                  <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/30 rounded-2xl flex items-start gap-3">
                    <X className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-rose-700 dark:text-rose-300 font-medium">
                      This target weight is outside the recommended healthy BMI range (18.5 - 25.0). Please consult a professional before pursuing extreme weight goals.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-emerald-50 dark:bg-emerald-950/30 p-8 rounded-[32px] border border-emerald-100 dark:border-emerald-900/30 text-center space-y-4">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                <p className="text-emerald-800 dark:text-emerald-300 font-bold">
                  You've chosen to maintain your current weight of {profile.weight} {unit}.
                </p>
                <button 
                  onClick={() => setStep(10)}
                  className="text-emerald-600 dark:text-emerald-400 text-xs font-black uppercase tracking-widest"
                >
                  Change Goal
                </button>
              </div>
            )}
          </motion.div>
        );
      case 12:
        return (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <div className="text-center space-y-2">
              <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-950/30 rounded-3xl flex items-center justify-center mx-auto mb-4">
                <ShieldCheck className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h2 className="text-3xl font-black text-gray-900 dark:text-white">Privacy & Tracking</h2>
              <p className="text-gray-500 dark:text-slate-400">Your health data is private.</p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-8 rounded-[32px] border-2 border-emerald-50 dark:border-slate-800 shadow-sm space-y-6">
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                To automatically count your steps, FitAI needs your permission to access your phone's motion sensors. 
                Running locally, we sync your progress only to your private profile.
              </p>
              
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
                <p className="text-[11px] text-emerald-800 dark:text-emerald-300 font-bold leading-tight">
                  By continuing, you agree to our Terms of Use and enable automatic background step tracking.
                </p>
              </div>
            </div>
          </motion.div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-50 dark:bg-slate-950 z-[200] flex flex-col p-6 overflow-y-auto no-scrollbar">
      {/* Progress Bar */}
      <div className="w-full h-2 bg-gray-100 dark:bg-slate-800 rounded-full mb-12 overflow-hidden">
        <motion.div 
          className="h-full gradient-bg"
          initial={{ width: 0 }}
          animate={{ width: `${(step / totalSteps) * 100}%` }}
        />
      </div>

      <div className="flex-1 max-w-sm mx-auto w-full flex flex-col">
        <AnimatePresence mode="wait">
          {renderStep()}
        </AnimatePresence>

        <div className="mt-auto pt-12 flex gap-4">
          {step > 1 && (
            <button 
              onClick={prevStep}
              className="p-5 bg-white dark:bg-slate-900 border-2 border-gray-100 dark:border-slate-800 rounded-2xl text-gray-400 dark:text-slate-500 hover:bg-gray-50 dark:hover:bg-slate-800 transition-all"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          
          {step < totalSteps ? (
            <div className="flex-1 flex flex-col gap-3">
              <button 
                onClick={nextStep}
                disabled={
                  isFinishing ||
                  (step === 1 && !profile.name) || 
                  (step === 2 && !profile.location) ||
                  (step === 11 && profile.goal !== 'maintain' && (
                    (profile.unitSystem === 'imperial' ? (profile.targetWeight || profile.weight) * 0.453592 : (profile.targetWeight || profile.weight)) / ((profile.height / 100) * (profile.height / 100)) < 18.5 ||
                    (profile.unitSystem === 'imperial' ? (profile.targetWeight || profile.weight) * 0.453592 : (profile.targetWeight || profile.weight)) / ((profile.height / 100) * (profile.height / 100)) > 30.0
                  ))
                }
                className="w-full p-5 gradient-bg rounded-2xl text-white font-black text-lg flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 dark:shadow-indigo-900/20 disabled:opacity-50"
              >
                {isFinishing ? <RefreshCw className="w-6 h-6 animate-spin" /> : <>Next <ChevronRight className="w-6 h-6" /></>}
              </button>
              
              <button 
                onClick={handleSkipAll}
                className="w-full py-2 text-indigo-600 dark:text-indigo-400 text-xs font-black uppercase tracking-widest hover:opacity-70 transition-all flex items-center justify-center gap-2"
              >
                Skip everything & use defaults
              </button>
              <p className="text-[10px] text-center text-slate-400 font-bold uppercase tracking-tight">You can edit these details anytime in your profile</p>
            </div>
          ) : (
            <button 
              onClick={handleFinish}
              disabled={isFinishing}
              className="flex-1 p-5 bg-slate-900 dark:bg-indigo-600 rounded-2xl text-white font-black text-lg flex items-center justify-center gap-2 shadow-xl hover:bg-slate-800 dark:hover:bg-indigo-700 transition-all disabled:opacity-50"
            >
              {isFinishing ? <RefreshCw className="w-6 h-6 animate-spin" /> : <>Start My Journey <ArrowRight className="w-6 h-6" /></>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
