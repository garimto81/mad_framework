import { useEffect } from 'react';
import { useDebateStore } from './stores/debate-store';
import { useLoginStore } from './stores/login-store';
import { MainLayout } from './layouts/MainLayout';

function App() {
  const { initializeIPC } = useDebateStore();
  const { initializeLoginListener } = useLoginStore();

  useEffect(() => {
    // Initialize IPC listeners for debate and login
    initializeIPC();
    initializeLoginListener();
    // Login status will be auto-checked by main process after BrowserViews load
  }, [initializeIPC, initializeLoginListener]);

  return <MainLayout />;
}

export default App;
