import React, { useState } from 'react';
import { useGraphStore } from '../store/graphStore';
import { MessageSquare, Send, Trash2, CheckCircle2, X, User, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

export const CommentsPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { comments, addComment, resolveComment, deleteComment, nodes, edges } = useGraphStore();
  const [newCommentText, setNewCommentText] = useState('');

  const handleAddComment = async () => {
    if (!newCommentText.trim()) return;
    // For general graph comments, we can use 'graph' as targetId
    await addComment('graph', newCommentText);
    setNewCommentText('');
  };

  const getTargetName = (targetId: string) => {
    if (targetId === 'graph') return 'General';
    const node = nodes.find(n => n.id === targetId);
    if (node) return `Node: ${node.data.title}`;
    const edge = edges.find(e => e.id === targetId);
    if (edge) return `Edge: ${edge.label || 'Relationship'}`;
    return 'Unknown';
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
          <MessageSquare className="w-5 h-5 text-emerald-600" />
          <span>Comments & Feedback</span>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-full transition-colors">
          <X className="w-5 h-5 text-slate-500" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {comments.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm">No comments yet.</p>
            <p className="text-xs mt-1">Start a discussion by adding a comment below.</p>
          </div>
        ) : (
          comments.map((comment) => (
            <div
              key={comment.id}
              className={`group relative space-y-2 ${comment.resolved ? 'opacity-60' : ''}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {comment.authorPhoto ? (
                    <img src={comment.authorPhoto} alt="" className="w-6 h-6 rounded-full" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center">
                      <User className="w-3 h-3 text-slate-500" />
                    </div>
                  )}
                  <span className="text-sm font-semibold text-slate-900">{comment.authorName}</span>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!comment.resolved && (
                    <button
                      onClick={() => resolveComment(comment.id)}
                      title="Resolve comment"
                      className="p-1 text-emerald-600 hover:bg-emerald-100 rounded transition-colors"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => deleteComment(comment.id)}
                    title="Delete comment"
                    className="p-1 text-rose-600 hover:bg-rose-100 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 relative">
                <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-tighter mb-1">
                  {getTargetName(comment.targetId)}
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">{comment.text}</p>
                {comment.resolved && (
                  <div className="absolute top-2 right-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                <Clock className="w-3 h-3" />
                {format(comment.timestamp, 'MMM d, HH:mm')}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-4 border-t border-slate-200 bg-white">
        <div className="relative">
          <textarea
            value={newCommentText}
            onChange={(e) => setNewCommentText(e.target.value)}
            placeholder="Add a comment..."
            className="w-full pl-3 pr-10 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm resize-none min-h-[80px]"
          />
          <button
            onClick={handleAddComment}
            disabled={!newCommentText.trim()}
            className="absolute bottom-3 right-3 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};
