import { useState } from 'react';
import { useGraphStore } from '../store/graphStore';
import { X, Plus, Trash2, Edit2, Save, Image as ImageIcon } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { Template } from '../models/types';
import IconPicker from './IconPicker';
import { icons } from '../utils/icons';

interface TemplateManagerProps {
  onClose: () => void;
}

export default function TemplateManager({ onClose }: TemplateManagerProps) {
  const { templates, saveTemplate, deleteTemplate } = useGraphStore();
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [showIconPicker, setShowIconPicker] = useState(false);

  const handleCreateNew = () => {
    setEditingTemplate({
      id: uuidv4(),
      name: 'New Template',
      description: 'A new template for your processes.',
      nodeType: 'Custom',
      metadataSchema: [],
      defaultLinks: [],
      defaultCodeSnippets: [],
      defaultDescription: '',
    });
  };

  const handleSave = async () => {
    if (editingTemplate) {
      await saveTemplate(editingTemplate);
      setEditingTemplate(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800">Template Manager</h2>
          <button onClick={onClose} className="p-2 text-slate-500 hover:bg-slate-200 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Template List */}
          <div className="w-1/3 border-r border-slate-200 bg-slate-50 flex flex-col">
            <div className="p-4 border-b border-slate-200">
              <button
                onClick={handleCreateNew}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
              >
                <Plus className="w-4 h-4" /> Create Template
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                    editingTemplate?.id === template.id
                      ? 'bg-indigo-100 text-indigo-900'
                      : 'hover:bg-slate-200 text-slate-700'
                  }`}
                  onClick={() => setEditingTemplate({ ...template })}
                >
                  <div>
                    <h3 className="font-medium text-sm">{template.name}</h3>
                    <p className="text-xs opacity-70">{template.nodeType}</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteTemplate(template.id);
                      if (editingTemplate?.id === template.id) setEditingTemplate(null);
                    }}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {templates.length === 0 && (
                <p className="text-sm text-slate-500 text-center p-4 italic">No templates found.</p>
              )}
            </div>
          </div>

          {/* Template Editor */}
          <div className="flex-1 bg-white flex flex-col">
            {editingTemplate ? (
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-slate-800">Edit Template</h3>
                  <button
                    onClick={handleSave}
                    className="flex items-center gap-2 py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
                  >
                    <Save className="w-4 h-4" /> Save Template
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Template Name</label>
                      <input
                        type="text"
                        value={editingTemplate.name}
                        onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                      <input
                        type="text"
                        value={editingTemplate.description}
                        onChange={(e) => setEditingTemplate({ ...editingTemplate, description: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Node Type</label>
                      <input
                        type="text"
                        value={editingTemplate.nodeType}
                        onChange={(e) => setEditingTemplate({ ...editingTemplate, nodeType: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Default Description</label>
                      <textarea
                        value={editingTemplate.defaultDescription}
                        onChange={(e) => setEditingTemplate({ ...editingTemplate, defaultDescription: e.target.value })}
                        rows={3}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Default Icon</label>
                      <div className="relative">
                        <button
                          onClick={() => setShowIconPicker(!showIconPicker)}
                          className="flex items-center justify-between w-full px-3 py-2 text-sm bg-white border border-slate-300 text-slate-900 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <div className="flex items-center gap-2">
                            {editingTemplate.iconUrl ? (
                              <img src={editingTemplate.iconUrl} alt="icon" className="w-4 h-4 object-contain" />
                            ) : editingTemplate.icon && icons[editingTemplate.icon as keyof typeof icons] ? (
                              (() => {
                                const IconComponent = icons[editingTemplate.icon as keyof typeof icons];
                                return <IconComponent className="w-4 h-4" />;
                              })()
                            ) : (
                              <ImageIcon className="w-4 h-4 text-slate-400" />
                            )}
                            <span>{editingTemplate.iconUrl ? 'Custom Icon' : editingTemplate.icon ? editingTemplate.icon : 'No Icon'}</span>
                          </div>
                        </button>
                        {showIconPicker && (
                          <div className="absolute top-full left-0 mt-1 z-50">
                            <IconPicker
                              currentIcon={editingTemplate.icon}
                              currentIconUrl={editingTemplate.iconUrl}
                              onSelectIcon={(icon) => setEditingTemplate({ ...editingTemplate, icon, iconUrl: undefined })}
                              onSelectIconUrl={(url) => setEditingTemplate({ ...editingTemplate, iconUrl: url, icon: undefined })}
                              onClose={() => setShowIconPicker(false)}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-slate-700">Metadata Schema (Keys)</label>
                        <button
                          onClick={() => setEditingTemplate({
                            ...editingTemplate,
                            metadataSchema: [...editingTemplate.metadataSchema, `field_${editingTemplate.metadataSchema.length + 1}`]
                          })}
                          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center"
                        >
                          <Plus className="w-3 h-3 mr-1" /> Add Key
                        </button>
                      </div>
                      <div className="space-y-2">
                        {editingTemplate.metadataSchema.map((key, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={key}
                              onChange={(e) => {
                                const newSchema = [...editingTemplate.metadataSchema];
                                newSchema[index] = e.target.value;
                                setEditingTemplate({ ...editingTemplate, metadataSchema: newSchema });
                              }}
                              className="flex-1 px-3 py-1.5 text-sm font-mono border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                            <button
                              onClick={() => {
                                const newSchema = [...editingTemplate.metadataSchema];
                                newSchema.splice(index, 1);
                                setEditingTemplate({ ...editingTemplate, metadataSchema: newSchema });
                              }}
                              className="p-1.5 text-slate-400 hover:text-red-600 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                        {editingTemplate.metadataSchema.length === 0 && (
                          <p className="text-xs text-slate-500 italic">No metadata fields defined.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <Edit2 className="w-12 h-12 mb-4 opacity-20" />
                <p>Select a template to edit or create a new one.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
