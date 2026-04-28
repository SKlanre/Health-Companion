import React, { useState, useRef, useEffect } from 'react';
import Dashboard from './pages/Dashboard';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  BarChart2, 
  Camera, 
  Plus, 
  Mic,
  PenLine,
  Utensils, 
  Clock, 
  X, 
  Zap,
  Users,
  Search,
  Sparkles,
  RefreshCw,
  LogIn, 
  User as UserIcon,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import FoodAssistant from './components/FoodAssistant';
import Community from './pages/Community';
import Progress from './pages/Progress';
import Profile from './pages/Profile';
import Onboarding from './components/Onboarding';
import { Tab, DailyStats, FoodLogEntry, WorkoutEntry, UserProfile, DailyHistoryEntry } from './types';
import { scanFoodImage } from './services/geminiService';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  onAuthStateChanged, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  onSnapshot, 
  collection, 
  query, 
  orderBy, 
  limit, 
  handleFirestoreError, 
  OperationType,
} from './firebase';
import type { User } from './firebase';
import { useStepCounter } from './hooks/useStepCounter';

import { initializePayment, verifyPayment } from './services/paymentService';

import { getCurrencyForLocation } from './lib/currencies';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isProfileLoaded, setIsProfileLoaded] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  const getDailyLimit = () => {
    if (userProfile?.tier === 'premium') return 9999; // Practically unlimited
    return 5;
  };
  const MAX_DAILY_SCANS = getDailyLimit();
  const [notification, setNotification] = useState<{message: string, type: 'error' | 'success' | 'info'} | null>(null);
  
  const [stats, setStats] = useState<DailyStats>({
    calories: 0,
    caloriesGoal: 2000,
    water: 0,
    waterGoal: 8,
    steps: 0,
    stepsGoal: 10000,
    exercise: 0,
    exerciseGoal: 30,
    weight: 165,
    weightGoal: 160
  });

  const [foodLog, setFoodLog] = useState<FoodLogEntry[]>([]);
  const [exerciseLog, setExerciseLog] = useState<WorkoutEntry[]>([]);
  const [dailyHistory, setDailyHistory] = useState<DailyHistoryEntry[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanMode, setScanMode] = useState<'quick' | 'deep'>('quick');
  const [showLogMenu, setShowLogMenu] = useState(false);
  const [showFoodAssistant, setShowFoodAssistant] = useState(false);
  const [assistantMode, setAssistantMode] = useState<'voice' | 'text'>('voice');
  const [pendingFood, setPendingFood] = useState<{ name: string, calories: number } | null>(null);
  const [currentBase64, setCurrentBase64] = useState<string | null>(null);
  const [additionalDetails, setAdditionalDetails] = useState("");
  const [isRefining, setIsRefining] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { startTracking, stopTracking, isTracking } = useStepCounter(() => {
    if (userProfile?.hasAcceptedTerms) {
      handleUpdateStatSilently('steps', stats.steps + 1);
    }
  });

  // Payment Verification logic
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get('reference');
    const trxref = params.get('trxref');
    
    if (reference && user) {
      const checkPayment = async () => {
        try {
          showNotification("Verifying payment...", 'success');
          const verification = await verifyPayment(reference);
          
          if (verification.status && verification.data.status === 'success') {
            // Update User to Premium
            const userDocRef = doc(db, 'users', user.uid);
            await updateDoc(userDocRef, { tier: 'premium' });
            
            if (userProfile) {
              setUserProfile({ ...userProfile, tier: 'premium' });
            }
            showNotification("Welcome to Premium! Your limits are gone.", 'success');
            
            // Clean URL
            window.history.replaceState({}, document.title, "/");
          } else {
            showNotification("Payment verification failed.", 'error');
          }
        } catch (error) {
          console.error("Verification error:", error);
          showNotification("Error verifying payment.", 'error');
        }
      };
      
      checkPayment();
    }
  }, [user, isAuthReady]);

  // Start/Stop tracking based on terms
  useEffect(() => {
    if (userProfile?.hasAcceptedTerms && !isTracking) {
      startTracking();
    } else if (!userProfile?.hasAcceptedTerms && isTracking) {
      stopTracking();
    }
  }, [userProfile?.hasAcceptedTerms, isTracking]);

  const handleUpdateStatSilently = async (key: keyof DailyStats, value: number) => {
    if (!user) return;
    try {
      const userDocRef = doc(db, 'users', user.uid);
      const newStats = { ...stats, [key]: value };
      await setDoc(userDocRef, { stats: newStats }, { merge: true });
      setStats(newStats);
    } catch (error) {
      // Fail silently for background updates
    }
  };

  // Theme Effect
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.style.colorScheme = 'light';
    }
  }, [darkMode]);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
    });
    return unsubscribe;
  }, []);

  // Firestore Sync
  useEffect(() => {
    if (!user || !isAuthReady) return;

    const userDocRef = doc(db, 'users', user.uid);
    
    // Sync Profile & Stats
    const unsubProfile = onSnapshot(userDocRef, async (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as UserProfile & { stats: DailyStats };
        
        // Check for streak reset
        const today = new Date().toISOString().split('T')[0];
        const lastDate = data.lastActivityDate;
        const lastResetDate = data.lastStatsResetDate;
        let currentStreak = data.streak || 0;
        let currentStats = data.stats || stats;

        // Reset daily stats if it's a new day
        if (lastResetDate && lastResetDate !== today) {
          // Archive previous day's stats
          try {
            const historyDocRef = doc(db, 'users', user.uid, 'dailyHistory', lastResetDate);
            await setDoc(historyDocRef, {
              ...currentStats,
              date: lastResetDate
            });
          } catch (e) {
            console.error("Failed to archive daily stats", e);
          }

          currentStats = {
            ...currentStats,
            calories: 0,
            water: 0,
            steps: 0,
            exercise: 0
          };
          await setDoc(userDocRef, { 
            stats: currentStats,
            lastStatsResetDate: today 
          }, { merge: true });
        } else if (!lastResetDate) {
          // First time setup for reset date
          await setDoc(userDocRef, { lastStatsResetDate: today }, { merge: true });
        }

        if (lastDate && lastDate !== today) {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toISOString().split('T')[0];

          if (lastDate !== yesterdayStr) {
            // Missed a day, reset streak to 0
            currentStreak = 0;
            await setDoc(userDocRef, { streak: 0 }, { merge: true });
          }
        }

        setUserProfile({
          name: data.name,
          age: data.age,
          gender: data.gender,
          weight: data.weight,
          height: data.height,
          activityLevel: data.activityLevel,
          goal: data.goal,
          location: data.location,
          workoutEnvironment: data.workoutEnvironment,
          mealPrepStyle: data.mealPrepStyle,
          fruitConsumption: data.fruitConsumption,
          dailyBudget: data.dailyBudget,
          streak: currentStreak,
          lastActivityDate: data.lastActivityDate,
          lastStatsResetDate: data.lastStatsResetDate || today,
          unitSystem: data.unitSystem || 'imperial',
          onboarded: data.onboarded,
          lastAiTip: data.lastAiTip,
          lastAiTipTimestamp: data.lastAiTipTimestamp,
          preloadedMeals: data.preloadedMeals,
          preloadedWorkout: data.preloadedWorkout,
          lastMealPreloadTimestamp: data.lastMealPreloadTimestamp,
          darkMode: data.darkMode,
          targetWeight: data.targetWeight
        });
        if (data.darkMode !== undefined) {
          setDarkMode(data.darkMode);
        }
        if (data.stats) {
          setStats(currentStats);
        }
      }
      // Only set loaded to true AFTER we've decided if snapshot exists or not
      // This prevents the onboarding from popping up for a split second for existing users
      setIsProfileLoaded(true);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
    });

    // Sync Food Logs
    const foodLogsQuery = query(
      collection(db, 'users', user.uid, 'foodLogs'),
      orderBy('timestamp', 'desc'),
      limit(20)
    );
    const unsubFood = onSnapshot(foodLogsQuery, (snapshot) => {
      const logs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name,
          calories: data.calories,
          timestamp: data.timestamp.toDate()
        } as FoodLogEntry;
      });
      setFoodLog(logs);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}/foodLogs`);
    });

    // Sync Daily History
    const historyQuery = query(
      collection(db, 'users', user.uid, 'dailyHistory'),
      orderBy('date', 'desc'),
      limit(365)
    );
    const unsubHistory = onSnapshot(historyQuery, (snapshot) => {
      const history = snapshot.docs.map(doc => doc.data() as DailyHistoryEntry);
      setDailyHistory(history);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}/dailyHistory`);
    });

    return () => {
      unsubProfile();
      unsubFood();
      unsubHistory();
    };
  }, [user, isAuthReady]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Login failed", error);
      if (error.code === 'auth/unauthorized-domain') {
        showNotification(`Domain Not Authorized: Please add '${window.location.hostname}' to Authorized Domains in your Firebase Console (Authentication > Settings).`);
      } else {
        showNotification("Login failed: " + error.message);
      }
    }
  };

  const handleOnboardingComplete = async (profile: UserProfile, initialStats: DailyStats) => {
    if (!user) return;
    
    try {
      const userDocRef = doc(db, 'users', user.uid);
      const today = new Date().toISOString().split('T')[0];
      const profileWithResetDate = {
        ...profile,
        lastStatsResetDate: today
      };
      await setDoc(userDocRef, {
        ...profileWithResetDate,
        stats: initialStats
      }, { merge: true });
      setUserProfile(profileWithResetDate);
      setStats(initialStats);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
    }
  };

  const handleUpdateStat = async (key: keyof DailyStats, value: number) => {
    if (!user) return;
    
    try {
      const userDocRef = doc(db, 'users', user.uid);
      const newStats = { ...stats, [key]: value };
      
      // Update streak
      const today = new Date().toISOString().split('T')[0];
      let newStreak = userProfile?.streak || 0;
      let newLastActivityDate = userProfile?.lastActivityDate;

      if (newLastActivityDate !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        if (newLastActivityDate === yesterdayStr) {
          newStreak += 1;
        } else {
          newStreak = 1;
        }
        newLastActivityDate = today;
      }

      await setDoc(userDocRef, { 
        stats: newStats, 
        streak: newStreak, 
        lastActivityDate: newLastActivityDate 
      }, { merge: true });
      
      setStats(newStats);
      if (userProfile) {
        setUserProfile({ ...userProfile, streak: newStreak, lastActivityDate: newLastActivityDate });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const handleAddFood = async (name: string, calories: number, analysis?: string) => {
    if (!user) return;

    try {
      const foodLogsRef = collection(db, 'users', user.uid, 'foodLogs');
      const newEntry = { name, calories, analysis: analysis || "", timestamp: new Date() };
      await setDoc(doc(foodLogsRef), newEntry);
      
      // Update daily calories and streak
      const userDocRef = doc(db, 'users', user.uid);
      const newStats = { ...stats, calories: stats.calories + calories };
      
      const today = new Date().toISOString().split('T')[0];
      let newStreak = userProfile?.streak || 0;
      let newLastActivityDate = userProfile?.lastActivityDate;

      if (newLastActivityDate !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        if (newLastActivityDate === yesterdayStr) {
          newStreak += 1;
        } else {
          newStreak = 1;
        }
        newLastActivityDate = today;
      }

      await setDoc(userDocRef, { 
        stats: newStats, 
        streak: newStreak, 
        lastActivityDate: newLastActivityDate 
      }, { merge: true });
      
      setStats(newStats);
      if (userProfile) {
        setUserProfile({ ...userProfile, streak: newStreak, lastActivityDate: newLastActivityDate });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/foodLogs`);
    }
  };

  const showNotification = (message: string, type: 'error' | 'success' | 'info' = 'error') => {
    setNotification({ message, type });
    // Keep rate limit info visible for longer as it implies waiting
    const duration = message.includes('retrying') ? 10000 : 5000;
    setTimeout(() => {
      setNotification(prev => (prev?.message === message ? null : prev));
    }, duration);
  };

  const incrementAiUsage = async () => {
    if (!user) return false;
    const today = new Date().toISOString().split('T')[0];
    let currentScansCount = userProfile?.dailyScansCount || 0;
    const lastScanDate = userProfile?.lastScanDate;

    if (lastScanDate !== today) {
      currentScansCount = 0;
    }

    if (currentScansCount >= MAX_DAILY_SCANS) {
      const message = userProfile?.tier === 'premium' 
        ? "Wow! You've used a lot of AI today. Take a breather!" 
        : `Daily limit reached (${MAX_DAILY_SCANS}/${MAX_DAILY_SCANS}). Upgrade for unlimited!`;
      showNotification(message, 'error');
      return false;
    }

    const userDocRef = doc(db, 'users', user.uid);
    const nextCount = currentScansCount + 1;
    await setDoc(userDocRef, { 
      dailyScansCount: nextCount,
      lastScanDate: today
    }, { merge: true });

    if (userProfile) {
      setUserProfile({ ...userProfile, dailyScansCount: nextCount, lastScanDate: today });
    }
    return true;
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Check & Increment (atomically-ish for the session)
    const canScan = await incrementAiUsage();
    if (!canScan) {
      event.target.value = '';
      return;
    }

    setIsScanning(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const img = new Image();
      img.src = reader.result as string;
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 512;
        const MAX_HEIGHT = 512;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        const base64Data = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
        setCurrentBase64(base64Data);
          try {
            const result = await scanFoodImage(base64Data, scanMode);
            if (result && result.name && result.calories) {
              setPendingFood({ ...result, analysis: result.analysis || "" });
            } else {
              showNotification("Sorry, couldn't identify the food. Please try again.");
            }
          } catch (err: any) {
            console.error("Scanning error:", err);
            showNotification(err.message || 'Scanning failed. Please try again.');
          } finally {
            setIsScanning(false);
          }
      };
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const handleRefineScan = async () => {
    if (!currentBase64 || !additionalDetails) return;
    
    setIsRefining(true);
    const result = await scanFoodImage(currentBase64, 'deep', additionalDetails);
    if (result && result.name && result.calories) {
      setPendingFood(result);
      setAdditionalDetails("");
    } else {
      showNotification("Sorry, couldn't refine the estimate. Please try again.");
    }
    setIsRefining(false);
  };

  const triggerScan = (mode: 'quick' | 'deep') => {
    setScanMode(mode);
    setShowLogMenu(false);
    fileInputRef.current?.click();
  };

  const confirmPendingFood = () => {
    if (pendingFood) {
      handleAddFood(pendingFood.name, pendingFood.calories, (pendingFood as any).analysis);
      setPendingFood(null);
      setCurrentBase64(null);
      setAdditionalDetails("");
    }
  };

  const handleToggleDarkMode = async () => {
    if (!user || !userProfile) return;
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    
    const userDocRef = doc(db, 'users', user.uid);
    try {
      await setDoc(userDocRef, { darkMode: newDarkMode }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const handleRestoreStats = async () => {
    if (!user) return;
    
    try {
      // 1. Recalculate Calories from Logs
      const todayCalories = foodLog.reduce((acc, log) => acc + log.calories, 0);
      
      // 2. Find most recent history entry for Goals
      let restoredGoals = {
        caloriesGoal: stats.caloriesGoal,
        waterGoal: stats.waterGoal,
        stepsGoal: stats.stepsGoal,
        exerciseGoal: stats.exerciseGoal
      };

      if (dailyHistory.length > 0) {
        const last = dailyHistory[0]; // Ordered by date desc
        restoredGoals = {
          caloriesGoal: last.caloriesGoal || stats.caloriesGoal,
          waterGoal: last.waterGoal || stats.waterGoal,
          stepsGoal: last.stepsGoal || stats.stepsGoal,
          exerciseGoal: last.exerciseGoal || stats.exerciseGoal
        };
      }

      const newStats = {
        ...stats,
        ...restoredGoals,
        calories: todayCalories
      };

      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, { stats: newStats }, { merge: true });
      setStats(newStats);
      return true;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
      return false;
    }
  };

  const handleUpdateFullProfile = async (profile: UserProfile, newStats: DailyStats) => {
    if (!user) return;
    try {
      const userDocRef = doc(db, 'users', user.uid);
      // Keep existing calories progress but update goals
      const mergedStats = {
        ...newStats,
        calories: stats.calories,
        water: stats.water,
        steps: stats.steps,
        exercise: stats.exercise
      };
      
      await setDoc(userDocRef, { 
        ...profile, 
        stats: mergedStats 
      }, { merge: true });
      
      setUserProfile(profile);
      setStats(mergedStats);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const handleUpgrade = async () => {
    if (!user) {
      showNotification("Please sign in to upgrade", 'error');
      return;
    }
    try {
      const currencyInfo = getCurrencyForLocation(userProfile?.location || "");
      showNotification(`Redirecting to payment (${currencyInfo.symbol}${currencyInfo.amount})...`, 'success');
      await initializePayment(user.email || "", currencyInfo.amount, user.uid, currencyInfo.code);
    } catch (error) {
      showNotification("Failed to start payment. Please try again.", 'error');
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard 
          stats={stats} 
          userProfile={userProfile} 
          foodLog={foodLog} 
          onUpdateStat={handleUpdateStat} 
          onLogMeal={handleAddFood}
          onTriggerScan={() => setShowLogMenu(true)} 
          maxDailyScans={MAX_DAILY_SCANS}
          incrementAiUsage={incrementAiUsage}
          onUpgrade={handleUpgrade}
        />;
      case 'progress':
        return <Progress stats={stats} history={dailyHistory} userProfile={userProfile} darkMode={darkMode} />;
      case 'community':
        return <Community userProfile={userProfile} />;
      case 'profile':
        return <Profile 
          profile={userProfile} 
          history={dailyHistory}
          onReset={() => {
            if (userProfile) {
              setUserProfile({ ...userProfile, onboarded: false });
            }
          }} 
          onRestoreStats={handleRestoreStats}
          onUpdateFullProfile={handleUpdateFullProfile}
          darkMode={darkMode} 
          onToggleDarkMode={handleToggleDarkMode} 
        />;
      default:
        return <Dashboard 
          stats={stats} 
          userProfile={userProfile} 
          foodLog={foodLog}
          onUpdateStat={handleUpdateStat} 
          onLogMeal={handleAddFood}
          onTriggerScan={() => setShowLogMenu(true)} 
          maxDailyScans={MAX_DAILY_SCANS}
          incrementAiUsage={incrementAiUsage}
          onUpgrade={handleUpgrade}
        />;
    }
  };

  if (!isAuthReady) {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 transition-colors duration-300">
        <div className="w-16 h-16 border-4 border-indigo-100 dark:border-slate-800 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
        <p className="text-gray-500 dark:text-slate-400 font-bold uppercase tracking-widest text-xs">Initializing FitAI...</p>
      </div>
    );
  }

  if (user && !isProfileLoaded) {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 transition-colors duration-300">
        <div className="w-16 h-16 border-4 border-indigo-100 dark:border-slate-800 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
        <p className="text-gray-500 dark:text-slate-400 font-bold uppercase tracking-widest text-xs">Loading Profile...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-10 text-center transition-colors duration-300">
        <div className="w-24 h-24 rounded-[32px] bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-black text-4xl shadow-2xl mb-8">
          A
        </div>
        <h1 className="text-4xl font-black text-gray-900 dark:text-white mb-4">Welcome to FitAI</h1>
        <p className="text-gray-500 dark:text-slate-400 mb-12 leading-relaxed">Your smart fitness companion. Log in to track your progress and access personalized AI coaching.</p>
        
        <button 
          onClick={handleLogin}
          className="w-full p-5 bg-white dark:bg-slate-900 border-2 border-gray-100 dark:border-slate-800 rounded-3xl flex items-center justify-center gap-4 hover:bg-gray-50 dark:hover:bg-slate-800 transition-all shadow-sm active:scale-95"
        >
          <LogIn className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          <span className="text-lg font-black text-gray-900 dark:text-white">Sign in with Google</span>
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col relative pb-20 overflow-hidden shadow-xl transition-colors duration-300">
      <input 
        ref={fileInputRef}
        type="file" 
        accept="image/*" 
        className="hidden" 
        onChange={handleImageUpload}
      />
      
      {/* Onboarding Overlay */}
      {isProfileLoaded && !userProfile?.onboarded && (
        <Onboarding onComplete={handleOnboardingComplete} initialProfile={userProfile} />
      )}

      {/* Header */}
      <header className="p-6 flex justify-between items-center bg-transparent z-10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-indigo-100 dark:shadow-indigo-900/20 border-2 border-white dark:border-slate-800">
            {userProfile?.name?.charAt(0) || 'A'}
          </div>
          <div>
            <h2 className="text-[11px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest leading-none mb-1">Good morning,</h2>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white leading-none">{userProfile?.name || 'Alex'}</h1>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="p-2.5 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 text-gray-600 dark:text-slate-400 hover:theme-text transition-colors">
            <Search className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setActiveTab('profile')}
            className={`p-2.5 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 transition-colors ${activeTab === 'profile' ? 'theme-text border-indigo-200 dark:border-indigo-900' : 'text-gray-600 dark:text-slate-400'}`}
          >
            <UserIcon className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 px-6 no-scrollbar overflow-y-auto relative">
        {renderContent()}
      </main>

      {/* Universal Log Menu (Floating over FAB) */}
      <div className="fixed bottom-24 right-6 z-20 flex flex-col items-end gap-3">
        {showLogMenu && (
          <div className="flex flex-col gap-3 mb-2 animate-in slide-in-from-bottom-4 duration-300">
            <button 
              onClick={() => {
                setShowLogMenu(false);
                triggerScan('deep');
              }}
              className="bg-white dark:bg-slate-900 px-5 py-3 rounded-2xl shadow-xl border border-indigo-100 dark:border-indigo-900/30 flex items-center gap-3 text-indigo-600 dark:text-indigo-400 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95"
            >
              <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-900/30 flex items-center justify-center text-rose-500">
                <Camera className="w-4 h-4" />
              </div>
              Scan Image
            </button>
            <button 
              onClick={() => {
                setShowLogMenu(false);
                setAssistantMode('voice');
                setShowFoodAssistant(true);
              }}
              className="bg-white dark:bg-slate-900 px-5 py-3 rounded-2xl shadow-xl border border-indigo-100 dark:border-indigo-900/30 flex items-center gap-3 text-indigo-600 dark:text-indigo-400 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95"
            >
              <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-500">
                <Mic className="w-4 h-4" />
              </div>
              Voice Record
            </button>
            <button 
              onClick={() => {
                setShowLogMenu(false);
                setAssistantMode('text');
                setShowFoodAssistant(true);
              }}
              className="bg-white dark:bg-slate-900 px-5 py-3 rounded-2xl shadow-xl border border-indigo-100 dark:border-indigo-900/30 flex items-center gap-3 text-indigo-600 dark:text-indigo-400 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95"
            >
              <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-500">
                <PenLine className="w-4 h-4" />
              </div>
              Type Meal
            </button>
          </div>
        )}
        <button 
          onClick={() => setShowLogMenu(!showLogMenu)}
          disabled={isScanning}
          className={`w-16 h-16 gradient-bg rounded-[24px] shadow-2xl text-white transition-all transform active:scale-90 hover:scale-105 flex items-center justify-center ${isScanning ? 'opacity-50' : ''}`}
        >
          {isScanning ? (
            <Clock className="w-8 h-8 animate-spin" />
          ) : (
            showLogMenu ? <X className="w-8 h-8" /> : <Plus className="w-8 h-8" />
          )}
        </button>
      </div>

      <FoodAssistant 
        isOpen={showFoodAssistant} 
        onClose={() => setShowFoodAssistant(false)}
        stats={stats}
        userProfile={userProfile}
        foodLog={foodLog}
        onLogMeal={(name, calories, analysis) => {
          handleAddFood(name, calories, analysis);
        }}
        initialMode={assistantMode}
        maxDailyScans={MAX_DAILY_SCANS}
        incrementAiUsage={incrementAiUsage}
      />

      {/* Notification Toast */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[1000] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 min-w-[320px] max-w-[90vw] ${
              notification.type === 'error' 
                ? 'bg-rose-600 text-white shadow-rose-200 dark:shadow-rose-950/40' 
                : notification.type === 'info'
                  ? 'bg-indigo-600 text-white shadow-indigo-200 dark:shadow-indigo-950/40'
                  : 'bg-emerald-600 text-white shadow-emerald-200 dark:shadow-emerald-950/40'
            }`}
          >
            <div className="p-2 bg-white/20 rounded-xl">
              {notification.type === 'error' ? (
                <AlertCircle className="w-5 h-5" />
              ) : notification.type === 'info' ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-5 h-5" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-black uppercase tracking-widest opacity-70 leading-none mb-1">
                {notification.type === 'error' ? 'System Error' : notification.type === 'info' ? 'AI Status' : 'Success'}
              </p>
              <p className="font-bold text-sm leading-snug">{notification.message}</p>
            </div>
            <button onClick={() => setNotification(null)} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Scanning Overlay */}
      {isScanning && (
        <div className="fixed inset-0 bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm z-[100] flex flex-col items-center justify-center animate-in fade-in duration-300">
          <div className="relative">
            <div className="w-24 h-24 border-4 border-indigo-100 dark:border-indigo-900 border-t-indigo-600 rounded-full animate-spin"></div>
            <Sparkles className="w-10 h-10 text-indigo-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
          </div>
          <h3 className="mt-6 text-lg font-bold text-gray-900 dark:text-white">AI {scanMode === 'deep' ? 'Deep' : 'Quick'} Analysis</h3>
          <p className="text-sm text-gray-500 dark:text-slate-400 max-w-[200px] text-center mt-2">
            {scanMode === 'deep' 
              ? 'Performing a detailed nutritional breakdown...' 
              : 'Identifying your meal and estimating calories...'}
          </p>
        </div>
      )}

      {/* AI Confirmation Modal */}
      {pendingFood && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[110] flex items-center justify-center p-6 animate-in fade-in zoom-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full rounded-[32px] p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 gradient-bg"></div>
            <button 
              onClick={() => { setPendingFood(null); setCurrentBase64(null); }}
              className="absolute top-4 right-4 p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>

            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-950/30 rounded-3xl flex items-center justify-center mb-4 transform -rotate-3">
                <Utensils className="w-10 h-10 text-indigo-600 dark:text-indigo-400" />
              </div>
              
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
                <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">AI Detection Successful</span>
              </div>
              
              <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2">{pendingFood.name}</h3>
              
              <div className="bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl px-6 py-3 mb-6">
                <span className="text-3xl font-black text-indigo-600 dark:text-indigo-400">{pendingFood.calories}</span>
                <span className="ml-1 text-sm font-bold text-indigo-400 uppercase">kcal</span>
              </div>

              {/* Refinement Section */}
              <div className="w-full mb-6 text-left">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 block ml-1">Add Details for Accuracy</label>
                <div className="relative">
                  <textarea 
                    value={additionalDetails}
                    onChange={(e) => setAdditionalDetails(e.target.value)}
                    placeholder="e.g. 2 spoons of rice, large milkshake, low-fat..."
                    className="w-full p-4 bg-gray-50 dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none h-20 dark:text-slate-200"
                  />
                  {additionalDetails && (
                    <button 
                      onClick={handleRefineScan}
                      disabled={isRefining}
                      className="absolute bottom-3 right-3 p-2 bg-indigo-600 text-white rounded-xl shadow-md hover:bg-indigo-700 transition-colors disabled:opacity-50"
                    >
                      {isRefining ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 w-full">
                <button 
                  onClick={() => { setPendingFood(null); setCurrentBase64(null); }}
                  className="py-4 rounded-2xl border border-gray-100 dark:border-slate-800 text-gray-500 dark:text-slate-400 font-bold hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Discard
                </button>
                <button 
                  onClick={confirmPendingFood}
                  className="py-4 rounded-2xl gradient-bg text-white font-bold shadow-lg shadow-indigo-100 dark:shadow-indigo-900/20 hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                >
                  <Plus className="w-5 h-5" /> Add to Log
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800 px-6 py-3 flex justify-between items-center z-20 transition-colors duration-300">
        <NavButton active={activeTab === 'dashboard'} icon={<LayoutDashboard />} label="Dashboard" onClick={() => setActiveTab('dashboard')} />
        <NavButton active={activeTab === 'progress'} icon={<BarChart2 />} label="Progress" onClick={() => setActiveTab('progress')} />
        <NavButton active={activeTab === 'community'} icon={<Users />} label="Community" onClick={() => setActiveTab('community')} />
        <NavButton active={activeTab === 'profile'} icon={<UserIcon />} label="Profile" onClick={() => setActiveTab('profile')} />
      </nav>
    </div>
  );
};

interface NavButtonProps {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}

const NavButton: React.FC<NavButtonProps> = ({ active, icon, label, onClick }) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center gap-1 transition-all flex-1 ${active ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300'}`}
  >
    <div className={`p-2 rounded-xl transition-all ${active ? 'bg-indigo-50 dark:bg-indigo-950/30 scale-110' : ''}`}>
      {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { className: 'w-6 h-6' }) : icon}
    </div>
    <span className={`text-[9px] font-black uppercase tracking-widest ${active ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-slate-500'}`}>{label}</span>
    {active && <div className="active-tab-indicator" />}
  </button>
);

export default App;