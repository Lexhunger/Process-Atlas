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
  
  // Settings & Cloud
  nodeTypes: string[];
  issueManagementConfigs: IssueManagementConfig[];
  issueManagementInstanceTypes: string[];
  cloudMode: boolean;
  devMode: boolean;
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
  
  setCloudMode: (enabled: boolean) => void;
  setDevMode: (enabled: boolean) => void;
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
  
  addNode: (position: { x: number; y: number }, type?: string, templateId?: string, shape?: string, parentId?: string) => Promise<void>;
  updateNodeData: (id: string, data: any) => Promise<void>;
  updateEdgeLabel: (id: string, label: string) => Promise<void>;
  updateEdgeType: (id: string, type: string) => Promise<void>;
  updateEdgeStyle: (id: string, style: { color?: string; animated?: boolean; hasArrow?: boolean }) => Promise<void>;
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
  
  tidyUp: () => void;
  generateAIProcess: (prompt: string) => Promise<void>;
  analyzeGitHubRepo: (repoUrl: string, mode?: 'new' | 'current') => Promise<void>;
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
  templates: [],
  snapshots: [],
  comments: [],
  
  selectedNodeId: null,
  selectedEdgeId: null,
  focusNodeId: null,
  searchQuery: '',
  darkMode: false,
  
  past: [] as { nodes: Node[]; edges: Edge[] }[],
  future: [] as { nodes: Node[]; edges: Edge[] }[],

  simulationActiveNodeId: null as string | null,
  isSimulating: false,
  isPresentationMode: false,
  
  nodeTypes: ['Process', 'Action', 'Decision', 'Data', 'System', 'User', 'External'],
  issueManagementConfigs: [],
  issueManagementInstanceTypes: ['HREGRC', 'THREGRC'],
  cloudMode: localStorage.getItem('atlas_cloud_mode') === 'true',
  devMode: localStorage.getItem('atlas_dev_mode') === 'true',
  selectedModel: localStorage.getItem('atlas_selected_model') || 'gemini-3-flash-preview',
  apiKeys: JSON.parse(localStorage.getItem('atlas_api_keys') || '{}'),
  user: null,
  isAuthReady: false,
  isOnline: navigator.onLine,
  presence: {},
  githubToken: localStorage.getItem('atlas_github_token'),
  exportFormat: 'json',
  setExportFormat: (format: 'json' | 'xml') => set({ exportFormat: format }),

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
  
  toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
  
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
    const { cloudMode, user, projects } = get();
    const newProject: Project = {
      id: uuidv4(),
      name,
      ownerId: user?.uid || 'local-user',
      members: user?.uid ? [user.uid] : ['local-user'],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Optimistic update
    set({ projects: [...projects, newProject] });

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
            extent: parentId ? 'parent' : undefined,
          };
        });
      
      const edges: Edge[] = allAppEdges.map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
        label: e.label,
        type: e.type,
        animated: e.animated,
        style: e.color ? { stroke: e.color, strokeWidth: 2 } : { strokeWidth: 2 },
        markerEnd: e.hasArrow !== false ? { type: MarkerType.ArrowClosed, color: e.color || '#94a3b8' } : undefined,
        data: { relationshipType: e.relationshipType, color: e.color, hasArrow: e.hasArrow !== false }
      }));
      
      set({ nodes, edges });
      
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
        extent: n.parentId ? 'parent' : undefined,
      }));
    
    const edges: Edge[] = appEdges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
      label: e.label,
      type: e.type,
      animated: e.animated,
      style: e.color ? { stroke: e.color, strokeWidth: 2 } : { strokeWidth: 2 },
      markerEnd: e.hasArrow !== false ? { type: MarkerType.ArrowClosed, color: e.color || '#94a3b8' } : undefined,
      data: { relationshipType: e.relationshipType, color: e.color, hasArrow: e.hasArrow !== false }
    }));
    
    set({ nodes, edges, activeGraphId: graphId });
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
    const isOpening = isGroup ? !node.data.isCollapsed : !!node.data.isExpanded;
    
    if (isOpening && (!node.width || node.width < 200)) {
      set({
        nodes: nodes.map(n => n.id === nodeId ? { 
          ...n, 
          width: 600, 
          height: 400, 
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
      await get().updateNodeData(nodeId, updateData);
      if (isOpening) {
        set({ focusNodeId: nodeId });
        await get().autoResizeParent(nodeId);
      } else {
        set({ focusNodeId: null });
      }
    }
  },
  
  setFocusNodeId: (id: string | null) => set({ focusNodeId: id }),

  autoResizeParent: async (parentId: string) => {
    const { nodes, activeProjectId, cloudMode } = get();
    const parent = nodes.find(n => n.id === parentId);
    if (!parent) return;

    // Recursive function to get all descendants
    const getDescendants = (nodeId: string): Node[] => {
      const children = nodes.filter(n => n.parentId === nodeId);
      let descendants = [...children];
      for (const child of children) {
        descendants = [...descendants, ...getDescendants(child.id)];
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
    let maxX = 0;
    let maxY = 0;

    descendants.forEach(descendant => {
      const pos = getAbsolutePosition(descendant);
      const x = pos.x;
      const y = pos.y;
      const w = descendant.width || (descendant.type === 'groupNode' ? 200 : 150);
      const h = descendant.height || (descendant.type === 'groupNode' ? 150 : 100);

      maxX = Math.max(maxX, x + w);
      maxY = Math.max(maxY, y + h);
    });

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
    set({ nodes: newNodes });
    
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
          await storageService.saveNode(appNode, activeProjectId || undefined, cloudMode);
          
          if (node.parentId) {
            parentIdsToResize.add(node.parentId);
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
    const { edges, activeGraphId, activeProjectId, cloudMode } = get();
    const newEdges = applyEdgeChanges(changes, edges);
    set({ edges: newEdges });
    
    if (!activeGraphId) return;
    
    changes.forEach(async (change) => {
      if (change.type === 'remove') {
        await storageService.deleteEdge(change.id, activeGraphId, activeProjectId || undefined, cloudMode);
      }
    });
  },
  
  onConnect: async (connection: Connection) => {
    const { activeGraphId, activeProjectId, edges, cloudMode } = get();
    if (!activeGraphId || !connection.source || !connection.target) return;
    
    get().takeSnapshot();
    
    const newEdge: Edge = {
      id: uuidv4(),
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle,
      targetHandle: connection.targetHandle,
      label: 'flow',
      type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
      style: { strokeWidth: 2 },
      data: { relationshipType: 'flow', hasArrow: true }
    };
    
    set({ edges: addEdge(newEdge, edges) });
    
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
  
  addNode: async (position: { x: number; y: number }, type: string = 'customNode', templateId?: string, shape?: string, parentId?: string) => {
    const { activeGraphId, activeProjectId, cloudMode, templates } = get();
    if (!activeGraphId) return;
    
    get().takeSnapshot();
    
    let initialData: any = {
      title: type === 'groupNode' ? 'New Group' : 'New Node',
      description: '',
      nodeType: type === 'groupNode' ? 'group' : 'default',
      metadata: {},
      links: [],
      codeSnippets: [],
      tags: [],
      shape: shape || 'rectangle',
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
      extent: parentId ? 'parent' : undefined,
      width: type === 'groupNode' ? 300 : 200,
      height: type === 'groupNode' ? 200 : 120,
    };
    
    set({ nodes: [...get().nodes, newNode] });
    
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
  
  updateNodeData: async (id: string, data: any) => {
    const { activeGraphId, activeProjectId, cloudMode, nodes } = get();
    if (!activeGraphId) return;
    
    get().takeSnapshot();
    
    set({
      nodes: nodes.map(n => n.id === id ? { ...n, data: { ...n.data, ...data } } : n)
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

  updateEdgeStyle: async (id: string, style: { color?: string; animated?: boolean; hasArrow?: boolean }) => {
    const { edges, activeGraphId, activeProjectId, cloudMode } = get();
    if (!activeGraphId) return;
    
    const edge = edges.find(e => e.id === id);
    if (!edge) return;
    
    get().takeSnapshot();
    
    const currentData = edge.data || {};
    const newColor = style.color !== undefined ? style.color : currentData.color as string | undefined;
    const newAnimated = style.animated !== undefined ? style.animated : edge.animated;
    const newHasArrow = style.hasArrow !== undefined ? style.hasArrow : currentData.hasArrow as boolean | undefined;
    
    const updatedEdge: Edge = {
      ...edge,
      animated: newAnimated,
      style: newColor ? { stroke: newColor, strokeWidth: 2 } : { strokeWidth: 2 },
      markerEnd: newHasArrow ? { type: MarkerType.ArrowClosed, color: newColor || '#94a3b8' } : undefined,
      data: { ...currentData, color: newColor, hasArrow: newHasArrow }
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
      relationshipType: currentData.relationshipType as string || 'flow',
      label: updatedEdge.label as string,
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
          extent: 'parent' as const,
        };
      }
      return n;
    });

    set({ nodes: [{ ...groupNode, selected: true }, ...updatedNodes], selectedNodeId: groupId });

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
            extent: undefined,
          };
        }
        return n;
      });
    }

    updatedNodes = updatedNodes.filter(n => !groupIdsToDelete.has(n.id));

    set({ nodes: updatedNodes });

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

    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({ rankdir: 'TB', nodesep: 100, ranksep: 100 });

    nodes.forEach((node) => {
      dagreGraph.setNode(node.id, { 
        width: node.measured?.width || node.width || 150, 
        height: node.measured?.height || node.height || 100 
      });
    });

    edges.forEach((edge) => {
      dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    const newNodes = nodes.map((node) => {
      const nodeWithPosition = dagreGraph.node(node.id);
      return {
        ...node,
        position: {
          x: nodeWithPosition.x - (node.measured?.width || node.width || 150) / 2,
          y: nodeWithPosition.y - (node.measured?.height || node.height || 100) / 2,
        },
      };
    });

    set({ nodes: newNodes });
    
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
      
      return {
        id: uuidv4(),
        source: sourceId,
        target: targetId,
        label: e.label,
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
        data: { relationshipType: e.label, hasArrow: true }
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
      
      // Limit tree size to avoid overwhelming the prompt (e.g., top 100 items)
      const treeItems = treeData.tree
        .filter((item: any) => !item.path.startsWith('.') && !item.path.includes('node_modules'))
        .slice(0, 150)
        .map((item: any) => `${item.type === 'tree' ? '[DIR]' : '[FILE]'} ${item.path}`)
        .join('\n');

      const result = await geminiService.analyzeRepo(treeItems, selectedModel);
      
      const idMap: Record<string, string> = {};
      const finalNewNodes: Node[] = [];

      result.nodes.forEach((n, index) => {
        const newId = uuidv4();
        idMap[n.id] = newId;
        
        finalNewNodes.push({
          id: newId,
          type: 'customNode',
          position: { x: 100, y: index * 150 },
          data: {
            title: n.title,
            description: n.description,
            nodeType: n.type,
            shape: n.type === 'decision' ? 'diamond' : 'rectangle',
            isExpanded: false,
            tags: ['github-import'],
            links: [],
            codeSnippets: [],
            metadata: {}
          }
        });
      });

      const finalNewEdges: Edge[] = result.edges.map(e => ({
        id: uuidv4(),
        source: idMap[e.source] || e.source,
        target: idMap[e.target] || e.target,
        label: e.label,
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
        data: { relationshipType: e.label, hasArrow: true }
      }));

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

      set({ nodes: updatedNodes });
      
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
          extent: rn.parentId ? 'parent' : undefined,
        } as Node;
      });
      
      set({ nodes: mergedNodes });
    });

    // Listen for edges
    const edgesRef = collection(db, `projects/${activeProjectId}/graphs/${graphId}/edges`);
    const unsubEdges = onSnapshot(edgesRef, (snapshot) => {
      const remoteEdges = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as AppEdge));
      const mergedEdges = remoteEdges.map(re => ({
        id: re.id,
        source: re.source,
        target: re.target,
        sourceHandle: re.sourceHandle,
        targetHandle: re.targetHandle,
        label: re.label,
        type: re.type,
        animated: re.animated,
        style: re.color ? { stroke: re.color, strokeWidth: 2 } : { strokeWidth: 2 },
        markerEnd: re.hasArrow !== false ? { type: MarkerType.ArrowClosed, color: re.color || '#94a3b8' } : undefined,
        data: { relationshipType: re.relationshipType, color: re.color, hasArrow: re.hasArrow !== false }
      } as Edge));
      
      set({ edges: mergedEdges });
    });

    // Listen for presence
    const presenceRef = collection(db, `projects/${activeProjectId}/presence`);
    const unsubPresence = onSnapshot(presenceRef, (snapshot) => {
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
      const updatedSnapshots = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Snapshot));
      set({ snapshots: updatedSnapshots.sort((a, b) => b.timestamp - a.timestamp) });
    });

    // Listen for comments
    const commentsRef = collection(db, `projects/${activeProjectId}/comments`);
    const unsubComments = onSnapshot(commentsRef, (snapshot) => {
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
      set({ nodes: snapshot.nodes, edges: snapshot.edges });
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
