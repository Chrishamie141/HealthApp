/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { 
  Activity, 
  Flame, 
  Footprints, 
  Calendar, 
  Upload, 
  Settings, 
  TrendingUp, 
  CheckCircle2, 
  AlertCircle,
  ChevronRight,
  BrainCircuit,
  Dumbbell
} from "lucide-react";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area,
  BarChart,
  Bar
} from "recharts";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import { analyzeFitnessData } from "./services/geminiService";
import { cn } from "./utils/cn";

// Types
interface DailyStat {
  date: string;
  steps: number;
  calories: number;
  distance: number;
}

interface Workout {
  type: string;
  duration: string;
  calories: string;
  date: string;
}

interface Goals {
  steps: number;
  calories: number;
  workoutsPerWeek: number;
}

export default function App() {
  const [data, setData] = useState<{ dailyStats: DailyStat[]; workouts: Workout[] } | null>(null);
  const [goals, setGoals] = useState<Goals>({
    steps: 10000,
    calories: 500,
    workoutsPerWeek: 3,
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"dashboard" | "workouts" | "goals">("dashboard");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/parse-health-data", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to parse health data. Make sure it's a valid Apple Health export.");
      }

      const result = await response.json();
      setData(result);
      
      // Automatically trigger AI analysis
      handleAnalyze(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnalyze = async (fitnessData: any) => {
    setIsAnalyzing(true);
    try {
      const result = await analyzeFitnessData(fitnessData, goals);
      setAnalysis(result || "No analysis generated.");
    } catch (err) {
      setError("Failed to generate AI analysis.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getAverageSteps = () => {
    if (!data || data.dailyStats.length === 0) return 0;
    const total = data.dailyStats.reduce((acc, curr) => acc + curr.steps, 0);
    return Math.round(total / data.dailyStats.length);
  };

  const getAverageCalories = () => {
    if (!data || data.dailyStats.length === 0) return 0;
    const total = data.dailyStats.reduce((acc, curr) => acc + curr.calories, 0);
    return Math.round(total / data.dailyStats.length);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-black/5 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-200">
              <Activity size={24} />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Pulse</h1>
          </div>
          
          <div className="flex items-center gap-6">
            <button 
              onClick={() => setActiveTab("dashboard")}
              className={cn("text-sm font-medium transition-colors", activeTab === "dashboard" ? "text-emerald-600" : "text-gray-500 hover:text-gray-900")}
            >
              Dashboard
            </button>
            <button 
              onClick={() => setActiveTab("workouts")}
              className={cn("text-sm font-medium transition-colors", activeTab === "workouts" ? "text-emerald-600" : "text-gray-500 hover:text-gray-900")}
            >
              Workouts
            </button>
            <button 
              onClick={() => setActiveTab("goals")}
              className={cn("text-sm font-medium transition-colors", activeTab === "goals" ? "text-emerald-600" : "text-gray-500 hover:text-gray-900")}
            >
              Goals
            </button>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-all flex items-center gap-2"
            >
              <Upload size={16} />
              Import Data
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              className="hidden" 
              accept=".zip,.xml"
            />
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6 space-y-8">
        {!data ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-24 h-24 bg-emerald-100 rounded-3xl flex items-center justify-center text-emerald-600"
            >
              <Upload size={48} />
            </motion.div>
            <div className="max-w-md space-y-2">
              <h2 className="text-3xl font-bold tracking-tight">Connect your Health Data</h2>
              <p className="text-gray-500">
                Export your data from the Apple Health app (Profile {">"} Export Health Data). 
                We support <strong>ZIP</strong> (standard export), <strong>XML</strong>, and <strong>JSON</strong> formats.
              </p>
            </div>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="bg-emerald-500 text-white px-8 py-4 rounded-2xl font-bold text-lg shadow-xl shadow-emerald-200 hover:scale-105 transition-transform"
            >
              Upload Export File
            </button>
            {isLoading && (
              <div className="flex items-center gap-3 text-emerald-600 font-medium">
                <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                Parsing your health data...
              </div>
            )}
            {error && (
              <div className="flex flex-col items-center gap-2 text-red-500 bg-red-50 px-4 py-4 rounded-xl border border-red-100 max-w-md">
                <div className="flex items-center gap-2">
                  <AlertCircle size={18} />
                  <span className="text-sm font-bold">Upload Error</span>
                </div>
                <p className="text-xs text-center opacity-80">{error}</p>
                <p className="text-[10px] mt-2 text-gray-400">Tip: Make sure you're uploading the full "export.zip" file from the Health app.</p>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Stats & Charts */}
            <div className="lg:col-span-2 space-y-8">
              {activeTab === "dashboard" && (
                <>
                  {/* Quick Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <StatCard 
                      icon={<Footprints className="text-blue-500" />}
                      label="Avg. Daily Steps"
                      value={getAverageSteps().toLocaleString()}
                      subValue={`${Math.round((getAverageSteps() / goals.steps) * 100)}% of goal`}
                      color="blue"
                    />
                    <StatCard 
                      icon={<Flame className="text-orange-500" />}
                      label="Avg. Calories"
                      value={getAverageCalories().toLocaleString()}
                      subValue={`${Math.round((getAverageCalories() / goals.calories) * 100)}% of goal`}
                      color="orange"
                    />
                    <StatCard 
                      icon={<Dumbbell className="text-emerald-500" />}
                      label="Workouts"
                      value={data.workouts.length.toString()}
                      subValue="Last 30 days"
                      color="emerald"
                    />
                  </div>

                  {/* Main Chart */}
                  <div className="bg-white p-6 rounded-3xl border border-black/5 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-lg font-bold">Activity Trends</h3>
                      <div className="flex gap-2">
                        <span className="flex items-center gap-1 text-xs font-medium text-gray-500">
                          <div className="w-2 h-2 rounded-full bg-emerald-500" /> Steps
                        </span>
                        <span className="flex items-center gap-1 text-xs font-medium text-gray-500">
                          <div className="w-2 h-2 rounded-full bg-orange-500" /> Calories
                        </span>
                      </div>
                    </div>
                    <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data.dailyStats}>
                          <defs>
                            <linearGradient id="colorSteps" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                          <XAxis 
                            dataKey="date" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 10, fill: '#9ca3af' }}
                            tickFormatter={(val) => val.split('-').slice(1).join('/')}
                          />
                          <YAxis hide />
                          <Tooltip 
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="steps" 
                            stroke="#10b981" 
                            strokeWidth={3}
                            fillOpacity={1} 
                            fill="url(#colorSteps)" 
                          />
                          <Area 
                            type="monotone" 
                            dataKey="calories" 
                            stroke="#f97316" 
                            strokeWidth={3}
                            fillOpacity={0}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </>
              )}

              {activeTab === "workouts" && (
                <div className="bg-white rounded-3xl border border-black/5 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-black/5">
                    <h3 className="text-lg font-bold">Recent Workouts</h3>
                  </div>
                  <div className="divide-y divide-black/5">
                    {data.workouts.length > 0 ? (
                      data.workouts.map((workout, i) => (
                        <div key={i} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                              <Dumbbell size={20} />
                            </div>
                            <div>
                              <p className="font-bold text-sm capitalize">{workout.type.replace('HKWorkoutActivityType', '').replace(/([A-Z])/g, ' $1').trim()}</p>
                              <p className="text-xs text-gray-500">{new Date(workout.date).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-sm">{Math.round(parseFloat(workout.duration))} min</p>
                            <p className="text-xs text-orange-500 font-medium">{Math.round(parseFloat(workout.calories))} kcal</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-10 text-center text-gray-400">No workouts found in the last 30 days.</div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === "goals" && (
                <div className="bg-white p-8 rounded-3xl border border-black/5 shadow-sm space-y-8">
                  <h3 className="text-xl font-bold">Fitness Goals</h3>
                  <div className="space-y-6">
                    <GoalInput 
                      label="Daily Step Goal" 
                      value={goals.steps} 
                      onChange={(v) => setGoals({ ...goals, steps: v })}
                      min={1000}
                      max={30000}
                      step={500}
                    />
                    <GoalInput 
                      label="Daily Calorie Goal" 
                      value={goals.calories} 
                      onChange={(v) => setGoals({ ...goals, calories: v })}
                      min={100}
                      max={2000}
                      step={50}
                    />
                    <GoalInput 
                      label="Workouts Per Week" 
                      value={goals.workoutsPerWeek} 
                      onChange={(v) => setGoals({ ...goals, workoutsPerWeek: v })}
                      min={1}
                      max={7}
                      step={1}
                    />
                  </div>
                  <button 
                    onClick={() => handleAnalyze(data)}
                    className="w-full bg-emerald-500 text-white py-4 rounded-2xl font-bold hover:bg-emerald-600 transition-colors"
                  >
                    Update & Re-Analyze
                  </button>
                </div>
              )}
            </div>

            {/* Right Column: AI Analysis */}
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-3xl border border-black/5 shadow-sm sticky top-24">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600">
                    <BrainCircuit size={18} />
                  </div>
                  <h3 className="text-lg font-bold">AI Coach Insights</h3>
                </div>

                {isAnalyzing ? (
                  <div className="space-y-4 py-10">
                    <div className="flex justify-center">
                      <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
                    </div>
                    <p className="text-center text-sm text-gray-500 font-medium animate-pulse">
                      Analyzing your patterns...
                    </p>
                  </div>
                ) : analysis ? (
                  <div className="prose prose-sm max-w-none prose-emerald">
                    <ReactMarkdown>{analysis}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="text-center py-10 space-y-4">
                    <p className="text-sm text-gray-400">Upload data to get AI-powered fitness coaching.</p>
                    <button 
                      onClick={() => handleAnalyze(data)}
                      className="text-purple-600 text-sm font-bold hover:underline"
                    >
                      Generate Analysis
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        className="hidden" 
        accept=".zip,.xml,.json"
      />
    </div>
  );
}

function StatCard({ icon, label, value, subValue, color }: { icon: React.ReactNode, label: string, value: string, subValue: string, color: string }) {
  return (
    <div className="bg-white p-6 rounded-3xl border border-black/5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div className="p-2 rounded-xl bg-gray-50">{icon}</div>
        <TrendingUp size={16} className="text-gray-300" />
      </div>
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      <h4 className="text-2xl font-bold tracking-tight mb-1">{value}</h4>
      <p className="text-xs font-medium text-gray-400">{subValue}</p>
    </div>
  );
}

function GoalInput({ label, value, onChange, min, max, step }: { label: string, value: number, onChange: (v: number) => void, min: number, max: number, step: number }) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <label className="text-sm font-bold text-gray-700">{label}</label>
        <span className="text-sm font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">{value.toLocaleString()}</span>
      </div>
      <input 
        type="range" 
        min={min} 
        max={max} 
        step={step} 
        value={value} 
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full h-2 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-emerald-500"
      />
    </div>
  );
}
