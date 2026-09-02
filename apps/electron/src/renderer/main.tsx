// @ts-nocheck - ErrorBoundary override checks conflict with React types + noImplicitOverride
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/global.css';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: any }> {
  state = { error: null as any };
  static override getDerivedStateFromError(error: any) { return { error }; }
  override componentDidCatch(error: any, info: any) { console.error('Cluster render error', error, info); }
  override render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: 'monospace', color: '#fff', background: '#0a0a0d', minHeight: '100vh' }}>
          <h2 style={{ color: '#ef4444' }}>Cluster failed to render</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, background: '#111113', padding: 12, borderRadius: 8, border: '1px solid #232326' }}>{String(this.state.error?.message || this.state.error)}</pre>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11, color: '#71717a', marginTop: 8 }}>{String(this.state.error?.stack || '')}</pre>
          <button onClick={() => location.reload()} style={{ marginTop: 12, background: '#fff', color: '#000', padding: '6px 12px', borderRadius: 6, border: 0, fontSize: 12 }}>Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootEl = document.getElementById('root');
if (!rootEl) {
  document.body.innerHTML = '<div style="padding:24px;color:#ef4444;font-family:monospace">Root #root not found</div>';
  throw new Error('Root not found');
}

// Global error handlers to avoid black screen
window.addEventListener('error', (e) => console.error('window.error', e.error || e.message));
window.addEventListener('unhandledrejection', (e) => console.error('unhandledrejection', e.reason));

// Log preload bridge presence for debugging (shows in devtools)
console.log('[Cluster] preload bridge', typeof (window as any).cluster !== 'undefined' ? 'ok' : 'MISSING — running outside Electron?');

createRoot(rootEl).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
