import React, { useState } from 'react';
import { useGraphStore } from '../store/graphStore';
import { History, Plus, Trash2, RotateCcw, X, Clock, User } from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

export const SnapshotsPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { snapshots, createSnapshot, restoreSnapshot, deleteSnapshot } = useGraphStore();
  const [newSnapshotName, setNewSnapshotName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!newSnapshotName.trim()) return;
    await createSnapshot(newSnapshotName);
    setNewSnapshotName('');
    setIsCreating(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 300 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 300 }}
      className="fixed right-0 top-0 bottom-0 w-80 bg-white shadow-2xl border-l border-slate-200 z-50 flex flex-col"
    >
      <div className="p-4 border-bottom border-slate-100 flex items-center justify-between bg-slate-50">
        <div className="flex items-center gap-2 font-semibold text-slate-800">
          <History className="w-5 h-5 text-indigo-600" />
          <span>Version History</span>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-full transition-colors">
          <X className="w-5 h-5 text-slate-500" />
        </button>
      </div>

      <div className="p-4 border-bottom border-slate-100">
        {!isCreating ? (
          <button
            onClick={() => setIsCreating(true)}
            className="w-full py-2 px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 font-medium shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Take Snapshot
          </button>
        ) : (
          <div className="space-y-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <input
              type="text"
              value={newSnapshotName}
              onChange={(e) => setNewSnapshotName(e.target.value)}
              placeholder="Snapshot name..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                className="flex-1 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
              >
                Save
              </button>
              <button
                onClick={() => setIsCreating(false)}
                className="flex-1 py-1.5 bg-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-300"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {snapshots.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Clock className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm">No snapshots yet.</p>
            <p className="text-xs mt-1">Save versions of your map to revert later.</p>
          </div>
        ) : (
          snapshots.map((snapshot) => (
            <div
              key={snapshot.id}
              className="group p-4 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all"
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-medium text-slate-900 leading-tight">{snapshot.name}</h3>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => {
                      if (confirm('Are you sure you want to restore this version? Current unsaved changes will be lost.')) {
                        restoreSnapshot(snapshot.id);
                      }
                    }}
                    title="Restore version"
                    className="p-1.5 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Delete this snapshot?')) {
                        deleteSnapshot(snapshot.id);
                      }
                    }}
                    title="Delete snapshot"
                    className="p-1.5 text-rose-600 hover:bg-rose-100 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div className="flex items-center gap-3 text-[10px] text-slate-500 font-medium uppercase tracking-wider">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {format(snapshot.timestamp, 'MMM d, HH:mm')}
                </div>
                <div className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {snapshot.createdBy === 'local-user' ? 'Local' : 'Member'}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
};
