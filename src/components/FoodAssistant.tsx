import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, 
  X, 
  Sparkles, 
  Loader2,
  Utensils,
  Info,
  Zap,
  MessageSquare,
  Image as ImageIcon,
  RotateCcw,
  Check,
  AlertCircle
} from 'lucide-react';
import { processVoiceMeal, analyzeBuffet, scanFoodImage } from '../services/geminiService';
import { DailyStats, UserProfile, FoodLogEntry } from '../types';
import ReactMarkdown from 'react-markdown';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  stats: DailyStats;
  userProfile: UserProfile | null;
  foodLog: FoodLogEntry[];
  onLogMeal: (name: string, calories: number, analysis?: string) => void;
  initialMode?: 'voice' | 'text' | 'buffet';
  maxDailyScans: number;
  incrementAiUsage: () => Promise<boolean>;
}

const FoodAssistant: React.FC<Props> = ({ 
  isOpen, 
  onClose, 
  stats, 
  userProfile, 
  foodLog, 
  onLogMeal, 
  initialMode = 'text', 
  maxDailyScans, 
  incrementAiUsage 
}) => {
  const [activeTab, setActiveTab] = useState<'text' | 'buffet'>('text');
  const [transcription, setTranscription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Photo & Camera State
  const [selectedImageBase64, setSelectedImageBase64] = useState<string | null>(null);
  const [selectedImagePreview, setSelectedImagePreview] = useState<string | null>(null);
  const [extraNotes, setExtraNotes] = useState("");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  
  const [result, setResult] = useState<{ 
    intent?: string;
    response?: string;
    advice?: string; 
    mealName?: string | null; 
    calories: number; 
    analysis?: string;
    isFood?: boolean;
  } | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      resetPhotoState();
      return;
    }

    setTranscription("");
    setResult(null);
    setError(null);

    if (initialMode === 'buffet') {
      setActiveTab('buffet');
    }

    if (activeTab === 'buffet' && !selectedImagePreview) {
      startCamera();
    } else {
      stopCamera();
    }
  }, [isOpen, activeTab]);

  const resetPhotoState = () => {
    setSelectedImageBase64(null);
    setSelectedImagePreview(null);
    setExtraNotes("");
  };

  const startCamera = async () => {
    setCameraError(null);
    setCameraActive(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: { ideal: 'environment' } } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
      }
    } catch (err) {
      console.warn("Could not access live camera stream:", err);
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          setCameraActive(true);
        }
      } catch (fallbackErr) {
        console.warn("Camera fallback failed:", fallbackErr);
        setCameraError("Live video stream is unavailable on this browser. Use the Snap Photo or Gallery buttons below!");
      }
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const img = new Image();
      img.src = reader.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 640;
        let width = img.width;
        let height = img.height;
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
        ctx?.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        const base64 = dataUrl.split(',')[1];
        
        setSelectedImagePreview(dataUrl);
        setSelectedImageBase64(base64);
        setResult(null);
        setError(null);
        stopCamera();
      };
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleProcessText = async () => {
    if (!transcription.trim()) return;
    
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
    } catch (err: any) {
      console.error(err);
      setError("Something went wrong. Please check your connection and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnalyzePhoto = async () => {
    if (!selectedImageBase64) return;

    const canProcess = await incrementAiUsage();
    if (!canProcess) return;

    setIsLoading(true);
    setResult(null);
    setError(null);

    try {
      const data = await scanFoodImage(selectedImageBase64, 'deep', extraNotes);
      if (data) {
        setResult({
          isFood: data.isFood,
          mealName: data.name,
          calories: data.calories,
          analysis: data.analysis,
          advice: data.analysis
        });
      } else {
        setError("AI was unable to scan this photo. Please try another picture.");
      }
    } catch (err: any) {
      console.error(err);
      setError(`Food scan failed: ${err.message || 'AI was unable to scan the image. Please try again.'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleScanLiveVideo = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const canProcess = await incrementAiUsage();
    if (!canProcess) return;

    setIsLoading(true);
    setResult(null);
    setError(null);

    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    const MAX_DIM = 512;
    let width = video.videoWidth || 640;
    let height = video.videoHeight || 480;
    
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

    const base64Data = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
    
    try {
      const remaining = stats.caloriesGoal - stats.calories;
      const data = await analyzeBuffet(base64Data, remaining > 0 ? remaining : 500, userProfile);
      if (data) {
        setResult({
          isFood: data.isFood,
          advice: data.advice,
          calories: data.estimatedCalories,
          mealName: data.isFood === false ? (data.advice ? "Non-Food Item" : "Scanned Item") : "Scanned Meal / Buffet"
        });
      }
    } catch (err: any) {
      console.error(err);
      setError(`Scan failed: ${err.message || 'AI was unable to scan the image. Please try again.'}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const now = new Date();
  const localNow = new Date(now.getTime() - (5 * 60 * 60 * 1000));
  const year = localNow.getFullYear();
  const month = String(localNow.getMonth() + 1).padStart(2, '0');
  const day = String(localNow.getDate()).padStart(2, '0');
  const today = `${year}-${month}-${day}`;
  const scanCountToday = userProfile?.lastScanDate === today ? (userProfile?.dailyScansCount || 0) : 0;
  const remainingScans = Math.max(0, maxDailyScans - scanCountToday);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[200] flex items-end sm:items-center justify-center animate-in fade-in duration-300">
      {/* Hidden Mobile Inputs */}
      <input 
        ref={cameraInputRef}
        type="file" 
        accept="image/*" 
        capture="environment" 
        className="hidden"
        onChange={handleFileSelected}
      />
      <input 
        ref={galleryInputRef}
        type="file" 
        accept="image/*" 
        className="hidden"
        onChange={handleFileSelected}
      />

      <div className="bg-white dark:bg-slate-900 w-full max-w-lg sm:rounded-[40px] rounded-t-[40px] p-6 sm:p-8 shadow-2xl relative flex flex-col max-h-[92vh] overflow-hidden">
        <button onClick={onClose} className="absolute top-5 right-5 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors z-10">
          <X className="w-6 h-6 text-slate-400" />
        </button>

        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-100 dark:shadow-indigo-900/30">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white leading-none">FitAI Scanner</h2>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-1">AI Food & Calorie Tracker</p>
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

        {/* Navigation Tabs */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl mb-6 shrink-0">
          <button 
            onClick={() => setActiveTab('text')}
            className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
              activeTab === 'text' 
              ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' 
              : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <MessageSquare className="w-4 h-4" /> Type Meal
          </button>
          <button 
            onClick={() => {
              setActiveTab('buffet');
              if (!selectedImagePreview) startCamera();
            }}
            className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
              activeTab === 'buffet' 
              ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' 
              : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Camera className="w-4 h-4" /> Scan Photo
          </button>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar pb-4 space-y-5">
          {/* TAB 1: TEXT LOGGING */}
          {activeTab === 'text' && (
            <div className="space-y-5 animate-in slide-in-from-bottom-4 duration-300">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Describe what you ate or ask a question</label>
                <textarea 
                  value={transcription}
                  onChange={(e) => setTranscription(e.target.value)}
                  placeholder="e.g., I had 2 boiled eggs, sourdough toast with avocado, and black coffee..."
                  className="w-full p-5 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all resize-none h-32 text-sm"
                  autoFocus
                />
              </div>

              {error && (
                <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded-2xl text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {transcription && !result && (
                <button 
                  onClick={handleProcessText}
                  disabled={isLoading}
                  className="w-full py-4 gradient-bg text-white font-black text-sm rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 disabled:opacity-50 transition-all hover:scale-[1.01] active:scale-95"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                  {isLoading ? "Analyzing Meal..." : "Estimate Calories & Log"}
                </button>
              )}
            </div>
          )}

          {/* TAB 2: FOOD PHOTO SCANNER */}
          {activeTab === 'buffet' && (
            <div className="space-y-5 animate-in slide-in-from-bottom-4 duration-300">
              
              {/* Photo Preview Mode */}
              {selectedImagePreview ? (
                <div className="space-y-4">
                  <div className="relative aspect-[4/3] bg-slate-900 rounded-[28px] overflow-hidden border-2 border-slate-200 dark:border-slate-800 shadow-md">
                    <img src={selectedImagePreview} alt="Selected food" className="w-full h-full object-cover" />
                    <button 
                      onClick={() => {
                        resetPhotoState();
                        startCamera();
                      }}
                      className="absolute top-3 right-3 bg-black/60 hover:bg-black/80 text-white text-xs font-bold px-3 py-1.5 rounded-xl backdrop-blur-md flex items-center gap-1.5 transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Retake
                    </button>
                  </div>

                  {/* Extra Details Input */}
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">
                      Add Extra Notes (Optional)
                    </label>
                    <input 
                      type="text"
                      value={extraNotes}
                      onChange={(e) => setExtraNotes(e.target.value)}
                      placeholder="e.g., Fried chicken, 1 bowl of white rice, gravy..."
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    />
                  </div>

                  {!result && (
                    <button 
                      onClick={handleAnalyzePhoto}
                      disabled={isLoading}
                      className="w-full py-4 gradient-bg text-white font-black text-sm rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25 hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-50"
                    >
                      {isLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Sparkles className="w-5 h-5" />
                      )}
                      <span>{isLoading ? "AI Scanning Food..." : "Analyze Food Photo with AI"}</span>
                    </button>
                  )}
                </div>
              ) : (
                /* Live Camera / Mobile Action Controls */
                <div className="space-y-4">
                  {/* Quick Mobile Action Buttons */}
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => cameraInputRef.current?.click()}
                      className="p-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl flex flex-col items-center justify-center gap-2 font-bold shadow-md shadow-indigo-600/20 active:scale-95 transition-all text-xs"
                    >
                      <Camera className="w-6 h-6" />
                      <span>Snap Mobile Photo</span>
                    </button>

                    <button 
                      onClick={() => galleryInputRef.current?.click()}
                      className="p-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-2xl flex flex-col items-center justify-center gap-2 font-bold shadow-sm active:scale-95 transition-all text-xs"
                    >
                      <ImageIcon className="w-6 h-6 text-purple-500" />
                      <span>Choose from Gallery</span>
                    </button>
                  </div>

                  {/* Live Viewfinder Stream */}
                  <div className="relative aspect-[4/3] bg-slate-900 rounded-[28px] overflow-hidden border-2 border-slate-200 dark:border-slate-800 shadow-inner group flex items-center justify-center">
                    <video 
                      ref={videoRef} 
                      autoPlay 
                      playsInline 
                      className={`w-full h-full object-cover ${!cameraActive ? 'hidden' : ''}`}
                    />

                    {!cameraActive && (
                      <div className="p-6 text-center text-slate-400 space-y-2">
                        <Camera className="w-10 h-10 mx-auto text-slate-500 mb-2 opacity-60" />
                        <p className="text-xs font-semibold text-slate-300">
                          {cameraError || "Tap 'Snap Mobile Photo' above to use your phone camera instantly!"}
                        </p>
                      </div>
                    )}

                    {cameraActive && (
                      <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/50 backdrop-blur-md px-3 py-1 rounded-full">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                        <span className="text-[10px] font-black text-white uppercase tracking-widest">Live Viewfinder</span>
                      </div>
                    )}
                  </div>

                  {cameraActive && (
                    <button 
                      onClick={handleScanLiveVideo}
                      disabled={isLoading}
                      className="w-full py-4 bg-slate-900 dark:bg-indigo-600 text-white font-black text-sm rounded-2xl flex items-center justify-center gap-3 shadow-lg active:scale-95 transition-all disabled:opacity-50"
                    >
                      {isLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <Sparkles className="w-5 h-5 text-amber-400" />
                          <span>Point & Scan Live View</span>
                        </>
                      )}
                    </button>
                  )}
                  
                  <canvas ref={canvasRef} className="hidden" />
                </div>
              )}

              {error && (
                <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded-2xl text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}

          {/* AI SCAN RESULT CARD */}
          {result && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300 pt-3 border-t border-slate-100 dark:border-slate-800">
              {result.isFood === false ? (
                <div className="bg-amber-50/80 dark:bg-amber-950/40 p-5 rounded-3xl border border-amber-200/80 dark:border-amber-900/50 text-center space-y-3">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-100 dark:bg-amber-900/60 flex items-center justify-center text-amber-600 dark:text-amber-400">
                    <Info className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="inline-block px-3 py-0.5 bg-amber-200/70 dark:bg-amber-900/80 text-amber-900 dark:text-amber-200 text-[10px] font-black uppercase tracking-widest rounded-full mb-1">
                      No Calories to Check
                    </span>
                    <h4 className="font-black text-slate-900 dark:text-white text-base">{result.mealName || "Non-Food Item"}</h4>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-relaxed px-2">
                    {result.analysis || result.advice || "There are no calories to check for here! Non-food objects like tables, humans, or furniture don't contain food calories. Try snapping a photo of your meal or drink."}
                  </p>
                  <button 
                    onClick={() => {
                      setResult(null);
                      resetPhotoState();
                    }}
                    className="w-full py-3 bg-slate-900 dark:bg-slate-800 text-white font-bold text-xs rounded-2xl hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Try Another Photo</span>
                  </button>
                </div>
              ) : (
                <>
                  {result.response ? (
                    <div className="bg-indigo-50/60 dark:bg-indigo-950/30 p-5 rounded-3xl border border-indigo-100 dark:border-indigo-900/40">
                      <div className="flex items-center gap-2 mb-2 text-indigo-600 dark:text-indigo-400">
                        <Sparkles className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">AI Response</span>
                      </div>
                      <div className="prose prose-sm prose-slate dark:prose-invert max-w-none text-xs">
                        <ReactMarkdown>{result.response}</ReactMarkdown>
                      </div>
                    </div>
                  ) : null}

                  {result.mealName && (
                    <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/60 rounded-3xl border border-slate-200/80 dark:border-slate-700/80">
                      <div className="w-12 h-12 rounded-2xl bg-orange-100 dark:bg-orange-950/50 flex items-center justify-center text-orange-600 shrink-0">
                        <Utensils className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-black text-slate-900 dark:text-white text-base">{result.mealName}</h4>
                        <p className="text-orange-600 dark:text-orange-400 font-black text-xs uppercase tracking-wider">
                          {result.calories === 0 ? "0 kcal estimated (Zero-Calorie / Hydration)" : `${result.calories} kcal estimated`}
                        </p>
                      </div>
                    </div>
                  )}

                  {result.advice && (
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-700/60">
                      <div className="flex items-center gap-1.5 mb-1.5 text-indigo-600 dark:text-indigo-400">
                        <Info className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Nutritional Analysis</span>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                        {result.advice}
                      </p>
                    </div>
                  )}

                  {result.mealName && (
                    <button 
                      onClick={() => {
                        onLogMeal(result.mealName!, result.calories, result.analysis || result.advice);
                        onClose();
                        setResult(null);
                        setTranscription("");
                        resetPhotoState();
                      }}
                      className="w-full py-4 bg-emerald-600 text-white font-black text-sm rounded-2xl shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      <Check className="w-5 h-5" />
                      <span>Confirm & Log ({result.calories} kcal)</span>
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FoodAssistant;
