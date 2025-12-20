import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Electron IPC
vi.mock('../lib/ipc', () => ({
  ipc: {
    send: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    invoke: vi.fn(),
  },
}));

// Mock window.electronAPI
Object.defineProperty(window, 'electronAPI', {
  value: {
    send: vi.fn(),
    on: vi.fn(() => () => {}),
    off: vi.fn(),
    invoke: vi.fn(),
    debate: {
      start: vi.fn(),
      cancel: vi.fn(),
      getStatus: vi.fn(),
    },
    login: {
      checkStatus: vi.fn(),
      openLoginWindow: vi.fn(),
      closeLoginWindow: vi.fn(),
    },
  },
  writable: true,
});
