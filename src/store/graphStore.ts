import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { debounce } from 'lodash';
import { Project, Graph, AppNode, AppEdge, Template, Snapshot, Comment, IssueManagementConfig, Settings } from '../models/types';
import { storageService } from '../services/storageService';
import { geminiService } from '../services/geminiService';
import { manualGenerator } from '../utils/manualGenerator';
import { auth, signIn, logout, db } from '../services/firebase';
import { User } from 'firebase/auth';
import { collection, doc, setDoc, onSnapshot, writeBatch } from 'firebase/firestore';

import { Node, Edge, Connection, addEdge, applyNodeChanges, applyEdgeChanges, NodeChange, EdgeChange, MarkerType } from '@xyflow/react';
import dagre from 'dagre';

// Helper function to calculate edge styling based on relationship type
const getEdgeStyleProps = (relationshipType: string | undefined, hasArrow: boolean | undefined, color: string | undefined) => {
  let markerType = MarkerType.ArrowClosed;
  let strokeDasharray = undefined;
  let markerStart = undefined;
  let finalHasArrow = hasArrow !== false;

  if (relationshipType === 'extends') {
    markerType = MarkerType.Arrow;
  } else if (relationshipType === 'implements') {
    markerType = MarkerType.Arrow;
    strokeDasharray = '5,5';
  } else if (relationshipType === 'dependency') {
    markerType = MarkerType.Arrow;
    strokeDasharray = '5,5';
  } else if (relationshipType === 'association') {
    finalHasArrow = false;
  } else if (relationshipType === 'aggregation') {
    markerType = MarkerType.Arrow; 
  } else if (relationshipType === 'composition') {
    markerType = MarkerType.ArrowClosed;
  } else if (relationshipType === 'bidirectional') {
    markerType = MarkerType.ArrowClosed;
    markerStart = { type: MarkerType.ArrowClosed, color: color || '#94a3b8' };
    finalHasArrow = true;
  }

  return {
    markerType,
    strokeDasharray,
    markerStart,
    finalHasArrow,
    labelBgStyle: { fill: 'transparent' },
    labelStyle: { fill: 'var(--edge-label-color)', fontWeight: 500 }
  };
};

