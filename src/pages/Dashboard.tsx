import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Utensils, 
  Droplets, 
  Footprints, 
  Timer, 
  ChevronRight,
  Zap,
  ChefHat,
  RefreshCw,
  X,
  Edit2,
  Camera,
  Mic,
  Scale,
  Plus,
  Minus,
  Check
} from 'lucide-react';
import { DailyStats, UserProfile, FoodLogEntry } from '../types';
import { suggestWorkout, suggestDailyMeals, suggestMeal, generateGoalSteps } from '../services/geminiService';
import { auth, db, doc, setDoc } from '../firebase';
import CircularProgress from '../components/CircularProgress';
import ReactMarkdown from 'react-markdown';
import FoodAssistant from '../components/FoodAssistant';
import WorkoutFocus from '../components/WorkoutFocus';

interface Props {
  stats: DailyStats;
  userProfile: UserProfile | null;
  foodLog: FoodLogEntry[];
  onUpdateStat: (key: keyof DailyStats, value: number) => void;
  onLogMeal: (name: string, calories: number, analysis?: string) => void;
  onTriggerScan: () => void;
}

const Dashboard: React.FC<Props> = ({ stats, userProfile, foodLog, onUpdateStat, onLogMeal, onTriggerScan }) => {
  const [aiCoachTip, setAiCoachTip] = useState<string>(userProfile?.lastAiTip || "Generating your personalized morning brief...");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPreloading, setIsPreloading] = useState(false);
  const [aiModalContent, setAiModalContent] = useState<{ title: string; content: string; isLoading?: boolean } | null>(null);
  
  // Manual Entry States
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [activeMetricKey, setActiveMetricKey] = useState<keyof DailyStats | null>(null);
  const [manualValue, setManualValue] = useState("");
  const [entryMode, setEntryMode] = useState<'choice' | 'manual'>('choice');
  const [adjustmentType, setAdjustmentType] = useState<'set' | 'add' | 'sub'>('set');
  const [selectedMealType, setSelectedMealType] = useState('breakfast');
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);

  const fetchCoachTip = async () => {
    if (!userProfile) return;
    setIsRefreshing(true);
    try {
      const tip = await generateGoalSteps(userProfile, stats, foodLog);
      const finalTip = tip || "Let's make today your best one yet! Start with some light movement.";
      setAiCoachTip(finalTip);
      
      // Persist to Firestore
      const userDocRef = doc(db, 'users', auth.currentUser!.uid);
      await setDoc(userDocRef, { 
        lastAiTip: finalTip,
        lastAiTipTimestamp: new Date().toISOString()
      }, { merge: true });
      
      // After tip, preload meals if needed
      preloadMeals();
    } catch (error) {
      setAiCoachTip("Ready to hit your goals today? Every step counts toward a better you.");
    } finally {
      setIsRefreshing(false);
    }
  };

  const preloadMeals = async (force = false) => {
    if (!userProfile || !auth.currentUser) return;
    
    const lastPreloadDate = userProfile.lastMealPreloadTimestamp ? new Date(userProfile.lastMealPreloadTimestamp).toDateString() : '';
    const today = new Date().toDateString();
    
    if (!force && userProfile.preloadedMeals && lastPreloadDate === today) return;

    setIsPreloading(true);
    try {
      const remaining = stats.caloriesGoal - stats.calories;
      const calBuffer = remaining > 0 ? remaining : 500;

      // Generate all in parallel for speed (including workout)
      const [mealResults, workoutResult] = await Promise.all([
        suggestDailyMeals(calBuffer, userProfile, stats.caloriesGoal),
        suggestWorkout(15, userProfile)
      ]);
      
      if (!mealResults) throw new Error("Failed to generate meals");

      const userDocRef = doc(db, 'users', auth.currentUser.uid);
      await setDoc(userDocRef, { 
        preloadedMeals: mealResults,
        preloadedWorkout: workoutResult,
        lastMealPreloadTimestamp: new Date().toISOString()
      }, { merge: true });
    } catch (error) {
      console.error("Failed to preload meals", error);
    } finally {
      setIsPreloading(false);
    }
  };

  const handleMetricClick = (key: keyof DailyStats) => {
    setActiveMetricKey(key);
    const isMetric = userProfile?.unitSystem === 'metric';
    let displayValue = stats[key].toString();
    
    if (key === 'weight' && isMetric) {
      displayValue = Math.round(stats.weight * 0.453592).toString();
    }
    
    // Default tracker-style metrics to "add" mode, others (weight) to "set"
    if (['calories', 'water', 'steps', 'exercise'].includes(key)) {
      setAdjustmentType('add');
      setManualValue("");
    } else {
      setAdjustmentType('set');
      setManualValue(displayValue);
    }
    
    // For calories, we show a choice first. For others, go straight to manual.
    if (key === 'calories') {
      setEntryMode('choice');
    } else {
      setEntryMode('manual');
    }
    
    setManualModalOpen(true);
  };

  const saveManualValue = () => {
    if (activeMetricKey) {
      const isMetric = userProfile?.unitSystem === 'metric';
      let inputVal = parseFloat(manualValue);
      if (isNaN(inputVal)) inputVal = 0;

      // Handle unit conversion for weight if in metric
      let processVal = inputVal;
      if (activeMetricKey === 'weight' && isMetric) {
        processVal = inputVal / 0.453592;
      }

      let finalVal = processVal;
      
      if (adjustmentType === 'add') {
        finalVal = stats[activeMetricKey] + processVal;
      } else if (adjustmentType === 'sub') {
        finalVal = Math.max(0, stats[activeMetricKey] - processVal);
      }

      onUpdateStat(activeMetricKey, finalVal);
    }
    closeManualModal();
  };

  const closeManualModal = () => {
    setManualModalOpen(false);
    setActiveMetricKey(null);
    setEntryMode('choice');
  };

  const handleLogPreloadedMeal = async () => {
    const currentMeal = userProfile?.preloadedMeals?.[selectedMealType as keyof typeof userProfile.preloadedMeals];
    if (currentMeal && typeof currentMeal !== 'string') {
      onUpdateStat('calories', stats.calories + currentMeal.calories);
      setAiModalContent(null);
    }
  };

  const handleAdjustMealCalories = async (amount: number) => {
    const currentMeal = userProfile?.preloadedMeals?.[selectedMealType as keyof typeof userProfile.preloadedMeals];
    if (currentMeal && typeof currentMeal !== 'string' && auth.currentUser) {
      const newCalories = Math.max(0, currentMeal.calories + amount);
      const userDocRef = doc(db, 'users', auth.currentUser.uid);
      
      // Update local state first for instant feedback if possible
      // But userProfile is passed from props, so we rely on Firestore sync
      await setDoc(userDocRef, { 
        preloadedMeals: {
          ...userProfile?.preloadedMeals,
          [selectedMealType]: {
            ...currentMeal,
            calories: newCalories
          }
        }
      }, { merge: true });
    }
  };

  const handleSuggestMeal = async () => {
    const preloaded = userProfile?.preloadedMeals?.[selectedMealType as keyof typeof userProfile.preloadedMeals];
    
    if (preloaded) {
      const content = typeof preloaded === 'string' ? preloaded : preloaded.content;
      setAiModalContent({ 
        title: `${selectedMealType.charAt(0).toUpperCase() + selectedMealType.slice(1)} Recommendation`, 
        content: content, 
        isLoading: false 
      });
      return;
    }

    setAiModalContent({ title: `${selectedMealType.charAt(0).toUpperCase() + selectedMealType.slice(1)} Recommendation`, content: "", isLoading: true });
    try {
      const remaining = stats.caloriesGoal - stats.calories;
      const otherMeals = Object.entries(userProfile?.preloadedMeals || {})
        .filter(([type]) => type !== selectedMealType)
        .map(([_, meal]) => {
          const content = typeof meal === 'string' ? meal : meal.content;
          return content.split('\n')[0].replace('# ', '');
        });

      const result = await suggestMeal(remaining > 0 ? remaining : 500, userProfile, selectedMealType, otherMeals, stats.caloriesGoal);
      
      // Save the result to lock it in for the rest of the day
      if (auth.currentUser && result) {
        const userDocRef = doc(db, 'users', auth.currentUser.uid);
        await setDoc(userDocRef, { 
          preloadedMeals: {
            ...userProfile?.preloadedMeals,
            [selectedMealType]: result
          },
          lastMealPreloadTimestamp: new Date().toISOString()
        }, { merge: true });
      }

      setAiModalContent({ 
        title: `${selectedMealType.charAt(0).toUpperCase() + selectedMealType.slice(1)} Recommendation`, 
        content: result?.content || "No content generated", 
        isLoading: false 
      });
    } catch (error) {
      setAiModalContent({ title: "AI Unavailable", content: "Could not generate a suggestion right now. Try high-protein snacks!", isLoading: false });
    }
  };

  const handleSuggestExercise = async () => {
    if (userProfile?.preloadedWorkout) {
      setAiModalContent({ title: "Quick Workout Idea", content: userProfile.preloadedWorkout, isLoading: false });
      return;
    }

    setAiModalContent({ title: "Quick Workout Idea", content: "", isLoading: true });
    try {
      const result = await suggestWorkout(15, userProfile);
      
      // Save to lock it in
      if (auth.currentUser) {
        const userDocRef = doc(db, 'users', auth.currentUser.uid);
        await setDoc(userDocRef, { 
          preloadedWorkout: result,
          lastMealPreloadTimestamp: new Date().toISOString()
        }, { merge: true });
      }

      setAiModalContent({ title: "Quick Workout Idea", content: result, isLoading: false });
    } catch (error) {
      setAiModalContent({ title: "AI Unavailable", content: "Could not generate a workout. How about 20 jumping jacks!", isLoading: false });
    }
  };

  useEffect(() => {
    // Only fetch if we don't have a tip or if it's a new day
    const lastTipDate = userProfile?.lastAiTipTimestamp ? new Date(userProfile.lastAiTipTimestamp).toDateString() : '';
    const lastPreloadDate = userProfile?.lastMealPreloadTimestamp ? new Date(userProfile.lastMealPreloadTimestamp).toDateString() : '';
    const today = new Date().toDateString();
    
    if (!userProfile?.lastAiTip || lastTipDate !== today) {
      fetchCoachTip();
    } else if (!userProfile?.preloadedMeals || lastPreloadDate !== today) {
      preloadMeals();
    }
  }, []);

  const getMetricInfo = (key: keyof DailyStats | null) => {
    const isMetric = userProfile?.unitSystem === 'metric';
    switch (key) {
      case 'calories': return { label: 'Calories', icon: <Utensils />, color: '#f97316', unit: 'kcal' };
      case 'water': return { label: 'Water', icon: <Droplets />, color: '#3b82f6', unit: 'cups' };
      case 'steps': return { label: 'Steps', icon: <Footprints />, color: '#10b981', unit: 'steps' };
      case 'exercise': return { label: 'Exercise', icon: <Timer />, color: '#8b5cf6', unit: 'min' };
      case 'weight': return { label: 'Weight', icon: <Scale />, color: '#f43f5e', unit: isMetric ? 'kg' : 'lbs' };
      default: return { label: '', icon: null, color: '#000', unit: '' };
    }
  };

  const handleLogMealInternal = (name: string, calories: number, analysis?: string) => {
    onLogMeal(name, calories, analysis);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-700 pb-10">
      <FoodAssistant 
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        stats={stats}
        userProfile={userProfile}
        foodLog={foodLog}
        onLogMeal={handleLogMealInternal}
      />
      
      {/* Header with Streak */}
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/30 px-4 py-2 rounded-2xl border border-amber-100 dark:border-amber-900/30 shadow-sm">
          <Zap className="w-5 h-5 text-amber-500 fill-amber-500" />
          <span className="text-lg font-black text-amber-700 dark:text-amber-400">{userProfile?.streak || 0} Day Streak</span>
        </div>
        <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
        </div>
      </div>

      {/* AI Suggests Top Card */}
      <div 
        onClick={() => !isRefreshing && setAiModalContent({ title: "Personalized Coaching", content: aiCoachTip })}
        className={`bg-white dark:bg-slate-900 rounded-[32px] p-6 shadow-sm border border-blue-50 dark:border-slate-800 flex gap-4 cursor-pointer transition-all active:scale-[0.98] hover:border-indigo-100 dark:hover:border-indigo-900 ${isRefreshing ? 'animate-pulse' : ''}`}
      >
        <div className="w-12 h-12 rounded-2xl bg-indigo-500 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-100 dark:shadow-indigo-900/20">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1">
          <div className="flex justify-between items-start">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg">AI suggests</h3>
            <button 
              onClick={(e) => { e.stopPropagation(); fetchCoachTip(); }} 
              className="text-indigo-600 dark:text-indigo-400 p-1 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
          
          {isRefreshing ? (
            <div className="space-y-2 mt-2">
              <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-full"></div>
              <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-5/6"></div>
              <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-4/6"></div>
            </div>
          ) : (
            <>
              <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mt-2 line-clamp-3 italic">
                {aiCoachTip}
              </p>
              <div className="mt-2 text-[10px] font-bold text-indigo-400 dark:text-indigo-500 uppercase tracking-widest">
                Tap to read full brief
              </div>
            </>
          )}
        </div>
      </div>

      {/* AI Food Assistant Quick Entry */}
      <button 
        onClick={() => setIsAssistantOpen(true)}
        className="w-full p-6 bg-gradient-to-br from-indigo-600 to-violet-700 rounded-[32px] text-white flex items-center gap-5 group transition-all active:scale-[0.98] shadow-xl shadow-indigo-100 dark:shadow-indigo-900/30 overflow-hidden relative"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-white/20 transition-all"></div>
        <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center backdrop-blur-md relative z-10 shrink-0">
          <Sparkles className="w-7 h-7 text-white" />
        </div>
        <div className="text-left relative z-10">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="font-black text-xl tracking-tight">AI Food Assistant</p>
            <div className="bg-white/20 text-[8px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded-md backdrop-blur-md">New</div>
          </div>
          <p className="text-white/80 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
            <Mic className="w-3 h-3" /> Voice Log • <Camera className="w-3 h-3" /> Buffet Scanner
          </p>
        </div>
        <div className="ml-auto w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-md group-hover:translate-x-1 transition-transform relative z-10">
          <ChevronRight className="w-5 h-5" />
        </div>
      </button>

      {/* Main Metrics (Grid) */}
      <div className="grid grid-cols-2 gap-4">
        <MetricCircleCard 
          label="Calories" 
          value={stats.calories} 
          goal={stats.caloriesGoal} 
          icon={<Utensils className="w-4 h-4" />} 
          color="#f97316" 
          unit="kcal"
          description="Goal:"
          onClick={() => handleMetricClick('calories')}
        />
        <MetricCircleCard 
          label="Water" 
          value={stats.water} 
          goal={stats.waterGoal} 
          icon={<Droplets className="w-4 h-4" />} 
          color="#3b82f6" 
          unit="cups"
          description="Goal:"
          onClick={() => handleMetricClick('water')}
        />
        <MetricCircleCard 
          label="Steps" 
          value={stats.steps} 
          goal={stats.stepsGoal} 
          icon={<Footprints className="w-4 h-4" />} 
          color="#10b981" 
          unit="steps"
          description="Goal:"
          onClick={() => handleMetricClick('steps')}
        />
        <MetricCircleCard 
          label="Exercise" 
          value={stats.exercise} 
          goal={stats.exerciseGoal} 
          icon={<Timer className="w-4 h-4" />} 
          color="#8b5cf6" 
          unit="min"
          description="Goal:"
          onClick={() => handleMetricClick('exercise')}
        />
      </div>

      {/* Weight Row - Special Large Card */}
      <button 
        onClick={() => handleMetricClick('weight')}
        className="w-full bg-white dark:bg-slate-900 rounded-[32px] p-6 shadow-sm border border-slate-50 dark:border-slate-800 flex items-center justify-between hover:border-rose-100 dark:hover:border-rose-900 transition-all active:scale-[0.98] group"
      >
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center text-rose-500 dark:text-rose-400 shadow-sm group-hover:scale-110 transition-transform">
            <Scale className="w-7 h-7" />
          </div>
          <div className="text-left">
            <h4 className="text-lg font-black text-slate-800 dark:text-slate-100">Current Weight</h4>
            <div className="flex items-center gap-1">
              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Goal:</span>
              <span className="text-xs font-black text-rose-500 dark:text-rose-400 uppercase tracking-widest">
                {userProfile?.unitSystem === 'metric' 
                  ? `${Math.round(stats.weightGoal * 0.453592)} kg` 
                  : `${stats.weightGoal} lbs`}
              </span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-black text-slate-800 dark:text-slate-100">
            {userProfile?.unitSystem === 'metric' 
              ? Math.round(stats.weight * 0.453592) 
              : stats.weight}
          </div>
          <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
            {userProfile?.unitSystem === 'metric' ? 'kg' : 'lbs'}
          </div>
        </div>
      </button>

      {/* AI Recommendation Buttons */}
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-black text-slate-900 dark:text-white">Meal Plan</h2>
          <button 
            onClick={() => preloadMeals(true)}
            disabled={isPreloading}
            className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-1.5 hover:opacity-80 disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${isPreloading ? 'animate-spin' : ''}`} />
            Refresh All
          </button>
        </div>
        <div className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl rounded-[32px] p-2 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] border border-white/40 dark:border-slate-800 flex gap-1">
          {['breakfast', 'lunch', 'dinner', 'snacks'].map((type) => (
            <button
              key={type}
              onClick={() => setSelectedMealType(type)}
              className={`flex-1 py-2.5 rounded-[24px] text-[10px] font-black uppercase tracking-wider transition-all duration-300 ${
                selectedMealType === type 
                ? 'bg-indigo-600/90 backdrop-blur-md text-white' 
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white/30 dark:hover:bg-slate-800/30'
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        <RecommendButton 
          icon={<Sparkles className="w-5 h-5 text-indigo-500" />} 
          title={`Suggest a ${selectedMealType} based on my calories`}
          subtitle={userProfile?.preloadedMeals?.[selectedMealType as keyof typeof userProfile.preloadedMeals] 
            ? `${(userProfile.preloadedMeals[selectedMealType as keyof typeof userProfile.preloadedMeals] as any).calories} kcal • Ready to view` 
            : "AI-powered meal recommendation"}
          bgColor="bg-indigo-50 dark:bg-indigo-950/30"
          onClick={handleSuggestMeal}
          isLoading={isPreloading}
        />

        {userProfile?.preloadedMeals?.[selectedMealType as keyof typeof userProfile.preloadedMeals] && (
          <div className="flex items-center gap-2 bg-white/50 dark:bg-slate-900/50 p-2 rounded-3xl border border-slate-100 dark:border-slate-800 animate-in slide-in-from-top-2 duration-300">
            <div className="flex-1 px-4">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Quick Adjust</span>
              <span className="text-sm font-black text-slate-700 dark:text-slate-300">
                {(userProfile.preloadedMeals[selectedMealType as keyof typeof userProfile.preloadedMeals] as any).calories} kcal
              </span>
            </div>
            <button 
              onClick={() => handleAdjustMealCalories(-50)}
              className="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm active:scale-90"
            >
              <Minus className="w-4 h-4 text-slate-500" />
            </button>
            <button 
              onClick={() => handleAdjustMealCalories(50)}
              className="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm active:scale-90"
            >
              <Plus className="w-4 h-4 text-slate-500" />
            </button>
            <button 
              onClick={handleLogPreloadedMeal}
              className="bg-indigo-500 text-white px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 flex items-center gap-1"
            >
              <Check className="w-3 h-3" /> Log
            </button>
          </div>
        )}

        <WorkoutFocus 
          stats={stats}
          userProfile={userProfile}
          foodLog={foodLog}
          onShowResult={(title, content) => setAiModalContent({ title, content, isLoading: false })}
        />
      </div>

      {/* Manual Entry Modal */}
      {manualModalOpen && activeMetricKey && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[150] flex items-center justify-center p-6 animate-in fade-in zoom-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[40px] p-8 shadow-2xl relative">
            <button onClick={closeManualModal} className="absolute top-6 right-6 p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full transition-colors">
              <X className="w-5 h-5 text-slate-400" />
            </button>
            
            {entryMode === 'choice' ? (
              <div className="animate-in slide-in-from-bottom-4 duration-300">
                <div className="flex flex-col items-center text-center mb-8">
                  <div className="w-16 h-16 rounded-2xl bg-orange-50 dark:bg-orange-950/30 flex items-center justify-center text-orange-500 mb-4">
                    <Utensils className="w-8 h-8" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-1">Track Calories</h3>
                  <p className="text-slate-400 dark:text-slate-500 text-sm font-bold uppercase tracking-widest">Choose your method</p>
                </div>

                <div className="space-y-4">
                  <button 
                    onClick={() => { setManualModalOpen(false); setIsAssistantOpen(true); }}
                    className="w-full p-6 gradient-bg rounded-3xl text-white flex items-center gap-4 group transition-all active:scale-[0.98] shadow-lg shadow-indigo-100 dark:shadow-indigo-900/20"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <div className="text-left">
                      <p className="font-black text-lg">AI Food Assistant</p>
                      <p className="text-white/70 text-xs font-bold uppercase tracking-widest">Voice, Scan & Advice</p>
                    </div>
                    <ChevronRight className="w-5 h-5 ml-auto text-white/50 group-hover:text-white transition-colors" />
                  </button>

                  <button 
                    onClick={() => setEntryMode('manual')}
                    className="w-full p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl text-slate-700 dark:text-slate-200 flex items-center gap-4 transition-all active:scale-[0.98] border border-slate-100 dark:border-slate-700"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-700 flex items-center justify-center text-slate-400 shadow-sm">
                      <Edit2 className="w-6 h-6" />
                    </div>
                    <div className="text-left">
                      <p className="font-black text-lg">Manual Entry</p>
                      <p className="text-slate-400 dark:text-slate-500 text-xs font-bold uppercase tracking-widest">Type in amount</p>
                    </div>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center text-center animate-in fade-in duration-300">
                <div 
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-sm"
                  style={{ backgroundColor: `${getMetricInfo(activeMetricKey).color}15`, color: getMetricInfo(activeMetricKey).color }}
                >
                  {React.isValidElement(getMetricInfo(activeMetricKey).icon) ? React.cloneElement(getMetricInfo(activeMetricKey).icon as React.ReactElement<any>, { className: 'w-8 h-8' }) : getMetricInfo(activeMetricKey).icon}
                </div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-1">Update {getMetricInfo(activeMetricKey).label}</h3>
                <p className="text-slate-400 dark:text-slate-500 text-sm font-bold uppercase tracking-widest mb-6">Manual Entry</p>
                
                <div className="flex gap-2 mb-8 bg-slate-50 dark:bg-slate-800 p-1.5 rounded-2xl w-full">
                  {[
                    { id: 'add', label: 'Add', icon: <Plus className="w-3.5 h-3.5" /> },
                    { id: 'sub', label: 'Sub', icon: <Minus className="w-3.5 h-3.5" /> },
                    { id: 'set', label: 'Set Total', icon: <Check className="w-3.5 h-3.5" /> }
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => setAdjustmentType(mode.id as any)}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                        adjustmentType === mode.id
                          ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                          : 'text-slate-400 dark:text-slate-500 hover:text-slate-600'
                      }`}
                    >
                      {mode.icon} {mode.label}
                    </button>
                  ))}
                </div>

                <div className="relative w-full">
                  <input 
                    type="number" 
                    step="any"
                    autoFocus
                    placeholder="0"
                    className="w-full text-center text-5xl font-black text-slate-800 dark:text-white bg-transparent focus:outline-none mb-2"
                    value={manualValue}
                    onChange={(e) => setManualValue(e.target.value)}
                  />
                  <div className="text-slate-400 dark:text-slate-500 font-black text-xs uppercase tracking-widest">
                    {adjustmentType === 'set' ? `New Target ${getMetricInfo(activeMetricKey).unit}` : `Amount to ${adjustmentType} (${getMetricInfo(activeMetricKey).unit})`}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 w-full mt-10">
                  <button 
                    onClick={closeManualModal}
                    className="py-4 rounded-2xl border border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={saveManualValue}
                    className="py-4 rounded-2xl text-white font-bold transition-all hover:opacity-90 active:scale-95"
                    style={{ backgroundColor: getMetricInfo(activeMetricKey).color }}
                  >
                    Save Entry
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI Content Modal */}
      {aiModalContent && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[150] flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[40px] p-8 shadow-2xl relative">
            <button onClick={() => setAiModalContent(null)} className="absolute top-6 right-6 p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full">
              <X className="w-5 h-5 text-slate-400" />
            </button>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-950/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">{aiModalContent.title}</h3>
            </div>
            <div className={`text-slate-600 dark:text-slate-300 leading-relaxed max-h-[60vh] overflow-y-auto no-scrollbar font-medium prose prose-slate dark:prose-invert prose-sm ${aiModalContent.title.includes('Recommendation') ? 'pb-24' : ''}`}>
              {aiModalContent.isLoading ? (
                <div className="space-y-4 py-4">
                  <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-full animate-pulse"></div>
                  <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-5/6 animate-pulse"></div>
                  <div className="h-4 bg-slate-100 dark:bg-slate-800 rounded w-4/6 animate-pulse"></div>
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest text-center mt-4">AI is thinking...</p>
                </div>
              ) : (
                <div className="markdown-body">
                  <ReactMarkdown 
                    components={{
                      a: ({ node, ...props }) => <a target="_blank" rel="noopener noreferrer" {...props} />
                    }}
                  >
                    {aiModalContent.content}
                  </ReactMarkdown>
                </div>
              )}
            </div>

            {aiModalContent.title.includes('Recommendation') && !aiModalContent.isLoading && (
              <div className="absolute bottom-0 left-0 right-0 p-8 pt-4 bg-gradient-to-t from-white dark:from-slate-900 via-white dark:via-slate-900 to-transparent rounded-b-[40px] flex flex-col gap-3">
                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Adjust Calories</span>
                    <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">
                      {(userProfile?.preloadedMeals?.[selectedMealType as keyof typeof userProfile.preloadedMeals] as any)?.calories || 0} kcal
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleAdjustMealCalories(-50)}
                      className="p-2 bg-white dark:bg-slate-700 rounded-xl border border-slate-100 dark:border-slate-600 shadow-sm transition-all active:scale-90"
                    >
                      <Minus className="w-4 h-4 text-slate-500 dark:text-slate-300" />
                    </button>
                    <button 
                      onClick={() => handleAdjustMealCalories(50)}
                      className="p-2 bg-white dark:bg-slate-700 rounded-xl border border-slate-100 dark:border-slate-600 shadow-sm transition-all active:scale-90"
                    >
                      <Plus className="w-4 h-4 text-slate-500 dark:text-slate-300" />
                    </button>
                  </div>
                </div>
                <button 
                  onClick={handleLogPreloadedMeal}
                  className="w-full py-4 bg-indigo-600 dark:bg-indigo-500 text-white font-black rounded-2xl hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 dark:shadow-indigo-900/30"
                >
                  <Check className="w-5 h-5" />
                  Log this {(userProfile?.preloadedMeals?.[selectedMealType as keyof typeof userProfile.preloadedMeals] as any)?.calories || 0} kcal meal
                </button>
              </div>
            )}

            {!aiModalContent.title.includes('Recommendation') && (
              <button 
                onClick={() => setAiModalContent(null)}
                className="w-full mt-8 py-4 bg-slate-900 dark:bg-indigo-600 text-white font-bold rounded-2xl hover:opacity-90 active:scale-95 transition-all"
              >
                Got it!
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const MetricCircleCard = ({ label, value, goal, icon, color, description, unit, onClick }: any) => (
  <button 
    onClick={onClick}
    className="bg-white dark:bg-slate-900 rounded-[32px] p-5 shadow-sm border border-slate-50 dark:border-slate-800 flex flex-col items-center text-center transition-all active:scale-95 hover:border-slate-200 dark:hover:border-slate-700 relative group"
  >
    <div className="absolute top-4 right-4 text-slate-200 dark:text-slate-700 group-hover:text-slate-300 dark:group-hover:text-slate-600 transition-colors">
      <Edit2 className="w-3 h-3" />
    </div>
    <CircularProgress value={value} max={goal} color={color} size={100} strokeWidth={8}>
      <span className="text-xl font-black text-slate-800 dark:text-white">{value >= 1000 ? (value / 1000).toFixed(1) + 'k' : value}</span>
    </CircularProgress>
    <div className="mt-4 flex items-center gap-2 font-black text-xs uppercase tracking-wider" style={{ color }}>
      {icon} {label}
    </div>
    <div className="text-[9px] text-slate-400 dark:text-slate-500 font-bold mt-1 uppercase tracking-widest leading-tight">
      {description} {goal} {unit}
    </div>
  </button>
);

const RecommendButton = ({ icon, title, subtitle, bgColor, onClick, isLoading }: any) => (
  <button 
    onClick={onClick}
    disabled={isLoading}
    className={`w-full bg-white dark:bg-slate-900 rounded-[32px] p-4 flex items-center gap-4 text-left border border-slate-50 dark:border-slate-800 shadow-sm hover:shadow-md transition-all active:scale-[0.98] ${isLoading ? 'opacity-70 cursor-wait' : ''}`}
  >
    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${bgColor}`}>
      {isLoading ? <RefreshCw className="w-5 h-5 text-indigo-500 animate-spin" /> : icon}
    </div>
    <div className="flex-1">
      <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm leading-tight">{title}</h4>
      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 font-medium">{subtitle}</p>
    </div>
    <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600" />
  </button>
);

export default Dashboard;