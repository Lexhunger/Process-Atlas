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
  settings: {
    key: string;
    value: any;
  };
  pending_writes: {
    key: number;
    value: any;
  };
}

const DB_NAME = 'ProcessAtlasDB';
const DB_VERSION = 4;

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
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }
        if (oldVersion < 4) {
          if (db.objectStoreNames.contains('pending_writes')) {
            db.deleteObjectStore('pending_writes');
          }
          db.createObjectStore('pending_writes', { keyPath: 'path' });
        }
      },
    });
  }
  return dbPromise;
}

const cleanObject = (obj: any) => {
  const newObj: any = {};
  Object.keys(obj).forEach(key => {
    if (obj[key] !== undefined) {
      newObj[key] = obj[key];
    }
  });
  return newObj;
};

const shouldSync = (cloudMode: boolean, projectId?: string) => {
  if (!cloudMode) return false;
  if (localStorage.getItem('atlas_dev_mode') === 'true') return false;
  if (projectId) {
    const localProjects = JSON.parse(localStorage.getItem('atlas_local_projects') || '[]');
    if (localProjects.includes(projectId)) return false;
  }
  return true;
};

let isCloudQuotaExceeded = false;

export const storageService = {
  getIsCloudQuotaExceeded() {
    return isCloudQuotaExceeded;
  },
  resetCloudQuotaStatus() {
    isCloudQuotaExceeded = false;
  },

  async queueWrite(type: string, data: any, path: string, projectId?: string) {
    console.warn('Firestore quota exceeded, queuing write:', type, path);
    const dbLocal = await getDB();
    await dbLocal.put('pending_writes', { type, data, path, projectId, timestamp: Date.now() });
  },

  async writeWithQueue(
    operation: () => Promise<void>,
    type: string,
    path: string,
    data: any,
    projectId?: string
  ) {
    if (isCloudQuotaExceeded) {
      await this.queueWrite(type, data, path, projectId);
      return;
    }
    try {
      await operation();
    } catch (error: any) {
      if (error?.code === 'resource-exhausted') {
        isCloudQuotaExceeded = true;
        await this.queueWrite(type, data, path, projectId);
      } else {
        handleFirestoreError(error, OperationType.WRITE, path);
      }
    }
  },

  async deleteWithQueue(
    operation: () => Promise<void>,
    type: string,
    path: string,
    data: any,
    projectId?: string
  ) {
    if (isCloudQuotaExceeded) {
      await this.queueWrite(type, data, path, projectId);
      return;
    }
    try {
      await operation();
    } catch (error: any) {
      if (error?.code === 'resource-exhausted') {
        isCloudQuotaExceeded = true;
        await this.queueWrite(type, data, path, projectId);
      } else {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    }
  },

  async syncPendingWrites(projectId: string, cloudMode = false) {
    if (!cloudMode || isCloudQuotaExceeded) return;
    const dbLocal = await getDB();
    const pendingWrites = await dbLocal.getAll('pending_writes');
    
    const projectWrites = pendingWrites.filter(w => w.projectId === projectId);
    if (projectWrites.length === 0) return;

    try {
      const batch = writeBatch(db);
      let count = 0;
      for (const write of projectWrites) {
        if (count >= 500) break; // Firestore batch limit
        
        const { type, data, projectId: pId } = write;
        
        switch (type) {
          case 'saveProject':
            batch.set(doc(db, 'projects', data.id), { ...cleanObject(data), updatedAt: Date.now() });
            break;
          case 'deleteProject':
            batch.delete(doc(db, 'projects', data.id));
            break;
          case 'saveGraph':
            batch.set(doc(db, `projects/${data.projectId}/graphs`, data.id), cleanObject(data));
            break;
          case 'saveNode':
            batch.set(doc(db, `projects/${pId}/graphs/${data.graphId}/nodes`, data.id), cleanObject(data));
            break;
          case 'deleteNode':
            batch.delete(doc(db, `projects/${pId}/graphs/${data.graphId}/nodes`, data.id));
            break;
          case 'saveEdge':
            batch.set(doc(db, `projects/${pId}/graphs/${data.graphId}/edges`, data.id), cleanObject(data));
            break;
          case 'deleteEdge':
            batch.delete(doc(db, `projects/${pId}/graphs/${data.graphId}/edges`, data.id));
            break;
          case 'saveSnapshot':
            batch.set(doc(db, `projects/${data.projectId}/snapshots`, data.id), data);
            break;
          case 'deleteSnapshot':
            batch.delete(doc(db, `projects/${pId}/snapshots`, data.id));
            break;
          case 'saveComment':
            batch.set(doc(db, `projects/${data.projectId}/comments`, data.id), data);
            break;
          case 'deleteComment':
            batch.delete(doc(db, `projects/${pId}/comments`, data.id));
            break;
          case 'saveSettings':
            batch.set(doc(db, `users/${pId}/settings`, data.key), { value: data.value, updatedAt: Date.now() });
            break;
          case 'updatePresence':
            batch.set(doc(db, `projects/${pId}/presence`, data.uid), data, { merge: true });
            break;
          default:
            console.warn('Unknown write type:', type);
        }
        
        count++;
      }
      await batch.commit();
      isCloudQuotaExceeded = false;
      
      // Clear pending writes
      for (const write of projectWrites) {
        if (count-- <= 0) break;
        await dbLocal.delete('pending_writes', write.path);
      }
    } catch (error: any) {
      if (error?.code === 'resource-exhausted') {
        isCloudQuotaExceeded = true;
        console.warn('Firestore quota exceeded during sync, queuing writes');
      } else {
        console.error('Failed to sync pending writes', error);
      }
    }
  },
  async getProjects(cloudMode = false, userId?: string): Promise<Project[]> {
    const dbLocal = await getDB();
    const localProjects = await dbLocal.getAll('projects');
    
    if (shouldSync(cloudMode) && userId) {
      try {
        const q = query(collection(db, 'projects'), where('members', 'array-contains', userId));
        const snapshot = await getDocs(q);
        const cloudProjects = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Project));
        
        // Merge local and cloud projects. Prefer cloud unless local is newer or project is local-only
        const merged = new Map<string, Project>();
        localProjects.forEach(p => merged.set(p.id, p));
        cloudProjects.forEach(p => {
          const existing = merged.get(p.id);
          if (!existing || p.updatedAt > existing.updatedAt) {
            merged.set(p.id, p);
          }
        });
        return Array.from(merged.values());
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, 'projects');
      }
    }
    return localProjects;
  },
  async saveProject(project: Project, cloudMode = false) {
    if (shouldSync(cloudMode, project.id)) {
      const { id, ...data } = project;
      await this.writeWithQueue(
        () => setDoc(doc(db, 'projects', id), { ...cleanObject(data), updatedAt: Date.now() }),
        'saveProject',
        `projects/${project.id}`,
        project,
        project.id
      );
    } else {
      const dbLocal = await getDB();
      await dbLocal.put('projects', project);
    }
  },
  async syncProjectToCloud(projectId: string) {
    const dbLocal = await getDB();
    const project = await dbLocal.get('projects', projectId);
    if (!project) return;
    
    // Save project
    const { id, ...data } = project;
    await this.writeWithQueue(
      () => setDoc(doc(db, 'projects', id), { ...cleanObject(data), updatedAt: Date.now() }),
      'saveProject',
      `projects/${id}`,
      project,
      id
    );
    
    // Get all graphs for this project
    const graphs = await dbLocal.getAllFromIndex('graphs', 'by-project', projectId);
    for (const graph of graphs) {
      await this.writeWithQueue(
        () => setDoc(doc(db, `projects/${projectId}/graphs`, graph.id), cleanObject(graph)),
        'saveGraph',
        `projects/${projectId}/graphs/${graph.id}`,
        graph,
        projectId
      );
      
      // Get nodes and edges for this graph
      const nodes = await dbLocal.getAllFromIndex('nodes', 'by-graph', graph.id);
      for (const node of nodes) {
        await this.writeWithQueue(
          () => setDoc(doc(db, `projects/${projectId}/graphs/${graph.id}/nodes`, node.id), cleanObject(node)),
          'saveNode',
          `projects/${projectId}/graphs/${graph.id}/nodes/${node.id}`,
          node,
          projectId
        );
      }
      
      const edges = await dbLocal.getAllFromIndex('edges', 'by-graph', graph.id);
      for (const edge of edges) {
        await this.writeWithQueue(
          () => setDoc(doc(db, `projects/${projectId}/graphs/${graph.id}/edges`, edge.id), cleanObject(edge)),
          'saveEdge',
          `projects/${projectId}/graphs/${graph.id}/edges/${edge.id}`,
          edge,
          projectId
        );
      }
    }
  },
  async deleteProjectFromCloud(id: string) {
    await this.deleteWithQueue(
      () => deleteDoc(doc(db, 'projects', id)),
      'deleteProject',
      `projects/${id}`,
      { id },
      id
    );
  },
  async deleteProject(id: string, cloudMode = false) {
    if (shouldSync(cloudMode, id)) {
      await this.deleteWithQueue(
        () => deleteDoc(doc(db, 'projects', id)),
        'deleteProject',
        `projects/${id}`,
        { id },
        id
      );
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
    if (shouldSync(cloudMode, projectId)) {
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
    if (shouldSync(cloudMode, graph.projectId)) {
      const { id, ...data } = graph;
      await this.writeWithQueue(
        () => setDoc(doc(db, `projects/${graph.projectId}/graphs`, id), cleanObject(data)),
        'saveGraph',
        `projects/${graph.projectId}/graphs/${graph.id}`,
        graph,
        graph.projectId
      );
    } else {
      const dbLocal = await getDB();
      await dbLocal.put('graphs', graph);
    }
  },
  async getNodesByGraph(graphId: string, projectId?: string, cloudMode = false): Promise<AppNode[]> {
    if (shouldSync(cloudMode, projectId) && projectId) {
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
    if (shouldSync(cloudMode, projectId) && projectId) {
      const { id, ...data } = node;
      await this.writeWithQueue(
        () => setDoc(doc(db, `projects/${projectId}/graphs/${node.graphId}/nodes`, id), cleanObject(data)),
        'saveNode',
        `projects/${projectId}/graphs/${node.graphId}/nodes/${node.id}`,
        node,
        projectId
      );
    } else {
      const dbLocal = await getDB();
      await dbLocal.put('nodes', node);
    }
  },
  async deleteNode(id: string, graphId: string, projectId?: string, cloudMode = false) {
    if (shouldSync(cloudMode, projectId) && projectId) {
      await this.deleteWithQueue(
        () => deleteDoc(doc(db, `projects/${projectId}/graphs/${graphId}/nodes`, id)),
        'deleteNode',
        `projects/${projectId}/graphs/${graphId}/nodes/${id}`,
        { id, graphId },
        projectId
      );
    } else {
      const dbLocal = await getDB();
      await dbLocal.delete('nodes', id);
    }
  },
  async getEdgesByGraph(graphId: string, projectId?: string, cloudMode = false): Promise<AppEdge[]> {
    if (shouldSync(cloudMode, projectId) && projectId) {
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
    if (shouldSync(cloudMode, projectId) && projectId) {
      const { id, ...data } = edge;
      await this.writeWithQueue(
        () => setDoc(doc(db, `projects/${projectId}/graphs/${edge.graphId}/edges`, id), cleanObject(data)),
        'saveEdge',
        `projects/${projectId}/graphs/${edge.graphId}/edges/${edge.id}`,
        edge,
        projectId
      );
    } else {
      const dbLocal = await getDB();
      await dbLocal.put('edges', edge);
    }
  },
  async deleteEdge(id: string, graphId: string, projectId?: string, cloudMode = false) {
    if (shouldSync(cloudMode, projectId) && projectId) {
      await this.deleteWithQueue(
        () => deleteDoc(doc(db, `projects/${projectId}/graphs/${graphId}/edges`, id)),
        'deleteEdge',
        `projects/${projectId}/graphs/${graphId}/edges/${id}`,
        { id, graphId },
        projectId
      );
    } else {
      const dbLocal = await getDB();
      await dbLocal.delete('edges', id);
    }
  },

  // Snapshots
  async getSnapshots(projectId: string, cloudMode = false): Promise<any[]> {
    if (shouldSync(cloudMode, projectId)) {
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
    if (shouldSync(cloudMode, snapshot.projectId)) {
      const { id, ...data } = snapshot;
      await this.writeWithQueue(
        () => setDoc(doc(db, `projects/${snapshot.projectId}/snapshots`, id), data),
        'saveSnapshot',
        `projects/${snapshot.projectId}/snapshots/${snapshot.id}`,
        snapshot,
        snapshot.projectId
      );
    } else {
      const dbLocal = await getDB();
      await dbLocal.put('snapshots', snapshot);
    }
  },
  async deleteSnapshot(id: string, projectId: string, cloudMode = false) {
    if (shouldSync(cloudMode, projectId)) {
      await this.deleteWithQueue(
        () => deleteDoc(doc(db, `projects/${projectId}/snapshots`, id)),
        'deleteSnapshot',
        `projects/${projectId}/snapshots/${id}`,
        { id },
        projectId
      );
    } else {
      const dbLocal = await getDB();
      await dbLocal.delete('snapshots', id);
    }
  },

  // Comments
  async getComments(projectId: string, cloudMode = false): Promise<any[]> {
    if (shouldSync(cloudMode, projectId)) {
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
    if (shouldSync(cloudMode, comment.projectId)) {
      const { id, ...data } = comment;
      await this.writeWithQueue(
        () => setDoc(doc(db, `projects/${comment.projectId}/comments`, id), data),
        'saveComment',
        `projects/${comment.projectId}/comments/${comment.id}`,
        comment,
        comment.projectId
      );
    } else {
      const dbLocal = await getDB();
      await dbLocal.put('comments', comment);
    }
  },
  async deleteComment(id: string, projectId: string, cloudMode = false) {
    if (shouldSync(cloudMode, projectId)) {
      await this.deleteWithQueue(
        () => deleteDoc(doc(db, `projects/${projectId}/comments`, id)),
        'deleteComment',
        `projects/${projectId}/comments/${id}`,
        { id },
        projectId
      );
    } else {
      const dbLocal = await getDB();
      await dbLocal.delete('comments', id);
    }
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
    
    if (shouldSync(cloudMode, project.id)) {
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
      
      await this.writeWithQueue(
        () => batch.commit(),
        'importProject',
        `projects/${project.id}/import`,
        data,
        project.id
      );
      return;
    }

    const dbLocal = await getDB();
    const tx = dbLocal.transaction(['projects', 'graphs', 'nodes', 'edges'], 'readwrite');
    
    await tx.objectStore('projects').put(project);
    for (const graph of graphs) await tx.objectStore('graphs').put(graph);
    for (const node of nodes) await tx.objectStore('nodes').put(node);
    for (const edge of edges) await tx.objectStore('edges').put(edge);
    
    await tx.done;
  },

  async getSettings(key: string, cloudMode = false, userId?: string): Promise<any> {
    if (shouldSync(cloudMode) && userId) {
      try {
        const docRef = doc(db, `users/${userId}/settings`, key);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          return docSnap.data().value;
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `users/${userId}/settings/${key}`);
      }
    }
    const dbLocal = await getDB();
    return dbLocal.get('settings', key);
  },

  async saveSettings(key: string, value: any, cloudMode = false, userId?: string) {
    if (shouldSync(cloudMode) && userId) {
      await this.writeWithQueue(
        () => setDoc(doc(db, `users/${userId}/settings`, key), { value, updatedAt: Date.now() }),
        'saveSettings',
        `users/${userId}/settings/${key}`,
        { value },
        userId
      );
    } else {
      const dbLocal = await getDB();
      await dbLocal.put('settings', value, key);
    }
  }
};
