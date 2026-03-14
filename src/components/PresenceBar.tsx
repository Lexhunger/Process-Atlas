import React from 'react';
import { useGraphStore } from '../store/graphStore';

export default function PresenceBar() {
  const { presence, user, cloudMode } = useGraphStore();

  if (!cloudMode) return null;

  const activeUsers = Object.entries(presence).filter(([id]) => id !== user?.uid);

  return (
    <div className="flex items-center gap-1 px-4 py-1.5 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700">
      <div className="flex -space-x-2 mr-3">
        {user && (
          <div className="relative group">
            <img
              src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName || 'Me'}&background=random`}
              alt="Me"
              className="w-7 h-7 rounded-full border-2 border-white dark:border-slate-900 object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full" />
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-slate-900 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
              You ({user.displayName})
            </div>
          </div>
        )}
        {activeUsers.map(([id, data]) => (
          <div key={id} className="relative group">
            <img
              src={data.photoUrl || `https://ui-avatars.com/api/?name=${data.name}&background=random`}
              alt={data.name}
              className="w-7 h-7 rounded-full border-2 border-white dark:border-slate-900 object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-slate-900 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
              {data.name}
            </div>
          </div>
        ))}
      </div>
      <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
        {activeUsers.length > 0 ? `${activeUsers.length + 1} active now` : 'Only you here'}
      </span>
    </div>
  );
}
