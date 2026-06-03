
import React, { useState, useMemo } from 'react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { DailyStats, DailyHistoryEntry, UserProfile } from '../types';
import { TrendingUp, Award, Droplets, Target, Scale, Calendar, Footprints, Timer } from 'lucide-react';

type TimeRange = 'daily' | 'weekly' | 'monthly' | 'yearly';
type MetricType = 'calories' | 'water' | 'steps' | 'exercise';

const Progress: React.FC<{ stats: DailyStats, history: DailyHistoryEntry[], userProfile: UserProfile | null, darkMode?: boolean }> = ({ stats, history, userProfile, darkMode }) => {
  const [range, setRange] = useState<TimeRange>('weekly');
  const [activeMetric, setActiveMetric] = useState<MetricType>('calories');

  const metricConfig = {
    calories: { label: 'Calories', unit: 'kcal', color: '#6366f1', icon: <Target /> },
    water: { label: 'Water', unit: 'cups', color: '#0ea5e9', icon: <Droplets /> },
    steps: { label: 'Steps', unit: 'steps', color: '#10b981', icon: <Footprints /> },
    exercise: { label: 'Exercise', unit: 'min', color: '#8b5cf6', icon: <Timer /> }
  };

  const chartData = useMemo(() => {
    const getTodayStr = () => {
    const now = new Date();
    const localNow = new Date(now.getTime() - (5 * 60 * 60 * 1000));
    const year = localNow.getFullYear();
    const month = String(localNow.getMonth() + 1).padStart(2, '0');
    const day = String(localNow.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const today = getTodayStr();
    const allData = [...history, { ...stats, date: today }].sort((a, b) => a.date.localeCompare(b.date));
    
    const now = new Date();
    
    switch (range) {
      case 'daily': {
        // For daily, we just show today's progress vs goal
        return [
          { name: 'Start', val: 0 },
          { name: 'Current', val: stats[activeMetric] },
          { name: 'Goal', val: stats[`${activeMetric}Goal` as keyof DailyStats] }
        ];
      }
      case 'weekly': {
        // Last 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(now.getDate() - 7);
        return allData
          .filter(d => new Date(d.date) >= sevenDaysAgo)
          .map(d => ({
            name: new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' }),
            val: d[activeMetric]
          }));
      }
      case 'monthly': {
        // Last 30 days grouped by week
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(now.getDate() - 30);
        const filtered = allData.filter(d => new Date(d.date) >= thirtyDaysAgo);
        
        // Group by week
        const weeks: { [key: string]: number[] } = {};
        filtered.forEach(d => {
          const date = new Date(d.date);
          const weekNum = Math.ceil(date.getDate() / 7);
          const key = `Week ${weekNum}`;
          if (!weeks[key]) weeks[key] = [];
          weeks[key].push(d[activeMetric]);
        });
        
        return Object.entries(weeks).map(([name, vals]) => ({
          name,
          val: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
        }));
      }
      case 'yearly': {
        // Last 12 months
        const months: { [key: string]: number[] } = {};
        allData.forEach(d => {
          const date = new Date(d.date);
          const key = date.toLocaleDateString('en-US', { month: 'short' });
          if (!months[key]) months[key] = [];
          months[key].push(d[activeMetric]);
        });
        
        return Object.entries(months).map(([name, vals]) => ({
          name,
          val: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
        }));
      }
      default:
        return [];
    }
  }, [range, activeMetric, history, stats]);

  const statsSummary = useMemo(() => {
    const vals = chartData.map(d => d.val);
    const avg = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
    const peak = vals.length ? Math.max(...vals) : 0;
    const total = vals.reduce((a, b) => a + b, 0);
    
    return { avg, peak, total };
  }, [chartData]);

  const insights = useMemo(() => {
    if (history.length < 3) return "Keep logging your activity to unlock personalized AI insights!";
    
    const recent = history.slice(0, 7);
    const avgRecent = recent.reduce((acc, curr) => acc + curr[activeMetric], 0) / recent.length;
    const goal = stats[`${activeMetric}Goal` as keyof DailyStats] as number;
    
    if (avgRecent >= goal) {
      return `Amazing consistency! You're averaging ${Math.round(avgRecent)} ${metricConfig[activeMetric].unit}, which is above your goal. Keep it up!`;
    } else if (avgRecent >= goal * 0.8) {
      return `You're so close! You're at 80% of your ${activeMetric} goal this week. A small extra push will get you there.`;
    } else {
      return `Focus on your ${activeMetric} intake. You're currently at ${Math.round((avgRecent/goal)*100)}% of your target. Try setting small reminders!`;
    }
  }, [history, activeMetric, stats]);

  return (
    <div className="space-y-6 pb-10 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white leading-tight">Your Progress</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 font-medium">Tracking your health journey</p>
        </div>
        <div className="bg-indigo-50 dark:bg-indigo-950/30 p-2 rounded-2xl">
          <Calendar className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
        </div>
      </div>

      {/* Time Range Selector */}
      <div className="bg-white dark:bg-slate-900 p-1.5 rounded-[22px] shadow-sm border border-gray-100 dark:border-slate-800 flex relative overflow-hidden">
        {(['daily', 'weekly', 'monthly', 'yearly'] as TimeRange[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`flex-1 py-2.5 rounded-[16px] text-[11px] font-black uppercase tracking-widest transition-all z-10 ${
              range === r ? 'text-white' : 'text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300'
            }`}
          >
            {r}
          </button>
        ))}
        <div 
          className="absolute top-1.5 bottom-1.5 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-[16px] transition-all duration-300 ease-out"
          style={{ 
            width: 'calc(25% - 4px)', 
            left: `calc(${['daily', 'weekly', 'monthly', 'yearly'].indexOf(range) * 25}% + ${['daily', 'weekly', 'monthly', 'yearly'].indexOf(range) === 0 ? '6px' : '2px'})`
          }}
        />
      </div>

      {/* Metric Selector */}
      <div className="grid grid-cols-4 gap-2">
        {(['calories', 'water', 'steps', 'exercise'] as MetricType[]).map((m) => (
          <button
            key={m}
            onClick={() => setActiveMetric(m)}
            className={`p-3 rounded-2xl border-2 transition-all flex flex-col items-center gap-1 ${
              activeMetric === m 
              ? 'bg-white dark:bg-slate-800 border-indigo-500 shadow-md scale-105' 
              : 'bg-gray-50 dark:bg-slate-900 border-transparent text-gray-400 dark:text-slate-600'
            }`}
          >
            {React.cloneElement(metricConfig[m].icon as React.ReactElement<{ className?: string }>, { 
              className: `w-5 h-5 ${activeMetric === m ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-slate-600'}` 
            })}
            <span className={`text-[8px] font-black uppercase tracking-widest ${activeMetric === m ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-slate-600'}`}>
              {m}
            </span>
          </button>
        ))}
      </div>

      {/* Main Chart Section */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-[32px] shadow-sm border border-gray-50 dark:border-slate-800 overflow-hidden">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-lg font-black text-gray-900 dark:text-white leading-none capitalize">{range} {metricConfig[activeMetric].label}</h3>
            <p className="text-[10px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-1.5">Historical Trend</p>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
          </div>
        </div>
        
        <div className="h-64 w-full -ml-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorTrend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={metricConfig[activeMetric].color} stopOpacity={0.25}/>
                  <stop offset="95%" stopColor={metricConfig[activeMetric].color} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? "#334155" : "#f1f5f9"} />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 9, fill: darkMode ? '#64748b' : '#94a3b8', fontWeight: 700 }} 
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 9, fill: darkMode ? '#64748b' : '#94a3b8', fontWeight: 700 }} 
              />
              <Tooltip 
                contentStyle={{ 
                  borderRadius: '20px', 
                  border: 'none', 
                  backgroundColor: darkMode ? '#0f172a' : '#1e293b',
                  boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)',
                  padding: '12px 16px'
                }}
                labelStyle={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', color: '#94a3b8', marginBottom: '4px' }}
                itemStyle={{ fontSize: '14px', fontWeight: 900, color: metricConfig[activeMetric].color }}
                formatter={(value: any) => [`${value} ${metricConfig[activeMetric].unit}`, metricConfig[activeMetric].label]}
              />
              <Area 
                type="monotone" 
                dataKey="val" 
                stroke={metricConfig[activeMetric].color} 
                strokeWidth={4} 
                fillOpacity={1} 
                fill="url(#colorTrend)" 
                animationDuration={1500}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        
        <div className="mt-6 pt-6 border-t border-gray-50 dark:border-slate-800 flex justify-between items-center">
          <div className="flex gap-4">
            <div className="flex flex-col">
              <span className="text-[9px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Average</span>
              <span className="text-sm font-black text-gray-900 dark:text-white">{statsSummary.avg} {metricConfig[activeMetric].unit}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest">Peak</span>
              <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">{statsSummary.peak} {metricConfig[activeMetric].unit}</span>
            </div>
          </div>
          <button className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest px-4 py-2 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-colors">
            Share Report
          </button>
        </div>
      </div>

      {/* AI Insight Card */}
      <div className="bg-gradient-to-tr from-indigo-600 to-purple-600 p-6 rounded-[32px] text-white shadow-lg shadow-indigo-100 dark:shadow-indigo-900/20 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 bg-white/20 rounded-lg">
              <TrendingUp className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Smart Insight</span>
          </div>
          <h4 className="text-lg font-bold leading-tight">{insights}</h4>
          <p className="text-indigo-100 text-xs mt-2 font-medium leading-relaxed opacity-90">
            Consistency is the key to long-term success. Keep pushing towards your {activeMetric} goals!
          </p>
        </div>
        <div className="absolute top-[-20%] right-[-10%] w-40 h-40 bg-white/10 rounded-full blur-3xl" />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <ProgressCard 
          icon={<Award className="w-5 h-5" />} 
          title="Goal Streak" 
          value={`${userProfile?.streak || 0} days`} 
          subtitle="Consistency is key" 
          bg="bg-amber-50 dark:bg-amber-950/30" 
          accent="text-amber-600 dark:text-amber-400"
          iconColor="text-amber-500"
        />
        <ProgressCard 
          icon={<Scale className="w-5 h-5" />} 
          title="Current Weight" 
          value={userProfile?.unitSystem === 'metric' ? `${Math.round(stats.weight * 0.453592)} kg` : `${stats.weight} lbs`} 
          subtitle="Latest reading" 
          bg="bg-rose-50 dark:bg-rose-950/30" 
          accent="text-rose-600 dark:text-rose-400"
          iconColor="text-rose-500"
        />
      </div>
    </div>
  );
};

const ProgressCard = ({ icon, title, value, subtitle, bg, accent, iconColor }: any) => (
  <div className="bg-white dark:bg-slate-900 p-5 rounded-[28px] shadow-sm border border-gray-50 dark:border-slate-800 flex flex-col items-center text-center group hover:border-gray-200 dark:hover:border-slate-700 transition-all active:scale-[0.98]">
    <div className={`w-12 h-12 ${bg} rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110`}>
      {React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: `w-6 h-6 ${iconColor}` })}
    </div>
    <p className={`text-xl font-black ${accent} leading-none`}>{value}</p>
    <p className="text-[11px] font-black text-gray-900 dark:text-white uppercase tracking-widest mt-2 leading-none">{title}</p>
    <p className="text-[9px] text-gray-400 dark:text-slate-500 font-bold mt-1.5 uppercase tracking-widest">{subtitle}</p>
  </div>
);

export default Progress;
