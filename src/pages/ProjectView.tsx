import { Layers } from 'lucide-react';
import { useEffect } from 'react';
import { useGraphStore } from '../store/graphStore';
import GraphCanvas from '../components/GraphCanvas';
import NodeInspector from '../components/NodeInspector';
import BreadcrumbNav from '../components/BreadcrumbNav';
import Toolbar from '../components/Toolbar';
import Sidebar from '../components/Sidebar';

export default function ProjectView() {
  const { loadProjects, activeProjectId, darkMode } = useGraphStore();

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  return (
    <div className={`flex flex-col h-screen w-full overflow-hidden font-sans ${darkMode ? 'dark bg-slate-900 text-slate-100' : 'bg-slate-100 text-slate-900'}`}>
      <Toolbar />
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        
        <div className="flex flex-col flex-1 relative bg-slate-50 dark:bg-slate-900">
          {activeProjectId ? (
            <>
              <BreadcrumbNav />
              <div className="flex-1 relative">
                <GraphCanvas />
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500">
              <div className="w-24 h-24 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
                <Layers className="w-12 h-12 text-slate-400 dark:text-slate-500" />
              </div>
              <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-300 mb-2">Welcome to Process Atlas</h2>
              <p className="text-slate-500 dark:text-slate-400 max-w-md text-center">
                Select a project from the sidebar or create a new one to start mapping your systems and processes.
              </p>
            </div>
          )}
        </div>
        
        {activeProjectId && <NodeInspector />}
      </div>
    </div>
  );
}
