
import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  X, 
  Save, 
  MapPin, 
  Scale, 
  Ruler, 
  Activity, 
  Target, 
  Utensils, 
  Apple, 
  Wallet,
  Sparkles,
  RefreshCw,
  Heart,
  AlertCircle
} from 'lucide-react';
import { UserProfile, ActivityLevel, FitnessGoal, Gender, MealPrepStyle, FruitConsumption, DailyStats } from '../types';

interface Props {
  profile: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedProfile: UserProfile, updatedStats: DailyStats) => Promise<void>;
}

const EditProfile: React.FC<Props> = ({ profile, isOpen, onClose, onSave }) => {
  const [editedProfile, setEditedProfile] = useState<UserProfile>({ ...profile });
  const [isSaving, setIsSaving] = useState(false);

  const [bmiError, setBmiError] = useState<string | null>(null);

  if (!isOpen) return null;

  const getBmiRange = () => {
    const heightM = editedProfile.height / 100;
    const minKg = 18.5 * (heightM * heightM);
    const maxKg = 25 * (heightM * heightM);
    
    if (editedProfile.unitSystem === 'imperial') {
      return {
        min: Math.round(minKg / 0.453592),
        max: Math.round(maxKg / 0.453592),
        unit: 'lbs'
      };
    }
    return {
      min: Math.round(minKg),
      max: Math.round(maxKg),
      unit: 'kg'
    };
  };

  const calculateUpdatedStats = (p: UserProfile): DailyStats => {
    // Mifflin-St Jeor Equation
    const weightKg = p.weight * 0.453592;
    const s = p.gender === 'male' ? 5 : p.gender === 'female' ? -161 : -78;
    const bmr = 10 * weightKg + 6.25 * p.height - 5 * p.age + s;

    const activityFactors: Record<ActivityLevel, number> = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      active: 1.725,
      very_active: 1.9
    };

    const tdee = bmr * activityFactors[p.activityLevel];
    let calorieGoal = tdee;

    if (p.goal === 'lose_weight') {
      calorieGoal -= 500;
    } else if (p.goal === 'gain_muscle') {
      calorieGoal += 500;
    }

    return {
      calories: 0,
      caloriesGoal: Math.round(calorieGoal),
      water: 0,
      waterGoal: p.activityLevel === 'active' || p.activityLevel === 'very_active' ? 12 : 8,
      steps: 0,
      stepsGoal: p.activityLevel === 'sedentary' ? 5000 : 10000,
      exercise: 0,
      exerciseGoal: 30,
      weight: p.weight,
      weightGoal: p.targetWeight || p.weight
    };
  };

  const handleSave = async () => {
    if (bmiError) return;

    setIsSaving(true);
    const stats = calculateUpdatedStats(editedProfile);
    await onSave(editedProfile, stats);
    setIsSaving(false);
    onClose();
  };

  const bmiRange = getBmiRange();

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[250] flex flex-col p-6 overflow-y-auto no-scrollbar">
      <div className="max-w-md mx-auto w-full bg-white dark:bg-slate-900 rounded-[40px] shadow-2xl p-8 mb-10 mt-10 relative">
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 bg-slate-50 dark:bg-slate-800 rounded-full text-slate-400 dark:text-slate-500 hover:text-slate-600 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="flex items-center gap-4 mb-10">
          <div className="w-16 h-16 bg-indigo-500 rounded-2xl flex items-center justify-center text-white text-2xl font-black">
            {editedProfile.name.charAt(0)}
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">Edit Profile</h2>
            <p className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest text-[10px]">Update your stats & goals</p>
          </div>
        </div>

        <div className="space-y-8">
          {/* General */}
          <div className="space-y-4">
             <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block ml-1">Basic Info</label>
             <div className="space-y-3">
                <div className="relative">
                   <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                   <input 
                    type="text" 
                    value={editedProfile.name}
                    onChange={(e) => setEditedProfile({...editedProfile, name: e.target.value})}
                    placeholder="Full Name"
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold focus:border-indigo-500 focus:outline-none transition-all"
                   />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <Heart className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-rose-300" />
                    <input 
                      type="number" 
                      value={editedProfile.age}
                      onChange={(e) => setEditedProfile({...editedProfile, age: parseInt(e.target.value)})}
                      placeholder="Age"
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-300" />
                    <select 
                      value={editedProfile.gender}
                      onChange={(e) => setEditedProfile({...editedProfile, gender: e.target.value as Gender})}
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 font-bold text-slate-800 dark:text-white appearance-none focus:outline-none"
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="relative">
                   <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                   <input 
                    type="text" 
                    value={editedProfile.location}
                    onChange={(e) => setEditedProfile({...editedProfile, location: e.target.value})}
                    placeholder="Location"
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold focus:border-indigo-500 focus:outline-none transition-all"
                   />
                </div>
             </div>
          </div>

          {/* Metrics */}
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block ml-1">Current ({editedProfile.unitSystem === 'imperial' ? 'lbs' : 'kg'})</label>
                  <div className="relative">
                    <Scale className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-rose-300" />
                    <input 
                      type="number" 
                      value={editedProfile.unitSystem === 'imperial' ? Math.round(editedProfile.weight) : Math.round(editedProfile.weight * 0.453592)}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        const valLbs = editedProfile.unitSystem === 'imperial' ? val : val / 0.453592;
                        setEditedProfile({...editedProfile, weight: valLbs});
                      }}
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 font-black text-slate-800 dark:text-white"
                    />
                  </div>
              </div>
              <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block ml-1">Height (cm)</label>
                  <div className="relative">
                    <Ruler className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-300" />
                    <input 
                      type="number" 
                      value={editedProfile.height}
                      onChange={(e) => setEditedProfile({...editedProfile, height: parseInt(e.target.value)})}
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 font-black text-slate-800 dark:text-white"
                    />
                  </div>
              </div>
            </div>

            <div className="space-y-2 p-5 bg-rose-50/50 dark:bg-rose-950/20 rounded-[24px] border border-rose-100 dark:border-rose-900/40">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest block ml-1">Goal Weight ({editedProfile.unitSystem === 'imperial' ? 'lbs' : 'kg'})</label>
                <span className="text-[9px] font-bold text-rose-400 dark:text-rose-500 uppercase tracking-widest">
                  Healthy: {bmiRange.min}-{bmiRange.max} {bmiRange.unit}
                </span>
              </div>
              <div className="relative">
                <Target className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-rose-400" />
                <input 
                  type="number" 
                  value={editedProfile.unitSystem === 'imperial' ? Math.round(editedProfile.targetWeight || editedProfile.weight) : Math.round((editedProfile.targetWeight || editedProfile.weight) * 0.453592)}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    const valLbs = editedProfile.unitSystem === 'imperial' ? val : val / 0.453592;
                    
                    // Validate
                    const inCurrentUnit = editedProfile.unitSystem === 'imperial' ? val : val; // wait val is already in current unit
                    const min = bmiRange.min;
                    const max = bmiRange.max;
                    
                    if (val < min || val > max) {
                      setBmiError(`Please set a healthy weight goal between ${min} and ${max} ${bmiRange.unit}.`);
                    } else {
                      setBmiError(null);
                    }
                    
                    setEditedProfile({...editedProfile, targetWeight: valLbs});
                  }}
                  className={`w-full pl-12 pr-4 py-4 bg-white dark:bg-slate-900 rounded-2xl border ${bmiError ? 'border-rose-500' : 'border-rose-200 dark:border-rose-800'} font-black text-slate-800 dark:text-white transition-all`}
                />
              </div>
              {bmiError && (
                <p className="text-[10px] font-bold text-rose-500 mt-2 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {bmiError}
                </p>
              )}
            </div>
          </div>

          {/* Activity & Goal */}
          <div className="space-y-4">
             <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block ml-1">Activity & Goal</label>
             <div className="space-y-3">
                <div className="relative">
                   <Activity className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-300" />
                   <select 
                    value={editedProfile.activityLevel}
                    onChange={(e) => setEditedProfile({...editedProfile, activityLevel: e.target.value as ActivityLevel})}
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 font-bold text-slate-800 dark:text-white appearance-none focus:outline-none"
                   >
                      <option value="sedentary">Sedentary</option>
                      <option value="light">Light Activity</option>
                      <option value="moderate">Moderate Activity</option>
                      <option value="active">Active</option>
                      <option value="very_active">Very Active</option>
                   </select>
                </div>
                <div className="relative">
                   <Target className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-300" />
                   <select 
                    value={editedProfile.goal}
                    onChange={(e) => setEditedProfile({...editedProfile, goal: e.target.value as FitnessGoal})}
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 font-bold text-slate-800 dark:text-white appearance-none focus:outline-none"
                   >
                      <option value="lose_weight">Lose Weight</option>
                      <option value="maintain">Maintain Weight</option>
                      <option value="gain_muscle">Gain Muscle</option>
                   </select>
                </div>
             </div>
          </div>

          {/* Budget & Prep */}
          <div className="space-y-4">
             <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block ml-1">Life Style</label>
             <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                   <Wallet className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-amber-300" />
                   <input 
                    type="number" 
                    value={editedProfile.dailyBudget}
                    onChange={(e) => setEditedProfile({...editedProfile, dailyBudget: parseInt(e.target.value)})}
                    placeholder="Budget"
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 font-bold text-slate-800 dark:text-white"
                   />
                </div>
                <div className="relative">
                   <Utensils className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                   <select 
                    value={editedProfile.mealPrepStyle}
                    onChange={(e) => setEditedProfile({...editedProfile, mealPrepStyle: e.target.value as MealPrepStyle})}
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 font-bold text-slate-800 dark:text-white appearance-none focus:outline-none"
                   >
                      <option value="self">I Cook</option>
                      <option value="others">Family/Cook</option>
                      <option value="eat_out">Eat Out</option>
                   </select>
                </div>
             </div>
          </div>

          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="w-full py-5 bg-indigo-600 text-white rounded-3xl font-black text-lg shadow-xl shadow-indigo-100 dark:shadow-indigo-900/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSaving ? <RefreshCw className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" /> Save Changes</>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditProfile;

const User = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
);
