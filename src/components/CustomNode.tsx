import { Handle, Position, NodeResizer, NodeToolbar } from '@xyflow/react';
import { Layers, ChevronDown, ChevronRight, Image as ImageIcon, Info } from 'lucide-react';
import { NodeData } from '../models/types';
import { useGraphStore } from '../store/graphStore';
import { icons } from '../utils/icons';

export default function CustomNode({ id, data, selected }: { id: string; data: NodeData; selected: boolean }) {
  const updateNodeData = useGraphStore((state) => state.updateNodeData);
  const nodes = useGraphStore((state) => state.nodes);
  const simulationActiveNodeId = useGraphStore((state) => state.simulationActiveNodeId);
  
  const isSimulationActive = simulationActiveNodeId === id;
  const shape = data.shape || 'rectangle';
  const isExpanded = data.isExpanded;
  
  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateNodeData(id, { isExpanded: !isExpanded });
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
      <>
        {tooltip}
        <NodeResizer 
          color="#6366f1" 
          isVisible={selected} 
          minWidth={200} 
          minHeight={150} 
          onResizeEnd={() => useGraphStore.getState().takeSnapshot()}
        />
        <Handle type="target" position={Position.Top} id="top" className="w-3 h-3 bg-indigo-400 dark:bg-indigo-500 z-20" />
        <Handle type="source" position={Position.Right} id="right" className="w-3 h-3 bg-indigo-400 dark:bg-indigo-500 z-20" />
        <Handle type="source" position={Position.Bottom} id="bottom" className="w-3 h-3 bg-indigo-400 dark:bg-indigo-500 z-20" />
        <Handle type="target" position={Position.Left} id="left" className="w-3 h-3 bg-indigo-400 dark:bg-indigo-500 z-20" />
        <div
          className={`w-full h-full rounded-xl border-2 bg-slate-50/50 dark:bg-slate-900/50 backdrop-blur-sm transition-colors flex flex-col ${
            selected ? 'border-indigo-500 ring-2 ring-indigo-200 dark:ring-indigo-900/50' : 'border-slate-300 dark:border-slate-700 border-dashed'
          }`}
        >
          <div className="px-4 py-2 bg-white/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between rounded-t-lg">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                {renderIcon("w-4 h-4")}
                <span className="text-xs font-semibold uppercase tracking-wider">
                  {data.nodeType || 'Node'}
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
          <div className="flex-1 p-4 pointer-events-none">
            {/* Children will be rendered here by React Flow */}
          </div>
        </div>
      </>
    );
  }

  const isDiamond = shape === 'diamond';
  const isCircle = shape === 'circle';
  const isPill = shape === 'pill';
  const isParallelogram = shape === 'parallelogram';
  const isHexagon = shape === 'hexagon';
  const isCylinder = shape === 'cylinder';
  const isDocument = shape === 'document';
  const isComponent = shape === 'component';
  const isGear = shape === 'gear';

  // Hexagon requires clip-path, we'll use a specific class for it if needed, 
  // but for simplicity we can use standard CSS for most.
  
  const containerClasses = `relative flex items-center justify-center ${
    isDiamond ? 'w-40 h-40' : 
    isCircle ? 'w-40 h-40' : 
    isPill ? 'min-w-[160px] px-4 py-2' :
    isParallelogram ? 'min-w-[160px] px-6 py-2' :
    isHexagon ? 'min-w-[160px] min-h-[100px] px-6 py-4' :
    isCylinder ? 'min-w-[150px] min-h-[100px] px-4 py-6' :
    isDocument ? 'min-w-[150px] min-h-[110px] px-4 py-5' :
    isComponent ? 'min-w-[160px] min-h-[100px] px-6 py-4' :
    isGear ? 'w-40 h-40' :
    'min-w-[150px] p-3'
  }`;

  const bgClasses = `absolute inset-0 border-2 bg-white dark:bg-slate-800 shadow-md transition-all ${
    selected ? 'border-indigo-500 shadow-lg ring-2 ring-indigo-200 dark:ring-indigo-900/50' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
  } ${
    isSimulationActive ? 'ring-4 ring-emerald-400 dark:ring-emerald-500 ring-offset-2 dark:ring-offset-slate-900 z-50 animate-pulse' : ''
  } ${
    isDiamond ? 'rotate-45 rounded-lg m-2' :
    isCircle ? 'rounded-full' :
    isPill ? 'rounded-full' :
    isParallelogram ? '-skew-x-12 rounded-lg' :
    isHexagon ? 'rounded-lg' :
    isCylinder ? '' : // Handled in style
    isDocument ? '' : // Handled in style
    isComponent ? 'rounded-lg' :
    isGear ? 'rounded-full' : // Gear will be a circle with a dashed border or something
    'rounded-lg'
  }`;

  const contentClasses = `relative z-10 flex flex-col gap-1 w-full ${
    isDiamond || isCircle || isGear ? 'items-center text-center max-w-[110px]' : ''
  }`;

  const getStyle = () => {
    if (isHexagon) return { clipPath: 'polygon(10% 0, 90% 0, 100% 50%, 90% 100%, 10% 100%, 0 50%)' };
    if (isDocument) return { clipPath: 'polygon(0 0, calc(100% - 24px) 0, 100% 24px, 100% 100%, 0 100%)' };
    if (isCylinder) return { borderRadius: '50% / 15px' };
    if (isGear) return { borderStyle: 'dashed', borderWidth: '4px' };
    return {};
  };

  return (
    <div className={containerClasses}>
      {tooltip}
      <div 
        className={bgClasses} 
        style={getStyle()}
      />
      
      {isDocument && (
        <div 
          className={`absolute top-0 right-0 w-[24px] h-[24px] border-b-2 border-l-2 ${selected ? 'border-indigo-500' : 'border-slate-200 dark:border-slate-700'} bg-slate-100 dark:bg-slate-800`}
        />
      )}
      
      {isComponent && (
        <>
          <div className={`absolute top-2 left-[-10px] w-5 h-2 border-2 border-r-0 ${selected ? 'border-indigo-500' : 'border-slate-200 dark:border-slate-700'} bg-white dark:bg-slate-800`} />
          <div className={`absolute bottom-2 left-[-10px] w-5 h-2 border-2 border-r-0 ${selected ? 'border-indigo-500' : 'border-slate-200 dark:border-slate-700'} bg-white dark:bg-slate-800`} />
        </>
      )}
      
      <Handle type="target" position={Position.Top} id="top" className="w-3 h-3 bg-indigo-400 dark:bg-indigo-500 z-20" />
      <Handle type="source" position={Position.Right} id="right" className="w-3 h-3 bg-indigo-400 dark:bg-indigo-500 z-20" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="w-3 h-3 bg-indigo-400 dark:bg-indigo-500 z-20" />
      <Handle type="target" position={Position.Left} id="left" className="w-3 h-3 bg-indigo-400 dark:bg-indigo-500 z-20" />
      
      <div className={contentClasses}>
        <div className={`flex items-center gap-2 ${isDiamond || isCircle ? 'justify-center' : 'justify-between'}`}>
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            {renderIcon("w-3.5 h-3.5")}
            <span className="text-xs font-semibold uppercase tracking-wider">
              {data.nodeType || 'Node'}
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
        <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 line-clamp-2">{data.title}</h3>
        {data.description && !isDiamond && !isCircle && (
          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">{data.description}</p>
        )}
        
        {data.tags && data.tags.length > 0 && !isDiamond && !isCircle && (
          <div className="flex flex-wrap gap-1 mt-2">
            {data.tags.slice(0, 3).map((tag, i) => (
              <span key={i} className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded">
                {tag}
              </span>
            ))}
            {data.tags.length > 3 && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded">
                +{data.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {data.links && data.links.length > 0 && !isDiamond && !isCircle && (
          <div className="flex flex-col gap-1 mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
            {data.links.slice(0, 2).map((link) => (
              <div key={link.id} className="flex items-center gap-1.5 text-[10px] text-indigo-600 dark:text-indigo-400">
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
              <span className="text-[10px] text-slate-500 dark:text-slate-400 italic">
                +{data.links.length - 2} more links
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
