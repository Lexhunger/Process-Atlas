import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Project, Graph, AppNode, AppEdge, Template } from '../models/types';

interface ProcessAtlasDB extends DBSchema {
  projects: {
    key: string;
    value: Project;
  };
  graphs: {
    key: string;
    value: Graph;
    indexes: { 'by-project': string };
  };
  nodes: {
    key: string;
    value: AppNode;
    indexes: { 'by-graph': string };
  };
  edges: {
    key: string;
    value: AppEdge;
    indexes: { 'by-graph': string };
  };
  templates: {
    key: string;
    value: Template;
  };
}

const DB_NAME = 'ProcessAtlasDB';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<ProcessAtlasDB>> | null = null;

export async function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<ProcessAtlasDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('projects')) {
          db.createObjectStore('projects', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('graphs')) {
          const graphStore = db.createObjectStore('graphs', { keyPath: 'id' });
          graphStore.createIndex('by-project', 'projectId');
        }
        if (!db.objectStoreNames.contains('nodes')) {
          const nodeStore = db.createObjectStore('nodes', { keyPath: 'id' });
          nodeStore.createIndex('by-graph', 'graphId');
        }
        if (!db.objectStoreNames.contains('edges')) {
          const edgeStore = db.createObjectStore('edges', { keyPath: 'id' });
          edgeStore.createIndex('by-graph', 'graphId');
        }
        if (!db.objectStoreNames.contains('templates')) {
          db.createObjectStore('templates', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

export const storageService = {
  async getProjects(): Promise<Project[]> {
    const db = await getDB();
    return db.getAll('projects');
  },
  async saveProject(project: Project) {
    const db = await getDB();
    await db.put('projects', project);
  },
  async deleteProject(id: string) {
    const db = await getDB();
    await db.delete('projects', id);
    // Also delete associated graphs, nodes, edges
    const tx = db.transaction(['graphs', 'nodes', 'edges'], 'readwrite');
    const graphIndex = tx.objectStore('graphs').index('by-project');
    const graphs = await graphIndex.getAll(id);
    for (const graph of graphs) {
      await tx.objectStore('graphs').delete(graph.id);
      
      const nodeIndex = tx.objectStore('nodes').index('by-graph');
      const nodes = await nodeIndex.getAll(graph.id);
      for (const node of nodes) {
        await tx.objectStore('nodes').delete(node.id);
      }
      
      const edgeIndex = tx.objectStore('edges').index('by-graph');
      const edges = await edgeIndex.getAll(graph.id);
      for (const edge of edges) {
        await tx.objectStore('edges').delete(edge.id);
      }
    }
    await tx.done;
  },
  async getGraphsByProject(projectId: string): Promise<Graph[]> {
    const db = await getDB();
    return db.getAllFromIndex('graphs', 'by-project', projectId);
  },
  async getGraph(id: string): Promise<Graph | undefined> {
    const db = await getDB();
    return db.get('graphs', id);
  },
  async saveGraph(graph: Graph) {
    const db = await getDB();
    await db.put('graphs', graph);
  },
  async getNode(id: string): Promise<AppNode | undefined> {
    const db = await getDB();
    return db.get('nodes', id);
  },
  async getNodesByGraph(graphId: string): Promise<AppNode[]> {
    const db = await getDB();
    return db.getAllFromIndex('nodes', 'by-graph', graphId);
  },
  async getAllProjectNodes(projectId: string): Promise<AppNode[]> {
    const db = await getDB();
    const graphs = await db.getAllFromIndex('graphs', 'by-project', projectId);
    const nodes: AppNode[] = [];
    for (const graph of graphs) {
      const graphNodes = await db.getAllFromIndex('nodes', 'by-graph', graph.id);
      nodes.push(...graphNodes);
    }
    return nodes;
  },
  async getAllProjectEdges(projectId: string): Promise<AppEdge[]> {
    const db = await getDB();
    const graphs = await db.getAllFromIndex('graphs', 'by-project', projectId);
    const edges: AppEdge[] = [];
    for (const graph of graphs) {
      const graphEdges = await db.getAllFromIndex('edges', 'by-graph', graph.id);
      edges.push(...graphEdges);
    }
    return edges;
  },
  async saveNode(node: AppNode) {
    const db = await getDB();
    await db.put('nodes', node);
  },
  async deleteNode(id: string) {
    const db = await getDB();
    await db.delete('nodes', id);
  },
  async getEdgesByGraph(graphId: string): Promise<AppEdge[]> {
    const db = await getDB();
    return db.getAllFromIndex('edges', 'by-graph', graphId);
  },
  async saveEdge(edge: AppEdge) {
    const db = await getDB();
    await db.put('edges', edge);
  },
  async deleteEdge(id: string) {
    const db = await getDB();
    await db.delete('edges', id);
  },
  async getTemplates(): Promise<Template[]> {
    const db = await getDB();
    return db.getAll('templates');
  },
  async saveTemplate(template: Template) {
    const db = await getDB();
    await db.put('templates', template);
  },
  async deleteTemplate(id: string) {
    const db = await getDB();
    await db.delete('templates', id);
  },
  async exportProject(projectId: string, format: 'json' | 'xml' = 'json'): Promise<string> {
    const db = await getDB();
    const project = await db.get('projects', projectId);
    if (!project) throw new Error('Project not found');

    const graphs = await db.getAllFromIndex('graphs', 'by-project', projectId);
    const nodes: AppNode[] = [];
    const edges: AppEdge[] = [];

    for (const graph of graphs) {
      const graphNodes = await db.getAllFromIndex('nodes', 'by-graph', graph.id);
      const graphEdges = await db.getAllFromIndex('edges', 'by-graph', graph.id);
      nodes.push(...graphNodes);
      edges.push(...graphEdges);
    }

    const data = { project, graphs, nodes, edges };
    
    if (format === 'xml') {
      const { formatConverter } = await import('../utils/formatConverter');
      return formatConverter.jsonToXml(data);
    }
    
    return JSON.stringify(data);
  },
  async importProject(dataString: string) {
    let data;
    if (dataString.trim().startsWith('<?xml') || dataString.trim().startsWith('<process-atlas')) {
      const { formatConverter } = await import('../utils/formatConverter');
      data = formatConverter.xmlToJson(dataString);
    } else {
      data = JSON.parse(dataString);
    }
    
    const { project, graphs, nodes, edges } = data;
    
    const db = await getDB();
    const tx = db.transaction(['projects', 'graphs', 'nodes', 'edges'], 'readwrite');
    
    await tx.objectStore('projects').put(project);
    for (const graph of graphs) await tx.objectStore('graphs').put(graph);
    for (const node of nodes) await tx.objectStore('nodes').put(node);
    for (const edge of edges) await tx.objectStore('edges').put(edge);
    
    await tx.done;
  }
};
