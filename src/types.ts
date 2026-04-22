
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type FitnessGoal = 'lose_weight' | 'maintain' | 'gain_muscle';
export type Gender = 'male' | 'female' | 'other';
export type UnitSystem = 'metric' | 'imperial';

export type WorkoutEnvironment = 'home' | 'gym';
export type MealPrepStyle = 'self' | 'others' | 'eat_out';
export type FruitConsumption = 'rarely' | 'sometimes' | 'daily';

export interface UserProfile {
  name: string;
  age: number;
  ageRange?: string;
  gender: Gender;
  weight: number;
  height: number;
  activityLevel: ActivityLevel;
  goal: FitnessGoal;
  location: string;
  workoutEnvironment: WorkoutEnvironment;
  mealPrepStyle: MealPrepStyle;
  fruitConsumption: FruitConsumption;
  dailyBudget: number;
  targetWeight?: number;
  streak: number;
  lastActivityDate?: string;
  lastStatsResetDate?: string;
  unitSystem: UnitSystem;
  onboarded: boolean;
  lastAiTip?: string;
  lastAiTipTimestamp?: string;
  preloadedMeals?: {
    [key: string]: {
      content: string;
      calories: number;
    };
  };
  preloadedWorkout?: string;
  preloadedFocusAreaRecommendation?: string;
  lastMealPreloadTimestamp?: string;
  darkMode?: boolean;
  hasAcceptedTerms?: boolean;
}

export interface DailyStats {
  calories: number;
  caloriesGoal: number;
  water: number;
  waterGoal: number;
  steps: number;
  stepsGoal: number;
  exercise: number;
  exerciseGoal: number;
  weight: number;
  weightGoal: number;
}

export interface FoodLogEntry {
  id: string;
  name: string;
  calories: number;
  analysis?: string;
  timestamp: Date;
}

export interface WorkoutEntry {
  id: string;
  title: string;
  duration: number;
  timestamp: Date;
}

export interface CommunityPost {
  id: string;
  user: {
    name: string;
    avatar: string;
    isPro: boolean;
  };
  type: 'workout' | 'meal' | 'milestone';
  content: string;
  detail?: string;
  image?: string;
  likes: number;
  comments: number;
  timestamp: string;
}

export interface DailyHistoryEntry extends DailyStats {
  date: string; // YYYY-MM-DD
}

export type Tab = 'dashboard' | 'progress' | 'community' | 'profile';
