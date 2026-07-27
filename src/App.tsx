import React, { useState, useRef, useEffect } from 'react';
import Dashboard from './pages/Dashboard';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  BarChart2, 
  Camera, 
  Plus, 
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
  UserCheck,
  AlertCircle,
  CheckCircle2,
  Info,
  Mail,
  Lock,
  Eye,
  EyeOff,
  UserPlus,
  LogOut
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
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
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
    return 15;
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
  const [assistantMode, setAssistantMode] = useState<'voice' | 'text' | 'buffet'>('text');
  const [pendingFood, setPendingFood] = useState<{ isFood?: boolean; name: string, calories: number, analysis?: string } | null>(null);
  const [currentBase64, setCurrentBase64] = useState<string | null>(null);
  const [additionalDetails, setAdditionalDetails] = useState("");
  const [isRefining, setIsRefining] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

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
      const updatePayload: any = { stats: newStats };
      if (key === 'weight') {
        updatePayload.weight = value;
      }
      await setDoc(userDocRef, updatePayload, { merge: true });
      setStats(newStats);
      if (key === 'weight' && userProfile) {
        setUserProfile({ ...userProfile, weight: value });
      }
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

  // Helper for consistent "Scan Day" calculation (resets at 5:00 AM local time)
  const getTodayStr = () => {
    const now = new Date();
    const localNow = new Date(now.getTime() - (5 * 60 * 60 * 1000));
    const year = localNow.getFullYear();
    const month = String(localNow.getMonth() + 1).padStart(2, '0');
    const day = String(localNow.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Firestore Sync
  useEffect(() => {
    if (!user || !isAuthReady) return;

    if (user.uid.startsWith('guest_local_')) {
      setIsProfileLoaded(true);
      return;
    }

    const userDocRef = doc(db, 'users', user.uid);
    
    // Sync Profile & Stats
    const unsubProfile = onSnapshot(userDocRef, async (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as UserProfile & { stats: DailyStats };
        
        // Check for streak reset
        const today = getTodayStr();
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
          const now = new Date();
          const localYesterday = new Date(now.getTime() - (29 * 60 * 60 * 1000)); // (24 + 5) hours back from now? No.
          // Better: Calculate 'yesterday' by taking 'today' logic and subtracting another 24 hours.
          const yDate = new Date(now.getTime() - (5 * 60 * 60 * 1000) - (24 * 60 * 60 * 1000));
          const yYear = yDate.getFullYear();
          const yMonth = String(yDate.getMonth() + 1).padStart(2, '0');
          const yDay = String(yDate.getDate()).padStart(2, '0');
          const yesterdayStr = `${yYear}-${yMonth}-${yDay}`;

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
      console.warn("User profile sync error:", error);
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
      setIsProfileLoaded(true);
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

  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    setLoginLoading(true);
    setLoginError(null);

    // Timeout guard so the UI never hangs indefinitely in WebViews or APK wrappers
    const timeoutId = setTimeout(() => {
      setLoginLoading(false);
      const errMsg = "Google Sign-In popup timed out. Google blocks web popups inside Android APK WebViews. Please sign in with Email & Password or Guest Mode above!";
      setLoginError(errMsg);
      showNotification(errMsg, 'error');
    }, 10000);

    try {
      await signInWithPopup(auth, googleProvider);
      clearTimeout(timeoutId);
    } catch (error: any) {
      clearTimeout(timeoutId);
      console.error("Login failed", error);
      let errMsg = error.message || "Failed to sign in.";
      if (error.code === 'auth/unauthorized-domain') {
        errMsg = `Google Sign-In is not allowed on this domain (${window.location.hostname}) until added to Firebase Authorized Domains. Use Email & Password or Guest Sign-In below!`;
      } else if (error.code === 'auth/popup-blocked' || error.code === 'auth/operation-not-supported-in-this-environment') {
        errMsg = "Sign-in popup was blocked or not supported in this app environment / APK. Please use Email & Password or Guest Sign-In above!";
      } else if (error.code === 'auth/popup-closed-by-user') {
        errMsg = "Sign-in popup was closed before completing.";
      }
      setLoginError(errMsg);
      showNotification(errMsg, 'error');
    } finally {
      clearTimeout(timeoutId);
      setLoginLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setLoginError("Please enter both email and password.");
      return;
    }
    setLoginLoading(true);
    setLoginError(null);

    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
        showNotification("Account created successfully!", "success");
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
        showNotification("Logged in successfully!", "success");
      }
    } catch (error: any) {
      console.error("Email auth error:", error);
      let errMsg = "Authentication failed. Please check your credentials.";
      if (error.code === 'auth/email-already-in-use') {
        errMsg = "An account with this email already exists. Switched to Sign In mode for you!";
        setIsSignUp(false);
      } else if (error.code === 'auth/invalid-email') {
        errMsg = "Please enter a valid email address.";
      } else if (error.code === 'auth/weak-password') {
        errMsg = "Password should be at least 6 characters long.";
      } else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        errMsg = "Incorrect email or password. If you don't have an account yet, click 'Create Account' above.";
      } else if (error.message) {
        errMsg = error.message;
      }
      setLoginError(errMsg);
      showNotification(errMsg, 'error');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email.trim()) {
      setLoginError("Please enter your email address above to receive a password reset link.");
      showNotification("Please enter your email address first.", "info");
      return;
    }
    setLoginLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      showNotification("Password reset email sent! Check your inbox.", "success");
      setLoginError(null);
    } catch (error: any) {
      let errMsg = "Failed to send password reset email.";
      if (error.code === 'auth/user-not-found') {
        errMsg = "No account found with this email address.";
      } else if (error.code === 'auth/invalid-email') {
        errMsg = "Please enter a valid email address.";
      } else if (error.message) {
        errMsg = error.message;
      }
      setLoginError(errMsg);
      showNotification(errMsg, 'error');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setLoginLoading(true);
    setLoginError(null);
    
    // 1. First attempt: Firebase Anonymous Auth
    try {
      await signInAnonymously(auth);
      showNotification("Signed in as Guest", "info");
      setLoginLoading(false);
      return;
    } catch (error: any) {
      console.warn("signInAnonymously failed, attempting guest email account fallback...", error);
    }

    // 2. Fallback attempt: Create a random guest account using email/password provider
    try {
      const guestEmail = `guest_${Date.now()}_${Math.floor(Math.random() * 10000)}@fitai.app`;
      const guestPass = `Guest${Math.floor(Math.random() * 1000000)}!`;
      await createUserWithEmailAndPassword(auth, guestEmail, guestPass);
      showNotification("Signed in as Guest", "info");
      setLoginLoading(false);
      return;
    } catch (fallbackError: any) {
      console.warn("createUserWithEmailAndPassword fallback failed, attempting shared guest account...", fallbackError);
    }

    // 3. Fallback attempt: Try existing shared guest account or create it
    try {
      await signInWithEmailAndPassword(auth, 'guest_demo@fitai.app', 'GuestDemo123!');
      showNotification("Signed in as Guest", "info");
      setLoginLoading(false);
      return;
    } catch (sharedErr: any) {
      if (sharedErr.code === 'auth/user-not-found' || sharedErr.code === 'auth/invalid-credential') {
        try {
          await createUserWithEmailAndPassword(auth, 'guest_demo@fitai.app', 'GuestDemo123!');
          showNotification("Signed in as Guest", "info");
          setLoginLoading(false);
          return;
        } catch (createSharedErr) {
          console.warn("Could not create shared guest account", createSharedErr);
        }
      }
    }

    // 4. Final safety net: Synthetic local guest session
    try {
      const syntheticUser = {
        uid: `guest_local_${Date.now()}`,
        email: 'guest@fitai.app',
        displayName: 'Guest User',
        isAnonymous: true,
      } as unknown as User;
      setUser(syntheticUser);
      setIsAuthReady(true);
      setIsProfileLoaded(true);
      showNotification("Signed in as Guest Mode", "info");
    } catch (finalErr: any) {
      console.error("All guest sign-in strategies failed", finalErr);
      const errMsg = "Guest sign-in failed. Please try Email Sign In.";
      setLoginError(errMsg);
      showNotification(errMsg, 'error');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleOnboardingComplete = async (profile: UserProfile, initialStats: DailyStats) => {
    const today = getTodayStr();
    const profileWithResetDate: UserProfile = {
      ...profile,
      onboarded: true,
      hasAcceptedTerms: true,
      lastStatsResetDate: today
    };

    // Update local React state immediately so UI dismisses Onboarding modal without waiting
    setUserProfile(profileWithResetDate);
    setStats(initialStats);

    if (user && !user.uid.startsWith('guest_local_')) {
      try {
        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, {
          ...profileWithResetDate,
          stats: initialStats
        }, { merge: true });
      } catch (error) {
        console.warn("Could not save user onboarding data to Firestore (Guest/Offline mode):", error);
      }
    }
  };

  const handleUpdateStat = async (key: keyof DailyStats, value: number) => {
    if (!user) return;
    
    const newStats = { ...stats, [key]: value };
    
    // Update streak
    const today = getTodayStr();
    let newStreak = userProfile?.streak || 0;
    let newLastActivityDate = userProfile?.lastActivityDate;

    if (newLastActivityDate !== today) {
      const now = new Date();
      const yDate = new Date(now.getTime() - (5 * 60 * 60 * 1000) - (24 * 60 * 60 * 1000));
      const yYear = yDate.getFullYear();
      const yMonth = String(yDate.getMonth() + 1).padStart(2, '0');
      const yDay = String(yDate.getDate()).padStart(2, '0');
      const yesterdayStr = `${yYear}-${yMonth}-${yDay}`;

      if (newLastActivityDate === yesterdayStr) {
        newStreak += 1;
      } else {
        newStreak = 1;
      }
      newLastActivityDate = today;
    }

    // Immediate local state update
    setStats(newStats);
    if (userProfile) {
      setUserProfile({ 
        ...userProfile, 
        streak: newStreak, 
        lastActivityDate: newLastActivityDate,
        weight: key === 'weight' ? value : userProfile.weight
      });
    }

    if (!user.uid.startsWith('guest_local_')) {
      try {
        const userDocRef = doc(db, 'users', user.uid);
        const updatePayload: any = { 
          stats: newStats, 
          streak: newStreak, 
          lastActivityDate: newLastActivityDate 
        };

        if (key === 'weight') {
          updatePayload.weight = value;
        }

        await setDoc(userDocRef, updatePayload, { merge: true });
      } catch (error) {
        console.warn("Could not sync stat update to Firestore:", error);
      }
    }
  };

  const handleAddFood = async (name: string, calories: number, analysis?: string) => {
    if (!user) return;

    const newStats = { ...stats, calories: stats.calories + calories };
    const today = getTodayStr();
    let newStreak = userProfile?.streak || 0;
    let newLastActivityDate = userProfile?.lastActivityDate;

    if (newLastActivityDate !== today) {
      const now = new Date();
      const yDate = new Date(now.getTime() - (5 * 60 * 60 * 1000) - (24 * 60 * 60 * 1000));
      const yYear = yDate.getFullYear();
      const yMonth = String(yDate.getMonth() + 1).padStart(2, '0');
      const yDay = String(yDate.getDate()).padStart(2, '0');
      const yesterdayStr = `${yYear}-${yMonth}-${yDay}`;

      if (newLastActivityDate === yesterdayStr) {
        newStreak += 1;
      } else {
        newStreak = 1;
      }
      newLastActivityDate = today;
    }

    // Immediate local state update
    setStats(newStats);
    if (userProfile) {
      setUserProfile({ ...userProfile, streak: newStreak, lastActivityDate: newLastActivityDate });
    }
    const localEntry: FoodLogEntry = { id: `log_${Date.now()}`, name, calories, timestamp: new Date() };
    setFoodLog(prev => [localEntry, ...prev]);

    if (!user.uid.startsWith('guest_local_')) {
      try {
        const foodLogsRef = collection(db, 'users', user.uid, 'foodLogs');
        const newEntry = { name, calories, analysis: analysis || "", timestamp: new Date() };
        await setDoc(doc(foodLogsRef), newEntry);
        
        const userDocRef = doc(db, 'users', user.uid);
        await setDoc(userDocRef, { 
          stats: newStats, 
          streak: newStreak, 
          lastActivityDate: newLastActivityDate 
        }, { merge: true });
      } catch (error) {
        console.warn("Could not sync food log to Firestore:", error);
      }
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
    
    const today = getTodayStr();
    const now = new Date();
    
    let currentScansCount = userProfile?.dailyScansCount || 0;
    const lastScanDate = userProfile?.lastScanDate;

    // Reset count if it's a new "Scan Day" (past 5:00 AM since last reset)
    if (lastScanDate !== today) {
      currentScansCount = 0;
    }

    if (currentScansCount >= MAX_DAILY_SCANS) {
      const message = userProfile?.tier === 'premium' 
        ? "Wow! You've used a lot of AI today. Take a breather!" 
        : `Daily limit reached (${MAX_DAILY_SCANS}/${MAX_DAILY_SCANS}). Reset at 5:00 AM.`;
      showNotification(message, 'error');
      return false;
    }

    const userDocRef = doc(db, 'users', user.uid);
    const nextCount = currentScansCount + 1;
    await setDoc(userDocRef, { 
      dailyScansCount: nextCount,
      lastScanDate: today,
      lastScanTimestamp: now.toISOString()
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
            if (result) {
              setPendingFood({
                isFood: result.isFood,
                name: result.name || "Scanned Item",
                calories: result.calories ?? 0,
                analysis: result.analysis || ""
              });
            } else {
              showNotification("Could not analyze image. Please try again with a clearer photo.");
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
    try {
      const result = await scanFoodImage(currentBase64, 'deep', additionalDetails);
      if (result) {
        setPendingFood({
          isFood: result.isFood,
          name: result.name || "Scanned Item",
          calories: result.calories ?? 0,
          analysis: result.analysis || ""
        });
        setAdditionalDetails("");
      } else {
        showNotification("Couldn't refine scan. Please try again.");
      }
    } catch (err: any) {
      console.error("Refine scan error:", err);
    } finally {
      setIsRefining(false);
    }
  };

  const triggerScan = (mode: 'quick' | 'deep', source: 'camera' | 'gallery' = 'camera') => {
    setScanMode(mode);
    setShowLogMenu(false);
    if (source === 'camera') {
      if (cameraInputRef.current) {
        cameraInputRef.current.click();
      } else {
        fileInputRef.current?.click();
      }
    } else {
      fileInputRef.current?.click();
    }
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

  const isGuest = Boolean(
    user && (
      user.isAnonymous ||
      user.uid?.startsWith('guest_local_') ||
      user.email?.toLowerCase().includes('guest') ||
      user.displayName?.toLowerCase().includes('guest')
    )
  );

  const handleSignOut = async () => {
    try {
      await auth.signOut();
    } catch (err) {
      console.warn("Sign out warning:", err);
    }
    setUser(null);
    setUserProfile(null);
    setIsProfileLoaded(false);
    setActiveTab('dashboard');
    showNotification("Exited session", "info");
  };

  const handleOpenAuth = async (mode: 'signin' | 'signup' = 'signup') => {
    try {
      await auth.signOut();
    } catch (err) {
      console.warn("Sign out warning:", err);
    }
    setUser(null);
    setUserProfile(null);
    setIsProfileLoaded(false);
    setIsSignUp(mode === 'signup');
    setActiveTab('dashboard');
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
          isGuest={isGuest}
          onReset={() => {
            if (userProfile) {
              setUserProfile({ ...userProfile, onboarded: false });
            }
          }} 
          onRestoreStats={handleRestoreStats}
          onUpdateFullProfile={handleUpdateFullProfile}
          darkMode={darkMode} 
          onToggleDarkMode={handleToggleDarkMode} 
          onSignOut={handleSignOut}
          onOpenAuth={handleOpenAuth}
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
      <div className="max-w-md mx-auto min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-center transition-colors duration-300 relative overflow-hidden">
        {/* Background Decorative Glow */}
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="w-16 h-16 rounded-[24px] bg-gradient-to-tr from-indigo-500 via-indigo-600 to-purple-500 flex items-center justify-center text-white font-black text-2xl shadow-xl shadow-indigo-500/20 mb-4 border-2 border-white/20">
          A
        </div>
        <h1 className="text-2xl font-black text-gray-900 dark:text-white mb-2">Welcome to FitAI</h1>
        <p className="text-gray-500 dark:text-slate-400 mb-6 leading-relaxed text-xs max-w-xs">
          Your AI fitness companion. Sign in or create an account to start tracking meals and workouts.
        </p>

        {/* Login Error Banner */}
        {loginError && (
          <div className="w-full mb-5 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300 text-xs font-semibold text-left flex items-start gap-3 animate-in fade-in duration-300">
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <div className="flex-1 leading-normal">
              <p className="font-bold mb-0.5 text-rose-800 dark:text-rose-200">Unable to Sign In</p>
              <p>{loginError}</p>
            </div>
          </div>
        )}

        {/* Email / Password Form Card */}
        <div className="w-full bg-white dark:bg-slate-900 border border-gray-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm mb-4 text-left">
          {/* Mode Switcher Tabs */}
          <div className="flex bg-gray-100 dark:bg-slate-800 p-1 rounded-2xl mb-4">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(false);
                setLoginError(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                !isSignUp
                  ? 'bg-white dark:bg-slate-900 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setIsSignUp(true);
                setLoginError(null);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                isSignUp
                  ? 'bg-white dark:bg-slate-900 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-3">
            <div>
              <label className="block text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input 
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700/80 rounded-xl text-sm font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-[11px] font-bold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  Password
                </label>
                {!isSignUp && (
                  <button
                    type="button"
                    onClick={handleResetPassword}
                    className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input 
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 bg-gray-50 dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700/80 rounded-xl text-sm font-medium text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button 
              type="submit"
              disabled={loginLoading}
              className="w-full mt-2 py-3 bg-indigo-600 text-white rounded-xl flex items-center justify-center gap-2 font-bold hover:bg-indigo-700 transition-all shadow-md shadow-indigo-600/20 active:scale-95 disabled:opacity-50 text-sm"
            >
              {loginLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : isSignUp ? (
                <UserPlus className="w-4 h-4" />
              ) : (
                <LogIn className="w-4 h-4" />
              )}
              <span>{isSignUp ? 'Create Account with Email' : 'Sign In with Email'}</span>
            </button>
          </form>
        </div>

        {/* Divider */}
        <div className="w-full flex items-center gap-3 my-2">
          <div className="flex-1 h-px bg-gray-200 dark:bg-slate-800" />
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">or</span>
          <div className="flex-1 h-px bg-gray-200 dark:bg-slate-800" />
        </div>

        {/* Alternative Actions */}
        <div className="w-full space-y-2 mt-2">
          <button 
            onClick={handleLogin}
            disabled={loginLoading}
            className="w-full p-3.5 bg-white dark:bg-slate-900 text-gray-800 dark:text-slate-100 border border-gray-200 dark:border-slate-800 rounded-2xl flex items-center justify-center gap-3 font-bold hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-all shadow-sm active:scale-95 disabled:opacity-50 text-sm"
          >
            {loginLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <LogIn className="w-4 h-4 text-indigo-500" />
            )}
            <span>Sign in with Google</span>
          </button>

          <button 
            onClick={handleGuestLogin}
            disabled={loginLoading}
            className="w-full p-3.5 bg-gray-100 dark:bg-slate-800/50 text-gray-700 dark:text-slate-300 rounded-2xl flex items-center justify-center gap-3 font-semibold hover:bg-gray-200/80 dark:hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50 text-xs"
          >
            {loginLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin text-purple-500" />
            ) : (
              <UserCheck className="w-4 h-4 text-purple-500" />
            )}
            <span>Continue as Guest</span>
          </button>
        </div>

        <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-4 leading-normal">
          Using as a <strong>Mobile APK / App</strong> or custom domain? Use <strong>Email Sign In</strong> or <strong>Guest Mode</strong> for instant access.
        </p>

        {/* Notification Toast on Login Screen */}
        <AnimatePresence>
          {notification && (
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[1000] px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 min-w-[280px] max-w-[90vw] ${
                notification.type === 'error' 
                  ? 'bg-rose-600 text-white shadow-rose-200 dark:shadow-rose-950/40' 
                  : notification.type === 'info'
                    ? 'bg-indigo-600 text-white shadow-indigo-200 dark:shadow-indigo-950/40'
                    : 'bg-emerald-600 text-white shadow-emerald-200 dark:shadow-emerald-950/40'
              }`}
            >
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="font-semibold text-xs leading-snug flex-1">{notification.message}</p>
              <button onClick={() => setNotification(null)} className="p-1 hover:bg-white/10 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col relative pb-20 overflow-hidden shadow-xl transition-colors duration-300">
      <input 
        ref={cameraInputRef}
        type="file" 
        accept="image/*" 
        capture="environment"
        className="hidden" 
        onChange={handleImageUpload}
      />
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
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-indigo-100 dark:shadow-indigo-900/20 border-2 border-white dark:border-slate-800 shrink-0">
            {userProfile?.name?.charAt(0) || 'G'}
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <h2 className="text-[11px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest leading-none">Good morning,</h2>
              {isGuest && (
                <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[9px] font-black uppercase tracking-wider rounded-full border border-amber-200 dark:border-amber-800/60 leading-none">
                  Guest
                </span>
              )}
            </div>
            <h1 className="text-2xl font-black text-gray-900 dark:text-white leading-none">{userProfile?.name || 'Guest User'}</h1>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          {isGuest && (
            <button 
              onClick={() => handleOpenAuth('signup')}
              className="px-3 py-2 bg-indigo-600 text-white rounded-xl font-black text-[11px] uppercase tracking-wider shadow-md shadow-indigo-600/20 hover:bg-indigo-700 active:scale-95 transition-all flex items-center gap-1.5 shrink-0"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Up / Sign In</span>
              <span className="sm:hidden">Sign In</span>
            </button>
          )}
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
                triggerScan('deep', 'camera');
              }}
              className="bg-white dark:bg-slate-900 px-5 py-3 rounded-2xl shadow-xl border border-indigo-100 dark:border-indigo-900/30 flex items-center gap-3 text-indigo-600 dark:text-indigo-400 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95"
            >
              <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Camera className="w-4 h-4" />
              </div>
              Snap Photo with Camera
            </button>
            <button 
              onClick={() => {
                setShowLogMenu(false);
                setAssistantMode('buffet');
                setShowFoodAssistant(true);
              }}
              className="bg-white dark:bg-slate-900 px-5 py-3 rounded-2xl shadow-xl border border-indigo-100 dark:border-indigo-900/30 flex items-center gap-3 text-indigo-600 dark:text-indigo-400 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95"
            >
              <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center text-purple-500">
                <Sparkles className="w-4 h-4" />
              </div>
              AI Camera Scanner
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
              Log Meal by Typing
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
              onClick={() => { setPendingFood(null); setCurrentBase64(null); setAdditionalDetails(""); }}
              className="absolute top-4 right-4 p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>

            {pendingFood.isFood === false ? (
              <div className="flex flex-col items-center text-center">
                <div className="w-20 h-20 bg-amber-50 dark:bg-amber-950/40 rounded-3xl flex items-center justify-center mb-4 transform -rotate-3 text-amber-500">
                  <Info className="w-10 h-10" />
                </div>
                
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest">No Calories to Check</span>
                </div>
                
                <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2">{pendingFood.name || "Non-Food Item"}</h3>
                
                <div className="bg-amber-50 dark:bg-amber-950/30 rounded-2xl px-5 py-3 mb-5 border border-amber-200/60 dark:border-amber-900/40">
                  <p className="text-xs text-amber-800 dark:text-amber-200 font-semibold leading-relaxed">
                    {pendingFood.analysis || "There are no calories to check for here! Non-food objects like tables, humans, or furniture don't contain food calories."}
                  </p>
                </div>

                {/* Refinement Section */}
                <div className="w-full mb-5 text-left">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 block ml-1">Is there food in the photo? Add details:</label>
                  <div className="relative">
                    <textarea 
                      value={additionalDetails}
                      onChange={(e) => setAdditionalDetails(e.target.value)}
                      placeholder="e.g. There is a bowl of soup on the table..."
                      className="w-full p-3.5 bg-gray-50 dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none h-16 dark:text-slate-200"
                    />
                    {additionalDetails && (
                      <button 
                        onClick={handleRefineScan}
                        disabled={isRefining}
                        className="absolute bottom-2.5 right-2.5 p-2 bg-indigo-600 text-white rounded-xl shadow-md hover:bg-indigo-700 transition-colors disabled:opacity-50"
                      >
                        {isRefining ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 w-full">
                  <button 
                    onClick={() => { setPendingFood(null); setCurrentBase64(null); setAdditionalDetails(""); }}
                    className="py-3.5 rounded-2xl border border-gray-100 dark:border-slate-800 text-gray-500 dark:text-slate-400 font-bold hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors text-xs"
                  >
                    Dismiss
                  </button>
                  <button 
                    onClick={() => {
                      setPendingFood(null);
                      setCurrentBase64(null);
                      setAdditionalDetails("");
                      triggerScan('deep', 'camera');
                    }}
                    className="py-3.5 rounded-2xl bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-100 dark:shadow-indigo-900/20 hover:bg-indigo-700 transition-colors text-xs flex items-center justify-center gap-2"
                  >
                    <Camera className="w-4 h-4" /> Snap Food Photo
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center text-center">
                <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-950/30 rounded-3xl flex items-center justify-center mb-4 transform -rotate-3">
                  <Utensils className="w-10 h-10 text-indigo-600 dark:text-indigo-400" />
                </div>
                
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
                  <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">
                    {pendingFood.calories === 0 ? "Zero-Calorie / Hydration Detected" : "AI Detection Successful"}
                  </span>
                </div>
                
                <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2">{pendingFood.name}</h3>
                
                <div className="bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl px-6 py-3 mb-4">
                  <span className="text-3xl font-black text-indigo-600 dark:text-indigo-400">{pendingFood.calories}</span>
                  <span className="ml-1 text-sm font-bold text-indigo-400 uppercase">kcal</span>
                </div>

                {pendingFood.analysis && (
                  <p className="text-xs text-slate-600 dark:text-slate-300 font-medium mb-4 px-2">
                    {pendingFood.analysis}
                  </p>
                )}

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
                    onClick={() => { setPendingFood(null); setCurrentBase64(null); setAdditionalDetails(""); }}
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
            )}
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