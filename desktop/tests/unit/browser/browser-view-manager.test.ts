/**
 * BrowserView Manager Tests
 *
 * TDD RED Phase: BrowserView 관리 테스트
 * - BrowserView 생성
 * - 로그인 상태 확인
 * - 토론 참여
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BrowserViewManager } from '../../../electron/browser/browser-view-manager';
import type { LLMProvider } from '../../../shared/types';

// Mock Electron
vi.mock('electron', () => ({
  BrowserView: vi.fn().mockImplementation(() => ({
    webContents: {
      loadURL: vi.fn(),
      executeJavaScript: vi.fn(),
      on: vi.fn(),
      getURL: vi.fn(),
    },
    setBounds: vi.fn(),
    destroy: vi.fn(),
  })),
  session: {
    fromPartition: vi.fn().mockReturnValue({
      clearStorageData: vi.fn(),
      clearCache: vi.fn(),
    }),
  },
}));

describe('BrowserViewManager', () => {
  let manager: BrowserViewManager;
  let mockMainWindow: any;

  beforeEach(() => {
    mockMainWindow = {
      setBrowserView: vi.fn(),
      getBounds: vi.fn().mockReturnValue({ x: 0, y: 0, width: 1200, height: 800 }),
    };
    manager = new BrowserViewManager(mockMainWindow);
    vi.clearAllMocks();
  });

  describe('createView', () => {
    it('should create BrowserView for chatgpt', () => {
      const view = manager.createView('chatgpt');

      expect(view).toBeDefined();
      expect(view.webContents).toBeDefined();
    });

    it('should create BrowserView for claude', () => {
      const view = manager.createView('claude');

      expect(view).toBeDefined();
      expect(view.webContents).toBeDefined();
    });

    it('should create BrowserView for gemini', () => {
      const view = manager.createView('gemini');

      expect(view).toBeDefined();
      expect(view.webContents).toBeDefined();
    });

    it('should create different views for each provider', () => {
      const chatgptView = manager.createView('chatgpt');
      const claudeView = manager.createView('claude');
      const geminiView = manager.createView('gemini');

      expect(chatgptView).toBeDefined();
      expect(claudeView).toBeDefined();
      expect(geminiView).toBeDefined();
    });
  });

  describe('getView', () => {
    it('should return existing view', () => {
      manager.createView('chatgpt');
      const view = manager.getView('chatgpt');

      expect(view).toBeDefined();
    });

    it('should return undefined for non-existent view', () => {
      const view = manager.getView('chatgpt');

      expect(view).toBeUndefined();
    });
  });

  describe('showView', () => {
    it('should set browser view on main window', () => {
      const view = manager.createView('chatgpt');
      const bounds = { x: 0, y: 100, width: 800, height: 600 };

      manager.showView('chatgpt', bounds);

      expect(mockMainWindow.setBrowserView).toHaveBeenCalled();
    });
  });

  describe('hideAllViews', () => {
    it('should remove browser view from main window', () => {
      manager.createView('chatgpt');
      manager.hideAllViews();

      expect(mockMainWindow.setBrowserView).toHaveBeenCalledWith(null);
    });
  });

  describe('destroyView', () => {
    it('should destroy specified view', () => {
      manager.createView('chatgpt');
      manager.destroyView('chatgpt');

      // View should no longer exist
      expect(manager.getView('chatgpt')).toBeUndefined();
    });

    it('should remove view from internal map', () => {
      manager.createView('chatgpt');
      manager.destroyView('chatgpt');

      expect(manager.getView('chatgpt')).toBeUndefined();
    });
  });

  describe('getAdapter', () => {
    it('should return correct adapter for chatgpt', () => {
      manager.createView('chatgpt');
      const adapter = manager.getAdapter('chatgpt');

      expect(adapter.provider).toBe('chatgpt');
    });

    it('should return correct adapter for claude', () => {
      manager.createView('claude');
      const adapter = manager.getAdapter('claude');

      expect(adapter.provider).toBe('claude');
    });

    it('should return correct adapter for gemini', () => {
      manager.createView('gemini');
      const adapter = manager.getAdapter('gemini');

      expect(adapter.provider).toBe('gemini');
    });
  });

  describe('checkLoginStatus', () => {
    it('should check login status for all providers', async () => {
      manager.createView('chatgpt');
      manager.createView('claude');
      manager.createView('gemini');

      const statuses = await manager.checkLoginStatus();

      expect(statuses).toHaveProperty('chatgpt');
      expect(statuses).toHaveProperty('claude');
      expect(statuses).toHaveProperty('gemini');
    });
  });
});
