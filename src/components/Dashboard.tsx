import React from 'react';
import { useGraphStore } from '../store/graphStore';
import { BarChart3, PieChart, Activity, Layers, Hash, Link as LinkIcon, X } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, PieChart as RePieChart, Pie } from 'recharts';

interface DashboardProps {
  onClose: () => void;
}

export default function Dashboard({ onClose }: DashboardProps) {
  const { nodes, edges } = useGraphStore();

  // Calculate stats
  const totalNodes = nodes.length;
  const totalEdges = edges.length;
  const nodeTypes = nodes.reduce((acc: Record<string, number>, node) => {
    const type = (node.data as any).nodeType || 'General';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  const typeData = Object.entries(nodeTypes).map(([name, value]) => ({ name, value }));
  
  const shapes = nodes.reduce((acc: Record<string, number>, node) => {
    const shape = (node.data as any).shape || 'rectangle';
    acc[shape] = (acc[shape] || 0) + 1;
    return acc;
  }, {});

  const shapeData = Object.entries(shapes).map(([name, value]) => ({ name, value }));

  const COLORS = ['#6366f1', '#f43f5e', '#f59e0b', '#10b981', '#0ea5e9', '#8b5cf6', '#ec4899'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
              <BarChart3 className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Process Analytics</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Insights and metrics for your current process map</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500 dark:text-slate-400"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Quick Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard 
              icon={<Layers className="w-5 h-5 text-blue-500" />}
              label="Total Nodes"
              value={totalNodes}
              color="blue"
            />
            <StatCard 
              icon={<LinkIcon className="w-5 h-5 text-rose-500" />}
              label="Total Edges"
              value={totalEdges}
              color="rose"
            />
            <StatCard 
              icon={<Activity className="w-5 h-5 text-emerald-500" />}
              label="Complexity"
              value={totalNodes > 0 ? (totalEdges / totalNodes).toFixed(2) : '0'}
              subLabel="Edges per Node"
              color="emerald"
            />
            <StatCard 
              icon={<Hash className="w-5 h-5 text-amber-500" />}
              label="Unique Types"
              value={Object.keys(nodeTypes).length}
              color="amber"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Node Types Chart */}
            <div className="bg-slate-50 dark:bg-slate-800/30 p-6 rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 mb-6">
                <PieChart className="w-5 h-5 text-indigo-500" />
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">Node Type Distribution</h3>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RePieChart>
                    <Pie
                      data={typeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {typeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#f8fafc' }}
                      itemStyle={{ color: '#f8fafc' }}
                    />
                  </RePieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 flex flex-wrap gap-4 justify-center">
                {typeData.map((entry, index) => (
                  <div key={entry.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <span className="text-xs text-slate-600 dark:text-slate-400">{entry.name} ({entry.value})</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Node Shapes Chart */}
            <div className="bg-slate-50 dark:bg-slate-800/30 p-6 rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 mb-6">
                <BarChart3 className="w-5 h-5 text-indigo-500" />
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">Shape Usage</h3>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={shapeData}>
                    <XAxis dataKey="name" fontSize={10} tick={{ fill: '#94a3b8' }} />
                    <YAxis fontSize={10} tick={{ fill: '#94a3b8' }} />
                    <Tooltip 
                      cursor={{ fill: 'rgba(99, 102, 241, 0.1)' }}
                      contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#f8fafc' }}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {shapeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-lg shadow-indigo-500/20 transition-all"
          >
            Close Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, subLabel, color }: { icon: React.ReactNode, label: string, value: string | number, subLabel?: string, color: string }) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-900/30',
    rose: 'bg-rose-50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-900/30',
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-900/30',
    amber: 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-900/30',
  };

  return (
    <div className={`p-4 rounded-xl border ${colorClasses[color]}`}>
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-white dark:bg-slate-900 rounded-lg shadow-sm">
          {icon}
        </div>
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</span>
        {subLabel && <span className="text-[10px] text-slate-500 dark:text-slate-400">{subLabel}</span>}
      </div>
    </div>
  );
}
