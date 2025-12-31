import { useEffect } from 'react';
import { useDebateStore } from './stores/debate-store';
import { useLoginStore } from './stores/login-store';
import { useBrowserStore } from './stores/browser-store';
import { MainLayout } from './layouts/MainLayout';
import { ErrorBoundary } from './components/ErrorBoundary';

function App() {
  const { initializeIPC } = useDebateStore();
  const { initializeLoginListener } = useLoginStore();
  const { initializeBrowserListener } = useBrowserStore();

  useEffect(() => {
    // Initialize IPC listeners for debate, login, and browser view
    initializeIPC();
    initializeLoginListener();
    initializeBrowserListener();
    // Login status will be auto-checked by main process after BrowserViews load
  }, [initializeIPC, initializeLoginListener, initializeBrowserListener]);

  return (
    <ErrorBoundary>
      <MainLayout />
    </ErrorBoundary>
  );
}

export default App;
