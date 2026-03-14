import React, { useState } from 'react';
import { useGraphStore } from '../store/graphStore';
import { Share2, Github, Trello, Clipboard, Check, Download, X, ListTodo } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const TaskExportModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { nodes, edges } = useGraphStore();
  const [platform, setPlatform] = useState<'github' | 'trello' | 'jira'>('github');
  const [copied, setCopied] = useState(false);

  // Filter for nodes that are likely "Action" nodes
  const actionNodes = nodes.filter(n => {
    const nodeType = (n.data as any).nodeType?.toLowerCase() || '';
    const tags = (n.data as any).tags || [];
    return nodeType.includes('action') || 
           nodeType.includes('task') ||
           tags.some((t: string) => t.toLowerCase().includes('action'));
  });

  const generateExportData = () => {
    if (platform === 'github') {
      return actionNodes.map(n => ({
        title: n.data.title,
        body: `${n.data.description}\n\n---\n*Exported from Process Atlas*`,
        labels: n.data.tags || []
      }));
    } else if (platform === 'trello') {
      return actionNodes.map(n => ({
        name: n.data.title,
        desc: n.data.description,
        pos: 'top'
      }));
    } else {
      // Jira
      return actionNodes.map(n => ({
        fields: {
          project: { key: 'PROJ' },
          summary: n.data.title,
          description: n.data.description,
          issuetype: { name: 'Task' }
        }
      }));
    }
  };

  const handleCopy = () => {
    const data = JSON.stringify(generateExportData(), null, 2);
    navigator.clipboard.writeText(data);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const data = JSON.stringify(generateExportData(), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tasks-${platform}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    >
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden border border-white/20">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
              <Share2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Export as Tasks</h2>
              <p className="text-slate-500 text-sm">Convert action nodes into project management tasks</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X className="w-6 h-6 text-slate-500" />
          </button>
        </div>

        <div className="p-8">
          <div className="grid grid-cols-3 gap-4 mb-8">
            <button
              onClick={() => setPlatform('github')}
              className={`flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all ${
                platform === 'github' ? 'border-indigo-600 bg-indigo-50 text-indigo-600' : 'border-slate-100 hover:border-slate-200 text-slate-500'
              }`}
            >
              <Github className="w-8 h-8" />
              <span className="font-bold text-sm">GitHub Issues</span>
            </button>
            <button
              onClick={() => setPlatform('trello')}
              className={`flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all ${
                platform === 'trello' ? 'border-indigo-600 bg-indigo-50 text-indigo-600' : 'border-slate-100 hover:border-slate-200 text-slate-500'
              }`}
            >
              <Trello className="w-8 h-8" />
              <span className="font-bold text-sm">Trello Cards</span>
            </button>
            <button
              onClick={() => setPlatform('jira')}
              className={`flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all ${
                platform === 'jira' ? 'border-indigo-600 bg-indigo-50 text-indigo-600' : 'border-slate-100 hover:border-slate-200 text-slate-500'
              }`}
            >
              <ListTodo className="w-8 h-8" />
              <span className="font-bold text-sm">Jira Tasks</span>
            </button>
          </div>

          <div className="bg-slate-900 rounded-2xl p-6 mb-8 relative group">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Preview ({actionNodes.length} tasks)</span>
              <div className="flex gap-2">
                <button
                  onClick={handleCopy}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
                  title="Copy JSON"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Clipboard className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto custom-scrollbar">
              <pre className="text-xs text-indigo-300 font-mono">
                {JSON.stringify(generateExportData().slice(0, 2), null, 2)}
                {actionNodes.length > 2 && '\n  ...'}
              </pre>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
            <div className="flex items-center gap-3 text-indigo-700">
              <Download className="w-5 h-5" />
              <span className="text-sm font-medium">Download JSON for bulk import</span>
            </div>
            <button
              onClick={handleDownload}
              className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-900/20"
            >
              Download
            </button>
          </div>
        </div>
        
        <div className="p-6 bg-slate-50 text-center">
          <p className="text-xs text-slate-400">
            Tip: Use the generated JSON with the official CLI or API of your chosen platform for bulk creation.
          </p>
        </div>
      </div>
    </motion.div>
  );
};
