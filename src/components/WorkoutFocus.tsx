
import React, { useState, useEffect } from 'react';
import { 
  Dumbbell, 
  Sparkles, 
  ChevronRight, 
  Target, 
  RefreshCw, 
  Zap, 
  X,
  Heart,
  User,
  Activity
} from 'lucide-react';
import { UserProfile, DailyStats, FoodLogEntry } from '../types';
import { recommendFocusArea, suggestWorkout } from '../services/geminiService';
import { auth, db, doc, setDoc } from '../firebase';
import ReactMarkdown from 'react-markdown';

interface Props {
  userProfile: UserProfile | null;
  stats: DailyStats;
  foodLog: FoodLogEntry[];
  onShowResult: (title: string, content: string) => void;
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

const WorkoutFocus: React.FC<Props> = ({ userProfile, stats, foodLog, onShowResult }) => {
  const [recommendation, setRecommendation] = useState<{ area: string, reason: string } | null>(null);
  const [isRecommending, setIsRecommending] = useState(false);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (userProfile && !recommendation) {
      handleGetRecommendation();
    }
  }, [userProfile]);

  const handleGetRecommendation = async () => {
    setIsRecommending(true);
    try {
      const result = await recommendFocusArea(userProfile, stats, foodLog);
      setRecommendation(result);
    } catch (error) {
      console.error("Failed to get recommendation", error);
    } finally {
      setIsRecommending(false);
    }
  };

  const handleGenerateWorkout = async (area: string) => {
    setIsGenerating(true);
    setSelectedArea(area);
    try {
      const remainingMinutes = Math.max(stats.exerciseGoal - stats.exercise, 15);
      const workout = await suggestWorkout(remainingMinutes, userProfile, area);
      if (workout) {
        onShowResult(`${area} Focused Workout`, workout);
      }
    } catch (error) {
      console.error("Failed to generate workout", error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
          <Dumbbell className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          Focus Your Training
        </h2>
      </div>

      {/* AI Recommendation Card */}
      <div 
        className={`bg-indigo-50 dark:bg-indigo-950/20 rounded-[32px] p-6 border border-indigo-100 dark:border-indigo-900/30 relative overflow-hidden transition-all ${isRecommending ? 'animate-pulse' : ''}`}
      >
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Sparkles className="w-24 h-24 text-indigo-600" />
        </div>
        
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <div className="bg-indigo-600 text-[10px] font-black text-white uppercase tracking-tighter px-2 py-0.5 rounded-lg">AI Recommendation</div>
            <button 
              onClick={handleGetRecommendation}
              disabled={isRecommending}
              className="text-indigo-400 hover:text-indigo-600 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isRecommending ? 'animate-spin' : ''}`} />
            </button>
          </div>
          
          {recommendation ? (
            <div className="animate-in slide-in-from-bottom-2 duration-500">
              <h3 className="text-2xl font-black text-indigo-900 dark:text-indigo-100 mb-2">Focus on your <span className="text-indigo-600 dark:text-indigo-400 uppercase">{recommendation.area}</span> today.</h3>
              <p className="text-indigo-700/70 dark:text-indigo-300 text-sm font-medium leading-relaxed italic mb-4">
                "{recommendation.reason}"
              </p>
              <button 
                onClick={() => handleGenerateWorkout(recommendation.area)}
                disabled={isGenerating}
                className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black text-sm shadow-lg shadow-indigo-200 dark:shadow-indigo-900/40 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isGenerating && selectedArea === recommendation.area ? (
                   <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4" />
                )}
                Generate {recommendation.area} Workout
              </button>
            </div>
          ) : (
            <div className="py-4 space-y-2">
              <div className="h-4 bg-indigo-200 dark:bg-indigo-900 rounded w-3/4"></div>
              <div className="h-4 bg-indigo-200 dark:bg-indigo-900 rounded w-1/2"></div>
            </div>
          )}
        </div>
      </div>

      {/* Manual Area Grid */}
      <div className="space-y-3">
        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1">Manual Selection</p>
        <div className="grid grid-cols-4 gap-3">
          {AREAS.map((area) => (
            <button
              key={area.id}
              onClick={() => handleGenerateWorkout(area.id)}
              disabled={isGenerating}
              className={`p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl flex flex-col items-center gap-2 transition-all active:scale-90 ${COLOR_MAP[area.color].border} group ${isGenerating ? 'opacity-50' : ''}`}
            >
              <div className={`w-10 h-10 rounded-xl ${COLOR_MAP[area.color].bg} flex items-center justify-center transition-transform group-hover:scale-110`}>
                {isGenerating && selectedArea === area.id ? (
                  <RefreshCw className="w-5 h-5 text-indigo-500 animate-spin" />
                ) : (
                  area.icon
                )}
              </div>
              <span className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-tighter">{area.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WorkoutFocus;
