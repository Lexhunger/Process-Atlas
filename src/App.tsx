/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import ProjectView from './pages/ProjectView';

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      const isFirebaseError = this.state.error?.message.includes('auth/invalid-api-key') || 
                              this.state.error?.message.includes('API key not valid');
      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
          <div className="bg-slate-800 p-8 rounded-2xl max-w-md w-full border border-slate-700 shadow-2xl">
            <h1 className="text-2xl font-bold text-red-400 mb-4">Application Error</h1>
            <p className="text-slate-300 mb-4">
              {isFirebaseError 
                ? "Firebase API key is missing or invalid. Please add VITE_FIREBASE_API_KEY to your AI Studio Secrets."
                : this.state.error?.message || "An unexpected error occurred."}
            </p>
            {isFirebaseError && (
              <div className="bg-slate-900 p-4 rounded-xl text-sm text-slate-400 font-mono mb-6">
                1. Open Settings (⚙️)<br/>
                2. Go to Secrets<br/>
                3. Add VITE_FIREBASE_API_KEY
              </div>
            )}
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-xl font-medium transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  // Check if API key is missing or is the dummy key
  const apiKey = process.env.VITE_FIREBASE_API_KEY || import.meta.env.VITE_FIREBASE_API_KEY;
  if (!apiKey || apiKey === "dummy-api-key-to-prevent-crash") {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 p-8 rounded-2xl max-w-md w-full border border-slate-700 shadow-2xl">
          <h1 className="text-2xl font-bold text-amber-400 mb-4">Firebase Setup Required</h1>
          <p className="text-slate-300 mb-4">
            The Firebase API key is missing. To enable cloud sync and authentication, please add your API key to AI Studio Secrets.
          </p>
          <div className="bg-slate-900 p-4 rounded-xl text-sm text-slate-400 font-mono mb-6">
            1. Open Settings (⚙️ in top right)<br/>
            2. Go to Secrets<br/>
            3. Add VITE_FIREBASE_API_KEY<br/>
            4. Paste your Firebase API key
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-xl font-medium transition-colors"
          >
            I've added the key, reload app
          </button>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <ProjectView />
    </ErrorBoundary>
  );
}
