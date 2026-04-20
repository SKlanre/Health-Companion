
import React, { useState } from 'react';
import { 
  Users, 
  Heart, 
  MessageSquare, 
  Share2, 
  Sparkles, 
  Flame, 
  Dumbbell, 
  Utensils, 
  Plus, 
  ChevronRight,
  TrendingUp,
  Zap
} from 'lucide-react';
import { DailyStats, CommunityPost } from '../types';
import { generateCheer } from '../services/geminiService';

const MOCK_POSTS: CommunityPost[] = [
  {
    id: '1',
    user: { name: 'Sarah J.', avatar: 'SJ', isPro: true },
    type: 'milestone',
    content: 'Just reached my 30-day streak! Consistency is paying off. 🚀',
    detail: '30 Day Goal Completion',
    likes: 24,
    comments: 8,
    timestamp: '2h ago'
  },
  {
    id: '2',
    user: { name: 'Mike Ross', avatar: 'MR', isPro: false },
    type: 'workout',
    content: 'Crushed a high-intensity interval session this morning. Feel the burn!',
    detail: 'HIIT Workout • 45 mins',
    likes: 12,
    comments: 3,
    timestamp: '4h ago'
  },
  {
    id: '3',
    user: { name: 'Elena G.', avatar: 'EG', isPro: true },
    type: 'meal',
    content: 'Found a new favorite healthy lunch! AI scanner clocked this at exactly what I needed.',
    detail: 'Quinoa Power Bowl • 420 kcal',
    likes: 45,
    comments: 12,
    timestamp: '6h ago'
  }
];

const SUGGESTED_PARTNERS = [
  { name: 'David L.', goal: 'Weight Loss', match: '95%' },
  { name: 'Jessica K.', goal: 'Muscle Gain', match: '88%' },
  { name: 'Chris W.', goal: 'Cardio', match: '82%' }
];

const Community: React.FC<{ stats: DailyStats, darkMode?: boolean }> = ({ stats, darkMode }) => {
  const [posts, setPosts] = useState<CommunityPost[]>(MOCK_POSTS);
  const [cheeringId, setCheeringId] = useState<string | null>(null);

  const handleMagicCheer = async (post: CommunityPost) => {
    setCheeringId(post.id);
    try {
      const cheer = await generateCheer(post.content);
      // In a real app, this would append to the comments array
      alert(`AI Magic Cheer: "${cheer}"`);
    } catch (error) {
      console.error("Cheer failed", error);
    } finally {
      setCheeringId(null);
    }
  };

  return (
    <div className="space-y-6 pb-10 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white leading-tight">Community</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 font-medium">Link up & level up together</p>
        </div>
        <div className="bg-purple-50 dark:bg-purple-950/30 p-2 rounded-2xl">
          <Users className="w-5 h-5 text-purple-500 dark:text-purple-400" />
        </div>
      </div>

      {/* Share Progress Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-[28px] shadow-sm border border-gray-100 dark:border-slate-800 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold">A</div>
        <button className="flex-1 text-left py-2 px-4 bg-gray-50 dark:bg-slate-800 rounded-2xl text-gray-400 dark:text-slate-500 text-sm font-medium hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
          Share your progress wins...
        </button>
        <button className="p-2.5 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-colors">
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* Suggested Partners Scroll */}
      <section>
        <div className="flex justify-between items-center mb-3 px-1">
          <h3 className="text-xs font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Suggested Partners</h3>
          <button className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-1">
            See All <ChevronRight className="w-3 h-3" />
          </button>
        </div>
        <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 -mx-1 px-1">
          {SUGGESTED_PARTNERS.map((partner, i) => (
            <div key={i} className="min-w-[140px] bg-white dark:bg-slate-900 p-4 rounded-[24px] shadow-sm border border-gray-50 dark:border-slate-800 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 mb-3 flex items-center justify-center text-slate-400 dark:text-slate-500 font-bold">
                {partner.name[0]}
              </div>
              <p className="text-xs font-black text-gray-900 dark:text-white">{partner.name}</p>
              <p className="text-[9px] font-bold text-indigo-500 uppercase mt-1">{partner.goal}</p>
              <div className="mt-3 px-3 py-1 bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400 text-[9px] font-black rounded-lg">
                {partner.match} Match
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Activity Feed */}
      <div className="space-y-4">
        <h3 className="text-xs font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest px-1">Recent Activity</h3>
        {posts.map((post) => (
          <div key={post.id} className="bg-white dark:bg-slate-900 rounded-[32px] p-6 shadow-sm border border-gray-50 dark:border-slate-800 group hover:border-indigo-100 dark:hover:border-indigo-900 transition-all">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center text-indigo-500 dark:text-indigo-400 font-black text-sm">
                  {post.user.avatar}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h4 className="font-black text-gray-900 dark:text-white text-sm">{post.user.name}</h4>
                    {post.user.isPro && <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />}
                  </div>
                  <p className="text-[10px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-wider">{post.timestamp}</p>
                </div>
              </div>
              <div className={`p-2 rounded-xl ${
                post.type === 'milestone' ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400' :
                post.type === 'workout' ? 'bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400' : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400'
              }`}>
                {post.type === 'milestone' ? <Flame className="w-4 h-4" /> :
                 post.type === 'workout' ? <Dumbbell className="w-4 h-4" /> : <Utensils className="w-4 h-4" />}
              </div>
            </div>

            <div className={`mb-4 p-4 rounded-2xl ${
              post.type === 'milestone' ? 'bg-gradient-to-tr from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20' : 'bg-slate-50 dark:bg-slate-800'
            }`}>
              <p className="text-gray-800 dark:text-slate-200 font-semibold leading-relaxed text-sm">"{post.content}"</p>
              {post.detail && (
                <div className="mt-2 flex items-center gap-2">
                  <TrendingUp className="w-3 h-3 text-indigo-400" />
                  <span className="text-[10px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest">{post.detail}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button className="flex items-center gap-1.5 text-gray-400 dark:text-slate-500 hover:text-rose-500 transition-colors">
                  <Heart className="w-4 h-4" />
                  <span className="text-[10px] font-black">{post.likes}</span>
                </button>
                <button className="flex items-center gap-1.5 text-gray-400 dark:text-slate-500 hover:text-indigo-500 transition-colors">
                  <MessageSquare className="w-4 h-4" />
                  <span className="text-[10px] font-black">{post.comments}</span>
                </button>
                <button className="text-gray-400 dark:text-slate-500 hover:text-emerald-500 transition-colors">
                  <Share2 className="w-4 h-4" />
                </button>
              </div>
              
              <button 
                onClick={() => handleMagicCheer(post)}
                disabled={!!cheeringId}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
                  cheeringId === post.id ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-400' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100 dark:shadow-indigo-900/20'
                }`}
              >
                {cheeringId === post.id ? <Sparkles className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                {cheeringId === post.id ? 'Generating...' : 'Magic Cheer'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Community;
