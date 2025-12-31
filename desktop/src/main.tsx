import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Global error handlers for uncaught errors
window.addEventListener('error', (event) => {
  console.error('[Renderer] Uncaught error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Renderer] Unhandled rejection:', event.reason);
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
