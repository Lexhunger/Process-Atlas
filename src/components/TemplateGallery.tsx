import React from 'react';
import { useGraphStore } from '../store/graphStore';
import { Layout, Plus, X, Search, Info } from 'lucide-react';
import { motion } from 'motion/react';

export const TemplateGallery: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { templates, addNode, activeGraphId } = useGraphStore();
  const [searchQuery, setSearchQuery] = React.useState('');

  const filteredTemplates = templates.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.nodeType.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleApplyTemplate = (template: any) => {
    if (!activeGraphId) return;
    
    // addNode(position, type, templateId, shape, parentId)
    addNode({ x: 100, y: 100 }, 'customNode', template.id);
    
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
    >
      <div className="bg-white w-full max-w-4xl max-h-[80vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-white/20">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Layout className="w-6 h-6 text-indigo-600" />
              Template Library
            </h2>
            <p className="text-slate-500 text-sm mt-1">Start your process with pre-built structures</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X className="w-6 h-6 text-slate-500" />
          </button>
        </div>

        <div className="p-6 bg-white border-b border-slate-100">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {filteredTemplates.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-slate-300" />
              </div>
              <h3 className="text-lg font-medium text-slate-900">No templates found</h3>
              <p className="text-slate-500">Try adjusting your search query</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTemplates.map((template) => (
                <div
                  key={template.id}
                  className="group relative bg-white border border-slate-200 rounded-2xl p-5 hover:border-indigo-400 hover:shadow-xl hover:shadow-indigo-500/10 transition-all cursor-pointer flex flex-col"
                  onClick={() => handleApplyTemplate(template)}
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      {template.iconUrl ? (
                        <img src={template.iconUrl} alt="" className="w-8 h-8 object-contain" referrerPolicy="no-referrer" />
                      ) : (
                        <Layout className="w-6 h-6" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{template.name}</h3>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{template.nodeType}</span>
                    </div>
                  </div>
                  
                  <p className="text-sm text-slate-500 line-clamp-3 mb-6 flex-1">
                    {template.defaultDescription || 'No description provided for this template.'}
                  </p>

                  <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-50">
                    <div className="flex items-center gap-1 text-xs text-slate-400">
                      <Info className="w-3 h-3" />
                      <span>{template.metadataSchema.length} fields</span>
                    </div>
                    <button className="p-2 bg-indigo-50 text-indigo-600 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-all">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
