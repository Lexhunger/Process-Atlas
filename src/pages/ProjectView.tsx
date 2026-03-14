import { Layers, Settings as SettingsIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useGraphStore } from '../store/graphStore';
import { auth } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import GraphCanvas from '../components/GraphCanvas';
import NodeInspector from '../components/NodeInspector';
import BreadcrumbNav from '../components/BreadcrumbNav';
import Toolbar from '../components/Toolbar';
import Sidebar from '../components/Sidebar';
import Settings from '../components/Settings';
import PresenceBar from '../components/PresenceBar';
import MonitoringDashboard from '../components/MonitoringDashboard';
import { SnapshotsPanel } from '../components/SnapshotsPanel';
import { CommentsPanel } from '../components/CommentsPanel';
import { TemplateGallery } from '../components/TemplateGallery';
import { TaskExportModal } from '../components/TaskExportModal';
import { AnimatePresence } from 'motion/react';

export default function ProjectView() {
  const { loadProjects, activeProjectId, activeGraphId, cloudMode, darkMode, setCloudMode, syncGraph, user } = useGraphStore();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMonitoringOpen, setIsMonitoringOpen] = useState(false);
  const [isSnapshotsOpen, setIsSnapshotsOpen] = useState(false);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  const [isTaskExportOpen, setIsTaskExportOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      useGraphStore.setState({ user: u, isAuthReady: true });
      if (!u) {
        setCloudMode(false);
      }
    });

    return () => unsubscribe();
  }, [setCloudMode]);

  // Load projects whenever cloudMode or user changes
  useEffect(() => {
    loadProjects();
  }, [cloudMode, user?.uid, loadProjects]);

  useEffect(() => {
    // Load initial cloud mode from localStorage
    const savedCloudMode = localStorage.getItem('atlas_cloud_mode') === 'true';
    if (savedCloudMode && user) {
      setCloudMode(true);
    }
  }, [setCloudMode, user]);

  // Real-time sync effect
  useEffect(() => {
    if (cloudMode && activeGraphId) {
      const unsub = syncGraph(activeGraphId);
      return () => {
        if (typeof unsub === 'function') unsub();
      };
    }
  }, [cloudMode, activeGraphId, syncGraph]);

  return (
    <div className={`flex flex-col h-screen w-full overflow-hidden font-sans ${darkMode ? 'dark bg-slate-900 text-slate-100' : 'bg-slate-100 text-slate-900'}`}>
      <Toolbar 
        onOpenMonitoring={() => setIsMonitoringOpen(true)} 
        onOpenSnapshots={() => setIsSnapshotsOpen(true)}
        onOpenComments={() => setIsCommentsOpen(true)}
        onOpenTemplates={() => setIsTemplatesOpen(true)}
        onOpenTaskExport={() => setIsTaskExportOpen(true)}
      />
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        
        <div className="flex flex-col flex-1 relative bg-slate-50 dark:bg-slate-900">
          {activeProjectId ? (
            <>
              <PresenceBar />
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

      <AnimatePresence>
        {isMonitoringOpen && (
          <MonitoringDashboard onClose={() => setIsMonitoringOpen(false)} />
        )}
        {isSnapshotsOpen && (
          <SnapshotsPanel onClose={() => setIsSnapshotsOpen(false)} />
        )}
        {isCommentsOpen && (
          <CommentsPanel onClose={() => setIsCommentsOpen(false)} />
        )}
        {isTemplatesOpen && (
          <TemplateGallery onClose={() => setIsTemplatesOpen(false)} />
        )}
        {isTaskExportOpen && (
          <TaskExportModal onClose={() => setIsTaskExportOpen(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
