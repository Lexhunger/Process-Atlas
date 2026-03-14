import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, Legend 
} from 'recharts';
import { 
  Activity, TrendingUp, DollarSign, Cpu, Database, 
  Calendar, ArrowUpRight, ArrowDownRight, X, Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface UsageLog {
  id: string;
  model: string;
  totalTokens: number;
  cost: number;
  timestamp: number;
  feature: string;
}

export default function MonitoringDashboard({ onClose }: { onClose: () => void }) {
  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('7d');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'usage_logs'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('timestamp', 'desc'),
      limit(500)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newLogs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as UsageLog));
      setLogs(newLogs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Process data for charts
  const totalCost = logs.reduce((sum, log) => sum + log.cost, 0);
  const totalTokens = logs.reduce((sum, log) => sum + log.totalTokens, 0);
  
  const modelUsage = logs.reduce((acc, log) => {
    acc[log.model] = (acc[log.model] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.entries(modelUsage).map(([name, value]) => ({ name, value }));
  
  const dailyData = logs.reduce((acc, log) => {
    const date = new Date(log.timestamp).toLocaleDateString();
    if (!acc[date]) {
      acc[date] = { date, cost: 0, tokens: 0 };
    }
    acc[date].cost += log.cost;
    acc[date].tokens += log.totalTokens;
    return acc;
  }, {} as Record<string, { date: string; cost: number; tokens: number }>);

  const chartData = Object.values(dailyData).reverse();

  const COLORS = ['#10b981', '#6366f1', '#f59e0b', '#ef4444'];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[200] flex items-center justify-center p-4"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-500/20 rounded-2xl flex items-center justify-center">
              <Activity className="w-7 h-7 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">AI Usage Monitoring</h2>
              <p className="text-slate-400 text-sm">Track your API consumption and estimated costs.</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard 
              title="Total Estimated Cost" 
              value={`$${totalCost.toFixed(4)}`} 
              icon={<DollarSign className="w-5 h-5 text-emerald-400" />}
              trend="+12%"
              trendUp={true}
            />
            <StatCard 
              title="Total Tokens" 
              value={totalTokens.toLocaleString()} 
              icon={<Cpu className="w-5 h-5 text-indigo-400" />}
              trend="-5%"
              trendUp={false}
            />
            <StatCard 
              title="Total API Calls" 
              value={logs.length.toString()} 
              icon={<Activity className="w-5 h-5 text-amber-400" />}
              trend="+8%"
              trendUp={true}
            />
            <StatCard 
              title="Avg. Cost per Call" 
              value={`$${(totalCost / (logs.length || 1)).toFixed(5)}`} 
              icon={<Clock className="w-5 h-5 text-slate-400" />}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Chart */}
            <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-indigo-400" />
                  Cost Over Time
                </h3>
                <div className="flex bg-slate-900 rounded-lg p-1">
                  {(['24h', '7d', '30d'] as const).map(range => (
                    <button
                      key={range}
                      onClick={() => setTimeRange(range)}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                        timeRange === range ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {range}
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v.toFixed(3)}`} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px' }}
                      itemStyle={{ color: '#f8fafc' }}
                    />
                    <Bar dataKey="cost" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Model Distribution */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
              <h3 className="font-bold text-white mb-6 flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-400" />
                Model Distribution
              </h3>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px' }}
                    />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Recent Logs */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-700/50 flex items-center justify-between">
              <h3 className="font-bold text-white">Recent API Activity</h3>
              <button className="text-xs text-indigo-400 hover:text-indigo-300 font-medium">View All Logs</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-900/50 text-slate-400 text-xs uppercase tracking-wider">
                    <th className="px-6 py-4 font-semibold">Timestamp</th>
                    <th className="px-6 py-4 font-semibold">Model</th>
                    <th className="px-6 py-4 font-semibold">Feature</th>
                    <th className="px-6 py-4 font-semibold text-right">Tokens</th>
                    <th className="px-6 py-4 font-semibold text-right">Est. Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {logs.slice(0, 5).map(log => (
                    <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4 text-sm text-slate-300">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-slate-700 text-slate-200 text-[10px] font-bold rounded uppercase">
                          {log.model.split('-')[1] || log.model}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-400">
                        {log.feature}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-300 text-right font-mono">
                        {log.totalTokens.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-sm text-emerald-400 text-right font-mono">
                        ${log.cost.toFixed(5)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function StatCard({ title, value, icon, trend, trendUp }: { title: string; value: string; icon: React.ReactNode; trend?: string; trendUp?: boolean }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="p-2 bg-slate-900 rounded-lg">
          {icon}
        </div>
        {trend && (
          <div className={`flex items-center text-xs font-bold ${trendUp ? 'text-emerald-400' : 'text-red-400'}`}>
            {trendUp ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
            {trend}
          </div>
        )}
      </div>
      <div className="text-2xl font-bold text-white mb-1">{value}</div>
      <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">{title}</div>
    </div>
  );
}
