import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Project, Graph, AppNode, AppEdge, Template } from '../models/types';
import { db, handleFirestoreError, OperationType } from './firebase';
import { 
  collection, doc, setDoc, getDoc, getDocs, deleteDoc, 
  query, where, serverTimestamp, onSnapshot, updateDoc,
  writeBatch
} from 'firebase/firestore';

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
  snapshots: {
    key: string;
    value: any;
    indexes: { 'by-project': string };
  };
  comments: {
    key: string;
    value: any;
    indexes: { 'by-project': string };
  };
}

const DB_NAME = 'ProcessAtlasDB';
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<ProcessAtlasDB>> | null = null;

export async function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<ProcessAtlasDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
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
        if (!db.objectStoreNames.contains('snapshots')) {
          const snapshotStore = db.createObjectStore('snapshots', { keyPath: 'id' });
          snapshotStore.createIndex('by-project', 'projectId');
        }
        if (!db.objectStoreNames.contains('comments')) {
          const commentStore = db.createObjectStore('comments', { keyPath: 'id' });
          commentStore.createIndex('by-project', 'projectId');
        }
      },
    });
  }
  return dbPromise;
}

export const storageService = {
  async getProjects(cloudMode = false, userId?: string): Promise<Project[]> {
    if (cloudMode && userId) {
      try {
        const q = query(collection(db, 'projects'), where('members', 'array-contains', userId));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Project));
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'projects');
      }
    }
    const dbLocal = await getDB();
    return dbLocal.getAll('projects');
  },
  async saveProject(project: Project, cloudMode = false) {
    if (cloudMode) {
      try {
        const { id, ...data } = project;
        await setDoc(doc(db, 'projects', id), {
          ...data,
          updatedAt: Date.now()
        });
        return;
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `projects/${project.id}`);
      }
    }
    const dbLocal = await getDB();
    await dbLocal.put('projects', project);
  },
  async deleteProject(id: string, cloudMode = false) {
    if (cloudMode) {
      try {
        await deleteDoc(doc(db, 'projects', id));
        // Subcollections need manual deletion or cloud functions, 
        // for now we just delete the main doc.
        return;
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `projects/${id}`);
      }
    }
    const dbLocal = await getDB();
    await dbLocal.delete('projects', id);
    // Also delete associated graphs, nodes, edges, snapshots, comments
    const tx = dbLocal.transaction(['graphs', 'nodes', 'edges', 'snapshots', 'comments'], 'readwrite');
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

    const snapshotIndex = tx.objectStore('snapshots').index('by-project');
    const snapshots = await snapshotIndex.getAll(id);
    for (const snapshot of snapshots) {
      await tx.objectStore('snapshots').delete(snapshot.id);
    }

    const commentIndex = tx.objectStore('comments').index('by-project');
    const comments = await commentIndex.getAll(id);
    for (const comment of comments) {
      await tx.objectStore('comments').delete(comment.id);
    }

    await tx.done;
  },
  async getGraphsByProject(projectId: string, cloudMode = false): Promise<Graph[]> {
    if (cloudMode) {
      try {
        const q = query(collection(db, `projects/${projectId}/graphs`));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Graph));
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, `projects/${projectId}/graphs`);
      }
    }
    const dbLocal = await getDB();
    return dbLocal.getAllFromIndex('graphs', 'by-project', projectId);
  },
  async saveGraph(graph: Graph, cloudMode = false) {
    if (cloudMode) {
      try {
        const { id, ...data } = graph;
        await setDoc(doc(db, `projects/${graph.projectId}/graphs`, id), data);
        return;
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `projects/${graph.projectId}/graphs/${graph.id}`);
      }
    }
    const dbLocal = await getDB();
    await dbLocal.put('graphs', graph);
  },
  async getNodesByGraph(graphId: string, projectId?: string, cloudMode = false): Promise<AppNode[]> {
    if (cloudMode && projectId) {
      try {
        const q = query(collection(db, `projects/${projectId}/graphs/${graphId}/nodes`));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as AppNode));
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, `projects/${projectId}/graphs/${graphId}/nodes`);
      }
    }
    const dbLocal = await getDB();
    return dbLocal.getAllFromIndex('nodes', 'by-graph', graphId);
  },
  async saveNode(node: AppNode, projectId?: string, cloudMode = false) {
    if (cloudMode && projectId) {
      try {
        const { id, ...data } = node;
        await setDoc(doc(db, `projects/${projectId}/graphs/${node.graphId}/nodes`, id), data);
        return;
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `projects/${projectId}/graphs/${node.graphId}/nodes/${node.id}`);
      }
    }
    const dbLocal = await getDB();
    await dbLocal.put('nodes', node);
  },
  async deleteNode(id: string, graphId: string, projectId?: string, cloudMode = false) {
    if (cloudMode && projectId) {
      try {
        await deleteDoc(doc(db, `projects/${projectId}/graphs/${graphId}/nodes`, id));
        return;
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `projects/${projectId}/graphs/${graphId}/nodes/${id}`);
      }
    }
    const dbLocal = await getDB();
    await dbLocal.delete('nodes', id);
  },
  async getEdgesByGraph(graphId: string, projectId?: string, cloudMode = false): Promise<AppEdge[]> {
    if (cloudMode && projectId) {
      try {
        const q = query(collection(db, `projects/${projectId}/graphs/${graphId}/edges`));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as AppEdge));
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, `projects/${projectId}/graphs/${graphId}/edges`);
      }
    }
    const dbLocal = await getDB();
    return dbLocal.getAllFromIndex('edges', 'by-graph', graphId);
  },
  async saveEdge(edge: AppEdge, projectId?: string, cloudMode = false) {
    if (cloudMode && projectId) {
      try {
        const { id, ...data } = edge;
        await setDoc(doc(db, `projects/${projectId}/graphs/${edge.graphId}/edges`, id), data);
        return;
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `projects/${projectId}/graphs/${edge.graphId}/edges/${edge.id}`);
      }
    }
    const dbLocal = await getDB();
    await dbLocal.put('edges', edge);
  },
  async deleteEdge(id: string, graphId: string, projectId?: string, cloudMode = false) {
    if (cloudMode && projectId) {
      try {
        await deleteDoc(doc(db, `projects/${projectId}/graphs/${graphId}/edges`, id));
        return;
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `projects/${projectId}/graphs/${graphId}/edges/${id}`);
      }
    }
    const dbLocal = await getDB();
    await dbLocal.delete('edges', id);
  },

  // Snapshots
  async getSnapshots(projectId: string, cloudMode = false): Promise<any[]> {
    if (cloudMode) {
      try {
        const q = query(collection(db, `projects/${projectId}/snapshots`));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, `projects/${projectId}/snapshots`);
      }
    }
    const dbLocal = await getDB();
    return dbLocal.getAllFromIndex('snapshots', 'by-project', projectId);
  },
  async saveSnapshot(snapshot: any, cloudMode = false) {
    if (cloudMode) {
      try {
        const { id, ...data } = snapshot;
        await setDoc(doc(db, `projects/${snapshot.projectId}/snapshots`, id), data);
        return;
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `projects/${snapshot.projectId}/snapshots/${snapshot.id}`);
      }
    }
    const dbLocal = await getDB();
    await dbLocal.put('snapshots', snapshot);
  },
  async deleteSnapshot(id: string, projectId: string, cloudMode = false) {
    if (cloudMode) {
      try {
        await deleteDoc(doc(db, `projects/${projectId}/snapshots`, id));
        return;
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `projects/${projectId}/snapshots/${id}`);
      }
    }
    const dbLocal = await getDB();
    await dbLocal.delete('snapshots', id);
  },

  // Comments
  async getComments(projectId: string, cloudMode = false): Promise<any[]> {
    if (cloudMode) {
      try {
        const q = query(collection(db, `projects/${projectId}/comments`));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, `projects/${projectId}/comments`);
      }
    }
    const dbLocal = await getDB();
    return dbLocal.getAllFromIndex('comments', 'by-project', projectId);
  },
  async saveComment(comment: any, cloudMode = false) {
    if (cloudMode) {
      try {
        const { id, ...data } = comment;
        await setDoc(doc(db, `projects/${comment.projectId}/comments`, id), data);
        return;
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `projects/${comment.projectId}/comments/${comment.id}`);
      }
    }
    const dbLocal = await getDB();
    await dbLocal.put('comments', comment);
  },
  async deleteComment(id: string, projectId: string, cloudMode = false) {
    if (cloudMode) {
      try {
        await deleteDoc(doc(db, `projects/${projectId}/comments`, id));
        return;
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `projects/${projectId}/comments/${id}`);
      }
    }
    const dbLocal = await getDB();
    await dbLocal.delete('comments', id);
  },

  async getTemplates(): Promise<Template[]> {
    const db = await getDB();
    const templates = await db.getAll('templates');
    
    if (templates.length === 0) {
      const defaultTemplates: Template[] = [
        {
          id: 'tpl-onboarding',
          name: 'User Onboarding',
          description: 'A standard flow for welcoming new users to your platform.',
          nodeType: 'process',
          defaultDescription: 'Step in the onboarding process',
          metadataSchema: ['step_number', 'required_action'],
          defaultLinks: [],
          defaultCodeSnippets: [],
          icon: 'UserPlus'
        },
        {
          id: 'tpl-cicd',
          name: 'CI/CD Pipeline',
          description: 'Automate your build, test, and deployment workflow.',
          nodeType: 'action',
          defaultDescription: 'Pipeline stage',
          metadataSchema: ['environment', 'timeout'],
          defaultLinks: [],
          defaultCodeSnippets: [{ id: 'ds-1', title: 'Deploy Script', code: 'npm run deploy', language: 'bash' }],
          icon: 'Zap'
        },
        {
          id: 'tpl-incident',
          name: 'Incident Response',
          description: 'Critical path for handling system outages or bugs.',
          nodeType: 'decision',
          defaultDescription: 'Decision point in incident handling',
          metadataSchema: ['severity', 'on_call_team'],
          defaultLinks: [],
          defaultCodeSnippets: [],
          icon: 'AlertTriangle'
        }
      ];
      
      for (const tpl of defaultTemplates) {
        await db.put('templates', tpl);
      }
      return defaultTemplates;
    }
    
    return templates;
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
  async importProject(dataString: string, cloudMode = false) {
    let data;
    if (dataString.trim().startsWith('<?xml') || dataString.trim().startsWith('<process-atlas')) {
      const { formatConverter } = await import('../utils/formatConverter');
      data = formatConverter.xmlToJson(dataString);
    } else {
      data = JSON.parse(dataString);
    }
    
    const { project, graphs, nodes, edges } = data;
    
    if (cloudMode) {
      try {
        const batch = writeBatch(db);
        
        // Project
        const projectRef = doc(db, 'projects', project.id);
        const { id: pId, ...pData } = project;
        batch.set(projectRef, pData);
        
        // Graphs
        for (const graph of graphs) {
          const graphRef = doc(db, `projects/${project.id}/graphs`, graph.id);
          const { id: gId, ...gData } = graph;
          batch.set(graphRef, gData);
        }
        
        // Nodes
        for (const node of nodes) {
          const nodeRef = doc(db, `projects/${project.id}/graphs/${node.graphId}/nodes`, node.id);
          const { id: nId, ...nData } = node;
          batch.set(nodeRef, nData);
        }
        
        // Edges
        for (const edge of edges) {
          const edgeRef = doc(db, `projects/${project.id}/graphs/${edge.graphId}/edges`, edge.id);
          const { id: eId, ...eData } = edge;
          batch.set(edgeRef, eData);
        }
        
        await batch.commit();
        return;
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `projects/${project.id}/import`);
      }
    }

    const dbLocal = await getDB();
    const tx = dbLocal.transaction(['projects', 'graphs', 'nodes', 'edges'], 'readwrite');
    
    await tx.objectStore('projects').put(project);
    for (const graph of graphs) await tx.objectStore('graphs').put(graph);
    for (const node of nodes) await tx.objectStore('nodes').put(node);
    for (const edge of edges) await tx.objectStore('edges').put(edge);
    
    await tx.done;
  }
};