// Helper function to sort nodes so that parents appear before their children
const sortNodesByParent = (nodes: Node[]): Node[] => {
  const sorted: Node[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const nodeMap = new Map<string, Node>();

  nodes.forEach(n => nodeMap.set(n.id, n));

  const addNode = (node: Node) => {
    if (visited.has(node.id)) return;
    if (visiting.has(node.id)) {
      // Break cycle
      sorted.push(node);
      visited.add(node.id);
      return;
    }

    visiting.add(node.id);

    if (node.parentId && !visited.has(node.parentId)) {
      const parent = nodeMap.get(node.parentId);
      if (parent) {
        addNode(parent);
      }
    }

    visiting.delete(node.id);
    sorted.push(node);
    visited.add(node.id);
  };

  nodes.forEach(addNode);
  return sorted;
};

const debouncedSaveNode = debounce((node: AppNode, projectId?: string, cloudMode = false) => {
  storageService.saveNode(node, projectId, cloudMode);
}, 500);

interface GraphStore {
  projects: Project[];
  activeProjectId: string | null;
  activeGraphId: string | null;
  graphHistory: string[]; // For breadcrumbs
  
  nodes: Node[];
  edges: Edge[];
  graphs: Graph[];
  templates: Template[];
  snapshots: Snapshot[];
  comments: Comment[];
  
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  focusNodeId: string | null;
  searchQuery: string;
  darkMode: boolean;
  
  past: { nodes: Node[]; edges: Edge[] }[];
  future: { nodes: Node[]; edges: Edge[] }[];
  
  simulationActiveNodeId: string | null;
  isSimulating: boolean;
  isPresentationMode: boolean;
  
  impactAnalysisMode: boolean;
  impactSelectedNode: string | null;
  hiddenLayers: string[];
  
  setImpactAnalysisMode: (active: boolean) => void;
  setImpactSelectedNode: (nodeId: string | null) => void;
  toggleLayerVisibility: (layer: string) => void;
  
  // Settings & Cloud
  nodeTypes: string[];
  issueManagementConfigs: IssueManagementConfig[];
  issueManagementInstanceTypes: string[];
  cloudMode: boolean;
  devMode: boolean;
  autoSync: boolean;
  autoResize: boolean;
  selectedModel: string;
  apiKeys: {
    openai?: string;
    anthropic?: string;
    gemini?: string;
  };
  user: User | null;
  isAuthReady: boolean;
  isOnline: boolean;
  presence: Record<string, { name: string; photoUrl: string; lastSeen: number; cursor?: { x: number; y: number } }>;
  githubToken: string | null;
  setGithubToken: (token: string | null) => void;
  
  dbReads: number;
  dbWrites: number;
  incrementDbReads: (count?: number) => void;
  incrementDbWrites: (count?: number) => void;
  
  setCloudMode: (enabled: boolean) => void;
  setDevMode: (enabled: boolean) => void;
  setAutoSync: (enabled: boolean) => void;
  setAutoResize: (enabled: boolean) => void;
  setSelectedModel: (model: string) => void;
  setApiKey: (provider: string, key: string) => void;
  login: () => Promise<User | null>;
  signOut: () => Promise<void>;
  
  addNodeType: (type: string) => void;
  addIssueManagementConfig: (config: Omit<IssueManagementConfig, 'id'>) => void;
  updateIssueManagementConfig: (id: string, config: Partial<IssueManagementConfig>) => void;
  removeIssueManagementConfig: (id: string) => void;
  
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  takeSnapshot: () => void;
  
  // Actions
  toggleDarkMode: () => void;
  loadProjects: () => Promise<void>;
  loadSettings: () => Promise<void>;
  createProject: (name: string) => Promise<void>;
  loadProject: (projectId: string) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  toggleProjectLocalOnly: (projectId: string) => Promise<void>;
  
  loadGraph: (graphId: string) => Promise<void>;
  drillDown: (nodeId: string) => Promise<void>;
  navigateUp: (index: number) => Promise<void>;
  setFocusNodeId: (id: string | null) => void;
  autoResizeParent: (parentId: string) => Promise<void>;
  
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  
  addNode: (position: { x: number; y: number }, type?: string, templateId?: string, shape?: string, parentId?: string, customNodeType?: string) => Promise<void>;
  updateNodeData: (id: string, data: any, size?: { width: number, height: number }) => Promise<void>;
  updateNodeParent: (id: string, parentId: string | undefined) => Promise<void>;
  updateNodeZIndex: (id: string, zIndex: number) => void;
  updateNodePosition: (id: string, position: { x: number; y: number }) => void;
  updateEdgeLabel: (id: string, label: string) => Promise<void>;
  updateEdgeType: (id: string, type: string) => Promise<void>;
  updateEdgeStyle: (id: string, style: { color?: string; animated?: boolean; hasArrow?: boolean; relationshipType?: string }) => Promise<void>;
  deleteNode: (id: string) => Promise<void>;
  deleteEdge: (id: string) => Promise<void>;
  
  selectNode: (id: string | null) => void;
  selectEdge: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  
  groupNodes: () => Promise<void>;
  ungroupNodes: () => Promise<void>;
  
  loadTemplates: () => Promise<void>;
  saveTemplate: (template: Template) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  
  exportFormat: 'json' | 'xml';
  setExportFormat: (format: 'json' | 'xml') => void;
  exportProject: (format?: 'json' | 'xml') => Promise<string | null>;
  importProject: (data: string) => Promise<void>;
  
  aiEnabled: boolean;
  setAiEnabled: (enabled: boolean) => void;
  
  tidyUp: () => void;
  generateAIProcess: (prompt: string) => Promise<void>;
  analyzeGitHubRepo: (repoUrl: string, mode?: 'new' | 'current') => Promise<void>;
  syncAgileBoard: (boardUrl: string, options: { epics: boolean, stories: boolean, bugs: boolean }, configId?: string) => Promise<void>;
  updateRepositoryNodeData: (nodeId: string) => Promise<void>;
  autoTagNodes: () => Promise<void>;
  
  // Simulation
  setPresentationMode: (enabled: boolean) => void;
  startSimulation: () => void;
  stopSimulation: () => void;
  stepSimulation: () => void;
  
  generateManual: () => string | null;
  syncGraph: (graphId: string) => (() => void) | void;
  updatePresence: (cursor?: { x: number; y: number }) => Promise<void>;

  // Snapshots & Comments
  createSnapshot: (name: string) => Promise<void>;
  restoreSnapshot: (snapshotId: string) => Promise<void>;
  deleteSnapshot: (snapshotId: string) => Promise<void>;
  addComment: (targetId: string, text: string) => Promise<void>;
  resolveComment: (commentId: string) => Promise<void>;
  deleteComment: (commentId: string) => Promise<void>;
}

export const useGraphStore = create<GraphStore>((set, get) => {
  const shouldSyncProject = (projectId?: string) => {
    const { cloudMode, devMode, projects } = get();
    if (!cloudMode || devMode) return false;
    if (!projectId) return true;
    const project = projects.find(p => p.id === projectId);
    return project ? !project.isLocalOnly : true;
  };

  return {
  projects: [],
  activeProjectId: null,
  activeGraphId: null,
  graphHistory: [],
  
  nodes: [],
  edges: [],
  graphs: [],
  templates: [],
  snapshots: [],
  comments: [],
  
  selectedNodeId: null,
  selectedEdgeId: null,
  focusNodeId: null,
  searchQuery: '',
  darkMode: localStorage.getItem('atlas_dark_mode') === 'true',
  
  past: [] as { nodes: Node[]; edges: Edge[] }[],
  future: [] as { nodes: Node[]; edges: Edge[] }[],

  simulationActiveNodeId: null as string | null,
  isSimulating: false,
  isPresentationMode: false,
  
  impactAnalysisMode: false,
  impactSelectedNode: null as string | null,
  hiddenLayers: [] as string[],
  
  setImpactAnalysisMode: (active: boolean) => set({ impactAnalysisMode: active, impactSelectedNode: active ? get().selectedNodeId : null }),
  setImpactSelectedNode: (nodeId: string | null) => set({ impactSelectedNode: nodeId }),
  toggleLayerVisibility: (layer: string) => {
    const { hiddenLayers } = get();
    if (hiddenLayers.includes(layer)) {
      set({ hiddenLayers: hiddenLayers.filter(l => l !== layer) });
    } else {
      set({ hiddenLayers: [...hiddenLayers, layer] });
    }
  },
  
  nodeTypes: ['Process', 'Action', 'Decision', 'Data', 'System', 'User', 'External'],
  issueManagementConfigs: [],
  issueManagementInstanceTypes: ['HREGRC', 'THREGRC'],
  cloudMode: localStorage.getItem('atlas_cloud_mode') === 'true',
  devMode: localStorage.getItem('atlas_dev_mode') === 'true',
  autoSync: localStorage.getItem('atlas_auto_sync') !== 'false', // Default to true
  autoResize: localStorage.getItem('atlas_auto_resize') !== 'false', // Default to true
  aiEnabled: localStorage.getItem('atlas_ai_enabled') !== 'false', // Default to true
  selectedModel: localStorage.getItem('atlas_selected_model') || 'gemini-3-flash-preview',
  apiKeys: JSON.parse(localStorage.getItem('atlas_api_keys') || '{}'),
  user: null,
  isAuthReady: false,
  isOnline: navigator.onLine,
  presence: {},
  githubToken: localStorage.getItem('atlas_github_token'),
  exportFormat: 'json',
  setExportFormat: (format: 'json' | 'xml') => set({ exportFormat: format }),
  setAiEnabled: (enabled: boolean) => {
    set({ aiEnabled: enabled });
    localStorage.setItem('atlas_ai_enabled', String(enabled));
  },

  dbReads: parseInt(localStorage.getItem('atlas_db_reads') || '0', 10),
  dbWrites: parseInt(localStorage.getItem('atlas_db_writes') || '0', 10),
  
  incrementDbReads: (count = 1) => {
    set((state) => {
      const newCount = state.dbReads + count;
      localStorage.setItem('atlas_db_reads', String(newCount));
      return { dbReads: newCount };
    });
  },
  
  incrementDbWrites: (count = 1) => {
    set((state) => {
      const newCount = state.dbWrites + count;
      localStorage.setItem('atlas_db_writes', String(newCount));
      return { dbWrites: newCount };
    });
  },

  setGithubToken: (token: string | null) => {
    set({ githubToken: token });
    if (token) {
      localStorage.setItem('atlas_github_token', token);
    } else {
      localStorage.removeItem('atlas_github_token');
    }
  },

  setCloudMode: (enabled: boolean) => {
    if (enabled && !get().user) {
      console.warn('Cloud mode requires authentication');
      return;
    }
    set({ cloudMode: enabled });
    localStorage.setItem('atlas_cloud_mode', String(enabled));
    get().loadProjects();
  },

  setDevMode: (enabled: boolean) => {
    set({ devMode: enabled });
    localStorage.setItem('atlas_dev_mode', String(enabled));
    get().loadProjects();
  },

  setAutoSync: (enabled: boolean) => {
    set({ autoSync: enabled });
    localStorage.setItem('atlas_auto_sync', String(enabled));
  },
  setAutoResize: (enabled: boolean) => {
    set({ autoResize: enabled });
    localStorage.setItem('atlas_auto_resize', String(enabled));
  },

  setSelectedModel: (model: string) => {
    set({ selectedModel: model });
    localStorage.setItem('atlas_selected_model', model);
  },

  setApiKey: (provider: string, key: string) => {
    const newKeys = { ...get().apiKeys, [provider]: key };
    set({ apiKeys: newKeys });
    localStorage.setItem('atlas_api_keys', JSON.stringify(newKeys));
  },

  login: async () => {
    try {
      const result = await signIn();
      set({ user: result.user, isAuthReady: true });
      return result.user;
    } catch (error) {
      console.error('Login failed', error);
      return null;
    }
  },

  signOut: async () => {
    try {
      await logout();
      set({ user: null, cloudMode: false });
      localStorage.setItem('atlas_cloud_mode', 'false');
    } catch (error) {
      console.error('Logout failed', error);
    }
  },

  addNodeType: (type: string) => {
    const { cloudMode, user } = get();
    const newNodeTypes = [...new Set([...get().nodeTypes, type])];
    set({ nodeTypes: newNodeTypes });
    storageService.saveSettings('nodeTypes', newNodeTypes, cloudMode, user?.uid);
  },

  addIssueManagementConfig: (config: Omit<IssueManagementConfig, 'id'>) => {
    const { cloudMode, user } = get();
    const newConfig = { ...config, id: uuidv4() };
    const newConfigs = [...get().issueManagementConfigs, newConfig];
    set({ issueManagementConfigs: newConfigs });
    storageService.saveSettings('issueManagementConfigs', newConfigs, cloudMode, user?.uid);
  },

  updateIssueManagementConfig: (id: string, config: Partial<IssueManagementConfig>) => {
    const { cloudMode, user } = get();
    const newConfigs = get().issueManagementConfigs.map(c => c.id === id ? { ...c, ...config } : c);
    set({ issueManagementConfigs: newConfigs });
    storageService.saveSettings('issueManagementConfigs', newConfigs, cloudMode, user?.uid);
  },

  removeIssueManagementConfig: (id: string) => {
    const { cloudMode, user } = get();
    const newConfigs = get().issueManagementConfigs.filter(c => c.id !== id);
    set({ issueManagementConfigs: newConfigs });
    storageService.saveSettings('issueManagementConfigs', newConfigs, cloudMode, user?.uid);
  },

  takeSnapshot: () => {
    const { nodes, edges, past } = get();
    // Only take snapshot if it's different from the last one
    const lastSnapshot = past[past.length - 1];
    if (lastSnapshot && 
        JSON.stringify(lastSnapshot.nodes) === JSON.stringify(nodes) && 
        JSON.stringify(lastSnapshot.edges) === JSON.stringify(edges)) {
      return;
    }

    set({
      past: [...past.slice(-49), { nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) }],
      future: []
    });
  },

  undo: () => {
    const { past, future, nodes, edges } = get();
    if (past.length === 0) return;

    const previous = past[past.length - 1];
    const newPast = past.slice(0, past.length - 1);

    set({
      nodes: previous.nodes,
      edges: previous.edges,
      past: newPast,
      future: [{ nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) }, ...future.slice(0, 49)]
    });

    // Persist all nodes/edges to storage after undo
    const { activeGraphId } = get();
    if (activeGraphId) {
      const { activeProjectId, cloudMode } = get();
      previous.nodes.forEach(n => {
        storageService.saveNode({
          id: n.id,
          graphId: activeGraphId,
          position: n.position,
          width: n.width,
          height: n.height,
          type: n.type || 'customNode',
          data: n.data as any,
          parentId: n.parentId
        }, activeProjectId || undefined, cloudMode);
      });
      previous.edges.forEach(e => {
        storageService.saveEdge({
          id: e.id,
          graphId: activeGraphId,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle,
          targetHandle: e.targetHandle,
          label: e.label as string,
          type: e.type,
          animated: e.animated,
          color: (e.data as any)?.color,
          hasArrow: (e.data as any)?.hasArrow !== false,
          relationshipType: (e.data as any)?.relationshipType
        }, activeProjectId || undefined, cloudMode);
      });
    }
  },

  redo: () => {
    const { past, future, nodes, edges } = get();
    if (future.length === 0) return;

    const next = future[0];
    const newFuture = future.slice(1);

    set({
      nodes: next.nodes,
      edges: next.edges,
      past: [...past, { nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) }],
      future: newFuture
    });

    // Persist all nodes/edges to storage after redo
    const { activeGraphId } = get();
    if (activeGraphId) {
      const { activeProjectId, cloudMode } = get();
      next.nodes.forEach(n => {
        storageService.saveNode({
          id: n.id,
          graphId: activeGraphId,
          position: n.position,
          width: n.width,
          height: n.height,
          type: n.type || 'customNode',
          data: n.data as any,
          parentId: n.parentId
        }, activeProjectId || undefined, cloudMode);
      });
      next.edges.forEach(e => {
        storageService.saveEdge({
          id: e.id,
          graphId: activeGraphId,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle,
          targetHandle: e.targetHandle,
          label: e.label as string,
          type: e.type,
          animated: e.animated,
          color: (e.data as any)?.color,
          hasArrow: (e.data as any)?.hasArrow !== false,
          relationshipType: (e.data as any)?.relationshipType
        }, activeProjectId || undefined, cloudMode);
      });
    }
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,
  
  toggleDarkMode: () => set((state) => {
    const newDarkMode = !state.darkMode;
    localStorage.setItem('atlas_dark_mode', String(newDarkMode));
    return { darkMode: newDarkMode };
  }),
  
  loadProjects: async () => {
    const { cloudMode, user } = get();
    await get().loadSettings();
    const projects = await storageService.getProjects(cloudMode, user?.uid);
    set({ projects });
  },

  loadSettings: async () => {
    const { cloudMode, user } = get();
    const nodeTypes = await storageService.getSettings('nodeTypes', cloudMode, user?.uid);
    const issueManagementConfigs = await storageService.getSettings('issueManagementConfigs', cloudMode, user?.uid);
    const issueManagementInstanceTypes = await storageService.getSettings('issueManagementInstanceTypes', cloudMode, user?.uid);
    
    if (nodeTypes) set({ nodeTypes });
    if (issueManagementConfigs) set({ issueManagementConfigs });
    if (issueManagementInstanceTypes) set({ issueManagementInstanceTypes });
  },
  
  createProject: async (name: string) => {
    const { cloudMode, devMode, autoSync, user, projects } = get();
    
    const isLocalOnly = (devMode || !autoSync);
    
    const newProject: Project = {
      id: uuidv4(),
      name,
      ownerId: user?.uid || 'local-user',
      collaborators: user?.uid ? { [user.uid]: 'editor' } : { 'local-user': 'editor' },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isLocalOnly,
    };

    // Optimistic update
    set({ projects: [...projects, newProject] });

    // Update local storage for fast access by storageService
    if (isLocalOnly) {
      const localProjects = JSON.parse(localStorage.getItem('atlas_local_projects') || '[]');
      if (!localProjects.includes(newProject.id)) {
        localProjects.push(newProject.id);
        localStorage.setItem('atlas_local_projects', JSON.stringify(localProjects));
      }
    }

    try {
      await storageService.saveProject(newProject, cloudMode);
      
      const rootGraph: Graph = {
        id: uuidv4(),
        projectId: newProject.id,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await storageService.saveGraph(rootGraph, cloudMode);
      
      await get().loadProject(newProject.id);
    } catch (error) {
      // Rollback
      set({ projects });
      console.error('Failed to create project', error);
      alert('Failed to create project. Please try again.');
    }
  },
  
  loadProject: async (projectId: string) => {
    const { cloudMode } = get();
    const graphs = await storageService.getGraphsByProject(projectId, cloudMode);
    const rootGraph = graphs.find(g => !g.parentNodeId);
    
    if (rootGraph) {
      set({ 
        activeProjectId: projectId, 
        activeGraphId: rootGraph.id, // Keep for backward compatibility of new nodes
        graphHistory: [rootGraph.id],
        selectedNodeId: null
      });
      
      // Load ALL nodes and edges for the project
      const allAppNodes = await storageService.getNodesByGraph(rootGraph.id, projectId, cloudMode);
      const allAppEdges = await storageService.getEdgesByGraph(rootGraph.id, projectId, cloudMode);
      
      // Build a map of graphId -> parentNodeId
      const graphToParentMap: Record<string, string> = {};
      graphs.forEach(g => {
        if (g.parentNodeId) {
          graphToParentMap[g.id] = g.parentNodeId;
        }
      });

      const nodes: Node[] = allAppNodes
        .sort((a, b) => {
          if (a.type === 'groupNode' && b.type !== 'groupNode') return -1;
          if (a.type !== 'groupNode' && b.type === 'groupNode') return 1;
          return 0;
        })
        .map(n => {
          // Determine parentId based on graph hierarchy
          const parentId = n.parentId || graphToParentMap[n.graphId];
          
          return {
            id: n.id,
            type: n.type,
            position: n.position,
            data: n.data,
            width: n.width,
            height: n.height,
            parentId: parentId,
            // extent removed
          };
        });
      
      const edges: Edge[] = allAppEdges.map(e => {
        const { markerType, strokeDasharray, markerStart, finalHasArrow } = getEdgeStyleProps(e.relationshipType, e.hasArrow, e.color);
        
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle,
          targetHandle: e.targetHandle,
          label: e.label,
          type: e.type,
          animated: e.animated,
          style: { 
            stroke: e.color || undefined, 
            strokeWidth: 2,
            strokeDasharray
          },
          markerEnd: finalHasArrow ? { type: markerType, color: e.color || '#94a3b8' } : undefined,
          markerStart,
          data: { relationshipType: e.relationshipType, color: e.color, hasArrow: finalHasArrow }
        };
      });
      
      set({ nodes: sortNodesByParent(nodes), edges });
      
      if (cloudMode) {
        get().syncGraph(rootGraph.id);
      }
    }
  },
  
  deleteProject: async (projectId: string) => {
    const { cloudMode, projects, activeProjectId, activeGraphId } = get();
    
    // Optimistic update
    const previousProjects = projects;
    set({
      projects: projects.filter(p => p.id !== projectId),
      activeProjectId: activeProjectId === projectId ? null : activeProjectId,
      activeGraphId: activeProjectId === projectId ? null : activeGraphId,
      nodes: activeProjectId === projectId ? [] : get().nodes,
      edges: activeProjectId === projectId ? [] : get().edges,
    });

    try {
      await storageService.deleteProject(projectId, cloudMode);
    } catch (error) {
      // Rollback
      set({ projects: previousProjects });
      console.error('Failed to delete project', error);
      alert('Failed to delete project. Please try again.');
    }
  },

  toggleProjectLocalOnly: async (projectId: string) => {
    const { projects, cloudMode } = get();
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    
    const isLocalOnly = !project.isLocalOnly;
    const updatedProject = { ...project, isLocalOnly };
    
    set({ projects: projects.map(p => p.id === projectId ? updatedProject : p) });
    
    // Update local storage for fast access by storageService
    const localProjects = JSON.parse(localStorage.getItem('atlas_local_projects') || '[]');
    if (isLocalOnly) {
      if (!localProjects.includes(projectId)) localProjects.push(projectId);
    } else {
      const index = localProjects.indexOf(projectId);
      if (index > -1) localProjects.splice(index, 1);
    }
    localStorage.setItem('atlas_local_projects', JSON.stringify(localProjects));
    
    await storageService.saveProject(updatedProject, cloudMode);
    
    if (isLocalOnly && cloudMode) {
      // If we just made it local only, we should delete it from the cloud
      await storageService.deleteProjectFromCloud(projectId);
    } else if (!isLocalOnly && cloudMode) {
      // If we just made it synced, we need to upload all its graphs, nodes, edges, etc.
      await storageService.syncProjectToCloud(projectId);
    }
  },
  
  loadGraph: async (graphId: string) => {
    const { activeProjectId, cloudMode } = get();
    const appNodes = await storageService.getNodesByGraph(graphId, activeProjectId || undefined, cloudMode);
    const appEdges = await storageService.getEdgesByGraph(graphId, activeProjectId || undefined, cloudMode);
    
    const nodes: Node[] = appNodes
      .sort((a, b) => {
        if (a.type === 'groupNode' && b.type !== 'groupNode') return -1;
        if (a.type !== 'groupNode' && b.type === 'groupNode') return 1;
        return 0;
      })
      .map(n => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: n.data,
        width: n.width,
        height: n.height,
        parentId: n.parentId,
        // extent removed
      }));
    
    const edges: Edge[] = appEdges.map(e => {
      const { markerType, strokeDasharray, markerStart, finalHasArrow, labelBgStyle, labelStyle } = getEdgeStyleProps(e.relationshipType, e.hasArrow, e.color);
      
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
        label: e.label,
        type: e.type,
        animated: e.animated,
        style: { 
          stroke: e.color || undefined, 
          strokeWidth: 2,
          strokeDasharray
        },
        labelBgStyle,
        labelStyle,
        markerEnd: finalHasArrow ? { type: markerType, color: e.color || '#94a3b8' } : undefined,
        markerStart,
        data: { relationshipType: e.relationshipType, color: e.color, hasArrow: finalHasArrow }
      };
    });
    
    set({ nodes: sortNodesByParent(nodes), edges, activeGraphId: graphId });
  },
  
  drillDown: async (nodeId: string) => {
    const { nodes } = get();
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    const isGroup = node.type === 'groupNode';
    
    const updateData: any = {};
    if (isGroup) {
      updateData.isCollapsed = !node.data.isCollapsed;
    } else {
      updateData.isExpanded = !node.data.isExpanded;
    }
    
    // If expanding (or uncollapsing), ensure it has a decent size
    const isOpening = isGroup ? !updateData.isCollapsed : !!updateData.isExpanded;
    
    if (isOpening) {
      const width = (node.data.lastWidth as number) || 600;
      const height = (node.data.lastHeight as number) || 400;
      set({
        nodes: nodes.map(n => n.id === nodeId ? { 
          ...n, 
          width, 
          height, 
          data: { ...n.data, ...updateData } 
        } : n),
        focusNodeId: nodeId
      });
      
      const updatedNode = get().nodes.find(n => n.id === nodeId);
      if (updatedNode) {
        await storageService.saveNode(updatedNode as any, get().activeProjectId || undefined, get().cloudMode);
      }
      await get().autoResizeParent(nodeId);
    } else {
      const updateDataWithLastSize = { ...updateData, lastWidth: node.width, lastHeight: node.height };
      const size = { width: 200, height: 50 };
      await get().updateNodeData(nodeId, updateDataWithLastSize, size);
      set({ focusNodeId: null });
    }
  },
  
  setFocusNodeId: (id: string | null) => set({ focusNodeId: id }),

  autoResizeParent: async (parentId: string) => {
    if (!get().autoResize) return;
    const { nodes, activeProjectId, cloudMode } = get();
    const parent = nodes.find(n => n.id === parentId);
    if (!parent) return;

    // Recursive function to get all descendants
    const getDescendants = (nodeId: string, visited: Set<string> = new Set()): Node[] => {
      if (visited.has(nodeId)) return [];
      visited.add(nodeId);
      const children = nodes.filter(n => n.parentId === nodeId);
      let descendants = [...children];
      for (const child of children) {
        descendants = [...descendants, ...getDescendants(child.id, visited)];
      }
      return descendants;
    };

    const descendants = getDescendants(parentId);
    if (descendants.length === 0) return;

    // Helper to get absolute position of a node relative to the parent
    const getAbsolutePosition = (node: Node): { x: number; y: number } => {
      let x = node.position.x;
      let y = node.position.y;
      let currentParentId = node.parentId;

      while (currentParentId && currentParentId !== parentId) {
        const p = nodes.find((n) => n.id === currentParentId);
        if (p) {
          x += p.position.x;
          y += p.position.y;
          currentParentId = p.parentId;
        } else {
          break;
        }
      }
      return { x, y };
    };

    // Calculate bounding box of descendants
    let maxX = -Infinity;
    let maxY = -Infinity;

    descendants.forEach(descendant => {
      const pos = getAbsolutePosition(descendant);
      const x = pos.x;
      const y = pos.y;
      const w = descendant.width || (descendant.type === 'groupNode' ? 200 : 150);
      const h = descendant.height || (descendant.type === 'groupNode' ? 150 : 100);

      maxX = Math.max(maxX, x + w);
      maxY = Math.max(maxY, y + h);
    });
    
    // If no descendants, use parent's own size
    if (maxX === -Infinity) {
        maxX = parent.width || 200;
        maxY = parent.height || 150;
    }

    const padding = 60;
    const headerHeight = 50;
    
    const requiredWidth = Math.max(parent.width || 200, maxX + padding);
    const requiredHeight = Math.max(parent.height || 150, maxY + padding + headerHeight);

    if (Math.abs(requiredWidth - (parent.width || 200)) > 5 || Math.abs(requiredHeight - (parent.height || 150)) > 5) {
      const oldWidth = parent.width || 200;
      const oldHeight = parent.height || 150;
      
      const deltaW = requiredWidth - oldWidth;
      const deltaH = requiredHeight - oldHeight;

      set(state => ({
        nodes: state.nodes.map(n => n.id === parentId ? {
          ...n,
          width: requiredWidth,
          height: requiredHeight
        } : n)
      }));
      
      const updatedParent = get().nodes.find(n => n.id === parentId);
      if (updatedParent) {
        await storageService.saveNode(updatedParent as any, activeProjectId || undefined, cloudMode);
      }
      
      // Push neighbors
      if (deltaW > 0 || deltaH > 0) {
        const currentNodes = get().nodes;
        const siblings = currentNodes.filter(n => n.parentId === parent.parentId && n.id !== parentId);
        
        const nodesToPush = siblings.filter(s => {
          // If sibling is to the right of the parent
          const isToRight = s.position.x >= parent.position.x + oldWidth - 20;
          // If sibling is below the parent
          const isBelow = s.position.y >= parent.position.y + oldHeight - 20;
          return isToRight || isBelow;
        });
        
        if (nodesToPush.length > 0) {
          set(state => ({
            nodes: state.nodes.map(n => {
              const pushNode = nodesToPush.find(p => p.id === n.id);
              if (pushNode) {
                const isToRight = pushNode.position.x >= parent.position.x + oldWidth - 20;
                const isBelow = pushNode.position.y >= parent.position.y + oldHeight - 20;
                
                return {
                  ...n,
                  position: {
                    x: n.position.x + (isToRight ? deltaW : 0),
                    y: n.position.y + (isBelow ? deltaH : 0)
                  }
                };
              }
              return n;
            })
          }));
          
          // Save pushed nodes
          const finalNodes = get().nodes;
          for (const pushedNode of finalNodes.filter(n => nodesToPush.some(p => p.id === n.id))) {
            await storageService.saveNode(pushedNode as any, activeProjectId || undefined, cloudMode);
          }
          
          // Recursively resize parent of parent if needed
          if (parent.parentId) {
            await get().autoResizeParent(parent.parentId);
          }
        }
      }
    }
  },
  
  navigateUp: async (index: number) => {
    // No-op in single canvas mode
  },
  
  onNodesChange: (changes: NodeChange[]) => {
    const { nodes, activeGraphId, activeProjectId, cloudMode } = get();
    const newNodes = applyNodeChanges(changes, nodes);
    set({ nodes: sortNodesByParent(newNodes) });
    
    // Persist position/size changes
    if (!activeGraphId) return;
    
    const parentIdsToResize = new Set<string>();

    changes.forEach(async (change) => {
      if (change.type === 'position' || change.type === 'dimensions') {
        const node = newNodes.find(n => n.id === change.id);
        if (node) {
          const appNode: AppNode = {
            id: node.id,
            graphId: activeGraphId,
            position: node.position,
            width: node.width,
            height: node.height,
            type: node.type || 'customNode',
            data: node.data as any,
            parentId: node.parentId
          };
          debouncedSaveNode(appNode, activeProjectId || undefined, cloudMode);
          
          if (node.parentId) {
            const isDragging = change.type === 'position' && (change as any).dragging;
            if (!isDragging) {
              parentIdsToResize.add(node.parentId);
            }
          }
        }
      } else if (change.type === 'remove') {
        await storageService.deleteNode(change.id, activeGraphId, activeProjectId || undefined, cloudMode);
      }
    });

    if (parentIdsToResize.size > 0) {
      // Use a small timeout to let React Flow update dimensions if needed
      setTimeout(() => {
        parentIdsToResize.forEach(pid => get().autoResizeParent(pid));
      }, 50);
    }
  },
  
  onEdgesChange: (changes: EdgeChange[]) => {
    const { edges, nodes, activeGraphId, activeProjectId, cloudMode, updateNodeData } = get();
    const newEdges = applyEdgeChanges(changes, edges);
    set({ edges: newEdges });
    
    if (!activeGraphId) return;
    
    changes.forEach(async (change) => {
      if (change.type === 'remove') {
        const removedEdge = edges.find(e => e.id === change.id);
        if (removedEdge) {
          const targetNode = nodes.find(n => n.id === removedEdge.target);
          if (targetNode && targetNode.data.nodeType === 'reference' && targetNode.data.referenceTarget === removedEdge.source) {
            updateNodeData(targetNode.id, { referenceTarget: '' });
          }
        }
        await storageService.deleteEdge(change.id, activeGraphId, activeProjectId || undefined, cloudMode);
      }
    });
  },
  
  onConnect: async (connection: Connection) => {
    const { activeGraphId, activeProjectId, edges, nodes, cloudMode, updateNodeData, deleteEdge } = get();
    if (!activeGraphId || !connection.source || !connection.target) return;
    
    get().takeSnapshot();

    // Check if target is a reference node
    const targetNode = nodes.find(n => n.id === connection.target);
    if (targetNode && targetNode.data.nodeType === 'reference') {
      // Update reference target
      updateNodeData(connection.target, { referenceTarget: connection.source });
      
      // Remove existing incoming edges to this reference node
      const existingEdges = edges.filter(edge => edge.target === connection.target);
      for (const edge of existingEdges) {
        await deleteEdge(edge.id);
      }
    }
    
    const { markerType, strokeDasharray, markerStart, finalHasArrow, labelBgStyle, labelStyle } = getEdgeStyleProps('flow', true, undefined);

    const newEdge: Edge = {
      id: uuidv4(),
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle,
      targetHandle: connection.targetHandle,
      label: 'flow',
      type: 'smoothstep',
      markerEnd: finalHasArrow ? { type: markerType, color: '#94a3b8' } : undefined,
      markerStart,
      style: { strokeWidth: 2, strokeDasharray },
      labelBgStyle,
      labelStyle,
      data: { relationshipType: 'flow', hasArrow: finalHasArrow }
    };
    
    set({ edges: addEdge(newEdge, get().edges) });
    
    const appEdge: AppEdge = {
      id: newEdge.id,
      graphId: activeGraphId,
      source: newEdge.source,
      target: newEdge.target,
      sourceHandle: connection.sourceHandle || undefined,
      targetHandle: connection.targetHandle || undefined,
      relationshipType: 'flow',
      label: 'flow',
      type: 'smoothstep',
      hasArrow: true
    };
    await storageService.saveEdge(appEdge, activeProjectId || undefined, cloudMode);
  },
  
  addNode: async (position: { x: number; y: number }, type: string = 'customNode', templateId?: string, shape?: string, parentId?: string, customNodeType?: string) => {
    const { activeGraphId, activeProjectId, cloudMode, templates } = get();
    if (!activeGraphId) return;
    
    get().takeSnapshot();
    
    let initialData: any = {
      title: type === 'groupNode' ? 'New Group' : (type === 'inputNode' ? 'Input' : (type === 'outputNode' ? 'Output' : (type === 'referenceNode' ? 'Reference' : (type === 'none' ? '' : 'New Node')))),
      description: '',
      nodeType: customNodeType || (type === 'groupNode' ? 'group' : (type === 'inputNode' ? 'input' : (type === 'outputNode' ? 'output' : (type === 'referenceNode' ? 'reference' : (type === 'none' ? '' : 'default'))))),
      metadata: {},
      links: [],
      codeSnippets: [],
      tags: [],
      shape: shape || (type === 'inputNode' || type === 'outputNode' ? 'pill' : 'rectangle'),
      isExpanded: false,
    };
    
    if (templateId) {
      const template = templates.find(t => t.id === templateId);
      if (template) {
        initialData = {
          title: `New ${template.name}`,
          description: template.defaultDescription || '',
          nodeType: template.nodeType,
          metadata: template.metadataSchema.reduce((acc, key) => ({ ...acc, [key]: '' }), {}),
          links: [...template.defaultLinks],
          codeSnippets: [...template.defaultCodeSnippets],
          tags: [],
          shape: shape || 'rectangle',
          isExpanded: false,
          icon: template.icon,
          iconUrl: template.iconUrl,
        };
      }
    }
    
    const newNode: Node = {
      id: uuidv4(),
      type,
      position,
      data: initialData,
      parentId,
      // extent removed
      width: type === 'groupNode' ? 300 : 200,
      height: type === 'groupNode' ? 200 : 120,
      selected: true,
    };
    
    set({ 
      nodes: sortNodesByParent([...get().nodes.map(n => ({ ...n, selected: false })), newNode]),
      selectedNodeId: newNode.id,
      selectedEdgeId: null
    });
    
    const appNode: AppNode = {
      id: newNode.id,
      graphId: activeGraphId,
      position: newNode.position,
      width: newNode.width,
      height: newNode.height,
      type: newNode.type || 'customNode',
      data: newNode.data as any,
      parentId,
    };
    await storageService.saveNode(appNode, activeProjectId || undefined, cloudMode);

    // Auto resize parent if needed
    if (parentId) {
      await get().autoResizeParent(parentId);
    }
  },
  
  updateNodeData: async (id: string, data: any, size?: { width: number, height: number }) => {
    const { activeGraphId, activeProjectId, cloudMode, nodes } = get();
    if (!activeGraphId) return;
    
    get().takeSnapshot();
    
    set({
      nodes: nodes.map(n => n.id === id ? { ...n, data: { ...n.data, ...data }, ...(size || {}) } : n)
    });
    
    const updatedNode = get().nodes.find(n => n.id === id);
    if (updatedNode) {
      const appNode: AppNode = {
        id: updatedNode.id,
        graphId: activeGraphId,
        position: updatedNode.position,
        width: updatedNode.width,
        height: updatedNode.height,
        type: updatedNode.type || 'customNode',
        data: updatedNode.data as any,
        parentId: updatedNode.parentId
      };
      debouncedSaveNode(appNode, activeProjectId || undefined, cloudMode);
    }
  },

  updateNodeParent: async (id: string, parentId: string | undefined) => {
    const { activeGraphId, activeProjectId, cloudMode, nodes } = get();
    if (!activeGraphId) return;

    // Cycle detection
    if (parentId) {
        let currentParentId = parentId;
        while(currentParentId) {
            if (currentParentId === id) return; // Cycle detected
            const parent = nodes.find(n => n.id === currentParentId);
            currentParentId = parent?.parentId;
        }
    }

    get().takeSnapshot();

    set({
      nodes: nodes.map(n => n.id === id ? { ...n, parentId } : n)
    });

    const updatedNode = get().nodes.find(n => n.id === id);
    if (updatedNode) {
      const appNode: AppNode = {
        id: updatedNode.id,
        graphId: activeGraphId,
        position: updatedNode.position,
        width: updatedNode.width,
        height: updatedNode.height,
        type: updatedNode.type || 'customNode',
        data: updatedNode.data as any,
        parentId: updatedNode.parentId
      };
      debouncedSaveNode(appNode, activeProjectId || undefined, cloudMode);
    }
  },

  updateNodeZIndex: (id: string, zIndex: number) => {
    const { nodes } = get();
    set({
      nodes: nodes.map(n => n.id === id ? { ...n, zIndex } : n)
    });
  },

  updateNodePosition: (id: string, position: { x: number; y: number }) => {
    const { nodes } = get();
    set({
      nodes: nodes.map(n => n.id === id ? { ...n, position } : n)
    });
  },
  
  updateEdgeLabel: async (id: string, label: string) => {
    const { edges, activeGraphId, activeProjectId, cloudMode } = get();
    if (!activeGraphId) return;
    
    const edge = edges.find(e => e.id === id);
    if (!edge) return;
    
    get().takeSnapshot();
    
    const updatedEdge = { ...edge, label };
    
    set({
      edges: edges.map(e => e.id === id ? updatedEdge : e)
    });
    
    const appEdge: AppEdge = {
      id: updatedEdge.id,
      graphId: activeGraphId,
      source: updatedEdge.source,
      target: updatedEdge.target,
      sourceHandle: updatedEdge.sourceHandle || undefined,
      targetHandle: updatedEdge.targetHandle || undefined,
      relationshipType: label,
      label: label,
      type: updatedEdge.type,
      color: edge.data?.color as string | undefined,
      animated: edge.animated,
      hasArrow: edge.data?.hasArrow as boolean | undefined
    };
    await storageService.saveEdge(appEdge, activeProjectId || undefined, cloudMode);
  },

  updateEdgeType: async (id: string, type: string) => {
    const { edges, activeGraphId, activeProjectId, cloudMode } = get();
    if (!activeGraphId) return;
    
    const edge = edges.find(e => e.id === id);
    if (!edge) return;
    
    get().takeSnapshot();
    
    const updatedEdge = { ...edge, type };
    
    set({
      edges: edges.map(e => e.id === id ? updatedEdge : e)
    });
    
    const appEdge: AppEdge = {
      id: updatedEdge.id,
      graphId: activeGraphId,
      source: updatedEdge.source,
      target: updatedEdge.target,
      sourceHandle: updatedEdge.sourceHandle || undefined,
      targetHandle: updatedEdge.targetHandle || undefined,
      relationshipType: (edge.data?.relationshipType as string) || 'flow',
      label: edge.label as string,
      type: type,
      color: edge.data?.color as string | undefined,
      animated: edge.animated,
      hasArrow: edge.data?.hasArrow as boolean | undefined
    };
    await storageService.saveEdge(appEdge, activeProjectId || undefined, cloudMode);
  },

  updateEdgeStyle: async (id: string, style: { color?: string; animated?: boolean; hasArrow?: boolean; relationshipType?: string }) => {
    const { edges, activeGraphId, activeProjectId, cloudMode } = get();
    if (!activeGraphId) return;
    
    const edge = edges.find(e => e.id === id);
    if (!edge) return;
    
    get().takeSnapshot();
    
    const currentData = edge.data || {};
    const newColor = style.color !== undefined ? style.color : currentData.color as string | undefined;
    const newAnimated = style.animated !== undefined ? style.animated : edge.animated;
    let newHasArrow = style.hasArrow !== undefined ? style.hasArrow : currentData.hasArrow as boolean | undefined;
    const newRelationshipType = style.relationshipType !== undefined ? style.relationshipType : currentData.relationshipType as string | undefined;
    
    // If the user just changed the relationship type, we might want to override the arrow setting
    if (style.relationshipType !== undefined) {
      if (newRelationshipType === 'association') {
        newHasArrow = false;
      } else if (newRelationshipType === 'bidirectional') {
        newHasArrow = true;
      }
    }
    
    const { markerType, strokeDasharray, markerStart, finalHasArrow, labelBgStyle, labelStyle } = getEdgeStyleProps(newRelationshipType, newHasArrow, newColor);
    
    let newLabel = edge.label;
    if (style.relationshipType !== undefined && style.relationshipType !== currentData.relationshipType) {
      if (!edge.label || edge.label === currentData.relationshipType) {
        newLabel = style.relationshipType;
      }
    }

    const updatedEdge: Edge = {
      ...edge,
      label: newLabel,
      animated: newAnimated,
      style: { 
        stroke: newColor || undefined, 
        strokeWidth: 2,
        strokeDasharray
      },
      labelBgStyle,
      labelStyle,
      markerEnd: finalHasArrow ? { type: markerType, color: newColor || '#94a3b8' } : undefined,
      markerStart: markerStart,
      data: { ...currentData, color: newColor, hasArrow: finalHasArrow, relationshipType: newRelationshipType }
    };
    
    set({
      edges: edges.map(e => e.id === id ? updatedEdge : e)
    });
    
    const appEdge: AppEdge = {
      id: updatedEdge.id,
      graphId: activeGraphId,
      source: updatedEdge.source,
      target: updatedEdge.target,
      sourceHandle: updatedEdge.sourceHandle || undefined,
      targetHandle: updatedEdge.targetHandle || undefined,
      relationshipType: newRelationshipType || 'flow',
      label: newLabel as string,
      type: updatedEdge.type,
      color: newColor,
      animated: newAnimated,
      hasArrow: newHasArrow
    };
    await storageService.saveEdge(appEdge, activeProjectId || undefined, cloudMode);
  },

  deleteNode: async (id: string) => {
    const { nodes, edges, activeGraphId, activeProjectId, cloudMode } = get();
    
    if (!activeGraphId) {
      console.warn('deleteNode called without activeGraphId');
      return;
    }
    
    get().takeSnapshot();
    
    // Find children if this is a group node
    const childrenIds = nodes.filter(n => n.parentId === id).map(n => n.id);
    const idsToDelete = new Set([id, ...childrenIds]);
    
    // Remove connected edges for node and its children
    const connectedEdges = edges.filter(e => idsToDelete.has(e.source) || idsToDelete.has(e.target));
    for (const edge of connectedEdges) {
      await storageService.deleteEdge(edge.id, activeGraphId, activeProjectId || undefined, cloudMode);
    }
    
    // Delete nodes from storage
    for (const nodeId of idsToDelete) {
      await storageService.deleteNode(nodeId, activeGraphId, activeProjectId || undefined, cloudMode);
    }
    
    set((state) => ({
      nodes: state.nodes.filter(n => !idsToDelete.has(n.id)),
      edges: state.edges.filter(e => !idsToDelete.has(e.source) && !idsToDelete.has(e.target)),
      selectedNodeId: idsToDelete.has(state.selectedNodeId as string) ? null : state.selectedNodeId
    }));
  },
  
  deleteEdge: async (id: string) => {
    const { edges, activeGraphId, activeProjectId, cloudMode } = get();
    get().takeSnapshot();
    await storageService.deleteEdge(id, activeGraphId || '', activeProjectId || undefined, cloudMode);
    set((state) => ({
      edges: state.edges.filter(e => e.id !== id)
    }));
  },
  
  selectNode: (id: string | null) => {
    set({ selectedNodeId: id, selectedEdgeId: null });
  },
  
  selectEdge: (id: string | null) => {
    set({ selectedEdgeId: id, selectedNodeId: null });
  },
  
  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },
  
  groupNodes: async () => {
    const { nodes, activeGraphId } = get();
    if (!activeGraphId) return;

    const selectedNodes = nodes.filter(n => n.selected && !n.parentId);
    if (selectedNodes.length < 2) return;

    get().takeSnapshot();

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    selectedNodes.forEach(n => {
      minX = Math.min(minX, n.position.x);
      minY = Math.min(minY, n.position.y);
      maxX = Math.max(maxX, n.position.x + (n.measured?.width || n.width || 150));
      maxY = Math.max(maxY, n.position.y + (n.measured?.height || n.height || 100));
    });

    const padding = 40;
    const groupPosition = { x: minX - padding, y: minY - padding };
    const groupWidth = maxX - minX + padding * 2;
    const groupHeight = maxY - minY + padding * 2;

    const groupId = uuidv4();
    const groupNode: Node = {
      id: groupId,
      type: 'groupNode',
      position: groupPosition,
      style: { width: groupWidth, height: groupHeight },
      data: { title: 'New Group', nodeType: 'group' },
    };

    const updatedNodes = nodes.map(n => {
      if (n.selected && !n.parentId) {
        return {
          ...n,
          selected: false,
          parentId: groupId,
          position: {
            x: n.position.x - groupPosition.x,
            y: n.position.y - groupPosition.y,
          },
          // extent removed
        };
      }
      return n;
    });

    set({ nodes: sortNodesByParent([{ ...groupNode, selected: true }, ...updatedNodes]), selectedNodeId: groupId });

    const { activeProjectId, cloudMode } = get();
    const appGroupNode: AppNode = {
      id: groupId,
      graphId: activeGraphId,
      position: groupNode.position,
      width: groupWidth,
      height: groupHeight,
      type: 'groupNode',
      data: groupNode.data as any,
    };
    await storageService.saveNode(appGroupNode, activeProjectId || undefined, cloudMode);

    for (const n of updatedNodes) {
      if (n.parentId === groupId) {
        const appNode: AppNode = {
          id: n.id,
          graphId: activeGraphId,
          position: n.position,
          width: n.width,
          height: n.height,
          type: n.type || 'customNode',
          data: n.data as any,
          parentId: n.parentId,
        };
        await storageService.saveNode(appNode, activeProjectId || undefined, cloudMode);
      }
    }
  },

  ungroupNodes: async () => {
    const { nodes, activeGraphId, activeProjectId, cloudMode } = get();
    if (!activeGraphId) return;

    const selectedGroups = nodes.filter(n => n.selected && n.type === 'groupNode');
    if (selectedGroups.length === 0) return;

    get().takeSnapshot();

    let updatedNodes = [...nodes];
    const groupIdsToDelete = new Set(selectedGroups.map(g => g.id));

    for (const group of selectedGroups) {
      updatedNodes = updatedNodes.map(n => {
        if (n.parentId === group.id) {
          return {
            ...n,
            parentId: undefined,
            position: {
              x: n.position.x + group.position.x,
              y: n.position.y + group.position.y,
            },
            // extent removed
          };
        }
        return n;
      });
    }

    updatedNodes = updatedNodes.filter(n => !groupIdsToDelete.has(n.id));

    set({ nodes: sortNodesByParent(updatedNodes) });

    for (const groupId of groupIdsToDelete) {
      await storageService.deleteNode(groupId, activeGraphId || '', activeProjectId || undefined, cloudMode);
    }

    for (const n of updatedNodes) {
      if (selectedGroups.some(g => g.id === n.parentId)) {
         // This shouldn't happen based on the logic above, but just in case
      } else {
        // We need to save the new positions of the ungrouped nodes
        const originalNode = nodes.find(oldN => oldN.id === n.id);
        if (originalNode && originalNode.parentId && groupIdsToDelete.has(originalNode.parentId)) {
           const appNode: AppNode = {
            id: n.id,
            graphId: activeGraphId,
            position: n.position,
            width: n.width,
            height: n.height,
            type: n.type || 'customNode',
            data: n.data as any,
            parentId: undefined,
          };
          await storageService.saveNode(appNode, activeProjectId || undefined, cloudMode);
        }
      }
    }
  },

  loadTemplates: async () => {
    const templates = await storageService.getTemplates();
    set({ templates });
  },
  
  saveTemplate: async (template: Template) => {
    await storageService.saveTemplate(template);
    set((state) => {
      const existing = state.templates.find(t => t.id === template.id);
      if (existing) {
        return { templates: state.templates.map(t => t.id === template.id ? template : t) };
      }
      return { templates: [...state.templates, template] };
    });
  },
  
  deleteTemplate: async (id: string) => {
    await storageService.deleteTemplate(id);
    set((state) => ({
      templates: state.templates.filter(t => t.id !== id)
    }));
  },
  
  exportProject: async (format: 'json' | 'xml' = 'json') => {
    const { activeProjectId } = get();
    if (!activeProjectId) return null;
    return await storageService.exportProject(activeProjectId, format);
  },
  
  importProject: async (data: string) => {
    const { cloudMode } = get();
    await storageService.importProject(data, cloudMode);
    await get().loadProjects();
  },

  tidyUp: () => {
    const { nodes, edges } = get();
    if (nodes.length === 0) return;

    get().takeSnapshot();

    const dagreGraph = new dagre.graphlib.Graph({ compound: true });
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({ rankdir: 'TB', nodesep: 100, ranksep: 100 });

    nodes.forEach((node) => {
      dagreGraph.setNode(node.id, { 
        width: node.measured?.width || node.width || 150, 
        height: node.measured?.height || node.height || 100 
      });
    });

    nodes.forEach((node) => {
      if (node.parentId) {
        dagreGraph.setParent(node.id, node.parentId);
      }
    });

    edges.forEach((edge) => {
      dagreGraph.setEdge(edge.source, edge.target);
    });

    try {
      dagre.layout(dagreGraph);
    } catch (e) {
      console.warn('Dagre layout failed (possibly due to cycles or parent-child edges). Falling back to non-compound layout.', e);
      
      // Recreate graph without compound option
      const fallbackGraph = new dagre.graphlib.Graph();
      fallbackGraph.setDefaultEdgeLabel(() => ({}));
      fallbackGraph.setGraph({ rankdir: 'TB', nodesep: 100, ranksep: 100 });

      nodes.forEach((node) => {
        fallbackGraph.setNode(node.id, { 
          width: node.measured?.width || node.width || 150, 
          height: node.measured?.height || node.height || 100 
        });
      });

      edges.forEach((edge) => {
        fallbackGraph.setEdge(edge.source, edge.target);
      });

      try {
        dagre.layout(fallbackGraph);
        // Copy positions back to dagreGraph so the rest of the code works
        nodes.forEach((node) => {
          const pos = fallbackGraph.node(node.id);
          dagreGraph.setNode(node.id, pos);
        });
      } catch (e2) {
        console.warn('Fallback layout also failed.', e2);
        return;
      }
    }

    const newNodes = nodes.map((node) => {
      const nodeWithPosition = dagreGraph.node(node.id);
      const width = nodeWithPosition.width || node.measured?.width || node.width || 150;
      const height = nodeWithPosition.height || node.measured?.height || node.height || 100;
      
      let x = nodeWithPosition.x - width / 2;
      let y = nodeWithPosition.y - height / 2;
      
      if (node.parentId) {
        const parentWithPosition = dagreGraph.node(node.parentId);
        const parentNode = nodes.find(n => n.id === node.parentId);
        if (parentWithPosition && parentNode) {
          const parentWidth = parentWithPosition.width || parentNode.measured?.width || parentNode.width || 150;
          const parentHeight = parentWithPosition.height || parentNode.measured?.height || parentNode.height || 100;
          const parentX = parentWithPosition.x - parentWidth / 2;
          const parentY = parentWithPosition.y - parentHeight / 2;
          x -= parentX;
          y -= parentY;
        }
      }

      return {
        ...node,
        width,
        height,
        position: { x, y },
      };
    });

    set({ nodes: sortNodesByParent(newNodes) });
    
    // Persist new positions
    const { activeGraphId, activeProjectId, cloudMode } = get();
    if (activeGraphId) {
      newNodes.forEach(n => {
        storageService.saveNode({
          id: n.id,
          graphId: activeGraphId,
          position: n.position,
          width: n.width,
          height: n.height,
          type: n.type || 'customNode',
          data: n.data as any,
          parentId: n.parentId
        }, activeProjectId || undefined, cloudMode);
      });
    }
  },

  generateAIProcess: async (prompt: string) => {
    const { activeGraphId, nodes: currentNodes, edges: currentEdges, selectedModel } = get();
    if (!activeGraphId) return;

    get().takeSnapshot();

    const result = await geminiService.generateProcess(prompt, { nodes: currentNodes, edges: currentEdges }, selectedModel);
    
    const idMap: Record<string, string> = {};
    const finalNewNodes: Node[] = [];

    // First pass: identify which nodes are new and which are existing
    result.nodes.forEach((n, index) => {
      const existingNode = currentNodes.find(cn => cn.id === n.id);
      if (existingNode) {
        // AI is referencing an existing node
        idMap[n.id] = n.id;
      } else {
        // AI created a new node
        const newId = uuidv4();
        idMap[n.id] = newId;
        
        finalNewNodes.push({
          id: newId,
          type: 'customNode',
          // Position new nodes roughly below or to the right of existing ones if possible, 
          // but tidyUp will fix it anyway.
          position: { x: 100, y: (currentNodes.length + index) * 150 },
          data: {
            title: n.title,
            description: n.description,
            nodeType: n.type,
            shape: n.type === 'decision' ? 'diamond' : 'rectangle',
            isExpanded: false,
            tags: [],
            links: [],
            codeSnippets: [],
            metadata: {}
          }
        });
      }
    });

    const finalNewEdges: Edge[] = result.edges.map(e => {
      const sourceId = idMap[e.source] || e.source;
      const targetId = idMap[e.target] || e.target;
      const { markerType, strokeDasharray, markerStart, finalHasArrow, labelBgStyle, labelStyle } = getEdgeStyleProps(e.label, true, undefined);
      
      return {
        id: uuidv4(),
        source: sourceId,
        target: targetId,
        label: e.label,
        type: 'smoothstep',
        markerEnd: finalHasArrow ? { type: markerType, color: '#94a3b8' } : undefined,
        markerStart,
        style: { strokeWidth: 2, strokeDasharray },
        labelBgStyle,
        labelStyle,
        data: { relationshipType: e.label, hasArrow: finalHasArrow }
      };
    });

    set({ 
      nodes: [...get().nodes, ...finalNewNodes], 
      edges: [...get().edges, ...finalNewEdges] 
    });

    // Persist new nodes
    const { activeProjectId, cloudMode } = get();
    for (const n of finalNewNodes) {
      await storageService.saveNode({
        id: n.id,
        graphId: activeGraphId,
        position: n.position,
        type: n.type || 'customNode',
        data: n.data as any,
      }, activeProjectId || undefined, cloudMode);
    }
    // Persist new edges
    for (const e of finalNewEdges) {
      await storageService.saveEdge({
        id: e.id,
        graphId: activeGraphId,
        source: e.source,
        target: e.target,
        relationshipType: (e.data as any).relationshipType,
        label: e.label as string,
        type: e.type,
        hasArrow: true
      }, activeProjectId || undefined, cloudMode);
    }

    // Auto layout after generation
    get().tidyUp();
  },

  analyzeGitHubRepo: async (repoUrl: string, mode: 'new' | 'current' = 'new') => {
    let { activeGraphId, selectedModel } = get();
    
    get().takeSnapshot();

    try {
      // Extract owner and repo from URL
      const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (!match) throw new Error('Invalid GitHub URL. Please use the format: https://github.com/owner/repo');
      const [, owner, repo] = match;

      // If mode is 'new' or no active graph, create a new project
      if (mode === 'new' || !activeGraphId) {
        await get().createProject(`Import: ${repo}`);
        // Re-fetch state after creation
        activeGraphId = get().activeGraphId;
        if (!activeGraphId) throw new Error('Failed to create a project for the import. Please create a project manually first.');
      }

      // Fetch repo structure (simplified for now)
      const headers: Record<string, string> = {
        'Accept': 'application/vnd.github.v3+json'
      };
      const { githubToken } = get();
      if (githubToken) {
        headers['Authorization'] = `token ${githubToken}`;
      }

      // 1. Get default branch
      const repoInfoResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
      if (!repoInfoResponse.ok) {
        if (repoInfoResponse.status === 404) {
          throw new Error('Repository not found. Make sure it is public or you are connected with a token that has access.');
        }
        throw new Error(`Failed to fetch repository info: ${repoInfoResponse.statusText}`);
      }
      const repoInfo = await repoInfoResponse.json();
      const defaultBranch = repoInfo.default_branch || 'main';

      // 2. Fetch recursive tree
      const treeResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`, { headers });
      if (!treeResponse.ok) {
        throw new Error(`Failed to fetch repository tree: ${treeResponse.statusText}`);
      }
      const treeData = await treeResponse.json();
      
      // Limit tree size to avoid overwhelming the prompt
      const filteredTree = treeData.tree
        .filter((item: any) => !item.path.startsWith('.') && !item.path.includes('node_modules') && !item.path.includes('dist') && !item.path.includes('build'))
        .slice(0, 300);

      const treeItems = filteredTree
        .map((item: any) => `${item.type === 'tree' ? '[DIR]' : '[FILE]'} ${item.path}`)
        .join('\n');

      const result = await geminiService.analyzeRepoStructure(treeItems, selectedModel);
      
      const pathMap: Record<string, string> = {};
      const finalNewNodes: Node[] = [];

      // Sort to ensure parents are processed before children
      const sortedTree = [...filteredTree].sort((a, b) => a.path.length - b.path.length);

      // Fetch file contents in parallel with a limit
      const fileContents: Record<string, string> = {};
      const fetchPromises = sortedTree.filter(item => item.type === 'blob').map(async (item) => {
        try {
          const response = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/${item.path}`);
          if (response.ok) {
            fileContents[item.path] = await response.text();
          }
        } catch (e) {
          console.error(`Failed to fetch content for ${item.path}`, e);
        }
      });
      
      // Wait for all fetches to complete (or fail)
      await Promise.allSettled(fetchPromises);

      sortedTree.forEach((item: any) => {
        const newId = uuidv4();
        pathMap[item.path] = newId;
        
        const pathParts = item.path.split('/');
        const name = pathParts[pathParts.length - 1];
        const parentPath = pathParts.slice(0, -1).join('/');
        const parentId = parentPath ? pathMap[parentPath] : undefined;
        
        const meta = result.metadata[item.path] || { description: '', tags: [], type: 'default' };
        
        const codeSnippets = [];
        if (item.type === 'blob' && fileContents[item.path]) {
          // Determine language from extension
          const ext = name.split('.').pop() || 'text';
          const languageMap: Record<string, string> = {
            'js': 'javascript', 'jsx': 'javascript', 'ts': 'typescript', 'tsx': 'typescript',
            'py': 'python', 'rb': 'ruby', 'java': 'java', 'go': 'go', 'rs': 'rust',
            'html': 'html', 'css': 'css', 'json': 'json', 'md': 'markdown', 'yml': 'yaml', 'yaml': 'yaml'
          };
          codeSnippets.push({
            id: uuidv4(),
            title: name,
            code: fileContents[item.path],
            language: languageMap[ext] || ext
          });
        }

        finalNewNodes.push({
          id: newId,
          type: item.type === 'tree' ? 'groupNode' : 'customNode',
          position: { x: Math.random() * 800, y: Math.random() * 800 },
          parentId,
          width: item.type === 'tree' ? 400 : 200,
          height: item.type === 'tree' ? 300 : 120,
          data: {
            title: name,
            description: meta.description || '',
            nodeType: item.type === 'tree' ? 'group' : (meta.type || 'default'),
            shape: item.type === 'tree' ? 'rectangle' : (meta.type === 'decision' ? 'diamond' : 'rectangle'),
            isCollapsed: false,
            isExpanded: false,
            tags: ['github-import', ...(meta.tags || [])],
            links: [{ id: uuidv4(), label: 'View on GitHub', url: `https://github.com/${owner}/${repo}/blob/${defaultBranch}/${item.path}` }],
            codeSnippets,
            metadata: { path: item.path }
          }
        });
      });

      const finalNewEdges: Edge[] = result.edges.map(e => {
        const sourceId = pathMap[e.source];
        const targetId = pathMap[e.target];
        if (!sourceId || !targetId) return null;
        const { markerType, strokeDasharray, markerStart, finalHasArrow, labelBgStyle, labelStyle } = getEdgeStyleProps(e.label, true, undefined);
        
        return {
          id: uuidv4(),
          source: sourceId,
          target: targetId,
          label: e.label,
          type: 'smoothstep',
          markerEnd: finalHasArrow ? { type: markerType, color: '#94a3b8' } : undefined,
          markerStart,
          style: { strokeWidth: 2, strokeDasharray },
          labelBgStyle,
          labelStyle,
          data: { relationshipType: e.label, hasArrow: finalHasArrow }
        };
      }).filter(Boolean) as Edge[];

      set({ 
        nodes: [...get().nodes, ...finalNewNodes], 
        edges: [...get().edges, ...finalNewEdges] 
      });

      // Persist
      const { activeProjectId, cloudMode } = get();
      for (const n of finalNewNodes) {
        await storageService.saveNode({
          id: n.id,
          graphId: activeGraphId,
          position: n.position,
          type: n.type || 'customNode',
          data: n.data as any,
        }, activeProjectId || undefined, cloudMode);
      }
      for (const e of finalNewEdges) {
        await storageService.saveEdge({
          id: e.id,
          graphId: activeGraphId,
          source: e.source,
          target: e.target,
          relationshipType: (e.data as any).relationshipType,
          label: e.label as string,
          type: e.type,
          hasArrow: true
        }, activeProjectId || undefined, cloudMode);
      }

      get().tidyUp();
    } catch (error) {
      console.error('Failed to analyze GitHub repo:', error);
      throw error; // Re-throw to be caught by the UI
    }
  },

  syncAgileBoard: async (boardUrl: string, options: { epics: boolean, stories: boolean, bugs: boolean }, configId?: string) => {
    const { activeGraphId, activeProjectId, cloudMode, githubToken, issueManagementConfigs } = get();
    if (!activeGraphId) return;

    if (configId && configId !== 'github') {
      const config = issueManagementConfigs.find(c => c.id === configId);
      if (!config) {
        throw new Error("Configuration not found.");
      }

      if (config.provider === 'Jira') {
        const jql = boardUrl.includes('=') ? boardUrl : `project = "${boardUrl}" AND statusCategory != Done`;
        
        try {
          // Jira REST API v2
          const url = new URL(`${config.url.replace(/\/$/, '')}/rest/api/2/search`);
          url.searchParams.append('jql', jql);
          url.searchParams.append('maxResults', '100');
          
          const headers: Record<string, string> = {
            'Accept': 'application/json',
            'Authorization': config.pat.includes(':') ? `Basic ${btoa(config.pat)}` : `Bearer ${config.pat}`
          };

          const response = await fetch(url.toString(), { headers });
          if (!response.ok) {
            throw new Error(`Jira API error: ${response.statusText}`);
          }
          const data = await response.json();
          const issues = data.issues || [];

          const newNodes: Node[] = [];
          const appNodes: AppNode[] = [];
          let xOffset = 100;
          let yOffset = 100;

          for (const issue of issues) {
            const issueType = issue.fields.issuetype?.name?.toLowerCase() || '';
            
            let isEpic = issueType.includes('epic');
            let isBug = issueType.includes('bug');
            let isStory = issueType.includes('story') || issueType.includes('task');

            if (!isEpic && !isBug && !isStory) {
              isStory = true;
            }

            if ((isEpic && !options.epics) || (isBug && !options.bugs) || (isStory && !options.stories)) {
              continue;
            }

            const shape = isBug ? 'bug' : isStory ? 'story' : 'rectangle';
            const nodeType = isBug ? 'bug' : isStory ? 'story' : 'epic';

            const newNodeId = uuidv4();
            const newNode: Node = {
              id: newNodeId,
              type: 'customNode',
              position: { x: xOffset, y: yOffset },
              data: {
                title: issue.fields.summary,
                description: issue.fields.description ? (typeof issue.fields.description === 'string' ? issue.fields.description.substring(0, 200) : 'Jira Issue') : '',
                nodeType: nodeType,
                shape: shape,
                status: issue.fields.status?.name || 'To Do',
                assignee: issue.fields.assignee?.displayName || 'Unassigned',
                priority: issue.fields.priority?.name || 'Normal',
                issueId: issue.key,
                issueConfigId: configId,
                tags: ['jira-sync', issueType],
                links: [{ url: `${config.url.replace(/\/$/, '')}/browse/${issue.key}`, label: 'Jira Issue' }],
                codeSnippets: [],
                metadata: {},
                isExpanded: false
              }
            };

            newNodes.push(newNode);
            
            appNodes.push({
              id: newNodeId,
              graphId: activeGraphId,
              position: newNode.position,
              type: newNode.type || 'customNode',
              data: newNode.data as any,
            });

            xOffset += 300;
            if (xOffset > 1000) {
              xOffset = 100;
              yOffset += 200;
            }
          }

          set({ nodes: sortNodesByParent([...get().nodes, ...newNodes]) });

          for (const appNode of appNodes) {
            await storageService.saveNode(appNode, activeProjectId || undefined, cloudMode);
          }
          return;
        } catch (error) {
          console.error("Failed to sync Jira board:", error);
          throw error;
        }
      } else {
        throw new Error(`Provider ${config.provider} is not yet fully implemented for Agile Sync.`);
      }
    }

    const match = boardUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) {
      throw new Error("Only GitHub repository URLs are supported for Agile Sync currently unless a Jira configuration is selected.");
    }
    const [, owner, repo] = match;

    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json'
    };
    if (githubToken) {
      headers['Authorization'] = `token ${githubToken}`;
    }

    try {
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues?state=open&per_page=100`, { headers });
      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.statusText}`);
      }
      const issues = await response.json();

      const newNodes: Node[] = [];
      const appNodes: AppNode[] = [];
      let xOffset = 100;
      let yOffset = 100;

      for (const issue of issues) {
        if (issue.pull_request) continue; // Skip PRs

        const labels = issue.labels.map((l: any) => l.name.toLowerCase());
        
        let isEpic = labels.some((l: string) => l.includes('epic'));
        let isBug = labels.some((l: string) => l.includes('bug'));
        let isStory = labels.some((l: string) => l.includes('story') || l.includes('enhancement') || l.includes('feature'));

        // If no specific label, default to story if stories are requested
        if (!isEpic && !isBug && !isStory) {
          isStory = true;
        }

        if ((isEpic && !options.epics) || (isBug && !options.bugs) || (isStory && !options.stories)) {
          continue;
        }

        const shape = isBug ? 'bug' : isStory ? 'story' : 'rectangle';
        const nodeType = isBug ? 'bug' : isStory ? 'story' : 'epic';

        const newNodeId = uuidv4();
        const newNode: Node = {
          id: newNodeId,
          type: 'customNode',
          position: { x: xOffset, y: yOffset },
          data: {
            title: issue.title,
            description: issue.body ? issue.body.substring(0, 200) + (issue.body.length > 200 ? '...' : '') : '',
            nodeType: nodeType,
            shape: shape,
            status: issue.state,
            assignee: issue.assignee ? issue.assignee.login : 'Unassigned',
            priority: labels.find((l: string) => l.includes('priority')) || 'Normal',
            issueId: `#${issue.number}`,
            tags: ['agile-sync', ...issue.labels.map((l: any) => l.name)],
            links: [{ url: issue.html_url, label: 'GitHub Issue' }],
            codeSnippets: [],
            metadata: {},
            isExpanded: false
          }
        };

        newNodes.push(newNode);
        
        appNodes.push({
          id: newNodeId,
          graphId: activeGraphId,
          position: newNode.position,
          type: newNode.type || 'customNode',
          data: newNode.data as any,
        });

        xOffset += 300;
        if (xOffset > 1000) {
          xOffset = 100;
          yOffset += 200;
        }
      }

      set({ nodes: sortNodesByParent([...get().nodes, ...newNodes]) });

      for (const appNode of appNodes) {
        await storageService.saveNode(appNode, activeProjectId || undefined, cloudMode);
      }
    } catch (error) {
      console.error("Failed to sync agile board:", error);
      throw error;
    }
  },

  updateRepositoryNodeData: async (nodeId: string) => {
    const { nodes, githubToken, updateNodeData } = get();
    const node = nodes.find(n => n.id === nodeId) as AppNode | undefined;
    if (!node || node.data.shape !== 'repository' || !node.data.links || node.data.links.length === 0) return;

    const repoUrl = node.data.links[0].url;
    const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) return;
    const [, owner, repo] = match;

    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json'
    };
    if (githubToken) {
      headers['Authorization'] = `token ${githubToken}`;
    }

    try {
      // Fetch open PRs
      const prsResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls?state=open`, { headers });
      let openPrCount = 0;
      if (prsResponse.ok) {
        const prs = await prsResponse.json();
        openPrCount = Array.isArray(prs) ? prs.length : 0;
      }

      // Fetch last commit
      const commitsResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`, { headers });
      let lastCommitInfo = undefined;
      if (commitsResponse.ok) {
        const commits = await commitsResponse.json();
        lastCommitInfo = Array.isArray(commits) && commits.length > 0 ? commits[0].commit.message : undefined;
      }

      // Fetch deployments
      const deploymentsResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/deployments?per_page=1`, { headers });
      let deploymentStatus = undefined;
      if (deploymentsResponse.ok) {
        const deployments = await deploymentsResponse.json();
        if (Array.isArray(deployments) && deployments.length > 0) {
          const statusesResponse = await fetch(deployments[0].statuses_url, { headers });
          if (statusesResponse.ok) {
            const statuses = await statusesResponse.json();
            if (Array.isArray(statuses) && statuses.length > 0) {
              const state = statuses[0].state;
              if (state === 'success') deploymentStatus = 'success';
              else if (state === 'error' || state === 'failure') deploymentStatus = 'failed';
              else deploymentStatus = 'pending';
            }
          }
        }
      }

      await updateNodeData(nodeId, {
        openPrCount,
        lastCommitInfo,
        deploymentStatus
      });
    } catch (error) {
      console.error('Failed to fetch repository data:', error);
    }
  },

  autoTagNodes: async () => {
    const { nodes, activeGraphId, selectedModel } = get();
    if (!activeGraphId || nodes.length === 0) return;

    const nodeData = nodes.map(n => ({
      id: n.id,
      title: (n.data as any).title,
      description: (n.data as any).description
    }));

    const prompt = `Analyze these process steps and suggest 2-3 relevant tags for each. Return as a JSON object mapping node IDs to an array of tag strings.
    Nodes: ${JSON.stringify(nodeData)}`;

    try {
      const response = await geminiService.generateRaw(prompt, selectedModel);
      // Extract JSON from response (handle potential markdown blocks)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return;
      
      const tagMap = JSON.parse(jsonMatch[0]);

      const updatedNodes = nodes.map(node => {
        if (tagMap[node.id]) {
          const existingTags = (node.data as any).tags || [];
          const newTags = tagMap[node.id];
          return {
            ...node,
            data: {
              ...node.data,
              tags: Array.from(new Set([...existingTags, ...newTags]))
            }
          };
        }
        return node;
      });

      set({ nodes: sortNodesByParent(updatedNodes) });
      
      // Persist changes
      const { activeProjectId, cloudMode } = get();
      for (const node of updatedNodes) {
        if (tagMap[node.id]) {
          await storageService.saveNode({
            id: node.id,
            graphId: activeGraphId,
            position: node.position,
            type: node.type || 'customNode',
            data: node.data as any,
          }, activeProjectId || undefined, cloudMode);
        }
      }
      
      get().takeSnapshot();
    } catch (error) {
      console.error('Failed to auto-tag nodes:', error);
    }
  },

  setPresentationMode: (enabled: boolean) => {
    set({ isPresentationMode: enabled });
  },

  startSimulation: () => {
    const { nodes } = get();
    if (nodes.length === 0) return;

    // Try to find a node with type 'start' or title containing 'start'
    let startNode = nodes.find(n => 
      (n.data as any).nodeType?.toLowerCase() === 'start' || 
      (n.data as any).title?.toLowerCase().includes('start')
    );

    if (!startNode) {
      // Fallback to the first node with no incoming edges
      const targetIds = new Set(get().edges.map(e => e.target));
      startNode = nodes.find(n => !targetIds.has(n.id)) || nodes[0];
    }

    set({ 
      isSimulating: true, 
      simulationActiveNodeId: startNode.id,
      selectedNodeId: startNode.id 
    });
  },

  stopSimulation: () => {
    set({ isSimulating: false, simulationActiveNodeId: null });
  },

  stepSimulation: () => {
    const { isSimulating, simulationActiveNodeId, edges, nodes } = get();
    if (!isSimulating || !simulationActiveNodeId) return;

    // Find outgoing edges from current node
    const outgoingEdges = edges.filter(e => e.source === simulationActiveNodeId);
    
    if (outgoingEdges.length === 0) {
      // End of process
      set({ isSimulating: false, simulationActiveNodeId: null });
      return;
    }

    // If multiple paths, pick one (could be random or based on user choice later)
    // For now, just pick the first one
    const nextEdge = outgoingEdges[Math.floor(Math.random() * outgoingEdges.length)];
    const nextNodeId = nextEdge.target;

    set({ 
      simulationActiveNodeId: nextNodeId,
      selectedNodeId: nextNodeId 
    });
  },

  generateManual: () => {
    const { nodes, edges, projects, activeProjectId } = get();
    const project = projects.find(p => p.id === activeProjectId);
    if (!project) return null;

    // We need to convert React Flow nodes/edges back to AppNode/AppEdge format for the generator
    const appNodes: AppNode[] = nodes.map(n => ({
      id: n.id,
      graphId: '', // not needed for manual
      position: n.position,
      type: n.type || 'customNode',
      data: n.data as any,
    }));

    const appEdges: AppEdge[] = edges.map(e => ({
      id: e.id,
      graphId: '', // not needed for manual
      source: e.source,
      target: e.target,
      label: e.label as string,
      relationshipType: (e.data as any)?.relationshipType || e.label || 'transition',
      type: e.type || 'default',
    }));

    return manualGenerator.generateMarkdown(project.name, appNodes, appEdges);
  },

  updatePresence: async (cursor?: { x: number; y: number }) => {
    const { user, cloudMode, activeProjectId } = get();
    if (!cloudMode || !activeProjectId || !user) return;

    const presenceRef = doc(db, `projects/${activeProjectId}/presence`, user.uid);
    await storageService.writeWithQueue(
      () => setDoc(presenceRef, {
        name: user.displayName || 'Anonymous',
        photoUrl: user.photoURL || '',
        lastSeen: Date.now(),
        cursor: cursor || null
      }, { merge: true }),
      'updatePresence',
      `projects/${activeProjectId}/presence/${user.uid}`,
      {
        name: user.displayName || 'Anonymous',
        photoUrl: user.photoURL || '',
        lastSeen: Date.now(),
        cursor: cursor || null
      },
      activeProjectId
    );
  },

  syncGraph: (graphId: string) => {
    const { activeProjectId, cloudMode, user } = get();
    if (!cloudMode || !activeProjectId) return;

    // Listen for nodes
    const nodesRef = collection(db, `projects/${activeProjectId}/graphs/${graphId}/nodes`);
    const unsubNodes = onSnapshot(nodesRef, (snapshot) => {
      get().incrementDbReads(snapshot.docs.length || 1);
      const remoteNodes = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as AppNode));
      
      const mergedNodes = remoteNodes.map(rn => {
        return {
          id: rn.id,
          type: rn.type,
          position: rn.position,
          data: rn.data,
          width: rn.width,
          height: rn.height,
          parentId: rn.parentId,
          // extent removed
        } as Node;
      });
      
      set({ nodes: sortNodesByParent(mergedNodes) });
    });

    // Listen for edges
    const edgesRef = collection(db, `projects/${activeProjectId}/graphs/${graphId}/edges`);
    const unsubEdges = onSnapshot(edgesRef, (snapshot) => {
      get().incrementDbReads(snapshot.docs.length || 1);
      const remoteEdges = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as AppEdge));
      const mergedEdges = remoteEdges.map(re => {
        const { markerType, strokeDasharray, markerStart, finalHasArrow } = getEdgeStyleProps(re.relationshipType, re.hasArrow, re.color);
        
        return {
          id: re.id,
          source: re.source,
          target: re.target,
          sourceHandle: re.sourceHandle,
          targetHandle: re.targetHandle,
          label: re.label,
          type: re.type,
          animated: re.animated,
          style: { 
            stroke: re.color || undefined, 
            strokeWidth: 2,
            strokeDasharray
          },
          markerEnd: finalHasArrow ? { type: markerType, color: re.color || '#94a3b8' } : undefined,
          markerStart,
          data: { relationshipType: re.relationshipType, color: re.color, hasArrow: finalHasArrow }
        } as Edge;
      });
      
      set({ edges: mergedEdges });
    });

    // Listen for presence
    const presenceRef = collection(db, `projects/${activeProjectId}/presence`);
    const unsubPresence = onSnapshot(presenceRef, (snapshot) => {
      get().incrementDbReads(snapshot.docs.length || 1);
      const presenceMap: Record<string, any> = {};
      snapshot.docs.forEach(doc => {
        // Only show users active in the last 5 minutes
        const data = doc.data();
        if (Date.now() - data.lastSeen < 300000) {
          presenceMap[doc.id] = data;
        }
      });
      set({ presence: presenceMap });
    });

    // Listen for snapshots
    const snapshotsRef = collection(db, `projects/${activeProjectId}/snapshots`);
    const unsubSnapshots = onSnapshot(snapshotsRef, (snapshot) => {
      get().incrementDbReads(snapshot.docs.length || 1);
      const updatedSnapshots = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Snapshot));
      set({ snapshots: updatedSnapshots.sort((a, b) => b.timestamp - a.timestamp) });
    });

    // Listen for comments
    const commentsRef = collection(db, `projects/${activeProjectId}/comments`);
    const unsubComments = onSnapshot(commentsRef, (snapshot) => {
      get().incrementDbReads(snapshot.docs.length || 1);
      const updatedComments = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Comment));
      set({ comments: updatedComments.sort((a, b) => b.timestamp - a.timestamp) });
    });

    // Update our own presence
    get().updatePresence();

    return () => {
      unsubNodes();
      unsubEdges();
      unsubPresence();
      unsubSnapshots();
      unsubComments();
    };
  },

  createSnapshot: async (name: string) => {
    const { activeProjectId, activeGraphId, nodes, edges, user, cloudMode } = get();
    if (!activeProjectId || !activeGraphId) return;

    const snapshot: Snapshot = {
      id: uuidv4(),
      projectId: activeProjectId,
      graphId: activeGraphId,
      name,
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
      createdBy: user?.uid || 'local-user',
      timestamp: Date.now(),
    };

    await storageService.saveSnapshot(snapshot, cloudMode);
    if (!cloudMode) {
      set(state => ({ snapshots: [snapshot, ...state.snapshots] }));
    }
  },

  restoreSnapshot: async (snapshotId: string) => {
    const { snapshots, activeProjectId, activeGraphId, cloudMode } = get();
    const snapshot = snapshots.find(s => s.id === snapshotId);
    if (!snapshot || !activeProjectId || !activeGraphId) return;

    get().takeSnapshot(); // Save current state to undo history

    if (cloudMode) {
      const batch = writeBatch(db);
      
      // Delete current
      const currentNodes = await storageService.getNodesByGraph(activeGraphId, activeProjectId, true);
      const currentEdges = await storageService.getEdgesByGraph(activeGraphId, activeProjectId, true);
      
      currentNodes.forEach(n => batch.delete(doc(db, `projects/${activeProjectId}/graphs/${activeGraphId}/nodes`, n.id)));
      currentEdges.forEach(e => batch.delete(doc(db, `projects/${activeProjectId}/graphs/${activeGraphId}/edges`, e.id)));
      
      // Add from snapshot
      snapshot.nodes.forEach(n => {
        const { id, ...data } = n;
        batch.set(doc(db, `projects/${activeProjectId}/graphs/${activeGraphId}/nodes`, id), data);
      });
      snapshot.edges.forEach(e => {
        const { id, ...data } = e;
        batch.set(doc(db, `projects/${activeProjectId}/graphs/${activeGraphId}/edges`, id), data);
      });
      
      await storageService.writeWithQueue(
        () => batch.commit(),
        'restoreSnapshot',
        `projects/${activeProjectId}/graphs/${activeGraphId}`,
        { nodes: snapshot.nodes, edges: snapshot.edges },
        activeProjectId
      );
    } else {
      set({ nodes: sortNodesByParent(snapshot.nodes), edges: snapshot.edges });
    }
  },

  deleteSnapshot: async (snapshotId: string) => {
    const { activeProjectId, cloudMode } = get();
    if (!activeProjectId) return;
    await storageService.deleteSnapshot(snapshotId, activeProjectId, cloudMode);
    if (!cloudMode) {
      set(state => ({ snapshots: state.snapshots.filter(s => s.id !== snapshotId) }));
    }
  },

  addComment: async (targetId: string, text: string) => {
    const { activeProjectId, activeGraphId, user, cloudMode } = get();
    if (!activeProjectId || !activeGraphId) return;

    const comment: Comment = {
      id: uuidv4(),
      projectId: activeProjectId,
      graphId: activeGraphId,
      targetId,
      text,
      authorId: user?.uid || 'local-user',
      authorName: user?.displayName || 'Local User',
      authorPhoto: user?.photoURL || undefined,
      timestamp: Date.now(),
      resolved: false,
    };

    await storageService.saveComment(comment, cloudMode);
    if (!cloudMode) {
      set(state => ({ comments: [comment, ...state.comments] }));
    }
  },

  resolveComment: async (commentId: string) => {
    const { activeProjectId, cloudMode, comments } = get();
    if (!activeProjectId) return;
    const comment = comments.find(c => c.id === commentId);
    if (!comment) return;

    const updatedComment = { ...comment, resolved: true };
    await storageService.saveComment(updatedComment, cloudMode);
    if (!cloudMode) {
      set(state => ({ comments: state.comments.map(c => c.id === commentId ? updatedComment : c) }));
    }
  },

  deleteComment: async (commentId: string) => {
    const { activeProjectId, cloudMode } = get();
    if (!activeProjectId) return;
    await storageService.deleteComment(commentId, activeProjectId, cloudMode);
    if (!cloudMode) {
      set(state => ({ comments: state.comments.filter(c => c.id !== commentId) }));
    }
  },
  };
});
