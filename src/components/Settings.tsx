import { X, Cloud, HardDrive, Key, LogIn, LogOut, Shield, Users, Zap, Sparkles, Image as ImageIcon, Plus, Trash2, Globe, ExternalLink, Settings as SettingsIcon, RefreshCw, Maximize2 } from 'lucide-react';
import { useGraphStore } from '../store/graphStore';
import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

interface SettingsProps {
  onClose: () => void;
}

export default function Settings({ onClose }: SettingsProps) {
  const { 
    cloudMode, 
    setCloudMode, 
    devMode,
    setDevMode,
    autoSync,
    setAutoSync,
    autoResize,
    setAutoResize,
    selectedModel,
    setSelectedModel,
    apiKeys, 
    setApiKey, 
    user, 
    login, 
    signOut,
    isAuthReady,
    issueManagementConfigs,
    addIssueManagementConfig,
    removeIssueManagementConfig,
    updateIssueManagementConfig,
    isOnline,
    aiEnabled,
    setAiEnabled
  } = useGraphStore();

  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [newConfigName, setNewConfigName] = useState('');
  const [newConfigUrl, setNewConfigUrl] = useState('');
  const [newConfigPat, setNewConfigPat] = useState('');
  const [newConfigProvider, setNewConfigProvider] = useState<'Jira' | 'ADO' | 'ServiceNow'>('Jira');
  const [newConfigInstanceType, setNewConfigInstanceType] = useState('');

  const handleAddConfig = () => {
    if (!newConfigName || !newConfigUrl || !newConfigPat || !newConfigInstanceType) return;
    addIssueManagementConfig({
      name: newConfigName,
      url: newConfigUrl,
      pat: newConfigPat,
      provider: newConfigProvider,
      instanceType: newConfigInstanceType
    });
    setNewConfigName('');
    setNewConfigUrl('');
    setNewConfigPat('');
    setNewConfigInstanceType('');
  };

  const models = [
    { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', description: 'Fast & efficient for most tasks', icon: Zap },
    { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', description: 'Advanced reasoning & complex flows', icon: Sparkles },
    { id: 'gemini-2.5-flash-image', name: 'Gemini 2.5 Flash Image', description: 'Visual analysis & generation', icon: ImageIcon },
  ];

  const handleCloudModeToggle = async () => {
    if (cloudMode) {
      setCloudMode(false);
      return;
    }

    if (!user) {
      setIsLoggingIn(true);
      try {
        await login();
        // After login, cloud mode will be enabled by the effect or we can do it here
        setCloudMode(true);
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoggingIn(false);
      }
    } else {
      setCloudMode(true);
    }
  };

  const [openaiKey, setOpenaiKey] = useState(apiKeys.openai || '');
  const [anthropicKey, setAnthropicKey] = useState(apiKeys.anthropic || '');

  const handleSaveKeys = () => {
    setApiKey('openai', openaiKey);
    setApiKey('anthropic', anthropicKey);
    alert('API keys saved locally.');
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center">
              <Key className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Settings</h2>
              <p className="text-sm text-slate-400">Manage your preferences and integrations.</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {/* Storage Mode */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Shield className="w-4 h-4" /> Storage & Collaboration
              </h3>
              {!isOnline && (
                <div className="flex items-center gap-2 px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded text-[10px] font-bold text-amber-500 uppercase">
                  Offline
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setCloudMode(false)}
                className={`flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                  !cloudMode 
                    ? 'border-indigo-500 bg-indigo-500/10 text-white' 
                    : 'border-slate-800 bg-slate-800/50 text-slate-400 hover:border-slate-700'
                }`}
              >
                <HardDrive className={`w-8 h-8 ${!cloudMode ? 'text-indigo-400' : 'text-slate-500'}`} />
                <div className="text-center">
                  <div className="font-bold">Local Mode</div>
                  <div className="text-xs opacity-60">Browser storage only</div>
                </div>
              </button>

              <button
                onClick={handleCloudModeToggle}
                disabled={isLoggingIn || !isOnline}
                className={`flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                  cloudMode && !devMode
                    ? 'border-emerald-500 bg-emerald-500/10 text-white' 
                    : 'border-slate-800 bg-slate-800/50 text-slate-400 hover:border-slate-700'
                } ${isLoggingIn || !isOnline ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Cloud className={`w-8 h-8 ${cloudMode && !devMode ? 'text-emerald-400' : 'text-slate-500'} ${isLoggingIn ? 'animate-pulse' : ''}`} />
                <div className="text-center">
                  <div className="font-bold">
                    {!isOnline ? 'Offline' : (isLoggingIn ? 'Signing In...' : (cloudMode && devMode ? 'Cloud Paused' : 'Cloud Mode'))}
                  </div>
                  <div className="text-xs opacity-60">
                    {isOnline ? (devMode ? 'Paused by Dev Mode' : 'Shared DB & Collaboration') : 'Requires internet'}
                  </div>
                </div>
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-4">
              <div className="flex items-center justify-between p-4 bg-slate-800/50 border border-slate-700 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${devMode ? 'bg-amber-500/20' : 'bg-slate-700'}`}>
                    <Zap className={`w-5 h-5 ${devMode ? 'text-amber-400' : 'text-slate-400'}`} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">Developer Mode</div>
                    <div className="text-xs text-slate-400">Store projects locally, only sync structural changes</div>
                  </div>
                </div>
                <button
                  onClick={() => setDevMode(!devMode)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                    devMode ? 'bg-amber-500' : 'bg-slate-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      devMode ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-800/50 border border-slate-700 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${autoSync ? 'bg-emerald-500/20' : 'bg-slate-700'}`}>
                    <RefreshCw className={`w-5 h-5 ${autoSync ? 'text-emerald-400' : 'text-slate-400'}`} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">Auto Sync</div>
                    <div className="text-xs text-slate-400">Automatically sync changes to the cloud (when Cloud Mode is on)</div>
                  </div>
                </div>
                <button
                  onClick={() => setAutoSync(!autoSync)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                    autoSync ? 'bg-emerald-500' : 'bg-slate-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      autoSync ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-800/50 border border-slate-700 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${autoResize ? 'bg-indigo-500/20' : 'bg-slate-700'}`}>
                    <Maximize2 className={`w-5 h-5 ${autoResize ? 'text-indigo-400' : 'text-slate-400'}`} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">Auto-Resize Parent</div>
                    <div className="text-xs text-slate-400">Automatically resize parent nodes when children move</div>
                  </div>
                </div>
                <button
                  onClick={() => setAutoResize(!autoResize)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                    autoResize ? 'bg-indigo-500' : 'bg-slate-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      autoResize ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-800/50 border border-slate-700 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${aiEnabled ? 'bg-emerald-500/20' : 'bg-slate-700'}`}>
                    <Sparkles className={`w-5 h-5 ${aiEnabled ? 'text-emerald-400' : 'text-slate-400'}`} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">AI Features</div>
                    <div className="text-xs text-slate-400">Enable AI-powered generation and optimization</div>
                  </div>
                </div>
                <button
                  onClick={() => setAiEnabled(!aiEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${
                    aiEnabled ? 'bg-emerald-500' : 'bg-slate-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      aiEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-800/50 border border-slate-700 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-indigo-500/20">
                    <HardDrive className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">Export Format</div>
                    <div className="text-xs text-slate-400">Default format for project exports</div>
                  </div>
                </div>
                <div className="flex items-center bg-slate-900 rounded-lg p-1 border border-slate-700">
                  <button
                    onClick={() => useGraphStore().setExportFormat('json')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${
                      useGraphStore().exportFormat === 'json' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    JSON
                  </button>
                  <button
                    onClick={() => useGraphStore().setExportFormat('xml')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${
                      useGraphStore().exportFormat === 'xml' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    XML
                  </button>
                </div>
              </div>
            </div>

            {!user && !isLoggingIn && isOnline && (
              <div className="mt-4 p-4 bg-amber-900/20 border border-amber-900/30 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3 text-amber-200 text-sm">
                  <LogIn className="w-5 h-5" />
                  <span>Sign in with Google to enable Cloud Mode and Collaboration.</span>
                </div>
                <button
                  onClick={login}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-bold transition-all"
                >
                  Sign In
                </button>
              </div>
            )}

            {!isOnline && cloudMode && (
              <div className="mt-4 p-4 bg-amber-900/20 border border-amber-500/30 rounded-xl flex items-center gap-3 text-amber-200 text-sm">
                <Zap className="w-5 h-5 text-amber-500" />
                <span>You are offline. Changes will be saved locally and synced to the cloud once you're back online.</span>
              </div>
            )}

            {user && (
              <div className="mt-4 p-4 bg-slate-800 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img src={user.photoURL || ''} alt="" className="w-10 h-10 rounded-full border border-slate-700" />
                  <div>
                    <div className="text-sm font-bold text-white">{user.displayName}</div>
                    <div className="text-xs text-slate-400">{user.email}</div>
                  </div>
                </div>
                <button
                  onClick={signOut}
                  className="px-4 py-2 text-slate-400 hover:text-red-400 text-sm font-bold transition-all flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </div>
            )}
          </section>

          {/* Issue Management Integration */}
          <section>
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <SettingsIcon className="w-4 h-4" /> Issue Management Integration
            </h3>
            
            <div className="space-y-4">
              {issueManagementConfigs.map((config) => (
                <div key={config.id} className="p-4 bg-slate-800/50 border border-slate-700 rounded-xl relative group">
                  <button
                    onClick={() => removeIssueManagementConfig(config.id)}
                    className="absolute top-2 right-2 p-1.5 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 bg-indigo-600 rounded flex items-center justify-center text-white font-bold text-[10px]">
                      {config.provider[0]}
                    </div>
                    <div className="text-sm font-bold text-white">{config.name}</div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Provider / Type</label>
                      <div className="text-sm font-bold text-indigo-400">{config.provider} / {config.instanceType}</div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">URL</label>
                      <div className="text-sm text-slate-300 truncate">{config.url}</div>
                    </div>
                  </div>
                </div>
              ))}

              <div className="p-4 border-2 border-dashed border-slate-700 rounded-xl space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Integration Name</label>
                  <input
                    type="text"
                    value={newConfigName}
                    onChange={(e) => setNewConfigName(e.target.value)}
                    placeholder="e.g. Production Jira"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Provider</label>
                    <select
                      value={newConfigProvider}
                      onChange={(e) => setNewConfigProvider(e.target.value as any)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="Jira">Jira</option>
                      <option value="ADO">Azure DevOps</option>
                      <option value="ServiceNow">ServiceNow</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Instance Type</label>
                    <input
                      type="text"
                      value={newConfigInstanceType}
                      onChange={(e) => setNewConfigInstanceType(e.target.value)}
                      placeholder="e.g. HREGRC"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">URL</label>
                  <input
                    type="url"
                    value={newConfigUrl}
                    onChange={(e) => setNewConfigUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Personal Access Token (PAT)</label>
                  <input
                    type="password"
                    value={newConfigPat}
                    onChange={(e) => setNewConfigPat(e.target.value)}
                    placeholder="Your PAT"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <button
                  onClick={handleAddConfig}
                  disabled={!newConfigName || !newConfigUrl || !newConfigPat || !newConfigInstanceType}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Add Configuration
                </button>
              </div>
            </div>
          </section>

          {/* AI Model Selection */}
          {aiEnabled && (
            <section>
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> AI Model Selection
              </h3>
              <div className="space-y-3">
                {models.map((model) => (
                  <button
                    key={model.id}
                    onClick={() => setSelectedModel(model.id)}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${
                      selectedModel === model.id 
                        ? 'border-indigo-500 bg-indigo-500/10 text-white' 
                        : 'border-slate-800 bg-slate-800/50 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      selectedModel === model.id ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-500'
                    }`}>
                      <model.icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-sm">{model.name}</div>
                      <div className="text-xs opacity-60">{model.description}</div>
                    </div>
                    {selectedModel === model.id && (
                      <div className="w-2 h-2 bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
                    )}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* AI Models */}
          {aiEnabled && (
            <section>
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Key className="w-4 h-4" /> External AI Models
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">OpenAI API Key (GPT-4o)</label>
                  <input
                    type="password"
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Anthropic API Key (Claude 3.5)</label>
                  <input
                    type="password"
                    value={anthropicKey}
                    onChange={(e) => setAnthropicKey(e.target.value)}
                    placeholder="x-..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                </div>
                <button
                  onClick={handleSaveKeys}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-900/20 transition-all"
                >
                  Save API Keys
                </button>
              </div>
            </section>
          )}

          {/* Collaboration Info */}
          {cloudMode && (
            <section className="p-4 bg-emerald-900/20 border border-emerald-900/30 rounded-xl">
              <h3 className="text-sm font-bold text-emerald-400 mb-2 flex items-center gap-2">
                <Users className="w-4 h-4" /> Real-time Collaboration Active
              </h3>
              <p className="text-xs text-emerald-200/70 leading-relaxed">
                You are currently in Cloud Mode. Your changes are being synced to the shared database in real-time. 
                Other members of this project will see your updates instantly.
              </p>
            </section>
          )}
        </div>

        <div className="p-6 bg-slate-950/50 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-bold transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
