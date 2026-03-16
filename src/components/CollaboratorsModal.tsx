import React, { useState } from 'react';
import { X, UserPlus, Trash2, Shield, Copy } from 'lucide-react';
import { Project } from '../models/types';
import { useGraphStore } from '../store/graphStore';
import { storageService } from '../services/storageService';

export default function CollaboratorsModal({ project, onClose }: { project: Project; onClose: () => void }) {
  const { user, cloudMode } = useGraphStore();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'reader' | 'editor'>('reader');
  const [isPublic, setIsPublic] = useState(!!project.publicAccess);
  const [copied, setCopied] = useState(false);

  const isOwner = user?.uid === project.ownerId;
  const projectUrl = `${window.location.origin}/project/${project.id}`;

  const handleTogglePublic = async () => {
    const newPublicAccess = !isPublic;
    setIsPublic(newPublicAccess);
    const updatedProject = { ...project, publicAccess: newPublicAccess };
    await storageService.saveProject(updatedProject, cloudMode);
    useGraphStore.getState().loadProjects();
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(projectUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInvite = async () => {
    if (!email) return;
    // In a real app, we'd need a way to look up user by email.
    // For now, assume we can invite by email and it maps to a userId.
    // This is a placeholder for the actual invite logic.
    console.log(`Inviting ${email} as ${role}`);
    // await storageService.inviteCollaborator(project.id, email, role);
    setEmail('');
  };

  const handleRemove = async (userId: string) => {
    // await storageService.removeCollaborator(project.id, userId);
  };

  const handleTransferOwnership = async (userId: string) => {
    // await storageService.transferOwnership(project.id, userId);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-xl w-96">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Collaborators</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        {isOwner && (
          <div className="mb-4 space-y-2">
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
              <input type="checkbox" checked={isPublic} onChange={handleTogglePublic} />
              Public access (anyone with the link can read)
            </label>
            {isPublic && (
              <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 p-2 rounded-md">
                <input type="text" readOnly value={projectUrl} className="flex-1 bg-transparent text-xs text-slate-600 dark:text-slate-400 truncate" />
                <button onClick={handleCopyLink} className="text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400">
                  <Copy className="w-4 h-4" />
                </button>
                {copied && <span className="text-xs text-emerald-600">Copied!</span>}
              </div>
            )}
          </div>
        )}

        {isOwner && (
          <div className="flex gap-2 mb-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="flex-1 px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-md"
            />
            <select value={role} onChange={(e) => setRole(e.target.value as any)} className="text-sm border border-slate-300 dark:border-slate-700 rounded-md">
              <option value="reader">Reader</option>
              <option value="editor">Editor</option>
            </select>
            <button onClick={handleInvite} className="p-2 bg-indigo-600 text-white rounded-md">
              <UserPlus className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="space-y-2">
          {Object.entries(project.collaborators || {}).map(([userId, role]) => (
            <div key={userId} className="flex items-center justify-between p-2 bg-slate-100 dark:bg-slate-700 rounded-md">
              <span className="text-sm text-slate-700 dark:text-slate-300">{userId === project.ownerId ? 'Owner' : userId} ({role})</span>
              {isOwner && userId !== project.ownerId && (
                <div className="flex gap-2">
                  <button onClick={() => handleTransferOwnership(userId)} className="text-indigo-600 dark:text-indigo-400" title="Transfer Ownership">
                    <Shield className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleRemove(userId)} className="text-red-600 dark:text-red-400" title="Remove">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
