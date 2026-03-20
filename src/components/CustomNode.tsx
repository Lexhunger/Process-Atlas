import { Handle, Position, NodeResizer, NodeToolbar } from '@xyflow/react';
import { Layers, ChevronDown, ChevronRight, Image as ImageIcon, Info } from 'lucide-react';
import { NodeData } from '../models/types';
import { useGraphStore } from '../store/graphStore';
import { icons } from '../utils/icons';

export default function CustomNode({ id, data, selected }: { id: string; data: NodeData; selected: boolean }) {
  const updateNodeData = useGraphStore((state) => state.updateNodeData);
  const drillDown = useGraphStore((state) => state.drillDown);
  const nodes = useGraphStore((state) => state.nodes);
  const edges = useGraphStore((state) => state.edges);
  const onConnect = useGraphStore((state) => state.onConnect);
  const deleteEdge = useGraphStore((state) => state.deleteEdge);
  const simulationActiveNodeId = useGraphStore((state) => state.simulationActiveNodeId);
  const impactAnalysisMode = useGraphStore((state) => state.impactAnalysisMode);
  const impactSelectedNode = useGraphStore((state) => state.impactSelectedNode);
  const hiddenLayers = useGraphStore((state) => state.hiddenLayers);
  
  const isSimulationActive = simulationActiveNodeId === id;
  const shape = data.shape || 'rectangle';
  const isExpanded = data.isExpanded;
  
  // Check if node is hidden by layer filtering
  if (data.layer && hiddenLayers.includes(data.layer)) {
    return null; // Don't render if layer is hidden
  }

  // Compute impact status
  let impactStatus: 'selected' | 'upstream' | 'downstream' | 'none' | 'dimmed' = 'none';
  if (impactAnalysisMode && impactSelectedNode) {
    if (id === impactSelectedNode) {
      impactStatus = 'selected';
    } else {
      const isDownstream = (startId: string, targetId: string, visited = new Set<string>()): boolean => {
        if (startId === targetId) return true;
        visited.add(startId);
        const outgoingEdges = edges.filter(e => e.source === startId);
        for (const edge of outgoingEdges) {
          if (!visited.has(edge.target)) {
            if (isDownstream(edge.target, targetId, visited)) return true;
          }
        }
        return false;
      };

      const isUpstream = (startId: string, targetId: string, visited = new Set<string>()): boolean => {
        if (startId === targetId) return true;
        visited.add(startId);
        const incomingEdges = edges.filter(e => e.target === startId);
        for (const edge of incomingEdges) {
          if (!visited.has(edge.source)) {
            if (isUpstream(edge.source, targetId, visited)) return true;
          }
        }
        return false;
      };

      if (isDownstream(impactSelectedNode, id)) {
        impactStatus = 'downstream';
      } else if (isUpstream(impactSelectedNode, id)) {
        impactStatus = 'upstream';
      } else {
        impactStatus = 'dimmed';
      }
    }
  } else if (impactAnalysisMode && !impactSelectedNode) {
    impactStatus = 'dimmed'; // Dim all if mode is active but nothing selected
  }
  
  const toggleExpand = (e: React.MouseEvent) => {
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

  const getHierarchicalNodes = () => {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    
    // Find descendants of currentId to exclude them
    const descendants = new Set<string>();
    const findDescendants = (nodeId: string) => {
      nodes.filter(n => n.parentId === nodeId).forEach(child => {
        descendants.add(child.id);
        findDescendants(child.id);
      });
    };
    findDescendants(id);
    
    const getPath = (node: any) => {
      const path = [node.data.title || 'Untitled Node'];
      let current = node;
      while (current.parentId && nodeMap.has(current.parentId)) {
        current = nodeMap.get(current.parentId);
        path.unshift(current.data.title || 'Untitled Node');
      }
      return path.join(' > ');
    };
    
    return nodes
      .filter(n => n.id !== id && !descendants.has(n.id))
      .map(n => ({
        id: n.id,
        label: getPath(n)
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  };

  const handleReferenceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const targetId = e.target.value;
    
    if (!targetId) {
      updateNodeData(id, { referenceTarget: '' });
      // Find existing incoming edges to this reference node
      const existingEdges = edges.filter(edge => edge.target === id);
      // Delete existing edges
      existingEdges.forEach(edge => {
        deleteEdge(edge.id);
      });
    } else {
      // Create new edge if a target is selected, onConnect will handle the cleanup and data update
      onConnect({
        source: targetId,
        target: id,
        sourceHandle: 'right', // Default handle
        targetHandle: 'left', // Default handle
      });
    }
  };

  const tooltip = (
    <NodeToolbar 
      isVisible={undefined} // undefined means it shows on hover by default in some versions, but let's check
      position={Position.Top}
      className="z-50"
    >
      <div className="bg-slate-900 text-white p-3 rounded-lg shadow-xl border border-slate-700 max-w-xs animate-in fade-in zoom-in duration-200">
        <div className="flex items-center gap-2 mb-1">
          {renderIcon("w-4 h-4 text-indigo-400")}
          <h4 className="text-sm font-bold truncate">{data.title || 'Untitled Node'}</h4>
        </div>
        {data.nodeType && (
          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
            {data.nodeType}
          </div>
        )}
        {data.description && (
          <p className="text-xs text-slate-300 leading-relaxed line-clamp-4">
            {data.description}
          </p>
        )}
        {!data.description && !data.nodeType && (
          <p className="text-xs text-slate-500 italic">No description available</p>
        )}
      </div>
    </NodeToolbar>
  );

  if (isExpanded) {
    return (
      <div className="group w-full h-full">
        {tooltip}
        <NodeResizer 
          color="#6366f1" 
          isVisible={selected} 
          minWidth={200} 
          minHeight={150} 
          onResize={(_, params) => {
            useGraphStore.getState().updateNodePosition(id, { x: params.x, y: params.y });
            useGraphStore.getState().updateNodeData(id, data, { width: params.width, height: params.height });
          }}
          onResizeEnd={() => useGraphStore.getState().takeSnapshot()}
        />
        <>
          <Handle type="target" position={Position.Top} id="top" className="w-3 h-3 bg-indigo-400 dark:bg-indigo-500 z-50" />
          <Handle type="target" position={Position.Left} id="left" className="w-3 h-3 bg-indigo-400 dark:bg-indigo-500 z-50" />
          {data.nodeType !== 'reference' && (
            <>
              <Handle type="source" position={Position.Right} id="right" className="w-3 h-3 bg-indigo-400 dark:bg-indigo-500 z-50" />
              <Handle type="source" position={Position.Bottom} id="bottom" className="w-3 h-3 bg-indigo-400 dark:bg-indigo-500 z-50" />
              
              {/* Extra Handles for multiple edges */}
              <Handle type="target" position={Position.Top} id="top-left" className="w-3 h-3 bg-indigo-400 dark:bg-indigo-500 z-50 opacity-0 group-hover:opacity-100 transition-opacity" style={{ left: '25%' }} />
              <Handle type="target" position={Position.Top} id="top-right" className="w-3 h-3 bg-indigo-400 dark:bg-indigo-500 z-50 opacity-0 group-hover:opacity-100 transition-opacity" style={{ left: '75%' }} />
              <Handle type="target" position={Position.Left} id="left-top" className="w-3 h-3 bg-indigo-400 dark:bg-indigo-500 z-50 opacity-0 group-hover:opacity-100 transition-opacity" style={{ top: '25%' }} />
              <Handle type="target" position={Position.Left} id="left-bottom" className="w-3 h-3 bg-indigo-400 dark:bg-indigo-500 z-50 opacity-0 group-hover:opacity-100 transition-opacity" style={{ top: '75%' }} />
              <Handle type="source" position={Position.Right} id="right-top" className="w-3 h-3 bg-indigo-400 dark:bg-indigo-500 z-50 opacity-0 group-hover:opacity-100 transition-opacity" style={{ top: '25%' }} />
              <Handle type="source" position={Position.Right} id="right-bottom" className="w-3 h-3 bg-indigo-400 dark:bg-indigo-500 z-50 opacity-0 group-hover:opacity-100 transition-opacity" style={{ top: '75%' }} />
              <Handle type="source" position={Position.Bottom} id="bottom-left" className="w-3 h-3 bg-indigo-400 dark:bg-indigo-500 z-50 opacity-0 group-hover:opacity-100 transition-opacity" style={{ left: '25%' }} />
              <Handle type="source" position={Position.Bottom} id="bottom-right" className="w-3 h-3 bg-indigo-400 dark:bg-indigo-500 z-50 opacity-0 group-hover:opacity-100 transition-opacity" style={{ left: '75%' }} />
            </>
          )}
        </>
        <div
          className={`w-full h-full rounded-xl border-2 backdrop-blur-sm flex flex-col relative ${
            selected ? 'border-indigo-500 ring-2 ring-indigo-200 dark:ring-indigo-900/50' : 'border-slate-300 dark:border-slate-700 border-dashed'
          }`}
          style={{ backgroundColor: data.color ? `${data.color}80` : undefined }}
        >
          <div className="px-4 py-2 bg-white/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between rounded-t-lg">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                {renderIcon("w-4 h-4")}
                <span className="text-xs font-semibold uppercase tracking-wider">
                  {data.nodeType === 'default' ? '' : (data.nodeType || '')}
                </span>
              </div>
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 ml-2">{data.title}</h3>
              {childCount > 0 && (
                <span className="flex items-center gap-1 text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full ml-2">
                  <Layers className="w-3 h-3" />
                  {childCount}
                </span>
              )}
            </div>
            <button
              onClick={toggleExpand}
              className="p-1 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded transition-colors"
              title="Collapse Node"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 p-4">
            {/* Children will be rendered here by React Flow */}
          </div>
          {selected && (
            <div className="absolute bottom-1 right-1 pointer-events-none text-indigo-400 opacity-50">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="21" y1="21" x2="12" y2="12" />
                <line x1="21" y1="16" x2="16" y2="21" />
              </svg>
            </div>
          )}
        </div>
      </div>
    );
  }

  const isDiamond = shape === 'diamond';
  const isCircle = shape === 'circle';
  const isPill = shape === 'pill';
  const isParallelogram = shape === 'parallelogram';
  const isHexagon = shape === 'hexagon';
  const isCylinder = shape === 'cylinder' || shape === 'database';
  const isDocument = shape === 'document' || shape === 'note';
  const isComponent = shape === 'component';
  const isGear = shape === 'gear';
  const isStep = shape === 'step';
  const isFolder = shape === 'folder';
  const isJira = shape === 'jira';
  const isCloud = shape === 'cloud';
  const isActor = shape === 'actor';
  const isCallout = shape === 'callout';
  const isBrowser = shape === 'browser';
  const isStack = shape === 'stack';
  const isQueue = shape === 'queue';
  const isRepository = shape === 'repository';
  const isBug = shape === 'bug';
  const isStory = shape === 'story';

  // Hexagon requires clip-path, we'll use a specific class for it if needed, 
  // but for simplicity we can use standard CSS for most.
  
  const containerClasses = `group relative flex items-center justify-center transition-all duration-300 ${
    impactStatus === 'dimmed' ? 'opacity-30 grayscale' : ''
  } ${
    isDiamond ? 'rotate-45 aspect-square' : 
    isCircle ? 'w-auto h-auto aspect-square' : 
    isParallelogram ? '' :
    isHexagon ? '' :
    isCylinder ? '' :
    isDocument ? '' :
    isComponent ? '' :
    isGear ? 'aspect-square' :
    isStep ? '' :
    isFolder ? '' :
    isJira ? '' :
    isCloud ? '' :
    isActor ? '' :
    isCallout ? '' :
    isBrowser ? '' :
    isStack ? '' :
    isQueue ? '' :
    isRepository ? '' :
    isBug ? '' :
    isStory ? '' :
    ''
  }`;

  const bgClasses = `absolute inset-0 border-2 shadow-md transition-all duration-300 ${
    !data.color && shape !== 'note' && !isActor ? 'bg-white dark:bg-slate-800' : ''
  } ${
    selected ? 'border-indigo-500 shadow-lg ring-2 ring-indigo-200 dark:ring-indigo-900/50' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
  } ${
    isSimulationActive ? 'ring-4 ring-emerald-400 dark:ring-emerald-500 ring-offset-2 dark:ring-offset-slate-900 z-50 animate-pulse' : ''
  } ${
    impactStatus === 'selected' ? 'ring-4 ring-indigo-500 dark:ring-indigo-400 ring-offset-2 dark:ring-offset-slate-900 z-50' :
    impactStatus === 'downstream' ? 'ring-4 ring-red-500 dark:ring-red-400 ring-offset-2 dark:ring-offset-slate-900 z-40 bg-red-50 dark:bg-red-900/20' :
    impactStatus === 'upstream' ? 'ring-4 ring-yellow-500 dark:ring-yellow-400 ring-offset-2 dark:ring-offset-slate-900 z-40 bg-yellow-50 dark:bg-yellow-900/20' :
    ''
  } ${
    data.criticality === 'mission-critical' ? 'border-red-500 dark:border-red-500 border-4' :
    data.criticality === 'business-operational' ? 'border-amber-500 dark:border-amber-500 border-4' : ''
  } ${
    isDiamond ? 'rounded-lg' :
    isCircle ? 'rounded-full' :
    isPill ? 'rounded-full' :
    isParallelogram ? '-skew-x-12 rounded-lg' :
    isHexagon ? 'rounded-lg' :
    isCylinder ? '' : // Handled in style
    isDocument ? '' : // Handled in style
    isComponent ? 'rounded-lg' :
    isGear ? '' :
    isStep ? 'rounded-sm' :
    isFolder ? 'rounded-sm' :
    isJira ? 'rounded-md border-l-4 border-l-blue-500 dark:border-l-blue-400' :
    isBug ? 'rounded-md border-l-4 border-l-red-500 dark:border-l-red-400' :
    isStory ? 'rounded-md border-l-4 border-l-emerald-500 dark:border-l-emerald-400' :
    isCloud ? '' :
    isActor ? 'border-none shadow-none bg-transparent' :
    isCallout ? 'rounded-xl' :
    isBrowser ? 'rounded-lg overflow-hidden' :
    isStack ? 'rounded-lg' :
    isQueue ? 'rounded-none border-t-2 border-b-2 border-l-0 border-r-0' :
    'rounded-lg'
  }`;

  const contentClasses = `relative z-10 flex flex-col gap-1 w-full ${
    isDiamond ? 'items-center text-center max-w-[110px] -rotate-45' :
    isCircle ? 'items-center text-center max-w-[120px]' :
    isGear || isActor ? 'items-center text-center max-w-[110px]' : ''
  }`;

  const scale = data.scale || 1;
  const hasCustomBg = !!data.color || shape === 'note';

  const getStyle = () => {
    let bgColor = data.color;
    if (!bgColor && shape === 'note') {
      bgColor = '#fef08a'; // yellow-200
    }
    
    const style: any = { backgroundColor: bgColor || undefined };
    if (isHexagon) style.clipPath = 'polygon(10% 0, 90% 0, 100% 50%, 90% 100%, 10% 100%, 0 50%)';
    if (isDocument) style.clipPath = 'polygon(0 0, calc(100% - 24px) 0, 100% 24px, 100% 100%, 0 100%)';
    if (isCylinder) style.borderRadius = '50% / 15px';
    if (isStep) style.clipPath = 'polygon(0% 0%, 85% 0%, 100% 50%, 85% 100%, 0% 100%, 15% 50%)';
    if (isFolder) style.clipPath = 'polygon(0 0, 35% 0, 45% 20%, 100% 20%, 100% 100%, 0 100%)';
    if (isCloud) {
      style.clipPath = 'polygon(10% 50%, 15% 30%, 30% 20%, 50% 15%, 70% 20%, 85% 30%, 90% 50%, 85% 70%, 70% 80%, 50% 85%, 30% 80%, 15% 70%)';
    }
    if (isGear) {
      style.clipPath = 'polygon(40% 0%, 60% 0%, 60% 10%, 75% 15%, 85% 5%, 95% 15%, 85% 25%, 90% 40%, 100% 40%, 100% 60%, 90% 60%, 85% 75%, 95% 85%, 85% 95%, 75% 85%, 60% 90%, 60% 100%, 40% 100%, 40% 90%, 25% 85%, 15% 95%, 5% 85%, 15% 75%, 10% 60%, 0% 60%, 0% 40%, 10% 40%, 15% 25%, 5% 15%, 15% 5%, 25% 15%, 40% 10%)';
    }
    if (isCallout) {
      style.clipPath = 'polygon(0% 0%, 100% 0%, 100% 75%, 75% 75%, 75% 100%, 50% 75%, 0% 75%)';
    }
    if (isActor) {
      style.backgroundColor = 'transparent';
    }
    return style;
  };

  const getContainerStyle = () => {
    const style: any = {};
    
    if (isDiamond) { style.width = `${160 * scale}px`; style.height = `${160 * scale}px`; }
    else if (isCircle) { style.width = `${60 * scale}px`; style.height = `${60 * scale}px`; style.padding = `${12 * scale}px`; }
    else if (isPill) { style.width = `${160 * scale}px`; style.padding = `${8 * scale}px ${16 * scale}px`; }
    else if (isParallelogram) { style.width = `${160 * scale}px`; style.padding = `${8 * scale}px ${24 * scale}px`; }
    else if (isHexagon) { style.width = `${160 * scale}px`; style.height = `${100 * scale}px`; style.padding = `${16 * scale}px ${24 * scale}px`; }
    else if (isCylinder) { style.width = `${150 * scale}px`; style.height = `${100 * scale}px`; style.padding = `${24 * scale}px ${16 * scale}px`; }
    else if (isDocument) { style.width = `${150 * scale}px`; style.height = `${110 * scale}px`; style.padding = `${20 * scale}px ${16 * scale}px`; }
    else if (isComponent) { style.width = `${160 * scale}px`; style.height = `${100 * scale}px`; style.padding = `${16 * scale}px ${24 * scale}px`; }
    else if (isGear) { style.width = `${160 * scale}px`; style.height = `${160 * scale}px`; }
    else if (isStep) { style.width = `${160 * scale}px`; style.height = `${80 * scale}px`; style.padding = `${12 * scale}px ${32 * scale}px ${12 * scale}px ${40 * scale}px`; }
    else if (isFolder) { style.width = `${150 * scale}px`; style.height = `${100 * scale}px`; style.padding = `${32 * scale}px ${16 * scale}px ${24 * scale}px ${16 * scale}px`; }
    else if (isJira) { style.width = `${160 * scale}px`; style.height = `${80 * scale}px`; style.padding = `${12 * scale}px ${16 * scale}px`; }
    else if (isCloud) { style.width = `${160 * scale}px`; style.height = `${100 * scale}px`; style.padding = `${24 * scale}px`; }
    else if (isActor) { style.width = `${120 * scale}px`; style.height = `${140 * scale}px`; style.padding = `${64 * scale}px ${16 * scale}px ${8 * scale}px ${16 * scale}px`; }
    else if (isCallout) { style.width = `${160 * scale}px`; style.height = `${100 * scale}px`; style.padding = `${16 * scale}px ${16 * scale}px ${32 * scale}px ${16 * scale}px`; }
    else if (isBrowser) { style.width = `${180 * scale}px`; style.height = `${120 * scale}px`; style.padding = `${40 * scale}px ${16 * scale}px ${16 * scale}px ${16 * scale}px`; }
    else if (isStack) { style.width = `${160 * scale}px`; style.height = `${100 * scale}px`; style.padding = `${16 * scale}px`; style.marginBottom = `${16 * scale}px`; style.marginRight = `${16 * scale}px`; }
    else if (isQueue) { style.width = `${160 * scale}px`; style.height = `${80 * scale}px`; style.padding = `${12 * scale}px ${32 * scale}px`; }
    else if (isRepository) { style.width = `${180 * scale}px`; style.height = `${100 * scale}px`; style.padding = `${16 * scale}px`; }
    else if (isBug) { style.width = `${160 * scale}px`; style.height = `${80 * scale}px`; style.padding = `${12 * scale}px ${16 * scale}px`; }
    else if (isStory) { style.width = `${160 * scale}px`; style.height = `${80 * scale}px`; style.padding = `${12 * scale}px ${16 * scale}px`; }
    else { style.width = `${150 * scale}px`; style.padding = `${12 * scale}px`; }
    
    return style;
  };

  return (
    <div className={containerClasses} style={getContainerStyle()}>
      {tooltip}
      
      {/* Stack Layers */}
      {isStack && (
        <>
          <div 
            className={`absolute inset-0 translate-x-4 translate-y-4 rounded-lg border-2 ${selected ? 'border-indigo-500' : 'border-slate-200 dark:border-slate-700'} bg-white dark:bg-slate-800 z-0`}
            style={getStyle()}
          />
          <div 
            className={`absolute inset-0 translate-x-2 translate-y-2 rounded-lg border-2 ${selected ? 'border-indigo-500' : 'border-slate-200 dark:border-slate-700'} bg-white dark:bg-slate-800 z-0`}
            style={getStyle()}
          />
        </>
      )}

      {/* Queue Lines */}
      {isQueue && (
        <>
          <div className={`absolute top-0 bottom-0 left-2 w-0 border-l-2 ${selected ? 'border-indigo-500' : 'border-slate-200 dark:border-slate-700'} z-0`} />
          <div className={`absolute top-0 bottom-0 left-4 w-0 border-l-2 ${selected ? 'border-indigo-500' : 'border-slate-200 dark:border-slate-700'} z-0`} />
          <div className={`absolute top-0 bottom-0 right-2 w-0 border-r-2 ${selected ? 'border-indigo-500' : 'border-slate-200 dark:border-slate-700'} z-0`} />
          <div className={`absolute top-0 bottom-0 right-4 w-0 border-r-2 ${selected ? 'border-indigo-500' : 'border-slate-200 dark:border-slate-700'} z-0`} />
        </>
      )}

      <div 
        className={`${bgClasses} ${isStack ? 'z-10' : ''}`} 
        style={getStyle()}
      />
      
      {/* Browser Top Bar */}
      {isBrowser && (
        <div className={`absolute top-[2px] left-[2px] right-[2px] h-6 bg-slate-200 dark:bg-slate-700 border-b ${selected ? 'border-indigo-500' : 'border-slate-300 dark:border-slate-600'} flex items-center px-2 gap-1.5 z-0 rounded-t-[6px]`}>
          <div className="w-2 h-2 rounded-full bg-red-400"></div>
          <div className="w-2 h-2 rounded-full bg-amber-400"></div>
          <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
        </div>
      )}
      
      {isDocument && (
        <div 
          className={`absolute top-0 right-0 w-[24px] h-[24px] border-b-2 border-l-2 ${selected ? 'border-indigo-500' : 'border-slate-200 dark:border-slate-700'} bg-slate-100 dark:bg-slate-800`}
        />
      )}
      
      {isCylinder && (
        <div 
          className={`absolute top-0 left-0 right-0 h-[30px] border-b-2 ${selected ? 'border-indigo-500' : 'border-slate-200 dark:border-slate-700'} rounded-[50%/15px]`}
          style={{ backgroundColor: 'inherit', opacity: 0.5 }}
        />
      )}
      
      {isComponent && (
        <>
          <div className={`absolute top-2 left-[-10px] w-5 h-2 border-2 border-r-0 ${selected ? 'border-indigo-500' : 'border-slate-200 dark:border-slate-700'} bg-white dark:bg-slate-800`} />
          <div className={`absolute bottom-2 left-[-10px] w-5 h-2 border-2 border-r-0 ${selected ? 'border-indigo-500' : 'border-slate-200 dark:border-slate-700'} bg-white dark:bg-slate-800`} />
        </>
      )}
      
      {isGear && (
        <div 
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full border-4 ${selected ? 'border-indigo-500' : 'border-slate-200 dark:border-slate-700'} bg-white dark:bg-slate-900 z-0`}
        />
      )}
      
      {isActor && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 flex flex-col items-center z-0 pointer-events-none">
          {/* Head */}
          <div className={`w-8 h-8 rounded-full border-2 ${selected ? 'border-indigo-500' : 'border-slate-400 dark:border-slate-500'} bg-white dark:bg-slate-800`} />
          {/* Body */}
          <div className={`w-0.5 h-10 ${selected ? 'bg-indigo-500' : 'bg-slate-400 dark:bg-slate-500'}`} />
          {/* Arms */}
          <div className={`absolute top-10 w-16 h-0.5 ${selected ? 'bg-indigo-500' : 'bg-slate-400 dark:bg-slate-500'}`} />
          {/* Legs */}
          <div className="flex w-12 justify-between absolute top-[72px]">
            <div className={`w-0.5 h-10 origin-top -rotate-15 ${selected ? 'bg-indigo-500' : 'bg-slate-400 dark:bg-slate-500'}`} style={{ transform: 'rotate(25deg)' }} />
            <div className={`w-0.5 h-10 origin-top rotate-15 ${selected ? 'bg-indigo-500' : 'bg-slate-400 dark:bg-slate-500'}`} style={{ transform: 'rotate(-25deg)' }} />
          </div>
        </div>
      )}

      <>
        <Handle 
          type="target" 
          position={Position.Top} 
          id="top" 
          className="w-3 h-3 bg-indigo-400 dark:bg-indigo-500 z-50" 
          style={isFolder ? { top: '20%' } : isCloud ? { top: '15%' } : isDiamond ? { top: 0, left: 0 } : {}}
        />
        <Handle 
          type="target" 
          position={Position.Left} 
          id="left" 
          className="w-3 h-3 bg-indigo-400 dark:bg-indigo-500 z-50" 
          style={isStep ? { left: '15%' } : isCloud ? { left: '10%' } : isDiamond ? { top: '100%', left: 0 } : {}}
        />
        {data.nodeType !== 'reference' && (
          <>
            <Handle 
              type="source" 
              position={Position.Right} 
              id="right" 
              className="w-3 h-3 bg-indigo-400 dark:bg-indigo-500 z-50" 
              style={isCloud ? { right: '10%' } : isStack ? { right: '-16px' } : isDiamond ? { top: 0, left: '100%' } : {}}
            />
            <Handle 
              type="source" 
              position={Position.Bottom} 
              id="bottom" 
              className="w-3 h-3 bg-indigo-400 dark:bg-indigo-500 z-50" 
              style={isCallout ? { left: '75%', bottom: 0 } : isCloud ? { bottom: '15%' } : isStack ? { bottom: '-16px' } : isDiamond ? { top: '100%', left: '100%' } : {}}
            />
            
            {/* Extra Handles for multiple edges (e.g., decision trees) */}
            {!isDiamond && !isCircle && !isGear && !isCloud && !isActor && !isCylinder && !isStep && !isFolder && !isCallout && !isHexagon && (
              <>
                <Handle type="target" position={Position.Top} id="top-left" className="w-3 h-3 bg-indigo-400 dark:bg-indigo-500 z-50 opacity-0 group-hover:opacity-100 transition-opacity" style={{ left: '25%' }} />
                <Handle type="target" position={Position.Top} id="top-right" className="w-3 h-3 bg-indigo-400 dark:bg-indigo-500 z-50 opacity-0 group-hover:opacity-100 transition-opacity" style={{ left: '75%' }} />
                <Handle type="target" position={Position.Left} id="left-top" className="w-3 h-3 bg-indigo-400 dark:bg-indigo-500 z-50 opacity-0 group-hover:opacity-100 transition-opacity" style={{ top: '25%' }} />
                <Handle type="target" position={Position.Left} id="left-bottom" className="w-3 h-3 bg-indigo-400 dark:bg-indigo-500 z-50 opacity-0 group-hover:opacity-100 transition-opacity" style={{ top: '75%' }} />
                <Handle type="source" position={Position.Right} id="right-top" className="w-3 h-3 bg-indigo-400 dark:bg-indigo-500 z-50 opacity-0 group-hover:opacity-100 transition-opacity" style={{ top: '25%' }} />
                <Handle type="source" position={Position.Right} id="right-bottom" className="w-3 h-3 bg-indigo-400 dark:bg-indigo-500 z-50 opacity-0 group-hover:opacity-100 transition-opacity" style={{ top: '75%' }} />
                <Handle type="source" position={Position.Bottom} id="bottom-left" className="w-3 h-3 bg-indigo-400 dark:bg-indigo-500 z-50 opacity-0 group-hover:opacity-100 transition-opacity" style={{ left: '25%' }} />
                <Handle type="source" position={Position.Bottom} id="bottom-right" className="w-3 h-3 bg-indigo-400 dark:bg-indigo-500 z-50 opacity-0 group-hover:opacity-100 transition-opacity" style={{ left: '75%' }} />
              </>
            )}
          </>
        )}
      </>
      
      <div className={contentClasses}>
        <div className={`flex items-center gap-2 ${isDiamond || isCircle ? 'justify-center' : 'justify-between'}`}>
          <div className={`flex items-center gap-1.5 ${hasCustomBg ? 'text-slate-700' : 'text-slate-500 dark:text-slate-400'}`}>
            {renderIcon("w-3.5 h-3.5")}
            <span className="text-xs font-semibold uppercase tracking-wider">
              {data.nodeType === 'default' ? '' : (data.nodeType || '')}
            </span>
          </div>
          {childCount > 0 && (
            <button
              onClick={toggleExpand}
              className="p-1 text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300 rounded transition-colors flex items-center gap-1"
              title="Expand Node"
            >
              <Layers className="w-4 h-4" />
              <span className="text-xs font-medium">{childCount}</span>
            </button>
          )}
        </div>
        <h3 className={`text-sm font-medium line-clamp-2 ${hasCustomBg ? 'text-slate-900' : 'text-slate-900 dark:text-slate-100'}`}>{data.title}</h3>
        {data.description && !isDiamond && !isCircle && (
          <p className={`text-xs line-clamp-2 mt-1 ${hasCustomBg ? 'text-slate-700' : 'text-slate-500 dark:text-slate-400'}`}>{data.description}</p>
        )}
        
        {data.nodeType === 'reference' && !isDiamond && !isCircle && (
          <div className={`mt-2 pt-2 border-t ${hasCustomBg ? 'border-black/10' : 'border-slate-200 dark:border-slate-700'}`}>
            <label className={`block text-[10px] font-semibold mb-1 uppercase tracking-wider ${hasCustomBg ? 'text-slate-700' : 'text-slate-500 dark:text-slate-400'}`}>
              Reference Target
            </label>
            <select
              value={data.referenceTarget || ''}
              onChange={handleReferenceChange}
              className={`w-full text-xs border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 ${
                hasCustomBg 
                  ? 'bg-white/50 border-black/10 text-slate-900' 
                  : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              <option value="">Select a node...</option>
              {getHierarchicalNodes().map(node => (
                <option key={node.id} value={node.id}>
                  {node.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {isRepository && (
          <div className={`mt-2 pt-2 border-t space-y-1 ${hasCustomBg ? 'border-black/10' : 'border-slate-200 dark:border-slate-700'}`}>
            {data.deploymentStatus && (
              <div className="flex items-center justify-between text-[10px]">
                <span className={hasCustomBg ? 'text-slate-700' : 'text-slate-500 dark:text-slate-400'}>Status</span>
                <span className={`font-medium ${
                  data.deploymentStatus === 'success' ? (hasCustomBg ? 'text-emerald-700' : 'text-emerald-600 dark:text-emerald-400') :
                  data.deploymentStatus === 'failed' ? (hasCustomBg ? 'text-red-700' : 'text-red-600 dark:text-red-400') :
                  (hasCustomBg ? 'text-amber-700' : 'text-amber-600 dark:text-amber-400')
                }`}>
                  {data.deploymentStatus.toUpperCase()}
                </span>
              </div>
            )}
            {data.openPrCount !== undefined && (
              <div className="flex items-center justify-between text-[10px]">
                <span className={hasCustomBg ? 'text-slate-700' : 'text-slate-500 dark:text-slate-400'}>Open PRs</span>
                <span className={`font-medium ${hasCustomBg ? 'text-slate-900' : 'text-slate-700 dark:text-slate-300'}`}>{data.openPrCount}</span>
              </div>
            )}
            {data.lastCommitInfo && (
              <div className="flex items-center justify-between text-[10px]">
                <span className={hasCustomBg ? 'text-slate-700' : 'text-slate-500 dark:text-slate-400'}>Last Commit</span>
                <span className={`font-medium truncate max-w-[80px] ${hasCustomBg ? 'text-slate-900' : 'text-slate-700 dark:text-slate-300'}`} title={data.lastCommitInfo}>{data.lastCommitInfo}</span>
              </div>
            )}
          </div>
        )}

        {(isBug || isStory || isJira || !!data.issueId) && (
          <div className={`mt-2 pt-2 border-t space-y-1 ${hasCustomBg ? 'border-black/10' : 'border-slate-200 dark:border-slate-700'}`}>
            {data.issueId && (
              <div className="flex items-center justify-between text-[10px]">
                <span className={hasCustomBg ? 'text-slate-700' : 'text-slate-500 dark:text-slate-400'}>Issue ID</span>
                <span className={`font-medium ${hasCustomBg ? 'text-indigo-700' : 'text-indigo-600 dark:text-indigo-400'}`}>
                  {data.issueId}
                </span>
              </div>
            )}
            {data.status && (
              <div className="flex items-center justify-between text-[10px]">
                <span className={hasCustomBg ? 'text-slate-700' : 'text-slate-500 dark:text-slate-400'}>Status</span>
                <span className={`font-medium ${hasCustomBg ? 'text-slate-900' : 'text-slate-700 dark:text-slate-300'}`}>
                  {data.status}
                </span>
              </div>
            )}
            {data.assignee && (
              <div className="flex items-center justify-between text-[10px]">
                <span className={hasCustomBg ? 'text-slate-700' : 'text-slate-500 dark:text-slate-400'}>Assignee</span>
                <span className={`font-medium truncate max-w-[80px] ${hasCustomBg ? 'text-slate-900' : 'text-slate-700 dark:text-slate-300'}`} title={data.assignee}>{data.assignee}</span>
              </div>
            )}
            {data.priority && (
              <div className="flex items-center justify-between text-[10px]">
                <span className={hasCustomBg ? 'text-slate-700' : 'text-slate-500 dark:text-slate-400'}>Priority</span>
                <span className={`font-medium ${
                  data.priority === 'High' || data.priority === 'Critical' ? (hasCustomBg ? 'text-red-700' : 'text-red-600 dark:text-red-400') :
                  data.priority === 'Medium' ? (hasCustomBg ? 'text-amber-700' : 'text-amber-600 dark:text-amber-400') :
                  (hasCustomBg ? 'text-emerald-700' : 'text-emerald-600 dark:text-emerald-400')
                }`}>
                  {data.priority}
                </span>
              </div>
            )}
          </div>
        )}

        {data.tags && data.tags.length > 0 && !isDiamond && !isCircle && (
          <div className="flex flex-wrap gap-1 mt-2">
            {data.tags.slice(0, 3).map((tag, i) => (
              <span key={i} className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${hasCustomBg ? 'bg-black/10 text-slate-900' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                {tag}
              </span>
            ))}
            {data.tags.length > 3 && (
              <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${hasCustomBg ? 'bg-black/10 text-slate-900' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                +{data.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {data.links && data.links.length > 0 && !isDiamond && !isCircle && (
          <div className={`flex flex-col gap-1 mt-2 pt-2 border-t ${hasCustomBg ? 'border-black/10' : 'border-slate-200 dark:border-slate-700'}`}>
            {data.links.slice(0, 2).map((link) => (
              <div key={link.id} className={`flex items-center gap-1.5 text-[10px] ${hasCustomBg ? 'text-indigo-700' : 'text-indigo-600 dark:text-indigo-400'}`}>
                {link.iconUrl ? (
                  <img src={link.iconUrl} alt="icon" className="w-3 h-3 object-contain" />
                ) : link.icon && icons[link.icon as keyof typeof icons] ? (
                  (() => {
                    const IconComponent = icons[link.icon as keyof typeof icons];
                    return <IconComponent className="w-3 h-3" />;
                  })()
                ) : (
                  <ImageIcon className="w-3 h-3 opacity-50" />
                )}
                <span className="truncate">{link.label}</span>
              </div>
            ))}
            {data.links.length > 2 && (
              <span className={`text-[10px] italic ${hasCustomBg ? 'text-slate-600' : 'text-slate-500 dark:text-slate-400'}`}>
                +{data.links.length - 2} more links
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
