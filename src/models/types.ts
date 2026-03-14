export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  ownerId?: string;
  members?: string[];
}

export interface Graph {
  id: string;
  projectId: string;
  parentNodeId?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface Link {
  id: string;
  label: string;
  url: string;
  icon?: string;
  iconUrl?: string;
}

export interface CodeSnippet {
  id: string;
  title: string;
  language: string;
  code: string;
}

export type NodeShape = 'rectangle' | 'diamond' | 'circle' | 'pill' | 'parallelogram' | 'hexagon' | 'cylinder' | 'document' | 'component' | 'gear';

export interface NodeData extends Record<string, unknown> {
  title: string;
  description: string;
  nodeType: string;
  metadata: Record<string, string>;
  childGraphId?: string;
  links: Link[];
  codeSnippets: CodeSnippet[];
  tags: string[];
  isCollapsed?: boolean;
  shape?: NodeShape;
  icon?: string;
  iconUrl?: string;
}

export interface AppNode {
  id: string;
  graphId: string;
  position: { x: number; y: number };
  width?: number;
  height?: number;
  type: string; // React Flow type, e.g., 'customNode'
  data: NodeData;
  parentId?: string;
}

export interface AppEdge {
  id: string;
  graphId: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  relationshipType: string;
  label?: string;
  type?: string;
  color?: string;
  animated?: boolean;
  hasArrow?: boolean;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  nodeType: string;
  metadataSchema: string[]; // Keys for metadata
  defaultLinks: Link[];
  defaultCodeSnippets: CodeSnippet[];
  defaultDescription: string;
  icon?: string;
  iconUrl?: string;
}

export interface Snapshot {
  id: string;
  projectId: string;
  graphId: string;
  name: string;
  nodes: any[];
  edges: any[];
  createdBy: string;
  timestamp: number;
}

export interface Comment {
  id: string;
  projectId: string;
  graphId: string;
  targetId: string;
  text: string;
  authorId: string;
  authorName: string;
  authorPhoto?: string;
  timestamp: number;
  resolved: boolean;
}
