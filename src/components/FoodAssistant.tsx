
import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, 
  X, 
  Sparkles, 
  Loader2,
  Utensils,
  History,
  Info,
  Zap,
  MessageSquare
} from 'lucide-react';
import { processVoiceMeal, analyzeBuffet } from '../services/geminiService';
import { DailyStats, UserProfile, FoodLogEntry } from '../types';
import ReactMarkdown from 'react-markdown';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  stats: DailyStats;
  userProfile: UserProfile | null;
  foodLog: FoodLogEntry[];
  onLogMeal: (name: string, calories: number, analysis?: string) => void;
  initialMode?: 'voice' | 'text';
  maxDailyScans: number;
  incrementAiUsage: () => Promise<boolean>;
}

const FoodAssistant: React.FC<Props> = ({ isOpen, onClose, stats, userProfile, foodLog, onLogMeal, initialMode = 'text', maxDailyScans, incrementAiUsage }) => {
  const [activeTab, setActiveTab] = useState<'text' | 'buffet'>('text');
  const [transcription, setTranscription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const [result, setResult] = useState<{ 
    intent?: string;
    response?: string;
    advice?: string; 
    mealName?: string | null; 
    calories: number; 
    analysis?: string 
  } | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    setTranscription("");
    setResult(null);

    if (activeTab === 'buffet') {
      startCamera();
    } else {
      stopCamera();
    }
  }, [isOpen, activeTab]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const handleProcessText = async () => {
    if (!transcription.trim()) return;
    
    // Check usage
    const canProcess = await incrementAiUsage();
    if (!canProcess) return;

    setIsLoading(true);
    setResult(null);
    setError(null);
    try {
      const data = await processVoiceMeal(transcription, stats, userProfile, foodLog);
      if (data) {
        setResult(data);
      } else {
        setError("AI was unable to process your request. Please try again with more detail.");
      }
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleScanBuffet = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    // Check usage
    const canProcess = await incrementAiUsage();
    if (!canProcess) return;

    setIsLoading(true);
    setResult(null);

    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    const MAX_DIM = 512;
    let width = video.videoWidth;
    let height = video.videoHeight;
    
    if (width > height) {
      if (width > MAX_DIM) {
        height *= MAX_DIM / width;
        width = MAX_DIM;
      }
    } else {
      if (height > MAX_DIM) {
        width *= MAX_DIM / height;
        height = MAX_DIM;
      }
    }

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(video, 0, 0, width, height);

    const base64Data = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
    
    try {
      const remaining = stats.caloriesGoal - stats.calories;
      const data = await analyzeBuffet(base64Data, remaining > 0 ? remaining : 500, userProfile);
      if (data) {
        setResult({
          advice: data.advice,
          calories: data.estimatedCalories,
          mealName: "Buffet Selection"
        });
      }
    } catch (err: any) {
      console.error(err);
      setError(`Buffet Scan failed: ${err.message || 'AI was unable to scan the image. Please try again.'}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const now = new Date();
  const scanDayDate = new Date(now.getTime() - (5 * 60 * 60 * 1000));
  const today = scanDayDate.toISOString().split('T')[0];
  const scanCountToday = userProfile?.lastScanDate === today ? (userProfile?.dailyScansCount || 0) : 0;
  const remainingScans = Math.max(0, maxDailyScans - scanCountToday);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[200] flex items-end sm:items-center justify-center animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg sm:rounded-[40px] rounded-t-[40px] p-8 shadow-2xl relative flex flex-col max-h-[90vh] overflow-hidden">
        <button onClick={onClose} className="absolute top-6 right-6 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors z-10">
          <X className="w-6 h-6 text-slate-400" />
        </button>

        <div className="flex justify-between items-start mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-100 dark:shadow-indigo-900/30">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white leading-none">FitAI Assistant</h2>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-1">Smart Health Companion</p>
            </div>
          </div>
          <div className={`flex flex-col items-end gap-1 p-2.5 rounded-2xl border shadow-sm ${
            remainingScans === 0 
              ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-100 dark:border-rose-900/30' 
              : 'bg-indigo-50 dark:bg-indigo-950/20 border-indigo-100 dark:border-indigo-900/30'
          }`}>
            <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-tighter bg-indigo-100 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md self-end">Free Tier</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Zap className={`w-3 h-3 ${remainingScans === 0 ? 'text-rose-400' : 'text-amber-500 fill-amber-500'}`} />
              <span className={`text-xs font-black ${remainingScans === 0 ? 'text-rose-600' : 'text-slate-700 dark:text-slate-200'}`}>
                {remainingScans}/{maxDailyScans} Uses Left
              </span>
            </div>
          </div>
        </div>

        <div className="flex bg-slate-50 dark:bg-slate-800 p-1.5 rounded-2xl mb-8 shrink-0">
          <button 
            onClick={() => setActiveTab('text')}
            className={`flex-1 py-3 rounded-xl text-sm font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
              activeTab === 'text' 
              ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' 
              : 'text-slate-500'
            }`}
          >
            <MessageSquare className="w-4 h-4" /> Log Meal
          </button>
          <button 
            onClick={() => setActiveTab('buffet')}
            className={`flex-1 py-3 rounded-xl text-sm font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
              activeTab === 'buffet' 
              ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' 
              : 'text-slate-500'
            }`}
          >
            <Camera className="w-4 h-4" /> Buffet Scanner
          </button>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar pb-6 space-y-6">
          {activeTab === 'text' && (
            <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
              <div className="space-y-4">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">What did you eat?</label>
                </div>
                <textarea 
                  value={transcription}
                  onChange={(e) => setTranscription(e.target.value)}
                  placeholder="e.g., I had 2 boiled eggs and a bowl of oatmeal with berries..."
                  className="w-full p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none h-32"
                  autoFocus
                />
              </div>

              {error && (
                <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/30 rounded-2xl text-rose-600 dark:text-rose-400 text-sm font-medium">
                  {error}
                </div>
              )}

              {transcription && !result && (
                <button 
                  onClick={handleProcessText}
                  disabled={isLoading}
                  className="w-full py-4 gradient-bg text-white font-black rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 dark:shadow-indigo-900/30 disabled:opacity-50 transition-all hover:scale-[1.02] active:scale-95"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                  {isLoading ? "Analyzing..." : "Estimate Calories with AI"}
                </button>
              )}
            </div>
          )}

          {activeTab === 'buffet' && (
            <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-300">
              <div className="relative aspect-[4/3] bg-slate-900 rounded-[32px] overflow-hidden border-4 border-white dark:border-slate-800 shadow-xl group">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-48 h-48 border-2 border-white/50 rounded-[40px] opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </div>
                <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full">
                  <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></div>
                  <span className="text-[10px] font-black text-white uppercase tracking-widest">Live Scanner</span>
                </div>
              </div>

              <button 
                onClick={handleScanBuffet}
                disabled={isLoading}
                className="w-full py-6 bg-slate-900 dark:bg-indigo-600 text-white font-black rounded-3xl flex items-center justify-center gap-4 shadow-xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                      <Sparkles className="w-6 h-6 border-transparent" />
                    </div>
                    <div>
                      <p className="text-lg">Point & Scan Buffet</p>
                      <p className="text-white/50 text-[10px] uppercase tracking-widest">Get Live Dining Advice</p>
                    </div>
                  </>
                )}
              </button>
              <canvas ref={canvasRef} className="hidden" />
            </div>
          )}

          {result && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500 pt-4 border-t border-slate-100 dark:border-slate-800">
              {result.response ? (
                <div className="bg-indigo-50/50 dark:bg-indigo-950/20 p-6 rounded-3xl border border-indigo-100/50 dark:border-indigo-900/30">
                  <div className="flex items-center justify-between mb-3 text-indigo-600 dark:text-indigo-400">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest">AI Response</span>
                    </div>
                  </div>
                  <div className="prose prose-sm prose-slate dark:prose-invert max-w-none">
                    <ReactMarkdown>{result.response}</ReactMarkdown>
                  </div>
                </div>
              ) : result.analysis ? (
                <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                  {result.analysis}
                </div>
              ) : null}

              {result.mealName && (
                <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-800/50">
                  <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950/30 flex items-center justify-center text-orange-500 shrink-0">
                    <Utensils className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-black text-slate-900 dark:text-white text-base">{result.mealName}</h4>
                    <p className="text-orange-500 font-black text-[10px] uppercase tracking-widest">{result.calories} kcal estimated</p>
                  </div>
                </div>
              )}

              {result.advice && (
                <div className="bg-indigo-50/50 dark:bg-indigo-950/20 p-6 rounded-3xl border border-indigo-100/50 dark:border-indigo-900/30">
                  <div className="flex items-center gap-2 mb-3 text-indigo-600 dark:text-indigo-400">
                    <Info className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">AI Expert Advice</span>
                  </div>
                  <div className="prose prose-sm prose-slate dark:prose-invert max-w-none">
                    <ReactMarkdown>{result.advice}</ReactMarkdown>
                  </div>
                </div>
              )}

              {result.mealName && (
                <button 
                  onClick={() => {
                    onLogMeal(result.mealName!, result.calories, result.analysis);
                    onClose();
                    setResult(null);
                    setTranscription("");
                  }}
                  className="w-full py-4 bg-emerald-500 text-white font-black rounded-2xl shadow-lg shadow-emerald-100 dark:shadow-emerald-900/20 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  Confirm & Log Calories
                </button>
              )}
              
              {!result.mealName && result.response && (
                <button 
                  onClick={() => {
                    setResult(null);
                    setTranscription("");
                  }}
                  className="w-full py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                >
                  Ask Another Question
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FoodAssistant;
