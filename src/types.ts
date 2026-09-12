
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
  currency?: string;
  targetWeight?: number;
  streak: number;
  lastActivityDate?: string;
  lastStatsResetDate?: string;
  unitSystem: UnitSystem;
  onboarded: boolean;
  lastAiTip?: string;
  lastAiTipTimestamp?: string;
  dailyScansCount?: number;
  lastScanDate?: string;
  tier?: 'free' | 'premium';
  preloadedMeals?: {
    [key: string]: {
      content: string;
      calories: number;
    };
  };
  preloadedWorkout?: string;
  preloadedWorkouts?: {
    [area: string]: string;
  };
  lastWorkoutPreloadTimestamp?: string;
  preloadedFocusAreaRecommendation?: {
    area: string;
    reason: string;
    timestamp?: string;
  } | string;
  lastMealPreloadTimestamp?: string;
  darkMode?: boolean;
  hasAcceptedTerms?: boolean;
  notificationSettings?: NotificationSettings;
  privacySettings?: PrivacySettings;
  appPreferences?: AppPreferences;
}

export interface NotificationSettings {
  goalCelebrations: boolean;       // Notify immediately when Daily Calorie, Water, Exercise, or Step goals are reached
  waterReminders: boolean;         // Hydration reminder checks
  mealReminders: boolean;          // Breakfast, Lunch, Dinner logging prompts
  streakAlerts: boolean;           // Daily streak saver reminder
  browserNotifications: boolean;   // Web Push / Browser desktop notification permissions
  soundEnabled: boolean;           // Celebration sound chime on goal unlock
  vibrationEnabled: boolean;       // Haptic vibration feedback
}

export interface PrivacySettings {
  shareGoalsPublicly: boolean;     // Share goal completions in community feed
  anonymousCommunity: boolean;     // Post anonymously with alias instead of full name
  aiPersonalization: boolean;      // Allow AI nutritionist to analyze meal history
  analyticsEnabled: boolean;       // Anonymous usage performance diagnostics
}

export interface AppPreferences {
  theme: 'light' | 'dark' | 'system';
  timeFormat: '12h' | '24h';
  startOfWeek: 'sunday' | 'monday';
  compactCards: boolean;
  autoCelebrateGoals: boolean;
}

export interface GoalAlertEvent {
  id: string;
  type: 'calories' | 'water' | 'exercise' | 'steps' | 'streak' | 'custom';
  title: string;
  message: string;
  timestamp: string; // ISO string
  value?: number;
  goal?: number;
  read?: boolean;
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
    uid?: string;
  };
  type: 'workout' | 'meal' | 'milestone';
  content: string;
  detail?: string;
  image?: string;
  likes: number;
  comments: number;
  timestamp: string;
}

export type CommunityType = 'challenge' | 'group';

export interface FeedPost {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  timestamp: any;
  likes: number;
  comments: number;
  image?: string;
}

export interface Community {
  id: string;
  name: string;
  description: string;
  creatorId: string;
  creatorName: string;
  isPrivate: boolean;
  type: CommunityType;
  membersCount: number;
  createdAt: string;
  image?: string;
}

export interface CommunityMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: any;
}

export interface CommunityMember {
  id: string;
  userId: string;
  name: string;
  role: 'admin' | 'member';
  joinedAt: any;
}

export interface CommunityJoinRequest {
  id: string;
  userId: string;
  userName: string;
  status: 'pending' | 'accepted' | 'declined';
  timestamp: any;
}

export interface CommunityVideo {
  id: string;
  title: string;
  description?: string;
  videoUrl: string;
  uploaderId: string;
  uploaderName: string;
  timestamp: any;
}

export interface DailyHistoryEntry extends DailyStats {
  date: string; // YYYY-MM-DD
}

export type Tab = 'dashboard' | 'progress' | 'community' | 'profile';
