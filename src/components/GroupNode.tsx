import { NodeResizer, Handle, Position, NodeToolbar } from '@xyflow/react';
import { ChevronDown, ChevronRight, Layers, Image as ImageIcon } from 'lucide-react';
import { NodeData } from '../models/types';
import { useGraphStore } from '../store/graphStore';
import { icons } from '../utils/icons';

export default function GroupNode({ id, data, selected }: { id: string; data: NodeData; selected: boolean }) {
  const updateNodeData = useGraphStore((state) => state.updateNodeData);
  const drillDown = useGraphStore((state) => state.drillDown);
  const nodes = useGraphStore((state) => state.nodes);
  const simulationActiveNodeId = useGraphStore((state) => state.simulationActiveNodeId);
  
  const isSimulationActive = simulationActiveNodeId === id;

  const toggleCollapse = (e: React.MouseEvent) => {
    e.stopPropagation();
    drillDown(id);
  };

  const childCount = nodes.filter(n => n.parentId === id).length;

  const renderIcon = (className: string = "w-4 h-4") => {
    if (data.iconUrl) {
      return <img src={data.iconUrl} alt="icon" className={`${className} object-contain`} />;
    }
    if (data.icon && icons[data.icon as keyof typeof icons]) {
      const IconComponent = icons[data.icon as keyof typeof icons];
      return <IconComponent className={className} />;
    }
    return null;
  };

  const tooltip = (
    <NodeToolbar 
      isVisible={undefined}
      position={Position.Top}
      className="z-50"
    >
      <div className="bg-slate-900 text-white p-3 rounded-lg shadow-xl border border-slate-700 max-w-xs animate-in fade-in zoom-in duration-200">
        <div className="flex items-center gap-2 mb-1">
          {renderIcon("w-4 h-4 text-indigo-400")}
          <h4 className="text-sm font-bold truncate">{data.title || 'Untitled Group'}</h4>
        </div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
          Group Node {childCount > 0 && `(${childCount} children)`}
        </div>
        {data.description && (
          <p className="text-xs text-slate-300 leading-relaxed line-clamp-4">
            {data.description}
          </p>
        )}
        {!data.description && (
          <p className="text-xs text-slate-500 italic">No description available</p>
        )}
      </div>
    </NodeToolbar>
  );

  return (
    <>
      {tooltip}
      <NodeResizer 
        color="#6366f1" 
        isVisible={selected} 
        minWidth={100} 
        minHeight={100} 
        onResize={(_, params) => {
          useGraphStore.getState().updateNodePosition(id, { x: params.x, y: params.y });
          useGraphStore.getState().updateNodeData(id, data, { width: params.width, height: params.height });
        }}
        onResizeEnd={() => useGraphStore.getState().takeSnapshot()}
      />
      <Handle type="target" position={Position.Top} id="top" className="w-3 h-3 bg-indigo-400 dark:bg-indigo-500 z-20" />
      <Handle type="source" position={Position.Right} id="right" className="w-3 h-3 bg-indigo-400 dark:bg-indigo-500 z-20" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="w-3 h-3 bg-indigo-400 dark:bg-indigo-500 z-20" />
      <Handle type="target" position={Position.Left} id="left" className="w-3 h-3 bg-indigo-400 dark:bg-indigo-500 z-20" />
      <div
        className={`w-full h-full rounded-xl border-2 backdrop-blur-sm transition-colors relative ${
          selected ? 'border-indigo-500 ring-2 ring-indigo-200 dark:ring-indigo-900/50' : 'border-slate-300 dark:border-slate-700 border-dashed'
        } ${
          isSimulationActive ? 'ring-4 ring-emerald-400 dark:ring-emerald-500 ring-offset-2 dark:ring-offset-slate-900 z-50 animate-pulse' : ''
        }`}
        style={{ backgroundColor: data.color ? `${data.color}80` : undefined }}
      >
        <div className={`px-4 py-2 bg-white/80 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 flex items-center justify-between pointer-events-auto ${
          data.isCollapsed ? 'rounded-xl h-full' : 'rounded-t-lg border-b'
        }`}>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              {renderIcon("w-4 h-4")}
            </div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{data.title || 'Group'}</h3>
            {data.isCollapsed && childCount > 0 && (
              <span className="flex items-center gap-1 text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full">
                <Layers className="w-3 h-3" />
                {childCount}
              </span>
            )}
          </div>
          <button
            onClick={toggleCollapse}
            className="p-1 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded transition-colors"
            title={data.isCollapsed ? "Expand Group" : "Collapse Group"}
          >
            {data.isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
        {selected && !data.isCollapsed && (
          <div className="absolute bottom-1 right-1 pointer-events-none text-indigo-400 opacity-50">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="21" y1="21" x2="12" y2="12" />
              <line x1="21" y1="16" x2="16" y2="21" />
            </svg>
          </div>
        )}
      </div>
    </>
  );
}
