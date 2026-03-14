import { useState, useMemo, useRef } from 'react';
import { Search, Image as ImageIcon, X, Upload, Smile } from 'lucide-react';
import { icons, IconName } from '../utils/icons';
import EmojiPicker, { Theme } from 'emoji-picker-react';

interface IconPickerProps {
  currentIcon?: string;
  currentIconUrl?: string;
  onSelectIcon: (iconName: string | undefined) => void;
  onSelectIconUrl: (url: string | undefined) => void;
  onClose: () => void;
}

export default function IconPicker({ currentIcon, currentIconUrl, onSelectIcon, onSelectIconUrl, onClose }: IconPickerProps) {
  const [activeTab, setActiveTab] = useState<'library' | 'emoji' | 'custom'>('library');
  const [searchQuery, setSearchQuery] = useState('');
  const [customUrl, setCustomUrl] = useState(currentIconUrl || '');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredIcons = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return Object.keys(icons).filter(name => name.toLowerCase().includes(query)) as IconName[];
  }, [searchQuery]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Url = event.target?.result as string;
      setCustomUrl(base64Url);
    };
    reader.readAsDataURL(file);
  };

  const handleEmojiClick = (emojiData: any) => {
    // We can store the emoji as a data URL SVG or just as a string if we supported it.
    // Since our system supports custom URLs, we can create a data URL containing the emoji as an SVG.
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">${emojiData.emoji}</text></svg>`;
    const dataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
    onSelectIcon(undefined);
    onSelectIconUrl(dataUrl);
    onClose();
  };

  return (
    <div className="absolute z-50 mt-2 w-72 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
      <div className="flex items-center justify-between p-3 border-b border-slate-200 dark:border-slate-700">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Select Icon</h3>
        <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex border-b border-slate-200 dark:border-slate-700">
        <button
          className={`flex-1 py-2 text-xs font-medium text-center ${activeTab === 'library' ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
          onClick={() => setActiveTab('library')}
        >
          Library
        </button>
        <button
          className={`flex-1 py-2 text-xs font-medium text-center ${activeTab === 'emoji' ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
          onClick={() => setActiveTab('emoji')}
        >
          Emoji
        </button>
        <button
          className={`flex-1 py-2 text-xs font-medium text-center ${activeTab === 'custom' ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
          onClick={() => setActiveTab('custom')}
        >
          Custom
        </button>
      </div>

      {activeTab === 'library' && (
        <div className="flex flex-col h-64">
          <div className="p-2 border-b border-slate-200 dark:border-slate-700">
            <div className="relative">
              <Search className="absolute left-2.5 top-2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search icons..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-100 dark:bg-slate-900 border-none rounded-md text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <div className="grid grid-cols-6 gap-1">
              {filteredIcons.map(name => {
                const IconComponent = icons[name];
                const isSelected = currentIcon === name && !currentIconUrl;
                return (
                  <button
                    key={name}
                    onClick={() => {
                      onSelectIconUrl(undefined);
                      onSelectIcon(name);
                      onClose();
                    }}
                    className={`p-2 flex items-center justify-center rounded-lg transition-colors ${isSelected ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                    title={name}
                  >
                    <IconComponent className="w-5 h-5" />
                  </button>
                );
              })}
            </div>
            {filteredIcons.length === 0 && (
              <div className="text-center py-8 text-sm text-slate-500 dark:text-slate-400">
                No icons found
              </div>
            )}
          </div>
          <div className="p-2 border-t border-slate-200 dark:border-slate-700">
            <button
              onClick={() => {
                onSelectIcon(undefined);
                onClose();
              }}
              className="w-full py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
            >
              Remove Icon
            </button>
          </div>
        </div>
      )}

      {activeTab === 'emoji' && (
        <div className="h-64 overflow-hidden">
          <EmojiPicker 
            onEmojiClick={handleEmojiClick} 
            width="100%" 
            height="100%" 
            theme={Theme.AUTO}
            searchDisabled={false}
            skinTonesDisabled
            previewConfig={{ showPreview: false }}
          />
        </div>
      )}

      {activeTab === 'custom' && (
        <div className="p-4 flex flex-col gap-4 h-64">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Image URL or Upload</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="https://example.com/icon.svg"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileUpload}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg border border-slate-300 dark:border-slate-600 transition-colors"
                title="Upload Image"
              >
                <Upload className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <div className="flex-1 flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/50 overflow-hidden">
            {customUrl ? (
              <img src={customUrl} alt="Preview" className="max-w-full max-h-full object-contain p-2" onError={(e) => (e.currentTarget.style.display = 'none')} onLoad={(e) => (e.currentTarget.style.display = 'block')} />
            ) : (
              <div className="text-center text-slate-400 dark:text-slate-500">
                <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <span className="text-xs">Preview</span>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                onSelectIconUrl(undefined);
                setCustomUrl('');
              }}
              className="flex-1 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              Clear
            </button>
            <button
              onClick={() => {
                if (customUrl) {
                  onSelectIcon(undefined);
                  onSelectIconUrl(customUrl);
                }
                onClose();
              }}
              disabled={!customUrl}
              className="flex-1 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
