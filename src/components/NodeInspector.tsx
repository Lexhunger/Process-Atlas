import { useState, useEffect } from 'react';
import { useGraphStore } from '../store/graphStore';
import { X, Plus, Trash2, Link as LinkIcon, Layers, Edit2, Check, ExternalLink, Copy, MoveRight, Image as ImageIcon, Eye, Type, Palette, ChevronDown, Settings as SettingsIcon } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import CodeSnippetViewer from './CodeSnippetViewer';
import { storageService } from '../services/storageService';
import IconPicker from './IconPicker';
import { icons } from '../utils/icons';
import Markdown from 'react-markdown';
import { PASTEL_COLORS } from '../constants';

export default function NodeInspector() {
  const { 
    selectedNodeId, 
    selectedEdgeId, 
    nodes, 
    edges, 
    updateNodeData, 
    updateEdgeLabel, 
    updateEdgeType, 
    updateEdgeStyle, 
    selectNode, 
    selectEdge, 
    deleteNode, 
    deleteEdge, 
    activeProjectId, 
    activeGraphId, 
    cloudMode,
    nodeTypes,
    addNodeType,
    issueManagementConfigs
  } = useGraphStore();
  const [activeTab, setActiveTab] = useState<'details' | 'links' | 'code'>('details');
  const [editingSnippetId, setEditingSnippetId] = useState<string | null>(null);
  const [targetGraphId, setTargetGraphId] = useState<string>('');
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [isPreviewingMarkdown, setIsPreviewingMarkdown] = useState(false);
  const [showTypeInput, setShowTypeInput] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');

  const node = nodes.find((n) => n.id === selectedNodeId);
  const edge = edges.find((e) => e.id === selectedEdgeId);

  const handleMoveNode = async () => {
    if (!node || !targetGraphId) return;
    
    let targetParentId = targetGraphId === activeProjectId ? undefined : targetGraphId;

    if (targetParentId === node.id) {
      alert('Node cannot be its own parent.');
      return;
    }

    // Save node with new parentId
    const updatedNode = { 
      id: node.id,
      graphId: activeGraphId || '',
      position: node.position,
      type: node.type || 'customNode',
      data: node.data as any,
      parentId: targetParentId
    };
    await storageService.saveNode(updatedNode, activeProjectId || undefined, cloudMode);
    
    // Refresh the current graph to apply changes
    useGraphStore.setState((state) => ({
      nodes: state.nodes.map(n => n.id === node.id ? { ...n, parentId: targetParentId, extent: (targetParentId ? 'parent' : undefined) as any } : n)
    }));
  };

  const handleCopyNode = async () => {
    if (!node || !targetGraphId) return;
    
    let targetParentId = targetGraphId === activeProjectId ? undefined : targetGraphId;

    const newNode = {
      ...node,
      id: uuidv4(),
      graphId: activeGraphId || '',
      parentId: targetParentId,
      position: { x: node.position.x + 50, y: node.position.y + 50 },
      selected: false,
      extent: (targetParentId ? 'parent' : undefined) as any
    };
    
    await storageService.saveNode(newNode as any, activeProjectId || undefined, cloudMode);
    
    useGraphStore.setState((state) => ({
      nodes: [...state.nodes, newNode] as any
    }));
    
    alert('Node copied successfully!');
  };

  if (!node && !edge) {
    return (
      <div className="w-80 h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center p-6 text-center text-slate-500 dark:text-slate-400">
        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
          <Layers className="w-8 h-8 text-slate-400 dark:text-slate-500" />
        </div>
        <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">No Item Selected</h3>
        <p className="text-sm">Click on a node or edge in the canvas to view and edit its details.</p>
      </div>
    );
  }

  if (edge) {
    return (
      <div className="w-80 h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col shadow-sm z-10">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Edge Details</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                deleteEdge(edge.id);
                selectEdge(null);
              }}
              className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
              title="Delete Edge"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => selectEdge(null)}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Relationship Label</label>
              <input
                type="text"
                value={edge.label as string || ''}
                onChange={(e) => updateEdgeLabel(edge.id, e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-slate-900 dark:text-slate-100"
                placeholder="e.g., depends on, flows to"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Edge Type</label>
              <select
                value={edge.type || 'default'}
                onChange={(e) => updateEdgeType(edge.id, e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm text-slate-900 dark:text-slate-100"
              >
                <option value="default">Bezier (Default)</option>
                <option value="straight">Straight</option>
                <option value="step">Step</option>
                <option value="smoothstep">Smooth Step</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Color</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { name: 'Default', value: '#94a3b8' },
                  { name: 'Indigo', value: '#6366f1' },
                  { name: 'Rose', value: '#f43f5e' },
                  { name: 'Amber', value: '#f59e0b' },
                  { name: 'Emerald', value: '#10b981' },
                  { name: 'Sky', value: '#0ea5e9' },
                ].map((color) => (
                  <button
                    key={color.name}
                    onClick={() => updateEdgeStyle(edge.id, { color: color.value })}
                    className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                      (edge.data?.color === color.value || (!edge.data?.color && color.name === 'Default'))
                        ? 'border-slate-900 dark:border-white scale-110'
                        : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={edge.data?.hasArrow !== false}
                  onChange={(e) => updateEdgeStyle(edge.id, { hasArrow: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">Directional Arrow</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={edge.animated || false}
                  onChange={(e) => updateEdgeStyle(edge.id, { animated: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">Animated Flow</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const data = node!.data as any;

  const handleChange = (field: string, value: any) => {
    updateNodeData(node.id, { [field]: value });
  };

  const handleMetadataChange = (key: string, value: string) => {
    handleChange('metadata', { ...data.metadata, [key]: value });
  };

  const addTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && e.currentTarget.value.trim()) {
      const newTag = e.currentTarget.value.trim();
      if (!data.tags?.includes(newTag)) {
        handleChange('tags', [...(data.tags || []), newTag]);
      }
      e.currentTarget.value = '';
    }
  };

  const removeTag = (tagToRemove: string) => {
    handleChange('tags', data.tags.filter((t: string) => t !== tagToRemove));
  };

  return (
    <div className="w-80 h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col shadow-xl z-10">
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider">Inspector</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => deleteNode(node.id)}
            className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
            title="Delete Node"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => selectNode(null)}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
            title="Close Inspector"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          className={`flex-1 py-3 text-xs font-medium uppercase tracking-wider ${
            activeTab === 'details' ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
          onClick={() => setActiveTab('details')}
        >
          Details
        </button>
        <button
          className={`flex-1 py-3 text-xs font-medium uppercase tracking-wider ${
            activeTab === 'links' ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
          onClick={() => setActiveTab('links')}
        >
          Links
        </button>
        <button
          className={`flex-1 py-3 text-xs font-medium uppercase tracking-wider ${
            activeTab === 'code' ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
          onClick={() => setActiveTab('code')}
        >
          Code
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {activeTab === 'details' && (
          <>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Title</label>
                <input
                  type="text"
                  value={data.title || ''}
                  onChange={(e) => handleChange('title', e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Icon</label>
                <div className="relative">
                  <button
                    onClick={() => setShowIconPicker(!showIconPicker)}
                    className="flex items-center justify-between w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <div className="flex items-center gap-2">
                      {data.iconUrl ? (
                        <img src={data.iconUrl} alt="icon" className="w-4 h-4 object-contain" />
                      ) : data.icon && icons[data.icon as keyof typeof icons] ? (
                        (() => {
                          const IconComponent = icons[data.icon as keyof typeof icons];
                          return <IconComponent className="w-4 h-4" />;
                        })()
                      ) : (
                        <ImageIcon className="w-4 h-4 text-slate-400" />
                      )}
                      <span>{data.icon ? data.icon : data.iconUrl ? 'Custom Image' : 'No Icon'}</span>
                    </div>
                  </button>
                  {showIconPicker && (
                    <IconPicker
                      currentIcon={data.icon}
                      currentIconUrl={data.iconUrl}
                      onSelectIcon={(icon) => handleChange('icon', icon)}
                      onSelectIconUrl={(url) => handleChange('iconUrl', url)}
                      onClose={() => setShowIconPicker(false)}
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1">
                  <Palette className="w-3 h-3" /> Color
                </label>
                <div className="grid grid-cols-5 gap-2">
                  <button
                    onClick={() => handleChange('color', undefined)}
                    className={`w-full aspect-square rounded-md border-2 flex items-center justify-center transition-all ${
                      !data.color ? 'border-indigo-500 ring-2 ring-indigo-100 dark:ring-indigo-900/30' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    }`}
                    title="Default"
                  >
                    <div className="w-4 h-4 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-sm" />
                  </button>
                  {PASTEL_COLORS.map((color) => (
                    <button
                      key={color.value}
                      onClick={() => handleChange('color', color.value)}
                      className={`w-full aspect-square rounded-md border-2 transition-all ${
                        data.color === color.value ? 'border-indigo-500 ring-2 ring-indigo-100 dark:ring-indigo-900/30' : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Shape</label>
                <select
                  value={data.shape || 'rectangle'}
                  onChange={(e) => handleChange('shape', e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="rectangle">Rectangle</option>
                  <option value="diamond">Diamond</option>
                  <option value="circle">Circle</option>
                  <option value="pill">Pill</option>
                  <option value="parallelogram">Parallelogram</option>
                  <option value="hexagon">Hexagon</option>
                  <option value="cylinder">Cylinder</option>
                  <option value="document">Document</option>
                  <option value="component">Component</option>
                  <option value="gear">Gear</option>
                  <option value="jira">Issue Ticket</option>
                </select>
              </div>

              {data.shape === 'jira' && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg space-y-3">
                  <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-bold text-[10px] uppercase tracking-wider">
                    <SettingsIcon className="w-3 h-3" /> Issue Management Configuration
                  </div>
                  
                  <div>
                    <label className="block text-[10px] font-medium text-blue-600 dark:text-blue-500 mb-1 uppercase">Instance</label>
                    <select
                      value={data.issueConfigId || ''}
                      onChange={(e) => handleChange('issueConfigId', e.target.value)}
                      className="w-full px-2 py-1.5 text-xs bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-800 text-slate-900 dark:text-slate-100 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">Select instance...</option>
                      {issueManagementConfigs.map(config => (
                        <option key={config.id} value={config.id}>{config.name} ({config.provider})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-medium text-blue-600 dark:text-blue-500 mb-1 uppercase">Ticket ID</label>
                    <input
                      type="text"
                      value={data.issueId || ''}
                      onChange={(e) => handleChange('issueId', e.target.value)}
                      placeholder="e.g., PROJ-123"
                      className="w-full px-2 py-1.5 text-xs bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-800 text-slate-900 dark:text-slate-100 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Type</label>
                <div className="flex gap-2">
                  <select
                    value={data.nodeType || ''}
                    onChange={(e) => {
                      if (e.target.value === 'ADD_NEW') {
                        setShowTypeInput(true);
                      } else {
                        handleChange('nodeType', e.target.value);
                      }
                    }}
                    className="flex-1 px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">None</option>
                    {nodeTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                    <option value="ADD_NEW" className="text-indigo-600 font-bold">+ Add New Type...</option>
                  </select>
                </div>
                
                {showTypeInput && (
                  <div className="mt-2 flex gap-2">
                    <input
                      type="text"
                      value={newTypeName}
                      onChange={(e) => setNewTypeName(e.target.value)}
                      placeholder="New type name..."
                      className="flex-1 px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-indigo-300 dark:border-indigo-700 text-slate-900 dark:text-slate-100 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      autoFocus
                    />
                    <button
                      onClick={() => {
                        if (newTypeName.trim()) {
                          addNodeType(newTypeName.trim());
                          handleChange('nodeType', newTypeName.trim());
                          setNewTypeName('');
                          setShowTypeInput(false);
                        }
                      }}
                      className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-md hover:bg-indigo-700"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => setShowTypeInput(false)}
                      className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-md hover:bg-slate-300 dark:hover:bg-slate-600"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Description</label>
                  <button
                    onClick={() => setIsPreviewingMarkdown(!isPreviewingMarkdown)}
                    className="text-[10px] flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    {isPreviewingMarkdown ? (
                      <><Type className="w-3 h-3" /> Edit</>
                    ) : (
                      <><Eye className="w-3 h-3" /> Preview</>
                    )}
                  </button>
                </div>
                {isPreviewingMarkdown ? (
                  <div className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-md min-h-[100px] overflow-y-auto prose dark:prose-invert prose-xs max-w-none">
                    <Markdown>{data.description || '*No description provided.*'}</Markdown>
                  </div>
                ) : (
                  <textarea
                    value={data.description || ''}
                    onChange={(e) => handleChange('description', e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                    placeholder="Markdown supported..."
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Tags</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {data.tags?.map((tag: string) => (
                    <span key={tag} className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-300">
                      {tag}
                      <button
                        onClick={() => removeTag(tag)}
                        className="ml-1 text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-200 focus:outline-none"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="Add a tag and press Enter"
                  onKeyDown={addTag}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider">Metadata</h3>
                <button
                  onClick={() => handleMetadataChange(`new_key_${Date.now()}`, '')}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium flex items-center"
                >
                  <Plus className="w-3 h-3 mr-1" /> Add Field
                </button>
              </div>
              
              <div className="space-y-3">
                {Object.entries(data.metadata || {}).map(([key, value]) => (
                  <div key={key} className="flex gap-2">
                    <input
                      type="text"
                      defaultValue={key}
                      onBlur={(e) => {
                        const newKey = e.target.value;
                        if (newKey !== key) {
                          const newMetadata = { ...data.metadata };
                          newMetadata[newKey] = newMetadata[key];
                          delete newMetadata[key];
                          handleChange('metadata', newMetadata);
                        }
                      }}
                      className="w-1/3 px-2 py-1.5 text-xs font-mono border border-slate-300 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      placeholder="Key"
                    />
                    <input
                      type="text"
                      value={value as string}
                      onChange={(e) => handleMetadataChange(key, e.target.value)}
                      className="flex-1 px-2 py-1.5 text-sm border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      placeholder="Value"
                    />
                    <button
                      onClick={() => {
                        const newMetadata = { ...data.metadata };
                        delete newMetadata[key];
                        handleChange('metadata', newMetadata);
                      }}
                      className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
              <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-3">Move / Copy Node</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Target Parent</label>
                  <select
                    value={targetGraphId}
                    onChange={(e) => setTargetGraphId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select target...</option>
                    <option value={activeProjectId || ''}>Root Project</option>
                    {nodes.filter(n => n.id !== node.id).map(n => (
                      <option key={n.id} value={n.id}>Node: {(n.data as any).title || 'Untitled'}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleMoveNode}
                    disabled={!targetGraphId}
                    className="flex-1 flex items-center justify-center py-2 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <MoveRight className="w-4 h-4 mr-2" /> Move
                  </button>
                  <button
                    onClick={handleCopyNode}
                    disabled={!targetGraphId}
                    className="flex-1 flex items-center justify-center py-2 px-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Copy className="w-4 h-4 mr-2" /> Copy
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'links' && (
          <div className="space-y-4">
            <button
              onClick={() => {
                const newLink = { id: uuidv4(), label: 'New Link', url: 'https://' };
                handleChange('links', [...(data.links || []), newLink]);
              }}
              className="w-full py-2 px-4 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:border-indigo-500 dark:hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center justify-center"
            >
              <Plus className="w-4 h-4 mr-2" /> Add Link
            </button>
            
            <div className="space-y-3">
              {(data.links || []).map((link: any, index: number) => (
                <div key={link.id} className="p-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/50 relative group">
                  <button
                    onClick={() => {
                      const newLinks = [...data.links];
                      newLinks.splice(index, 1);
                      handleChange('links', newLinks);
                    }}
                    className="absolute top-2 right-2 p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="space-y-2 pr-6">
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <button
                          onClick={() => {
                            // We need a separate state for link icon pickers, or just use a simple prompt for now
                            // Let's use a simple prompt for the icon name or URL to keep it simple, or we can use the IconPicker component
                            // Since we can't easily manage multiple IconPickers without an array of states, let's just use the IconPicker for the currently editing link
                            setEditingSnippetId(`link-icon-${link.id}`); // Reuse state variable for simplicity
                          }}
                          className="p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded hover:border-indigo-500 dark:hover:border-indigo-400 transition-colors"
                          title="Choose Icon"
                        >
                          {link.iconUrl ? (
                            <img src={link.iconUrl} alt="icon" className="w-4 h-4 object-contain" />
                          ) : link.icon && icons[link.icon as keyof typeof icons] ? (
                            (() => {
                              const IconComponent = icons[link.icon as keyof typeof icons];
                              return <IconComponent className="w-4 h-4" />;
                            })()
                          ) : (
                            <ImageIcon className="w-4 h-4 text-slate-400" />
                          )}
                        </button>
                        {editingSnippetId === `link-icon-${link.id}` && (
                          <div className="absolute top-full left-0 mt-1 z-50">
                            <IconPicker
                              currentIcon={link.icon}
                              currentIconUrl={link.iconUrl}
                              onSelectIcon={(icon) => {
                                const newLinks = [...data.links];
                                newLinks[index] = { ...newLinks[index], icon, iconUrl: undefined };
                                handleChange('links', newLinks);
                              }}
                              onSelectIconUrl={(url) => {
                                const newLinks = [...data.links];
                                newLinks[index] = { ...newLinks[index], iconUrl: url, icon: undefined };
                                handleChange('links', newLinks);
                              }}
                              onClose={() => setEditingSnippetId(null)}
                            />
                          </div>
                        )}
                      </div>
                      <input
                        type="text"
                        value={link.label}
                        onChange={(e) => {
                          const newLinks = [...data.links];
                          newLinks[index] = { ...newLinks[index], label: e.target.value };
                          handleChange('links', newLinks);
                        }}
                        className="flex-1 px-2 py-1 text-sm font-medium border-b border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-indigo-500 dark:focus:border-indigo-400 focus:outline-none bg-transparent text-slate-900 dark:text-slate-100"
                        placeholder="Link Label"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <LinkIcon className="w-4 h-4 text-slate-400" />
                      <input
                        type="url"
                        value={link.url}
                        onChange={(e) => {
                          const newLinks = [...data.links];
                          newLinks[index] = { ...newLinks[index], url: e.target.value };
                          handleChange('links', newLinks);
                        }}
                        className="flex-1 px-2 py-1 text-xs font-mono text-indigo-600 dark:text-indigo-400 border-b border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-indigo-500 dark:focus:border-indigo-400 focus:outline-none bg-transparent"
                        placeholder="https://"
                      />
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded"
                        title="Open Link"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'code' && (
          <div className="space-y-4">
            <button
              onClick={() => {
                const newSnippetId = uuidv4();
                const newSnippet = { id: newSnippetId, title: 'New Snippet', language: 'javascript', code: '' };
                handleChange('codeSnippets', [...(data.codeSnippets || []), newSnippet]);
                setEditingSnippetId(newSnippetId);
              }}
              className="w-full py-2 px-4 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:border-indigo-500 dark:hover:border-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center justify-center"
            >
              <Plus className="w-4 h-4 mr-2" /> Add Code Snippet
            </button>

            <div className="space-y-4">
              {(data.codeSnippets || []).map((snippet: any, index: number) => (
                <div key={snippet.id}>
                  {editingSnippetId === snippet.id ? (
                    <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden shadow-sm">
                      <div className="flex items-center justify-between p-2 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                        <input
                          type="text"
                          value={snippet.title}
                          onChange={(e) => {
                            const newSnippets = [...data.codeSnippets];
                            newSnippets[index].title = e.target.value;
                            handleChange('codeSnippets', newSnippets);
                          }}
                          className="px-2 py-1 text-sm font-medium bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:focus:ring-indigo-400 rounded text-slate-900 dark:text-slate-100"
                          placeholder="Snippet Title"
                        />
                        <div className="flex items-center gap-2">
                          <select
                            value={snippet.language}
                            onChange={(e) => {
                              const newSnippets = [...data.codeSnippets];
                              newSnippets[index].language = e.target.value;
                              handleChange('codeSnippets', newSnippets);
                            }}
                            className="text-xs border border-slate-300 dark:border-slate-600 rounded px-2 py-1 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                          >
                            <option value="javascript">JavaScript</option>
                            <option value="typescript">TypeScript</option>
                            <option value="html">HTML</option>
                            <option value="css">CSS</option>
                            <option value="json">JSON</option>
                            <option value="sql">SQL</option>
                            <option value="python">Python</option>
                            <option value="bash">Bash</option>
                          </select>
                          <button
                            onClick={() => setEditingSnippetId(null)}
                            className="p-1 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded"
                            title="Done Editing"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <textarea
                        value={snippet.code}
                        onChange={(e) => {
                          const newSnippets = [...data.codeSnippets];
                          newSnippets[index].code = e.target.value;
                          handleChange('codeSnippets', newSnippets);
                        }}
                        className="w-full h-48 p-3 font-mono text-sm bg-slate-900 text-slate-100 focus:outline-none resize-y"
                        placeholder="Paste code here..."
                        spellCheck={false}
                      />
                    </div>
                  ) : (
                    <div className="relative group">
                      <div className="absolute top-2 right-2 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setEditingSnippetId(snippet.id)}
                          className="p-1.5 bg-slate-800 text-slate-300 hover:text-white rounded shadow-sm"
                          title="Edit Snippet"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            const newSnippets = [...data.codeSnippets];
                            newSnippets.splice(index, 1);
                            handleChange('codeSnippets', newSnippets);
                          }}
                          className="p-1.5 bg-slate-800 text-slate-300 hover:text-red-400 rounded shadow-sm"
                          title="Delete Snippet"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <CodeSnippetViewer
                        title={snippet.title}
                        language={snippet.language}
                        code={snippet.code}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
