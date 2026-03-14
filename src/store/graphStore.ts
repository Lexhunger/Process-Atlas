import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { Project, Graph, AppNode, AppEdge, Template } from '../models/types';
import { storageService } from '../services/storageService';
import { geminiService } from '../services/geminiService';
import { manualGenerator } from '../utils/manualGenerator';
import { Node, Edge, Connection, addEdge, applyNodeChanges, applyEdgeChanges, NodeChange, EdgeChange, MarkerType } from '@xyflow/react';
import dagre from 'dagre';

interface GraphStore {
  projects: Project[];
  activeProjectId: string | null;
  activeGraphId: string | null;
  graphHistory: string[]; // For breadcrumbs
  
  nodes: Node[];
  edges: Edge[];
  templates: Template[];
  
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  searchQuery: string;
  darkMode: boolean;
  
  past: { nodes: Node[]; edges: Edge[] }[];
  future: { nodes: Node[]; edges: Edge[] }[];
  
  simulationActiveNodeId: string | null;
  isSimulating: boolean;
  isPresentationMode: boolean;
  
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  takeSnapshot: () => void;
  
  // Actions
  toggleDarkMode: () => void;
  loadProjects: () => Promise<void>;
  createProject: (name: string) => Promise<void>;
  loadProject: (projectId: string) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  
  loadGraph: (graphId: string) => Promise<void>;
  drillDown: (nodeId: string) => Promise<void>;
  navigateUp: (index: number) => Promise<void>;
  
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
  
  exportProject: (format?: 'json' | 'xml') => Promise<string | null>;
  importProject: (data: string) => Promise<void>;
  
  tidyUp: () => void;
  generateAIProcess: (prompt: string) => Promise<void>;
  autoTagNodes: () => Promise<void>;
  
  // Simulation
  setPresentationMode: (enabled: boolean) => void;
  startSimulation: () => void;
  stopSimulation: () => void;
  stepSimulation: () => void;
  
  generateManual: () => string | null;
}

