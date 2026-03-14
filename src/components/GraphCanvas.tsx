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

const nodeTypes = {
  customNode: CustomNode,
  groupNode: GroupNode,
};

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
  } = useGraphStore();

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const { setCenter } = useReactFlow();

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

      // Check if dropped inside an expanded node
      const intersectingNodes = reactFlowInstance.getIntersectingNodes({
        x: position.x,
        y: position.y,
        width: 1,
        height: 1
      });

      let parentId = undefined;
      const expandedParent = intersectingNodes.find((n: Node) => 
        (n.type === 'customNode' && n.data.isExpanded) || 
        (n.type === 'groupNode' && !n.data.isCollapsed)
      );

      if (expandedParent) {
        parentId = expandedParent.id;
        // Adjust position to be relative to parent
        position.x -= expandedParent.position.x;
        position.y -= expandedParent.position.y;
      }

      addNode(position, type, templateId || undefined, shape || undefined, parentId);
    },
    [reactFlowInstance, addNode]
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
    <div className="w-full h-full" ref={reactFlowWrapper}>
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
