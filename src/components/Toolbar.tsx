import { useGraphStore } from '../store/graphStore';
import { 
  Search, Download, Upload, Moon, Sun, Combine, Ungroup, Undo2, Redo2, 
  Wand2, Layout, BarChart3, Sparkles, Play, Square, FastForward, X, 
  ChevronDown, MonitorPlay, FileText, Image as ImageIcon, Zap, Tags, Settings as SettingsIcon,
  Github, LogIn, Activity, LogOut, User, Cloud, History, MessageSquare, Layout as LayoutIcon, Share2, RefreshCw, Network
} from 'lucide-react';
import { useRef, useEffect, useState } from 'react';
import Dashboard from './Dashboard';
import Settings from './Settings';
import { toPng } from 'html-to-image';

export default function Toolbar({ 
  onOpenMonitoring,
  onOpenSnapshots,
  onOpenComments,
  onOpenTemplates,
  onOpenTaskExport
}: { 
  onOpenMonitoring?: () => void;
  onOpenSnapshots?: () => void;
  onOpenComments?: () => void;
  onOpenTemplates?: () => void;
  onOpenTaskExport?: () => void;
}) {
  const { 
    searchQuery, 
    setSearchQuery, 
    exportProject, 
    importProject, 
    darkMode, 
    toggleDarkMode, 
    groupNodes, 
    ungroupNodes, 
    nodes,
    undo,
    redo,
    canUndo,
    canRedo,
    tidyUp,
    generateAIProcess,
    isSimulating,
    isPresentationMode,
    setPresentationMode,
    startSimulation,
    stopSimulation,
    stepSimulation,
    generateManual,
    autoTagNodes,
    analyzeGitHubRepo,
    activeGraphId,
    githubToken,
    setGithubToken,
    user,
    login,
    signOut,
    cloudMode,
    setCloudMode,
    devMode,
    autoSync,
    isOnline,
    exportFormat,
    setExportFormat,
    aiEnabled
  } = useGraphStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toolsRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isGitHubModalOpen, setIsGitHubModalOpen] = useState(false);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [githubRepos, setGithubRepos] = useState<any[]>([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [importMode, setImportMode] = useState<'new' | 'current'>('new');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isOptimizeModalOpen, setIsOptimizeModalOpen] = useState(false);
  const [optimizePrompt, setOptimizePrompt] = useState('');
  const [isSavingToCloud, setIsSavingToCloud] = useState(false);
  const [hasSavedToCloud, setHasSavedToCloud] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAIGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setIsGenerating(true);
    try {
      await generateAIProcess(aiPrompt);
      setIsAIModalOpen(false);
      setAiPrompt('');
    } catch (error) {
      console.error(error);
      alert("Failed to generate process. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          if (canRedo()) redo();
        } else {
          if (canUndo()) undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        if (canRedo()) redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, canUndo, canRedo]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (toolsRef.current && !toolsRef.current.contains(event.target as Node)) {
        setIsToolsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedNodes = nodes.filter(n => n.selected);
  const canGroup = selectedNodes.length >= 2 && selectedNodes.every(n => !n.parentId);
  const canUngroup = selectedNodes.length > 0 && selectedNodes.some(n => n.type === 'groupNode');

  const handleExport = async () => {
    const data = await exportProject(exportFormat);
    if (data) {
      const mimeType = exportFormat === 'json' ? 'application/json' : 'application/xml';
      const blob = new Blob([data], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `process-atlas-export-${new Date().toISOString().split('T')[0]}.${exportFormat}`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const data = event.target?.result as string;
        if (data) {
          try {
            await importProject(data);
          } catch (error) {
            console.error(error);
            alert("Failed to import project. Please check if the file format is valid.");
          }
        }
      };
      reader.readAsText(file);
    }
  };

  const handleExportImage = async () => {
    const flowElement = document.querySelector('.react-flow__viewport') as HTMLElement;
    if (!flowElement) return;

    try {
      const dataUrl = await toPng(flowElement, {
        backgroundColor: darkMode ? '#0f172a' : '#f8fafc',
        quality: 1,
        pixelRatio: 2,
      });
      
      const link = document.createElement('a');
      link.download = `process-atlas-${new Date().toISOString().split('T')[0]}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to export image', err);
    }
  };

  const handleGenerateManual = () => {
    const md = generateManual();
    if (md) {
      const blob = new Blob([md], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `process-manual-${new Date().toISOString().split('T')[0]}.md`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleAIOptimize = async () => {
    if (!optimizePrompt.trim()) return;
    setIsGenerating(true);
    try {
      // Re-use generateAIProcess but with a specific optimization context
      await generateAIProcess(`OPTIMIZE THIS PROCESS: ${optimizePrompt}`);
      setIsOptimizeModalOpen(false);
      setOptimizePrompt('');
    } catch (error) {
      console.error(error);
      alert("Failed to optimize process. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGitHubImport = async () => {
    if (!githubUrl.trim()) return;
    setIsGenerating(true);
    try {
      await analyzeGitHubRepo(githubUrl, importMode);
      setIsGitHubModalOpen(false);
      setGithubUrl('');
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Failed to analyze GitHub repository. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleConnectGitHub = async () => {
    try {
      const response = await fetch('/api/auth/github/url');
      if (!response.ok) {
        throw new Error('Failed to get auth URL');
      }
      const { url } = await response.json();

      const authWindow = window.open(
        url,
        'github_oauth',
        'width=600,height=700'
      );

      if (!authWindow) {
        alert('Please allow popups for this site to connect your GitHub account.');
      }
    } catch (error) {
      console.error('GitHub OAuth error:', error);
      alert('Failed to initiate GitHub connection.');
    }
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) {
        return;
      }
      if (event.data?.type === 'GITHUB_AUTH_SUCCESS') {
        setGithubToken(event.data.token);
      }
    };
    
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'atlas_github_token' && e.newValue) {
        setGithubToken(e.newValue);
      }
    };

    window.addEventListener('message', handleMessage);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('storage', handleStorage);
    };
  }, [setGithubToken]);

  useEffect(() => {
    if (isGitHubModalOpen && githubToken) {
      const fetchRepos = async () => {
        setIsLoadingRepos(true);
        try {
          const res = await fetch('https://api.github.com/user/repos?sort=updated&per_page=100', {
            headers: {
              'Authorization': `token ${githubToken}`,
              'Accept': 'application/vnd.github.v3+json'
            }
          });
          if (res.ok) {
            const data = await res.json();
            setGithubRepos(data);
            if (data.length > 0 && !githubUrl) {
              setGithubUrl(data[0].html_url);
            }
          } else if (res.status === 401) {
            setGithubToken(null);
          }
        } catch (err) {
          console.error('Failed to fetch repos', err);
        } finally {
          setIsLoadingRepos(false);
        }
      };
      fetchRepos();
    }
  }, [isGitHubModalOpen, githubToken]);

  return (
    <div className="flex items-center justify-between h-14 px-6 bg-slate-900 text-white shadow-md z-20 relative">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center shadow-inner">
          <Network className="w-5 h-5 text-white" />
        </div>
        <h1 className="text-lg font-bold tracking-tight">Process Atlas</h1>
      </div>

      <div className="flex items-center gap-6">
        {!isOnline && (
          <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full">
            <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Offline Mode</span>
          </div>
        )}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search nodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-64 pl-9 pr-4 py-1.5 bg-slate-800 border border-slate-700 rounded-full text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          />
        </div>

        <div className="flex items-center gap-2 border-l border-slate-700 pl-6">
          <div className="flex items-center gap-1 mr-4">
            <button
              onClick={undo}
              disabled={!canUndo()}
              className={`p-2 rounded-md transition-colors ${
                canUndo() 
                  ? 'text-slate-300 hover:text-white hover:bg-slate-800' 
                  : 'text-slate-600 cursor-not-allowed'
              }`}
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              onClick={redo}
              disabled={!canRedo()}
              className={`p-2 rounded-md transition-colors ${
                canRedo() 
                  ? 'text-slate-300 hover:text-white hover:bg-slate-800' 
                  : 'text-slate-600 cursor-not-allowed'
              }`}
              title="Redo (Ctrl+Y / Ctrl+Shift+Z)"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>

          <div className="w-px h-6 bg-slate-700 mx-2"></div>

          <div className="relative" ref={toolsRef}>
            <button
              onClick={() => setIsToolsOpen(!isToolsOpen)}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                isToolsOpen ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Wand2 className="w-4 h-4" />
              <span>Tools</span>
              <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isToolsOpen ? 'rotate-180' : ''}`} />
            </button>

            {isToolsOpen && (
              <div className="absolute top-full right-0 mt-2 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-[100]">
                <div className="p-2 space-y-1 max-h-[80vh] overflow-y-auto custom-scrollbar">
                  <button
                    onClick={() => {
                      onOpenTemplates?.();
                      setIsToolsOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 rounded-lg transition-colors group"
                  >
                    <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center group-hover:bg-slate-700 transition-colors">
                      <LayoutIcon className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col items-start">
                      <span>Template Library</span>
                      <span className="text-[10px] text-slate-500 font-normal">Start from pre-built map</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      onOpenSnapshots?.();
                      setIsToolsOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 rounded-lg transition-colors group"
                  >
                    <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center group-hover:bg-slate-700 transition-colors">
                      <History className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col items-start">
                      <span>Version History</span>
                      <span className="text-[10px] text-slate-500 font-normal">Snapshots & Reverts</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      onOpenComments?.();
                      setIsToolsOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 rounded-lg transition-colors group"
                  >
                    <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center group-hover:bg-slate-700 transition-colors">
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col items-start">
                      <span>Comments</span>
                      <span className="text-[10px] text-slate-500 font-normal">Collaborative feedback</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      onOpenTaskExport?.();
                      setIsToolsOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 rounded-lg transition-colors group"
                  >
                    <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center group-hover:bg-slate-700 transition-colors">
                      <Share2 className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col items-start">
                      <span>Task Export</span>
                      <span className="text-[10px] text-slate-500 font-normal">GitHub, Jira, Trello</span>
                    </div>
                  </button>

                  <div className="h-px bg-slate-800 my-1 mx-2"></div>
                  <div className="px-3 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Project</div>

                  <button
                    onClick={() => {
                      handleExport();
                      setIsToolsOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 rounded-lg transition-colors group"
                  >
                    <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center group-hover:bg-slate-700 transition-colors">
                      <Download className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col items-start">
                      <span>Export Project</span>
                      <span className="text-[10px] text-slate-500 font-normal">Save as {exportFormat.toUpperCase()}</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      fileInputRef.current?.click();
                      setIsToolsOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 rounded-lg transition-colors group"
                  >
                    <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center group-hover:bg-slate-700 transition-colors">
                      <Upload className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col items-start">
                      <span>Import Project</span>
                      <span className="text-[10px] text-slate-500 font-normal">Load from JSON/XML</span>
                    </div>
                  </button>

                  <div className="h-px bg-slate-800 my-1 mx-2"></div>
                  <div className="px-3 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-widest">{aiEnabled ? 'Layout & AI' : 'Layout'}</div>
                  
                  <button
                    onClick={() => {
                      tidyUp();
                      setIsToolsOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 rounded-lg transition-colors group"
                  >
                    <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center group-hover:bg-slate-700 transition-colors">
                      <Layout className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col items-start">
                      <span>Tidy Up</span>
                      <span className="text-[10px] text-slate-500 font-normal">Auto-layout hierarchy</span>
                    </div>
                  </button>

                  {aiEnabled && (
                    <>
                      <button
                        onClick={() => {
                          if (!isOnline) return;
                          setIsAIModalOpen(true);
                          setIsToolsOpen(false);
                        }}
                        disabled={!isOnline}
                        className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors group ${
                          isOnline ? 'text-emerald-400 hover:bg-emerald-900/20' : 'text-slate-600 cursor-not-allowed'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                          isOnline ? 'bg-emerald-500/10 group-hover:bg-emerald-500/20' : 'bg-slate-800'
                        }`}>
                          <Sparkles className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col items-start">
                          <span>AI Generate</span>
                          <span className="text-[10px] text-slate-500 font-normal">
                            {isOnline ? 'Build process with AI' : 'Requires internet'}
                          </span>
                        </div>
                      </button>

                      <button
                        onClick={() => {
                          if (!isOnline) return;
                          setIsOptimizeModalOpen(true);
                          setIsToolsOpen(false);
                        }}
                        disabled={!isOnline}
                        className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors group ${
                          isOnline ? 'text-amber-400 hover:bg-amber-900/20' : 'text-slate-600 cursor-not-allowed'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                          isOnline ? 'bg-amber-500/10 group-hover:bg-amber-500/20' : 'bg-slate-800'
                        }`}>
                          <Zap className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col items-start">
                          <span>AI Optimize</span>
                          <span className="text-[10px] text-slate-500 font-normal">
                            {isOnline ? 'Improve efficiency' : 'Requires internet'}
                          </span>
                        </div>
                      </button>

                      <button
                        onClick={() => {
                          if (!isOnline) return;
                          autoTagNodes();
                          setIsToolsOpen(false);
                        }}
                        disabled={!isOnline}
                        className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors group ${
                          isOnline ? 'text-indigo-400 hover:bg-indigo-900/20' : 'text-slate-600 cursor-not-allowed'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                          isOnline ? 'bg-indigo-500/10 group-hover:bg-indigo-500/20' : 'bg-slate-800'
                        }`}>
                          <Tags className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col items-start">
                          <span>AI Auto-Tag</span>
                          <span className="text-[10px] text-slate-500 font-normal">
                            {isOnline ? 'Categorize steps' : 'Requires internet'}
                          </span>
                        </div>
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => {
                      if (!isOnline) return;
                      setIsGitHubModalOpen(true);
                      setIsToolsOpen(false);
                    }}
                    disabled={!isOnline}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors group ${
                      isOnline ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 cursor-not-allowed'
                    }`}
                  >
                    <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center group-hover:bg-slate-700 transition-colors">
                      <Github className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col items-start">
                      <span>GitHub Import</span>
                      <span className="text-[10px] text-slate-500 font-normal">
                        {isOnline ? 'Map repo architecture' : 'Requires internet'}
                      </span>
                    </div>
                  </button>

                  <div className="h-px bg-slate-800 my-1 mx-2"></div>
                  <div className="px-3 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Simulation</div>

                  {!isSimulating ? (
                    <button
                      onClick={() => {
                        startSimulation();
                        setIsToolsOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-emerald-400 hover:bg-emerald-900/20 rounded-lg transition-colors group"
                    >
                      <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
                        <Play className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col items-start">
                        <span>Play Simulation</span>
                        <span className="text-[10px] text-slate-500 font-normal">Step through process</span>
                      </div>
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        stopSimulation();
                        setIsToolsOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-red-400 hover:bg-red-900/20 rounded-lg transition-colors group"
                    >
                      <div className="w-8 h-8 bg-red-500/10 rounded-lg flex items-center justify-center group-hover:bg-red-500/20 transition-colors">
                        <Square className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col items-start">
                        <span>Stop Simulation</span>
                        <span className="text-[10px] text-slate-500 font-normal">End current run</span>
                      </div>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setPresentationMode(!isPresentationMode);
                      setIsToolsOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors group ${
                      isPresentationMode ? 'text-indigo-400 bg-indigo-900/20' : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                      isPresentationMode ? 'bg-indigo-500/20' : 'bg-slate-800 group-hover:bg-slate-700'
                    }`}>
                      <MonitorPlay className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col items-start">
                      <span>Presentation Mode</span>
                      <span className="text-[10px] text-slate-500 font-normal">Auto-focus on active step</span>
                    </div>
                  </button>

                  <div className="h-px bg-slate-800 my-1 mx-2"></div>
                  <div className="px-3 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Documentation</div>

                  <button
                    onClick={() => {
                      handleGenerateManual();
                      setIsToolsOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 rounded-lg transition-colors group"
                  >
                    <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center group-hover:bg-slate-700 transition-colors">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col items-start">
                      <span>Generate Manual</span>
                      <span className="text-[10px] text-slate-500 font-normal">Export Markdown guide</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      handleExportImage();
                      setIsToolsOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 rounded-lg transition-colors group"
                  >
                    <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center group-hover:bg-slate-700 transition-colors">
                      <ImageIcon className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col items-start">
                      <span>Export as Image</span>
                      <span className="text-[10px] text-slate-500 font-normal">High-res PNG capture</span>
                    </div>
                  </button>

                  <div className="h-px bg-slate-800 my-1 mx-2"></div>
                  <div className="px-3 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Insights</div>

                  <button
                    onClick={() => {
                      setIsDashboardOpen(true);
                      setIsToolsOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 rounded-lg transition-colors group"
                  >
                    <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center group-hover:bg-slate-700 transition-colors">
                      <BarChart3 className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col items-start">
                      <span>Dashboard</span>
                      <span className="text-[10px] text-slate-500 font-normal">Analytics & Insights</span>
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>

          {isSimulating && (
            <>
              <div className="w-px h-6 bg-slate-700 mx-2"></div>
              <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1 mr-2">
                <button
                  onClick={stepSimulation}
                  className="p-1.5 text-emerald-400 hover:bg-slate-700 rounded transition-colors"
                  title="Next Step"
                >
                  <FastForward className="w-4 h-4" />
                </button>
                <button
                  onClick={stopSimulation}
                  className="p-1.5 text-red-400 hover:bg-slate-700 rounded transition-colors"
                  title="Stop Simulation"
                >
                  <Square className="w-4 h-4" />
                </button>
                <div className="px-2 text-[10px] font-bold text-emerald-500 uppercase tracking-widest animate-pulse">
                  Simulating
                </div>
              </div>
            </>
          )}

          {(canGroup || canUngroup) && (
            <>
              <div className="w-px h-6 bg-slate-700 mx-2"></div>
              {canGroup && (
                <button
                  onClick={groupNodes}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-indigo-300 hover:text-white hover:bg-indigo-900/50 rounded-md transition-colors"
                  title="Group Selected Nodes"
                >
                  <Combine className="w-4 h-4" /> Group
                </button>
              )}
              {canUngroup && (
                <button
                  onClick={ungroupNodes}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-indigo-300 hover:text-white hover:bg-indigo-900/50 rounded-md transition-colors"
                  title="Ungroup Selected Groups"
                >
                  <Ungroup className="w-4 h-4" /> Ungroup
                </button>
              )}
            </>
          )}
          
          <div className="w-px h-6 bg-slate-700 mx-2"></div>
          
          {!autoSync && cloudMode && !devMode && activeGraphId && (
            <button
              onClick={async () => {
                if (isSavingToCloud) return;
                setIsSavingToCloud(true);
                try {
                  const { storageService } = await import('../services/storageService');
                  const graph = useGraphStore.getState().graphs.find(g => g.id === activeGraphId);
                  if (graph) {
                    await storageService.syncProjectToCloud(graph.projectId);
                    setHasSavedToCloud(true);
                    setTimeout(() => setHasSavedToCloud(false), 2000);
                  }
                } catch (error) {
                  console.error("Failed to save to cloud", error);
                } finally {
                  setIsSavingToCloud(false);
                }
              }}
              disabled={isSavingToCloud}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors mr-2 ${
                hasSavedToCloud 
                  ? 'bg-emerald-600 text-white' 
                  : 'text-emerald-400 hover:text-white hover:bg-emerald-900/50'
              }`}
              title="Save changes to Cloud"
            >
              {isSavingToCloud ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : hasSavedToCloud ? (
                <Cloud className="w-4 h-4" />
              ) : (
                <Cloud className="w-4 h-4" />
              )}
              {isSavingToCloud ? 'Saving...' : hasSavedToCloud ? 'Saved!' : 'Save to Cloud'}
            </button>
          )}

          {/* User & Monitoring Dropdown */}
          <div className="relative" ref={userMenuRef}>
            {user ? (
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-2 pl-2 pr-1 py-1 hover:bg-slate-800 rounded-lg transition-all border border-transparent hover:border-slate-700"
              >
                <div className="flex flex-col items-end mr-1 hidden sm:flex">
                  <span className="text-[10px] font-bold text-white leading-none">{user.displayName?.split(' ')[0]}</span>
                  <span className={`text-[8px] font-bold leading-none mt-1 ${cloudMode ? 'text-emerald-400' : 'text-slate-500'}`}>
                    {cloudMode ? 'Cloud' : 'Local'}
                  </span>
                </div>
                <div className="relative">
                  <img 
                    src={user.photoURL || ''} 
                    alt="" 
                    className="w-7 h-7 rounded-full border border-slate-700" 
                  />
                  {cloudMode && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-slate-900 rounded-full shadow-sm" />
                  )}
                </div>
                <ChevronDown className={`w-3 h-3 text-slate-500 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
              </button>
            ) : (
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center justify-center p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
              >
                <User className="w-5 h-5" />
              </button>
            )}

            {/* Dropdown Menu */}
            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-2 z-[100] animate-in fade-in slide-in-from-top-2 duration-200">
                {user ? (
                  <div className="px-4 py-3 border-b border-slate-800 mb-2">
                    <div className="flex items-center gap-3">
                      <img src={user.photoURL || ''} alt="" className="w-10 h-10 rounded-full border border-slate-700" />
                      <div className="flex flex-col overflow-hidden">
                        <span className="text-sm font-bold text-white truncate">{user.displayName}</span>
                        <span className="text-xs text-slate-500 truncate">{user.email}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="px-4 py-3 border-b border-slate-800 mb-2">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-white">Not Signed In</span>
                      <span className="text-xs text-slate-500">Sign in to sync to cloud</span>
                    </div>
                  </div>
                )}

                {aiEnabled && (
                  <div className="px-2 space-y-1">
                    <button
                      onClick={() => {
                        onOpenMonitoring?.();
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      <Activity className="w-4 h-4 text-indigo-400" />
                      <div className="flex flex-col items-start">
                        <span>Usage Monitoring</span>
                        <span className="text-[10px] text-slate-500">Track AI costs & tokens</span>
                      </div>
                    </button>
                  </div>
                )}

                <div className="px-2 space-y-1 mt-1">
                  <button
                    onClick={() => {
                      if (!isOnline) return;
                      setCloudMode(!cloudMode);
                      setIsUserMenuOpen(false);
                    }}
                    disabled={!isOnline}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${
                      isOnline ? 'text-slate-300 hover:text-white hover:bg-slate-800' : 'text-slate-600 cursor-not-allowed'
                    }`}
                  >
                    <Cloud className={`w-4 h-4 ${cloudMode && !devMode ? 'text-emerald-400' : 'text-slate-500'}`} />
                    <div className="flex flex-col items-start">
                      <span>Cloud Sync</span>
                      <span className="text-[10px] text-slate-500">
                        {isOnline ? (cloudMode ? (devMode ? 'Paused (Dev Mode)' : (autoSync ? 'Syncing to Firestore' : 'Manual Sync Only')) : 'Local storage only') : 'Requires internet'}
                      </span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setIsSettingsOpen(true);
                      setIsUserMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    <SettingsIcon className="w-4 h-4 text-slate-400" />
                    <span>Settings</span>
                  </button>
                </div>

                <div className="mt-2 pt-2 border-t border-slate-800 px-2">
                  {user ? (
                    <button
                      onClick={() => {
                        signOut();
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  ) : (
                    <button
                      onClick={async () => {
                        await login();
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-indigo-400 hover:text-indigo-300 hover:bg-indigo-900/20 rounded-lg transition-colors"
                    >
                      <LogIn className="w-4 h-4" />
                      <span>Sign In</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="w-px h-6 bg-slate-700 mx-2"></div>

          <button
            onClick={toggleDarkMode}
            className="flex items-center justify-center p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors mr-2"
            title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImport}
            accept=".json,.xml"
            className="hidden"
          />
        </div>
      </div>

      {isAIModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">AI Process Generator</h2>
                  <p className="text-sm text-slate-400">Describe the process you want to map out.</p>
                </div>
              </div>
              <button 
                onClick={() => setIsAIModalOpen(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="e.g., A customer refund process starting from a request, through approval, and ending with payment."
                className="w-full h-32 bg-slate-800 border border-slate-700 rounded-xl p-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all resize-none"
                autoFocus
              />
              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  onClick={() => setIsAIModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAIGenerate}
                  disabled={isGenerating || !aiPrompt.trim()}
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-900/20 transition-all flex items-center gap-2"
                >
                  {isGenerating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" /> Generate Map
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isDashboardOpen && (
        <Dashboard onClose={() => setIsDashboardOpen(false)} />
      )}

      {isSettingsOpen && (
        <Settings onClose={() => setIsSettingsOpen(false)} />
      )}

      {isOptimizeModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center">
                  <Zap className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">AI Process Optimizer</h2>
                  <p className="text-sm text-slate-400">How should the AI improve this process?</p>
                </div>
              </div>
              <button 
                onClick={() => setIsOptimizeModalOpen(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <textarea
                value={optimizePrompt}
                onChange={(e) => setOptimizePrompt(e.target.value)}
                placeholder="e.g., Reduce the number of approval steps, or find ways to automate the data entry phase."
                className="w-full h-32 bg-slate-800 border border-slate-700 rounded-xl p-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all resize-none"
                autoFocus
              />
              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  onClick={() => setIsOptimizeModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAIOptimize}
                  disabled={isGenerating || !optimizePrompt.trim()}
                  className="px-6 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-amber-900/20 transition-all flex items-center gap-2"
                >
                  {isGenerating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Optimizing...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" /> Optimize Process
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isGitHubModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center">
                  <Github className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">GitHub Repository Import</h2>
                  <p className="text-sm text-slate-400">Map out the architecture of a repository.</p>
                </div>
              </div>
              <button 
                onClick={() => setIsGitHubModalOpen(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {githubToken ? (
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Select Repository</label>
                    {isLoadingRepos ? (
                      <div className="text-sm text-slate-400 py-2">Loading repositories...</div>
                    ) : (
                      <select
                        value={githubUrl}
                        onChange={(e) => setGithubUrl(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      >
                        <option value="">-- Select a repository --</option>
                        {githubRepos.map((repo: any) => (
                          <option key={repo.id} value={repo.html_url}>
                            {repo.full_name} {repo.private ? '(Private)' : ''}
                          </option>
                        ))}
                      </select>
                    )}
                    <div className="mt-3">
                      <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Or Enter URL Manually</label>
                      <input
                        type="text"
                        value={githubUrl}
                        onChange={(e) => setGithubUrl(e.target.value)}
                        placeholder="https://github.com/owner/repo"
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Repository URL</label>
                    <input
                      type="text"
                      value={githubUrl}
                      onChange={(e) => setGithubUrl(e.target.value)}
                      placeholder="https://github.com/owner/repo"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      autoFocus
                    />
                  </div>
                )}

                {activeGraphId && (
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Import Destination</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setImportMode('new')}
                        className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all ${
                          importMode === 'new' 
                            ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-900/20' 
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                        }`}
                      >
                        New Project
                      </button>
                      <button
                        onClick={() => setImportMode('current')}
                        className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all ${
                          importMode === 'current' 
                            ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-900/20' 
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                        }`}
                      >
                        Current Project
                      </button>
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">GitHub Connection</label>
                  {githubToken ? (
                    <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                        <span className="text-xs font-medium text-emerald-400">Connected to GitHub</span>
                      </div>
                      <button 
                        onClick={() => setGithubToken(null)}
                        className="text-[10px] font-bold text-slate-500 hover:text-slate-300 uppercase tracking-wider"
                      >
                        Disconnect
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleConnectGitHub}
                      className="w-full flex items-center justify-center gap-2 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all"
                    >
                      <Github className="w-4 h-4" />
                      Connect GitHub for Private Repos
                    </button>
                  )}
                </div>

                <p className="text-[10px] text-slate-500 leading-relaxed italic">
                  Note: This will fetch the root directory structure and use AI to generate a high-level architecture graph. {githubToken ? 'Private repositories are supported while connected.' : 'Currently supports public repositories only.'}
                </p>
              </div>
              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  onClick={() => setIsGitHubModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGitHubImport}
                  disabled={isGenerating || !githubUrl.trim()}
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-900/20 transition-all flex items-center gap-2"
                >
                  {isGenerating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Github className="w-4 h-4" /> Import & Map
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
