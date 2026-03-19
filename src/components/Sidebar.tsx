import { useState, useEffect } from 'react';
import { useGraphStore } from '../store/graphStore';
import { Folder, Plus, Trash2, FileText, Layers, Settings, Square, Diamond, Circle, Hexagon, ArrowRightLeft, Database, File, MousePointerClick, LayoutTemplate, Cloud, CloudOff, RefreshCw, X, UserPlus } from 'lucide-react';
import TemplateManager from './TemplateManager';
import CollaboratorsModal from './CollaboratorsModal';
import { Project } from '../models/types';
import { icons } from '../utils/icons';

export default function Sidebar({ isOpen, onToggle }: { isOpen: boolean; onToggle: () => void }) {
  const { projects, activeProjectId, createProject, loadProject, deleteProject, toggleProjectLocalOnly, templates, loadTemplates, issueManagementConfigs, cloudMode, devMode, nodes, selectNode, setFocusNodeId, drillDown, user, hiddenLayers, toggleLayerVisibility } = useGraphStore();
  const [newProjectName, setNewProjectName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isTemplateManagerOpen, setIsTemplateManagerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'projects' | 'project' | 'library' | 'layers'>('projects');
  const [selectedProjectForCollaborators, setSelectedProjectForCollaborators] = useState<Project | null>(null);

  const handleNodeClick = (nodeId: string) => {
    let node = nodes.find(n => n.id === nodeId);
    let parentId = node?.parentId;
    const parentsToExpand = [];
    while (parentId) {
      const parent = nodes.find(n => n.id === parentId);
      if (parent && parent.data.isCollapsed) {
        parentsToExpand.push(parentId);
      }
      parentId = parent?.parentId;
    }
    
    // Expand parents from top to bottom
    for (let i = parentsToExpand.length - 1; i >= 0; i--) {
      drillDown(parentsToExpand[i]);
    }
    
    selectNode(nodeId);
    setFocusNodeId(nodeId);
  };

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newProjectName.trim()) {
      await createProject(newProjectName.trim());
      setNewProjectName('');
      setIsCreating(false);
    }
  };

  const onDragStart = (event: any, nodeType: string, templateId?: string, shape?: string, customNodeType?: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    if (templateId) {
      event.dataTransfer.setData('application/templateId', templateId);
    }
    if (shape) {
      event.dataTransfer.setData('application/shape', shape);
    }
    if (customNodeType) {
      event.dataTransfer.setData('application/customNodeType', customNodeType);
    }
    event.dataTransfer.effectAllowed = 'move';
  };

  if (!isOpen) {
    return (
      <div className="w-12 h-full bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col items-center py-4 z-10">
        <button onClick={onToggle} className="p-2 text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400">
          <Layers className="w-5 h-5" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-64 h-full bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col shadow-sm z-10">
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button onClick={() => setActiveTab('projects')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider ${activeTab === 'projects' ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400' : 'text-slate-500 dark:text-slate-400'}`}>Projects</button>
        <button onClick={() => setActiveTab('project')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider ${activeTab === 'project' ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400' : 'text-slate-500 dark:text-slate-400'}`}>Project</button>
        <button onClick={() => setActiveTab('library')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider ${activeTab === 'library' ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400' : 'text-slate-500 dark:text-slate-400'}`}>Library</button>
        <button onClick={() => setActiveTab('layers')} className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider ${activeTab === 'layers' ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400' : 'text-slate-500 dark:text-slate-400'}`}>Layers</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'projects' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Projects</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsCreating(true)}
                  className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition-colors"
                  title="New Project"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <button onClick={onToggle} className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {isCreating && (
              <form onSubmit={handleCreateProject} className="mb-4">
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="Project Name..."
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                  onBlur={() => setIsCreating(false)}
                />
              </form>
            )}

            <div className="space-y-1 max-h-48 overflow-y-auto">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className={`group flex items-center justify-between px-3 py-2 rounded-md cursor-pointer transition-colors ${
                    activeProjectId === project.id
                      ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-900 dark:text-indigo-300 font-medium'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
                  }`}
                  onClick={() => loadProject(project.id)}
                >
                  <div className="flex items-center truncate">
                    <Folder className={`w-4 h-4 mr-2 ${activeProjectId === project.id ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'}`} />
                    <span className="truncate text-sm">
                      {project.name}
                      {project.ownerId !== user?.uid && (
                        <span className="text-xs text-slate-500 dark:text-slate-400 ml-1">({project.ownerId})</span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center opacity-0 group-hover:opacity-100 transition-all">
                    {project.ownerId === user?.uid && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedProjectForCollaborators(project);
                        }}
                        className="p-1 mr-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded transition-all"
                        title="Manage Collaborators"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {!project.isLocalOnly && cloudMode && !devMode && (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          const { storageService } = await import('../services/storageService');
                          await storageService.syncProjectToCloud(project.id);
                        }}
                        className="p-1 mr-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded transition-all"
                        title="Force Sync to Cloud"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (project.ownerId === user?.uid) {
                          deleteProject(project.id);
                        } else {
                          // Leave project logic
                        }
                      }}
                      className="p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded transition-all"
                      title={project.ownerId === user?.uid ? "Delete Project" : "Leave Project"}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {projects.length === 0 && !isCreating && (
                <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-4 italic">No projects yet.</p>
              )}
            </div>
          </>
        )}

        {activeTab === 'project' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Nodes</h2>
              <button onClick={onToggle} className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {nodes.map(node => (
                <div key={node.id} onClick={() => handleNodeClick(node.id)} className="text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 px-3 py-1 rounded cursor-pointer truncate">
                  {(node.data as any).title}
                </div>
              ))}
            </div>
          </>
        )}

        {activeTab === 'library' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Node Library</h2>
              <button
                onClick={() => setIsTemplateManagerOpen(true)}
                className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition-colors"
                title="Manage Templates"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Drag nodes onto the canvas to add them to the graph.</p>
            
            <div className="space-y-3">
              <div
                className="flex items-center p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm cursor-grab hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-md transition-all"
                onDragStart={(event) => onDragStart(event, 'referenceNode', undefined, 'rectangle')}
                draggable
              >
                <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900/50 rounded flex items-center justify-center mr-3">
                  <div className="w-4 h-4 rounded-sm bg-amber-500 dark:bg-amber-400" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">Reference</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Link to another node</p>
                </div>
              </div>

              <div
                className="flex items-center p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm cursor-grab hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-md transition-all"
                onDragStart={(event) => onDragStart(event, 'groupNode')}
                draggable
              >
                <div className="w-8 h-8 bg-slate-100 dark:bg-slate-800 rounded flex items-center justify-center mr-3">
                  <Layers className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">Group</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Container for nodes</p>
                </div>
              </div>

              <div
                className="flex items-center p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm cursor-grab hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-md transition-all"
                onDragStart={(event) => onDragStart(event, 'inputNode', undefined, 'pill')}
                draggable
              >
                <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/50 rounded flex items-center justify-center mr-3">
                  <div className="w-4 h-4 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">Input</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Data entry point</p>
                </div>
              </div>

              <div
                className="flex items-center p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm cursor-grab hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-md transition-all"
                onDragStart={(event) => onDragStart(event, 'outputNode', undefined, 'pill')}
                draggable
              >
                <div className="w-8 h-8 bg-rose-100 dark:bg-rose-900/50 rounded flex items-center justify-center mr-3">
                  <div className="w-4 h-4 rounded-full bg-rose-500 dark:bg-rose-400" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">Output</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Data exit point</p>
                </div>
              </div>

              <div
                className="flex items-center p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm cursor-grab hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-md transition-all"
                onDragStart={(event) => onDragStart(event, 'customNode', undefined, 'rectangle')}
                draggable
              >
                <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/50 rounded flex items-center justify-center mr-3">
                  <Square className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">Rectangle</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Basic process step</p>
                </div>
              </div>

              <div
                className="flex items-center p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm cursor-grab hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-md transition-all"
                onDragStart={(event) => onDragStart(event, 'customNode', undefined, 'diamond')}
                draggable
              >
                <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900/50 rounded flex items-center justify-center mr-3">
                  <Diamond className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">Diamond</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Decision point</p>
                </div>
              </div>

              <div
                className="flex items-center p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm cursor-grab hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-md transition-all"
                onDragStart={(event) => onDragStart(event, 'customNode', undefined, 'circle')}
                draggable
              >
                <div className="w-8 h-8 bg-rose-100 dark:bg-rose-900/50 rounded flex items-center justify-center mr-3">
                  <Circle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">Circle</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Start/End point</p>
                </div>
              </div>

              <div
                className="flex items-center p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm cursor-grab hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-md transition-all"
                onDragStart={(event) => onDragStart(event, 'customNode', undefined, 'parallelogram')}
                draggable
              >
                <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/50 rounded flex items-center justify-center mr-3">
                  <ArrowRightLeft className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">Parallelogram</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Input / Output</p>
                </div>
              </div>

              <div
                className="flex items-center p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm cursor-grab hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-md transition-all"
                onDragStart={(event) => onDragStart(event, 'customNode', undefined, 'hexagon')}
                draggable
              >
                <div className="w-8 h-8 bg-cyan-100 dark:bg-cyan-900/50 rounded flex items-center justify-center mr-3">
                  <Hexagon className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">Hexagon</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Preparation step</p>
                </div>
              </div>

              <div
                className="flex items-center p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm cursor-grab hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-md transition-all"
                onDragStart={(event) => onDragStart(event, 'customNode', undefined, 'cylinder')}
                draggable
              >
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/50 rounded flex items-center justify-center mr-3">
                  <Database className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">Cylinder</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Database / Storage</p>
                </div>
              </div>

              <div
                className="flex items-center p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm cursor-grab hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-md transition-all"
                onDragStart={(event) => onDragStart(event, 'customNode', undefined, 'repository')}
                draggable
              >
                <div className="w-8 h-8 bg-slate-100 dark:bg-slate-800 rounded flex items-center justify-center mr-3">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-600 dark:text-slate-400"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">Repository</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Code Repository</p>
                </div>
              </div>

              <div
                className="flex items-center p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm cursor-grab hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-md transition-all"
                onDragStart={(event) => onDragStart(event, 'customNode', undefined, 'document')}
                draggable
              >
                <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/50 rounded flex items-center justify-center mr-3">
                  <File className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">Document</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Page / Report / File</p>
                </div>
              </div>

              <div
                className="flex items-center p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm cursor-grab hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-md transition-all"
                onDragStart={(event) => onDragStart(event, 'customNode', undefined, 'pill')}
                draggable
              >
                <div className="w-8 h-8 bg-pink-100 dark:bg-pink-900/50 rounded flex items-center justify-center mr-3">
                  <MousePointerClick className="w-4 h-4 text-pink-600 dark:text-pink-400" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">Pill</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">UI Action / Button</p>
                </div>
              </div>

              <div
                className="flex items-center p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm cursor-grab hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-md transition-all"
                onDragStart={(event) => onDragStart(event, 'customNode', undefined, 'component')}
                draggable
              >
                <div className="w-8 h-8 bg-teal-100 dark:bg-teal-900/50 rounded flex items-center justify-center mr-3">
                  <LayoutTemplate className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">Component</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">UI Element / Module</p>
                </div>
              </div>

              <div
                className="flex items-center p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm cursor-grab hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-md transition-all"
                onDragStart={(event) => onDragStart(event, 'customNode', undefined, 'gear')}
                draggable
              >
                <div className="w-8 h-8 bg-gray-100 dark:bg-gray-800 rounded flex items-center justify-center mr-3">
                  <Settings className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">Gear</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Business Rule / Logic</p>
                </div>
              </div>

              <div
                className="flex items-center p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm cursor-grab hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-md transition-all"
                onDragStart={(event) => onDragStart(event, 'customNode', undefined, 'bug')}
                draggable
              >
                <div className="w-8 h-8 bg-red-100 dark:bg-red-900/50 rounded flex items-center justify-center mr-3">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-600 dark:text-red-400"><path d="m8 2 1.88 1.88"/><path d="M14.12 3.88 16 2"/><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"/><path d="M12 20v-9"/><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/><path d="M6 13H2"/><path d="M3 21c0-2.1 1.7-3.9 3.8-4"/><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/><path d="M22 13h-4"/><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/></svg>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">Bug</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Defect / Issue</p>
                </div>
              </div>

              <div
                className="flex items-center p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm cursor-grab hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-md transition-all"
                onDragStart={(event) => onDragStart(event, 'customNode', undefined, 'story')}
                draggable
              >
                <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/50 rounded flex items-center justify-center mr-3">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600 dark:text-emerald-400"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">User Story</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Feature / Requirement</p>
                </div>
              </div>

              {issueManagementConfigs.length > 0 && (
                <div
                  className="flex items-center p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg shadow-sm cursor-grab hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-md transition-all"
                  onDragStart={(event) => onDragStart(event, 'jiraNode', undefined, 'jira')}
                  draggable
                >
                  <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center mr-3 text-white font-bold text-xs">
                    I
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-indigo-900 dark:text-indigo-100">Issue Node</h3>
                    <p className="text-xs text-indigo-600 dark:text-indigo-400">Live integration</p>
                  </div>
                </div>
              )}

              {templates.length > 0 && (
                <div className="pt-4 pb-2">
                  <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Templates</h2>
                </div>
              )}

              {templates.map((template) => {
                return (
                  <div
                    key={template.id}
                    className="flex items-center p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm cursor-grab hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-md transition-all"
                    onDragStart={(event) => onDragStart(event, 'customNode', template.id)}
                    draggable
                  >
                    <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/50 rounded flex items-center justify-center mr-3 overflow-hidden">
                      {template.iconUrl ? (
                        <img src={template.iconUrl} alt="icon" className="w-4 h-4 object-contain" />
                      ) : template.icon && icons[template.icon as keyof typeof icons] ? (
                        (() => {
                          const IconComponent = icons[template.icon as keyof typeof icons];
                          return <IconComponent className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
                        })()
                      ) : (
                        <Layers className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100">{template.name}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate w-32">{template.nodeType}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
        {activeTab === 'layers' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Layers</h2>
              <button onClick={onToggle} className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2">
              {Array.from(new Set(nodes.map(n => n.data.layer).filter((l): l is string => Boolean(l)))).map((layer) => (
                <div key={layer} className="flex items-center justify-between px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-sm">
                  <span className="text-sm text-slate-700 dark:text-slate-300">{layer}</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={!hiddenLayers.includes(layer)}
                      onChange={() => toggleLayerVisibility(layer)}
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
                  </label>
                </div>
              ))}
              {Array.from(new Set(nodes.map(n => n.data.layer).filter(Boolean))).length === 0 && (
                <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-4 italic">No layers defined in nodes.</p>
              )}
            </div>
          </>
        )}
      </div>
      
      {isTemplateManagerOpen && (
        <TemplateManager onClose={() => setIsTemplateManagerOpen(false)} />
      )}
      {selectedProjectForCollaborators && (
        <CollaboratorsModal
          project={selectedProjectForCollaborators}
          onClose={() => setSelectedProjectForCollaborators(null)}
        />
      )}
    </div>
  );
}
