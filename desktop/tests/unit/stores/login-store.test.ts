/**
 * Login Store Tests
 *
 * Zustand 로그인 상태 관리 테스트
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useLoginStore } from '../../../src/stores/login-store';

// Mock IPC module
vi.mock('../../../src/lib/ipc', () => ({
  ipc: {
    login: {
      checkStatus: vi.fn().mockResolvedValue({
        chatgpt: { provider: 'chatgpt', isLoggedIn: true, lastChecked: '2024-01-01T00:00:00Z' },
        claude: { provider: 'claude', isLoggedIn: false, lastChecked: '2024-01-01T00:00:00Z' },
        gemini: { provider: 'gemini', isLoggedIn: true, lastChecked: '2024-01-01T00:00:00Z' },
      }),
      openLoginWindow: vi.fn().mockResolvedValue({ success: true }),
      closeLoginWindow: vi.fn().mockResolvedValue({ success: true }),
    },
    onLoginStatusChanged: vi.fn(),
  },
}));

describe('useLoginStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useLoginStore.setState({
      status: {
        chatgpt: { provider: 'chatgpt', isLoggedIn: false, lastChecked: '' },
        claude: { provider: 'claude', isLoggedIn: false, lastChecked: '' },
        gemini: { provider: 'gemini', isLoggedIn: false, lastChecked: '' },
      },
      isChecking: false,
      activeLoginProvider: null,
    });
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = useLoginStore.getState();

      expect(state.isChecking).toBe(false);
      expect(state.activeLoginProvider).toBeNull();
      expect(state.status.chatgpt.isLoggedIn).toBe(false);
      expect(state.status.claude.isLoggedIn).toBe(false);
      expect(state.status.gemini.isLoggedIn).toBe(false);
    });
  });

  describe('checkLoginStatus', () => {
    it('should fetch and update login status', async () => {
      await useLoginStore.getState().checkLoginStatus();

      const state = useLoginStore.getState();
      expect(state.status.chatgpt.isLoggedIn).toBe(true);
      expect(state.status.claude.isLoggedIn).toBe(false);
      expect(state.status.gemini.isLoggedIn).toBe(true);
      expect(state.isChecking).toBe(false);
    });

    it('should set isChecking during check', async () => {
      const { ipc } = await import('../../../src/lib/ipc');
      vi.mocked(ipc.login.checkStatus).mockImplementation(() => {
        // Check that isChecking is true during the call
        expect(useLoginStore.getState().isChecking).toBe(true);
        return Promise.resolve({
          chatgpt: { provider: 'chatgpt', isLoggedIn: true, lastChecked: '' },
          claude: { provider: 'claude', isLoggedIn: true, lastChecked: '' },
          gemini: { provider: 'gemini', isLoggedIn: true, lastChecked: '' },
        });
      });

      await useLoginStore.getState().checkLoginStatus();
    });

    it('should handle check error', async () => {
      const { ipc } = await import('../../../src/lib/ipc');
      vi.mocked(ipc.login.checkStatus).mockRejectedValueOnce(new Error('Network error'));

      await useLoginStore.getState().checkLoginStatus();

      const state = useLoginStore.getState();
      expect(state.isChecking).toBe(false);
      // Status should remain unchanged on error
    });
  });

  describe('openLoginWindow', () => {
    it('should open login window and set active provider', async () => {
      await useLoginStore.getState().openLoginWindow('claude');

      const state = useLoginStore.getState();
      expect(state.activeLoginProvider).toBe('claude');
    });

    it('should call ipc.login.openLoginWindow', async () => {
      const { ipc } = await import('../../../src/lib/ipc');

      await useLoginStore.getState().openLoginWindow('chatgpt');

      expect(ipc.login.openLoginWindow).toHaveBeenCalledWith('chatgpt');
    });

    it('should handle open error gracefully', async () => {
      const { ipc } = await import('../../../src/lib/ipc');
      vi.mocked(ipc.login.openLoginWindow).mockRejectedValueOnce(new Error('Failed'));

      await useLoginStore.getState().openLoginWindow('gemini');

      // Should not throw
      const state = useLoginStore.getState();
      expect(state.activeLoginProvider).toBeNull();
    });
  });

  describe('closeLoginWindow', () => {
    it('should close login window and clear active provider', async () => {
      useLoginStore.setState({ activeLoginProvider: 'claude' });

      await useLoginStore.getState().closeLoginWindow();

      const state = useLoginStore.getState();
      expect(state.activeLoginProvider).toBeNull();
    });

    it('should refresh login status after closing', async () => {
      const { ipc } = await import('../../../src/lib/ipc');
      useLoginStore.setState({ activeLoginProvider: 'claude' });

      await useLoginStore.getState().closeLoginWindow();

      expect(ipc.login.checkStatus).toHaveBeenCalled();
    });

    it('should handle close error gracefully', async () => {
      const { ipc } = await import('../../../src/lib/ipc');
      vi.mocked(ipc.login.closeLoginWindow).mockRejectedValueOnce(new Error('Failed'));

      await useLoginStore.getState().closeLoginWindow();

      // Should not throw
    });
  });

  describe('updateStatus', () => {
    it('should update specific provider status', () => {
      useLoginStore.getState().updateStatus('claude', true);

      const state = useLoginStore.getState();
      expect(state.status.claude.isLoggedIn).toBe(true);
      expect(state.status.claude.lastChecked).not.toBe('');
      // Other providers unchanged
      expect(state.status.chatgpt.isLoggedIn).toBe(false);
      expect(state.status.gemini.isLoggedIn).toBe(false);
    });

    it('should set lastChecked timestamp', () => {
      const before = new Date().toISOString();
      useLoginStore.getState().updateStatus('chatgpt', true);
      const after = new Date().toISOString();

      const state = useLoginStore.getState();
      expect(state.status.chatgpt.lastChecked >= before).toBe(true);
      expect(state.status.chatgpt.lastChecked <= after).toBe(true);
    });

    it('should handle logout (isLoggedIn = false)', () => {
      // First set logged in
      useLoginStore.setState({
        status: {
          ...useLoginStore.getState().status,
          gemini: { provider: 'gemini', isLoggedIn: true, lastChecked: '' },
        },
      });

      // Then log out
      useLoginStore.getState().updateStatus('gemini', false);

      const state = useLoginStore.getState();
      expect(state.status.gemini.isLoggedIn).toBe(false);
    });
  });

  describe('initializeLoginListener', () => {
    it('should register listener for status changes', async () => {
      const { ipc } = await import('../../../src/lib/ipc');

      useLoginStore.getState().initializeLoginListener();

      expect(ipc.onLoginStatusChanged).toHaveBeenCalled();
    });
  });
});
