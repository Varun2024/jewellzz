import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';
import './styles/tokens.css';
import { UiPreview } from './features/dev/UiPreview';
import { Toaster } from '@/components/ui';

// Ctrl+Alt+U toggles between the app and the v2 primitives preview. Delete
// once every screen has migrated and the preview file is gone.
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.altKey && (e.key === 'u' || e.key === 'U')) {
    e.preventDefault();
    window.location.hash = window.location.hash === '#ui-preview' ? '' : '#ui-preview';
    window.location.reload();
  }
});

const isPreview = window.location.hash === '#ui-preview';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isPreview ? <UiPreview /> : <App />}
    <Toaster />
  </React.StrictMode>,
);
