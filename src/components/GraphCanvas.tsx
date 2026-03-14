import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  ReactFlowProvider,
  NodeMouseHandler,
  Node,
  Edge,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useGraphStore } from '../store/graphStore';
import CustomNode from './CustomNode';
import GroupNode from './GroupNode';
import IssueNode from './IssueNode';
import { MousePointer2 } from 'lucide-react';

const nodeTypes = {
  customNode: CustomNode,
  groupNode: GroupNode,
  jiraNode: IssueNode,
};

function RemoteCursors() {
  const { presence, user, cloudMode } = useGraphStore();
  const { screenToFlowPosition } = useReactFlow();

  if (!cloudMode) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
      {Object.entries(presence).map(([id, data]) => {
        if (id === user?.uid || !data.cursor) return null;

        return (
          <div
            key={id}
            className="absolute transition-all duration-75 ease-linear flex items-center gap-2"
            style={{
              left: data.cursor.x,
              top: data.cursor.y,
            }}
          >
            <MousePointer2 className="w-5 h-5 text-indigo-500 fill-indigo-500" />
            <div className="px-1.5 py-0.5 bg-indigo-500 text-white text-[10px] rounded whitespace-nowrap shadow-sm">
              {data.name}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Flow() {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    selectNode,
    selectEdge,
    drillDown,
    addNode,
    searchQuery,
    takeSnapshot,
    simulationActiveNodeId,
    isPresentationMode,
    cloudMode,
    updatePresence,
    focusNodeId,
    setFocusNodeId,
  } = useGraphStore();

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const { setCenter, fitView } = useReactFlow();

  const lastPresenceUpdate = useRef<number>(0);

  // Focus effect: Zoom to node when focusNodeId changes
  useEffect(() => {
    if (focusNodeId && reactFlowInstance) {
      const node = nodes.find(n => n.id === focusNodeId);
      if (node) {
        // Calculate center of node
        const x = node.position.x + (node.width || 0) / 2;
        const y = node.position.y + (node.height || 0) / 2;
        
        // Zoom in
        if (setCenter) {
          setCenter(x, y, { zoom: 1.2, duration: 800 });
        }
        
        // Clear focus after zoom
        const timer = setTimeout(() => {
          setFocusNodeId(null);
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [focusNodeId, reactFlowInstance, nodes, setCenter, setFocusNodeId]);

  // Cursor tracking
  const onMouseMove = useCallback((event: React.MouseEvent) => {
    if (!cloudMode || !reactFlowInstance) return;

    const now = Date.now();
    if (now - lastPresenceUpdate.current < 100) return; // 10fps max
    lastPresenceUpdate.current = now;

    const position = reactFlowInstance.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    updatePresence(position);
  }, [cloudMode, reactFlowInstance, updatePresence]);

  // Presentation Mode: Follow the active simulation node
  useEffect(() => {
    if (isPresentationMode && simulationActiveNodeId) {
      const activeNode = nodes.find(n => n.id === simulationActiveNodeId);
      if (activeNode) {
        setCenter(activeNode.position.x + (activeNode.measured?.width || 200) / 2, 
                  activeNode.position.y + (activeNode.measured?.height || 100) / 2, 
                  { zoom: 1.2, duration: 800 });
      }
    }
  }, [simulationActiveNodeId, isPresentationMode, nodes, setCenter]);

  const onNodeDragStop = useCallback(() => {
    takeSnapshot();
  }, [takeSnapshot]);

  const onInit = (instance: any) => {
    setReactFlowInstance(instance);
  };

  const onPaneClick = useCallback(() => {
    selectNode(null);
    selectEdge(null);
  }, [selectNode, selectEdge]);

  const onNodeClick: NodeMouseHandler = useCallback(
    (_, node) => {
      selectNode(node.id);
    },
    [selectNode]
  );

  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      selectEdge(edge.id);
    },
    [selectEdge]
  );

  const onNodeDoubleClick: NodeMouseHandler = useCallback(
    (_, node) => {
      drillDown(node.id);
    },
    [drillDown]
  );

  const onDragOver = useCallback((event: any) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: any) => {
      event.preventDefault();

      if (!reactFlowInstance) return;

      const type = event.dataTransfer.getData('application/reactflow');
      const templateId = event.dataTransfer.getData('application/templateId');
      const shape = event.dataTransfer.getData('application/shape');

      if (typeof type === 'undefined' || !type) {
        return;
      }

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // Helper to get absolute position of a node
      const getAbsolutePosition = (node: Node, allNodes: Node[]): { x: number; y: number } => {
        let x = node.position.x;
        let y = node.position.y;
        let parentId = node.parentId;

        while (parentId) {
          const parent = allNodes.find((n) => n.id === parentId);
          if (parent) {
            x += parent.position.x;
            y += parent.position.y;
            parentId = parent.parentId;
          } else {
            break;
          }
        }
        return { x, y };
      };

      // Helper to get depth of a node
      const getNodeDepth = (node: Node, allNodes: Node[]): number => {
        let depth = 0;
        let parentId = node.parentId;
        while (parentId) {
          depth++;
          const parent = allNodes.find(n => n.id === parentId);
          parentId = parent?.parentId;
        }
        return depth;
      };

      // Check if dropped inside an expanded node
      const intersectingNodes = reactFlowInstance.getIntersectingNodes({
        x: position.x,
        y: position.y,
        width: 1,
        height: 1
      });

      let parentId = undefined;
      const expandedParents = intersectingNodes.filter((n: Node) => 
        (n.type === 'customNode' && n.data.isExpanded) || 
        (n.type === 'groupNode' && !n.data.isCollapsed)
      );

      if (expandedParents.length > 0) {
        // Pick the deepest node as the parent
        const deepestParent = expandedParents.reduce((prev, curr) => 
          getNodeDepth(curr, nodes) > getNodeDepth(prev, nodes) ? curr : prev
        );
        
        parentId = deepestParent.id;
        // Adjust position to be relative to parent using absolute coordinates
        const absoluteParentPos = getAbsolutePosition(deepestParent, nodes);
        position.x -= absoluteParentPos.x;
        position.y -= absoluteParentPos.y;
        
        // Ensure it's not hidden behind the header (50px)
        if (position.y < 50) position.y = 60;
        if (position.x < 20) position.x = 20;
      }

      addNode(position, type, templateId || undefined, shape || undefined, parentId);
    },
    [reactFlowInstance, addNode, nodes]
  );

  const filteredNodes = useMemo(() => {
    let processedNodes = nodes;

    // Handle collapsed groups and unexpanded custom nodes
    const hiddenNodeIds = new Set<string>();
    
    // First pass: identify all nodes that are collapsed/unexpanded
    const collapsedIds = new Set(
      nodes.filter(n => 
        (n.type === 'groupNode' && n.data.isCollapsed) || 
        (n.type === 'customNode' && !n.data.isExpanded)
      ).map(n => n.id)
    );

    // Second pass: recursively find all descendants of collapsed nodes
    let added = true;
    while (added) {
      added = false;
      for (const node of nodes) {
        if (node.parentId && (collapsedIds.has(node.parentId) || hiddenNodeIds.has(node.parentId))) {
          if (!hiddenNodeIds.has(node.id)) {
            hiddenNodeIds.add(node.id);
            added = true;
          }
        }
      }
    }

    if (hiddenNodeIds.size > 0 || collapsedIds.size > 0) {
      processedNodes = processedNodes.map(node => {
        if (hiddenNodeIds.has(node.id)) {
          return { ...node, hidden: true };
        }
        if (node.type === 'groupNode' && collapsedIds.has(node.id)) {
          return {
            ...node,
            style: {
              ...node.style,
              width: 200,
              height: 50,
            }
          };
        }
        return node;
      });
    }

    if (!searchQuery) return processedNodes;
    
    const lowerQuery = searchQuery.toLowerCase();
    return processedNodes.map((node) => {
      const data = node.data as any;
      const isMatch =
        data.title?.toLowerCase().includes(lowerQuery) ||
        data.description?.toLowerCase().includes(lowerQuery) ||
        data.nodeType?.toLowerCase().includes(lowerQuery) ||
        data.tags?.some((t: string) => t.toLowerCase().includes(lowerQuery));
      return {
        ...node,
        style: {
          ...node.style,
          opacity: isMatch ? 1 : 0.2,
        },
      };
    });
  }, [nodes, searchQuery]);

  const onNodesDelete = useCallback(
    (deleted: Node[]) => {
      deleted.forEach((node) => {
        useGraphStore.getState().deleteNode(node.id);
      });
    },
    []
  );

  const onEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      deleted.forEach((edge) => {
        useGraphStore.getState().deleteEdge(edge.id);
      });
    },
    []
  );

  return (
    <div className="w-full h-full relative" ref={reactFlowWrapper} onMouseMove={onMouseMove}>
      <RemoteCursors />
      <ReactFlow
        nodes={filteredNodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        onInit={onInit}
        onPaneClick={onPaneClick}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={{ type: 'smoothstep' }}
        fitView
        className="bg-slate-50 dark:bg-slate-900"
      >
        <Controls className="dark:bg-slate-800 dark:border-slate-700 dark:fill-slate-300" />
        <MiniMap
          nodeStrokeColor={(n) => {
            if (n.type === 'customNode') return '#6366f1';
            return '#eee';
          }}
          nodeColor={(n) => {
            if (n.type === 'customNode') return '#fff';
            return '#fff';
          }}
          nodeBorderRadius={2}
          className="dark:bg-slate-800 dark:border-slate-700"
          maskColor="rgba(15, 23, 42, 0.6)" // dark:slate-900 with opacity
        />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} color="var(--color-slate-300)" className="dark:opacity-20" />
      </ReactFlow>
    </div>
  );
}

export default function GraphCanvas() {
  return (
    <ReactFlowProvider>
      <Flow />
    </ReactFlowProvider>
  );
}
