
import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, 
  Mic, 
  MicOff, 
  X, 
  Sparkles, 
  ChevronRight, 
  Loader2,
  Utensils,
  History,
  Info,
  Volume2,
  VolumeX,
  Zap
} from 'lucide-react';
import { processVoiceMeal, analyzeBuffet, generateSpeech } from '../services/geminiService';
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

const FoodAssistant: React.FC<Props> = ({ isOpen, onClose, stats, userProfile, foodLog, onLogMeal, initialMode = 'voice', maxDailyScans, incrementAiUsage }) => {
  const [activeTab, setActiveTab] = useState<'voice' | 'buffet'>('voice');
  const [isListening, setIsListening] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [transcription, setTranscription] = useState("");
  const [interimTranscription, setInterimTranscription] = useState("");
  const [isManualInput, setIsManualInput] = useState(initialMode === 'text');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
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
  const recognitionRef = useRef<any>(null);
  const transcriptionRef = useRef("");

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      stopListening();
      stopSpeech();
      return;
    }

    setIsManualInput(initialMode === 'text');
    setTranscription("");
    setResult(null);

    if (activeTab === 'buffet') {
      startCamera();
    } else {
      stopCamera();
    }
  }, [isOpen, activeTab, initialMode]);

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

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const startListening = async () => {
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SpeechRecognition) {
      setError("Speech recognition is not supported in this browser. Try Chrome or Safari.");
      return;
    }

    try {
      // Proactively request microphone permission to trigger the browser prompt
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err: any) {
      console.error("Microphone access error:", err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError("Microphone permission was denied. Please click the camera/mic icon in your address bar and allow access.");
      } else {
        setError(`Microphone error: ${err.message || 'Access denied'}. Please check your system settings.`);
      }
      return;
    }

    setError(null);
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      let final = "";
      let interim = "";
      for (let i = 0; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += (final ? " " : "") + transcript;
        } else {
          interim += (interim ? " " : "") + transcript;
        }
      }
      
      const fullText = (final.trim() + " " + interim.trim()).trim();
      transcriptionRef.current = fullText;
      
      if (final) {
        setTranscription(final.trim());
      }
      setInterimTranscription(interim.trim());
    };

    recognition.onstart = () => {
      console.log("Speech recognition started");
      setIsListening(true);
      setIsInitializing(false);
      setError(null);
    };
    
    recognition.onend = () => {
      console.log("Speech recognition ended");
      setIsListening(false);
      setIsInitializing(false);
    };
    
    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
      setIsInitializing(false);
      if (event.error === 'not-allowed') {
        setError("Microphone access denied. Please allow microphone access in your browser's site settings to use voice logging.");
      } else if (event.error === 'network') {
        setError("Connection lost. Please check your internet and try again.");
      } else if (event.error === 'no-speech') {
        setError("No speech detected. Please try again.");
      } else if (event.error === 'service-not-allowed') {
        setError("Speech service is currently unavailable. Try typing instead.");
      } else {
        setError(`Speech recognition error: ${event.error}`);
      }
    };

    try {
      setIsInitializing(true);
      recognition.start();
      recognitionRef.current = recognition;
    } catch (err: any) {
      console.error("Failed to start recognition:", err);
      setError("Could not start microphone. Please refresh and try again.");
      setIsListening(false);
      setIsInitializing(false);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    
    // Use the latest text from the ref (includes interim)
    const text = transcriptionRef.current.trim();
    if (text && !isManualInput) {
      handleProcessVoice(text);
    } else if (!isManualInput) {
      setError("I didn't catch that. Please speak louder or try again.");
    }
    
    setInterimTranscription("");
  };

  const stopSpeech = () => {
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.stop();
      } catch (e) {}
      audioSourceRef.current = null;
    }
    setIsSpeaking(false);
  };

  const speakText = async (text: string) => {
    if (!text) return;
    stopSpeech();
    setIsSpeaking(true);

    try {
      const base64Audio = await generateSpeech(text);
      if (!base64Audio) {
        setIsSpeaking(false);
        return;
      }

      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const audioCtx = audioCtxRef.current;
      const binaryString = atob(base64Audio);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // PCM data is 16-bit little endian
      const int16 = new Int16Array(bytes.buffer);
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768;
      }

      const buffer = audioCtx.createBuffer(1, float32.length, 24000);
      buffer.getChannelData(0).set(float32);
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);
      source.onended = () => setIsSpeaking(false);
      source.start();
      audioSourceRef.current = source;
    } catch (err) {
      console.error("Playback failed:", err);
      setIsSpeaking(false);
    }
  };

  const handleProcessVoice = async (textToProcess?: string) => {
    const finalTranscription = textToProcess || transcription;
    if (!finalTranscription.trim()) return;
    
    // Check usage
    const canProcess = await incrementAiUsage();
    if (!canProcess) return;

    setIsLoading(true);
    setResult(null);
    setError(null);
    try {
      const data = await processVoiceMeal(finalTranscription, stats, userProfile, foodLog);
      if (data) {
        setResult(data);
        // Auto-speak the response if it was a voice-initiated flow and not manual input
        if (!isManualInput && data.response) {
          speakText(data.response.replace(/[#*`]/g, '')); // Strip markdown for cleaner speech
        }
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
    
    // Resize for AI efficiency (max 512px)
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

  const today = new Date().toISOString().split('T')[0];
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
            onClick={() => setActiveTab('voice')}
            className={`flex-1 py-3 rounded-xl text-sm font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
              activeTab === 'voice' 
              ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' 
              : 'text-slate-500'
            }`}
          >
            <Mic className="w-4 h-4" /> Voice Log
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
          {activeTab === 'voice' && (
            <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
              {!isManualInput ? (
                <div className="bg-indigo-50/50 dark:bg-indigo-950/20 p-8 rounded-[32px] border border-indigo-100/50 dark:border-indigo-900/30 flex flex-col items-center text-center">
                  <button 
                    onClick={toggleListening}
                    disabled={isInitializing || isLoading}
                    className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${
                      isLoading 
                      ? 'bg-indigo-100 dark:bg-slate-800 text-indigo-500'
                      : isListening 
                        ? 'bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-200 dark:shadow-rose-900/40' 
                        : 'bg-white dark:bg-slate-800 text-indigo-500 shadow-sm hover:scale-105'
                    } ${isInitializing ? 'opacity-50 cursor-wait' : ''}`}
                  >
                    {isInitializing ? (
                      <Loader2 className="w-10 h-10 animate-spin" />
                    ) : isLoading ? (
                      <Loader2 className="w-10 h-10 animate-spin" />
                    ) : (
                      isListening ? <MicOff className="w-10 h-10" /> : <Mic className="w-10 h-10" />
                    )}
                  </button>
                  <div className="mt-6">
                    <p className="max-w-[80%] mx-auto text-slate-800 dark:text-white font-black text-xl mb-2">
                      {isInitializing ? "Initializing..." : isLoading ? "AI is Analyzing..." : isListening ? "Listening to you..." : "Tap to Speak"}
                    </p>
                    
                    {isListening && (
                      <div className="mt-4 px-4 py-2 bg-white/50 dark:bg-slate-800/50 rounded-2xl backdrop-blur-sm border border-indigo-100/30 min-h-[60px] flex items-center justify-center">
                        <p className="text-slate-600 dark:text-slate-300 font-medium italic animate-pulse">
                          {interimTranscription || transcription || "Say something like 'I just had a salad'..."}
                        </p>
                      </div>
                    )}

                    {!isListening && !isLoading && !transcription && (
                      <p className="text-slate-400 dark:text-slate-500 text-sm font-medium italic">
                        "I'm eating a grilled chicken salad with avocado..."
                      </p>
                    )}
                    <button 
                      onClick={() => setIsManualInput(true)}
                      className="mt-4 text-indigo-600 dark:text-indigo-400 text-xs font-black underline underline-offset-4 tracking-widest uppercase"
                    >
                      Or Type Instead
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">What's on your mind?</label>
                    <button 
                      onClick={() => setIsManualInput(false)}
                      className="text-[10px] font-black text-indigo-500 uppercase tracking-widest hover:text-indigo-600"
                    >
                      Switch to Voice
                    </button>
                  </div>
                  <textarea 
                    value={transcription}
                    onChange={(e) => setTranscription(e.target.value)}
                    placeholder="Describe your meal or ask a health question..."
                    className="w-full p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none h-32"
                    autoFocus
                  />
                </div>
              )}

              {error && (
                <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/30 rounded-2xl text-rose-600 dark:text-rose-400 text-sm font-medium">
                  {error}
                </div>
              )}

              {transcription && !result && (
                <div className="space-y-4">
                  <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2 mb-2 text-slate-400">
                      <History className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Transcription</span>
                    </div>
                    <p className="text-slate-700 dark:text-slate-300 font-medium">{transcription}</p>
                  </div>
                  <button 
                    onClick={() => handleProcessVoice()}
                    disabled={isLoading}
                    className="w-full py-4 gradient-bg text-white font-black rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 dark:shadow-indigo-900/30 disabled:opacity-50 transition-all hover:scale-[1.02] active:scale-95"
                  >
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                    {isLoading ? "Analyzing..." : "Estimate Calories with AI"}
                  </button>
                </div>
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
              {/* AI Conversational Response */}
              {result.response ? (
                <div className="bg-indigo-50/50 dark:bg-indigo-950/20 p-6 rounded-3xl border border-indigo-100/50 dark:border-indigo-900/30">
                  <div className="flex items-center justify-between mb-3 text-indigo-600 dark:text-indigo-400">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest">AI Response</span>
                    </div>
                    <button 
                      onClick={() => isSpeaking ? stopSpeech() : speakText(result.response!.replace(/[#*`]/g, ''))}
                      className="p-2 hover:bg-white dark:hover:bg-indigo-900/50 rounded-xl transition-colors"
                    >
                      {isSpeaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="prose prose-sm prose-slate dark:prose-invert max-w-none">
                    <ReactMarkdown 
                      components={{
                        a: ({ node, ...props }) => <a target="_blank" rel="noopener noreferrer" {...props} />
                      }}
                    >
                      {result.response}
                    </ReactMarkdown>
                  </div>
                </div>
              ) : result.analysis ? (
                <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                  {result.analysis}
                </div>
              ) : null}

              {/* Meal Summary if logging */}
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

              {/* Buffet Advice */}
              {result.advice && (
                <div className="bg-indigo-50/50 dark:bg-indigo-950/20 p-6 rounded-3xl border border-indigo-100/50 dark:border-indigo-900/30">
                  <div className="flex items-center gap-2 mb-3 text-indigo-600 dark:text-indigo-400">
                    <Info className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">AI Expert Advice</span>
                  </div>
                  <div className="prose prose-sm prose-slate dark:prose-invert max-w-none">
                    <ReactMarkdown 
                      components={{
                        a: ({ node, ...props }) => <a target="_blank" rel="noopener noreferrer" {...props} />
                      }}
                    >
                      {result.advice}
                    </ReactMarkdown>
                  </div>
                </div>
              )}

              {/* Confirm Button ONLY if it's a log intent and mealName exists */}
              {result.mealName && (
                <button 
                  onClick={() => {
                    onLogMeal(result.mealName!, result.calories, result.analysis);
                    onClose();
                    setResult(null);
                    setTranscription("");
                    setInterimTranscription("");
                    transcriptionRef.current = "";
                  }}
                  className="w-full py-4 bg-emerald-500 text-white font-black rounded-2xl shadow-lg shadow-emerald-100 dark:shadow-emerald-900/20 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  Confirm & Log Calories
                </button>
              )}
              
              {/* Back / Done button if just advice/question */}
              {!result.mealName && result.response && (
                <button 
                  onClick={() => {
                    setResult(null);
                    setTranscription("");
                    setInterimTranscription("");
                    transcriptionRef.current = "";
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
