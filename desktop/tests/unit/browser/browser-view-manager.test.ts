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

// Mock BrowserView instance for tracking
const mockViewInstances: Map<string, any> = new Map();

// Mock Electron
vi.mock('electron', () => ({
  BrowserView: vi.fn().mockImplementation(() => {
    const mockView = {
      webContents: {
        loadURL: vi.fn(),
        executeJavaScript: vi.fn(),
        on: vi.fn(),
        getURL: vi.fn(),
      },
      setBounds: vi.fn(),
      destroy: vi.fn(),
    };
    return mockView;
  }),
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
    vi.clearAllMocks();
    mockMainWindow = {
      setBrowserView: vi.fn(),
      addBrowserView: vi.fn(),
      removeBrowserView: vi.fn(),
      getBrowserViews: vi.fn().mockReturnValue([]),
      getBounds: vi.fn().mockReturnValue({ x: 0, y: 0, width: 1200, height: 800 }),
    };
    manager = new BrowserViewManager(mockMainWindow);
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
    it('should set view bounds to visible area', () => {
      const view = manager.createView('chatgpt');
      const bounds = { x: 0, y: 100, width: 800, height: 600 };

      // Replace setBounds with spy after creation
      const setBoundsSpy = vi.fn();
      view.setBounds = setBoundsSpy;

      manager.showView('chatgpt', bounds);

      // Issue #10: 이제 setBounds로 view를 보이게 함 (setBrowserView 대신)
      expect(setBoundsSpy).toHaveBeenCalledWith(bounds);
    });
  });

  describe('hideAllViews', () => {
    it('should move views offscreen', () => {
      const view = manager.createView('chatgpt');

      // Replace setBounds with spy after creation
      const setBoundsSpy = vi.fn();
      view.setBounds = setBoundsSpy;

      manager.hideAllViews();

      // Issue #10: 이제 화면 밖으로 이동 (setBrowserView(null) 대신)
      expect(setBoundsSpy).toHaveBeenCalledWith({ x: -10000, y: -10000, width: 1920, height: 1080 });
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
