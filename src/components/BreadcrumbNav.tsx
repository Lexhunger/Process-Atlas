import { ChevronRight, Home } from 'lucide-react';
import { useGraphStore } from '../store/graphStore';
import { useEffect, useState } from 'react';

export default function BreadcrumbNav() {
  const { projects, activeProjectId, selectedNodeId, nodes, selectNode } = useGraphStore();
  const [hierarchy, setHierarchy] = useState<{ id: string; title: string }[]>([]);
  
  const activeProject = projects.find(p => p.id === activeProjectId);

  useEffect(() => {
    if (!selectedNodeId) {
      setHierarchy([]);
      return;
    }

    const path: { id: string; title: string }[] = [];
    let currentNode = nodes.find(n => n.id === selectedNodeId);

    while (currentNode) {
      path.unshift({ id: currentNode.id, title: (currentNode.data as any).title || 'Node' });
      const parentId = currentNode.parentId;
      currentNode = parentId ? nodes.find(n => n.id === parentId) : undefined;
    }

    setHierarchy(path);
  }, [selectedNodeId, nodes]);
  
  if (!activeProject) return null;

  return (
    <div className="flex items-center h-12 px-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm z-10">
      <div className="flex items-center text-sm text-slate-600 dark:text-slate-300 font-medium">
        <button 
          onClick={() => selectNode(null)}
          className="flex items-center px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
        >
          <Home className="w-4 h-4 mr-2 text-indigo-600 dark:text-indigo-400" />
          {activeProject.name}
        </button>
        
        {hierarchy.map((item, index) => (
          <div key={item.id} className="flex items-center">
            <ChevronRight className="w-4 h-4 mx-1 text-slate-400 dark:text-slate-500" />
            <button
              onClick={() => selectNode(item.id)}
              className={`px-2 py-1 rounded-md transition-colors ${
                index === hierarchy.length - 1
                  ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-semibold'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              {item.title}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