export const useGraphStore = create<GraphStore>((set, get) => ({
  projects: [],
  activeProjectId: null,
  activeGraphId: null,
  graphHistory: [],
  
  nodes: [],
  edges: [],
  templates: [],
  
  selectedNodeId: null,
  selectedEdgeId: null,
  searchQuery: '',
  darkMode: false,
  
  past: [] as { nodes: Node[]; edges: Edge[] }[],
  future: [] as { nodes: Node[]; edges: Edge[] }[],

  simulationActiveNodeId: null as string | null,
  isSimulating: false,
  isPresentationMode: false,

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
        });
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
        });
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
        });
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
        });
      });
    }
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,
  
  toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
  
  loadProjects: async () => {
    const projects = await storageService.getProjects();
    set({ projects });
  },
  
  createProject: async (name: string) => {
    const newProject: Project = {
      id: uuidv4(),
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await storageService.saveProject(newProject);
    
    const rootGraph: Graph = {
      id: uuidv4(),
      projectId: newProject.id,
    };
    await storageService.saveGraph(rootGraph);
    
    set((state) => ({
      projects: [...state.projects, newProject],
    }));
    
    await get().loadProject(newProject.id);
  },
  
  loadProject: async (projectId: string) => {
    const graphs = await storageService.getGraphsByProject(projectId);
    const rootGraph = graphs.find(g => !g.parentNodeId);
    
    if (rootGraph) {
      set({ 
        activeProjectId: projectId, 
        activeGraphId: rootGraph.id, // Keep for backward compatibility of new nodes
        graphHistory: [rootGraph.id],
        selectedNodeId: null
      });
      
      // Load ALL nodes and edges for the project
      const allAppNodes = await storageService.getAllProjectNodes(projectId);
      const allAppEdges = await storageService.getAllProjectEdges(projectId);
      
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
    }
  },
  
  deleteProject: async (projectId: string) => {
    await storageService.deleteProject(projectId);
    set((state) => ({
      projects: state.projects.filter(p => p.id !== projectId),
      activeProjectId: state.activeProjectId === projectId ? null : state.activeProjectId,
      activeGraphId: state.activeProjectId === projectId ? null : state.activeGraphId,
      nodes: state.activeProjectId === projectId ? [] : state.nodes,
      edges: state.activeProjectId === projectId ? [] : state.edges,
    }));
  },
  
  loadGraph: async (graphId: string) => {
    const appNodes = await storageService.getNodesByGraph(graphId);
    const appEdges = await storageService.getEdgesByGraph(graphId);
    
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
    
    // Toggle expanded state
    const isExpanded = !node.data.isExpanded;
    await get().updateNodeData(nodeId, { isExpanded });
  },
  
  navigateUp: async (index: number) => {
    // No-op in single canvas mode
  },
  
  onNodesChange: (changes: NodeChange[]) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes),
    });
    
    // Persist position/size changes
    const { activeGraphId, nodes } = get();
    if (!activeGraphId) return;
    
    changes.forEach(async (change) => {
      if (change.type === 'position' || change.type === 'dimensions') {
        const node = nodes.find(n => n.id === change.id);
        if (node) {
          const appNode: AppNode = {
            id: node.id,
            graphId: activeGraphId,
            position: node.position,
            width: node.width,
            height: node.height,
            type: node.type || 'customNode',
            data: node.data as any,
          };
          await storageService.saveNode(appNode);
        }
      }
    });
  },
  
  onEdgesChange: (changes: EdgeChange[]) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    });
  },
  
  onConnect: async (connection: Connection) => {
    const { activeGraphId, edges } = get();
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
      sourceHandle: connection.sourceHandle,
      targetHandle: connection.targetHandle,
      relationshipType: 'flow',
      label: 'flow',
      type: 'smoothstep',
      hasArrow: true
    };
    await storageService.saveEdge(appEdge);
  },
  
  addNode: async (position: { x: number; y: number }, type: string = 'customNode', templateId?: string, shape?: string, parentId?: string) => {
    const { activeGraphId, templates } = get();
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
    };
    
    set({ nodes: [...get().nodes, newNode] });
    
    const appNode: AppNode = {
      id: newNode.id,
      graphId: activeGraphId,
      position: newNode.position,
      type: newNode.type || 'customNode',
      data: newNode.data as any,
      parentId,
    };
    await storageService.saveNode(appNode);
  },
  
  updateNodeData: async (id: string, data: any) => {
    const { activeGraphId, nodes } = get();
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
      };
      await storageService.saveNode(appNode);
    }
  },
  
  updateEdgeLabel: async (id: string, label: string) => {
    const { edges, activeGraphId } = get();
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
      sourceHandle: updatedEdge.sourceHandle,
      targetHandle: updatedEdge.targetHandle,
      relationshipType: label,
      label: label,
      type: updatedEdge.type,
      color: edge.data?.color as string | undefined,
      animated: edge.animated,
      hasArrow: edge.data?.hasArrow as boolean | undefined
    };
    await storageService.saveEdge(appEdge);
  },

  updateEdgeType: async (id: string, type: string) => {
    const { edges, activeGraphId } = get();
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
      sourceHandle: updatedEdge.sourceHandle,
      targetHandle: updatedEdge.targetHandle,
      relationshipType: (edge.data?.relationshipType as string) || 'flow',
      label: edge.label as string,
      type: type,
      color: edge.data?.color as string | undefined,
      animated: edge.animated,
      hasArrow: edge.data?.hasArrow as boolean | undefined
    };
    await storageService.saveEdge(appEdge);
  },

  updateEdgeStyle: async (id: string, style: { color?: string; animated?: boolean; hasArrow?: boolean }) => {
    const { edges, activeGraphId } = get();
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
      sourceHandle: updatedEdge.sourceHandle,
      targetHandle: updatedEdge.targetHandle,
      relationshipType: currentData.relationshipType as string || 'flow',
      label: updatedEdge.label as string,
      type: updatedEdge.type,
      color: newColor,
      animated: newAnimated,
      hasArrow: newHasArrow
    };
    await storageService.saveEdge(appEdge);
  },

  deleteNode: async (id: string) => {
    const { nodes, edges } = get();
    
    get().takeSnapshot();
    
    // Find children if this is a group node
    const childrenIds = nodes.filter(n => n.parentId === id).map(n => n.id);
    const idsToDelete = new Set([id, ...childrenIds]);
    
    // Remove connected edges for node and its children
    const connectedEdges = edges.filter(e => idsToDelete.has(e.source) || idsToDelete.has(e.target));
    for (const edge of connectedEdges) {
      await storageService.deleteEdge(edge.id);
    }
    
    // Delete nodes from storage
    for (const nodeId of idsToDelete) {
      await storageService.deleteNode(nodeId);
    }
    
    set((state) => ({
      nodes: state.nodes.filter(n => !idsToDelete.has(n.id)),
      edges: state.edges.filter(e => !idsToDelete.has(e.source) && !idsToDelete.has(e.target)),
      selectedNodeId: idsToDelete.has(state.selectedNodeId as string) ? null : state.selectedNodeId
    }));
  },
  
  deleteEdge: async (id: string) => {
    get().takeSnapshot();
    await storageService.deleteEdge(id);
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

    const appGroupNode: AppNode = {
      id: groupId,
      graphId: activeGraphId,
      position: groupNode.position,
      width: groupWidth,
      height: groupHeight,
      type: 'groupNode',
      data: groupNode.data as any,
    };
    await storageService.saveNode(appGroupNode);

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
        await storageService.saveNode(appNode);
      }
    }
  },

  ungroupNodes: async () => {
    const { nodes, activeGraphId } = get();
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
      await storageService.deleteNode(groupId);
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
          await storageService.saveNode(appNode);
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
    await storageService.importProject(data);
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
    const { activeGraphId } = get();
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
        });
      });
    }
  },

  generateAIProcess: async (prompt: string) => {
    const { activeGraphId, nodes: currentNodes, edges: currentEdges } = get();
    if (!activeGraphId) return;

    get().takeSnapshot();

    const result = await geminiService.generateProcess(prompt, { nodes: currentNodes, edges: currentEdges });
    
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
    for (const n of finalNewNodes) {
      await storageService.saveNode({
        id: n.id,
        graphId: activeGraphId,
        position: n.position,
        type: n.type || 'customNode',
        data: n.data as any,
      });
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
      });
    }

    // Auto layout after generation
    get().tidyUp();
  },

  autoTagNodes: async () => {
    const { nodes, activeGraphId } = get();
    if (!activeGraphId || nodes.length === 0) return;

    const nodeData = nodes.map(n => ({
      id: n.id,
      title: (n.data as any).title,
      description: (n.data as any).description
    }));

    const prompt = `Analyze these process steps and suggest 2-3 relevant tags for each. Return as a JSON object mapping node IDs to an array of tag strings.
    Nodes: ${JSON.stringify(nodeData)}`;

    try {
      const response = await geminiService.generateRaw(prompt);
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
      for (const node of updatedNodes) {
        if (tagMap[node.id]) {
          await storageService.saveNode({
            id: node.id,
            graphId: activeGraphId,
            position: node.position,
            type: node.type || 'customNode',
            data: node.data as any,
          });
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
}));
