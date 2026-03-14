import { useGraphStore } from '../store/graphStore';
import { 
  Search, Download, Upload, Moon, Sun, Combine, Ungroup, Undo2, Redo2, 
  Wand2, Layout, BarChart3, Sparkles, Play, Square, FastForward, X, 
  ChevronDown, MonitorPlay, FileText, Image as ImageIcon, Zap, Tags
} from 'lucide-react';
import { useRef, useEffect, useState } from 'react';
import Dashboard from './Dashboard';
import { toPng } from 'html-to-image';

export default function Toolbar() {
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
    autoTagNodes
  } = useGraphStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toolsRef = useRef<HTMLDivElement>(null);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isOptimizeModalOpen, setIsOptimizeModalOpen] = useState(false);
  const [optimizePrompt, setOptimizePrompt] = useState('');

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

  const [exportFormat, setExportFormat] = useState<'json' | 'xml'>('json');

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

  return (
    <div className="flex items-center justify-between h-14 px-6 bg-slate-900 text-white shadow-md z-20 relative">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center shadow-inner">
          <span className="font-bold text-white text-lg">P</span>
        </div>
        <h1 className="text-lg font-bold tracking-tight">Process Atlas</h1>
      </div>

      <div className="flex items-center gap-6">
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
                  <div className="px-3 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Layout & AI</div>
                  
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

                  <button
                    onClick={() => {
                      setIsAIModalOpen(true);
                      setIsToolsOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-emerald-400 hover:bg-emerald-900/20 rounded-lg transition-colors group"
                  >
                    <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col items-start">
                      <span>AI Generate</span>
                      <span className="text-[10px] text-slate-500 font-normal">Build process with AI</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setIsOptimizeModalOpen(true);
                      setIsToolsOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-amber-400 hover:bg-amber-900/20 rounded-lg transition-colors group"
                  >
                    <div className="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col items-start">
                      <span>AI Optimize</span>
                      <span className="text-[10px] text-slate-500 font-normal">Improve efficiency</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      autoTagNodes();
                      setIsToolsOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-indigo-400 hover:bg-indigo-900/20 rounded-lg transition-colors group"
                  >
                    <div className="w-8 h-8 bg-indigo-500/10 rounded-lg flex items-center justify-center group-hover:bg-indigo-500/20 transition-colors">
                      <Tags className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col items-start">
                      <span>AI Auto-Tag</span>
                      <span className="text-[10px] text-slate-500 font-normal">Categorize steps</span>
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

          <button
            onClick={toggleDarkMode}
            className="flex items-center justify-center p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors mr-2"
            title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          
          <div className="flex items-center bg-slate-800 rounded-md p-1 mr-2">
            <button
              onClick={() => setExportFormat('json')}
              className={`px-2 py-0.5 text-[10px] font-bold rounded transition-colors ${
                exportFormat === 'json' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              JSON
            </button>
            <button
              onClick={() => setExportFormat('xml')}
              className={`px-2 py-0.5 text-[10px] font-bold rounded transition-colors ${
                exportFormat === 'xml' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              XML
            </button>
          </div>
          
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
            title={`Export Project as ${exportFormat.toUpperCase()}`}
          >
            <Download className="w-4 h-4" /> Export
          </button>
          
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
            title="Import Project (JSON or XML)"
          >
            <Upload className="w-4 h-4" /> Import
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
    </div>
  );
}
