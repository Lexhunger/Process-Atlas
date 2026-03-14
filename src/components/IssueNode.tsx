import { useState, useEffect } from 'react';
import { Handle, Position, NodeResizer, NodeToolbar } from '@xyflow/react';
import { ExternalLink, AlertCircle, CheckCircle2, Clock, Tag, Loader2 } from 'lucide-react';
import { NodeData } from '../models/types';
import { useGraphStore } from '../store/graphStore';

export default function IssueNode({ id, data, selected }: { id: string; data: NodeData; selected: boolean }) {
  const issueManagementConfigs = useGraphStore((state) => state.issueManagementConfigs);
  const updateNodeData = useGraphStore((state) => state.updateNodeData);
  const config = issueManagementConfigs.find(c => c.id === data.issueConfigId);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    if (data.issueId && config && !data.title) {
      fetchIssueData();
    }
  }, [data.issueId, config?.id]);

  const fetchIssueData = async () => {
    if (!data.issueId || !config) return;
    
    setLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Mock data based on issue ID
    const issueId = data.issueId as string;
    const isDefect = issueId.startsWith('DEF-');
    const mockData = {
      title: isDefect ? `Defect: ${issueId} - System crash on login` : `Story: ${issueId} - Implement user profile dashboard`,
      metadata: {
        status: isDefect ? 'In Progress' : 'To Do',
        priority: isDefect ? 'High' : 'Medium',
        updatedAt: new Date().toISOString()
      },
      nodeType: isDefect ? 'Defect' : 'Story'
    };

    updateNodeData(id, mockData);
    setLoading(false);
  };
  
  const statusColors: Record<string, string> = {
    'To Do': 'bg-slate-100 text-slate-600 border-slate-200',
    'In Progress': 'bg-blue-100 text-blue-600 border-blue-200',
    'Done': 'bg-emerald-100 text-emerald-600 border-emerald-200',
    'Blocked': 'bg-rose-100 text-rose-600 border-rose-200',
  };

  const status = (data.metadata?.status as string) || 'To Do';
  const priority = (data.metadata?.priority as string) || 'Medium';

  return (
    <>
      <NodeResizer 
        color="#6366f1" 
        isVisible={selected} 
        minWidth={250} 
        minHeight={150} 
      />
      <Handle type="target" position={Position.Top} id="top" className="w-3 h-3 bg-indigo-500 z-20" />
      <Handle type="source" position={Position.Right} id="right" className="w-3 h-3 bg-indigo-500 z-20" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="w-3 h-3 bg-indigo-500 z-20" />
      <Handle type="target" position={Position.Left} id="left" className="w-3 h-3 bg-indigo-500 z-20" />
      
      <div
        className={`w-full h-full rounded-xl border-2 bg-white dark:bg-slate-800 shadow-lg transition-all flex flex-col overflow-hidden ${
          selected ? 'border-indigo-500 ring-2 ring-indigo-200 dark:ring-indigo-900/50' : 'border-slate-200 dark:border-slate-700'
        }`}
        style={{ backgroundColor: data.color || undefined }}
      >
        {/* Header */}
        <div className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-100 dark:border-indigo-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-indigo-600 rounded flex items-center justify-center text-white font-bold text-[10px]">
              {config?.provider[0] || 'I'}
            </div>
            <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">
              {config?.provider || 'Issue'}
            </span>
          </div>
          <a 
            href={`${config?.url}/browse/${data.issueId as string}`} 
            target="_blank" 
            rel="noopener noreferrer"
            className="p-1 text-indigo-600 hover:bg-indigo-100 dark:hover:bg-indigo-800 rounded transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Content */}
        <div className="p-4 flex-1 flex flex-col gap-3">
          <div>
            <div className="text-[10px] font-medium text-slate-400 mb-1 uppercase tracking-tighter">
              {(data.issueId as string) || 'NO-ID'}
            </div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-tight line-clamp-2">
              {loading ? (
                <span className="flex items-center gap-2 text-slate-400 font-normal">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Fetching issue...
                </span>
              ) : (
                (data.title as string) || 'No issue data'
              )}
            </h3>
          </div>

          {!loading && data.title && (
            <div className="flex flex-wrap gap-2 mt-auto">
              <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusColors[status] || statusColors['To Do']}`}>
                {status}
              </div>
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                <AlertCircle className="w-3 h-3" />
                {priority}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900/40 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-500">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{data.metadata?.updatedAt ? `Updated ${new Date(data.metadata.updatedAt).toLocaleDateString()}` : 'Not synced'}</span>
          </div>
          <div className="flex items-center gap-1">
            <Tag className="w-3 h-3" />
            <span>{data.nodeType || 'Issue'}</span>
          </div>
        </div>
      </div>
    </>
  );
}
